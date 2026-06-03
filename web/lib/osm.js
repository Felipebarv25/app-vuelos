// Utilidades para hablar con OpenStreetMap (gratis, sin API key):
// - Nominatim: geocodificar (nombre de ciudad -> coordenadas)
// - Overpass: traer lugares reales (atracciones, restaurantes, cafés...)

const NOMINATIM = "https://nominatim.openstreetmap.org";

// Varios espejos de Overpass: si uno falla (saturado o rechaza), probamos el
// siguiente. Así la app no se cae por depender de un solo servidor.
const OVERPASS_MIRRORS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

// Consulta TODOS los espejos en paralelo y usa el PRIMERO que responde bien.
// Así no esperamos a que uno falle para probar el siguiente: la velocidad
// la marca el servidor más rápido en ese momento, no el más lento.
async function consultarOverpass(query) {
  const cuerpo = "data=" + encodeURIComponent(query);

  const intentos = OVERPASS_MIRRORS.map((url) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 12000);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cuerpo,
      signal: ctrl.signal,
    })
      .then(async (res) => {
        clearTimeout(id);
        if (!res.ok) throw new Error(`Overpass ${res.status}`);
        return res.json();
      })
      .catch((e) => {
        clearTimeout(id);
        throw e;
      });
  });

  // Gana la PRIMERA respuesta con datos reales; si todas vienen vacías,
  // devolvemos la vacía en vez de fallar.
  return new Promise((resolve, reject) => {
    let pendientes = intentos.length;
    let ultimoError;
    let vacio = null;
    intentos.forEach((p) =>
      p
        .then((data) => {
          if ((data?.elements?.length || 0) > 0) resolve(data);
          else {
            vacio = data;
            if (--pendientes === 0) resolve(vacio || { elements: [] });
          }
        })
        .catch((e) => {
          ultimoError = e;
          if (--pendientes === 0) {
            if (vacio) resolve(vacio);
            else reject(ultimoError || new Error("No se pudieron cargar los lugares."));
          }
        })
    );
  });
}

// Categorías de lugares que sabemos pedir a Overpass.
// Cada una mapea a filtros de OpenStreetMap.
export const CATEGORIAS = {
  imperdibles: {
    nombre: "Imperdibles",
    icono: "⭐",
    filtros: [
      'node["tourism"~"attraction|museum|viewpoint|gallery|artwork"]["name"]',
      'node["historic"~"monument|memorial|castle|ruins|monastery|archaeological_site"]["name"]',
      'way["tourism"~"attraction|museum"]["name"]',
    ],
  },
  museos: {
    nombre: "Museos",
    icono: "🖼️",
    filtros: [
      'node["tourism"~"museum|gallery"]["name"]',
      'way["tourism"~"museum|gallery"]["name"]',
    ],
  },
  monumentos: {
    nombre: "Monumentos",
    icono: "🏛️",
    filtros: [
      'node["tourism"="attraction"]["name"]',
      'node["historic"~"monument|memorial|castle|ruins|monastery|archaeological_site|palace|fort"]["name"]',
      'way["historic"~"castle|palace|fort|monastery|monument"]["name"]',
    ],
  },
  parques: {
    nombre: "Parques",
    icono: "🌳",
    filtros: [
      'node["leisure"~"park|garden"]["name"]',
      'way["leisure"~"park|garden"]["name"]',
      'node["tourism"="theme_park"]["name"]',
      'way["tourism"="theme_park"]["name"]',
    ],
  },
  estadios: {
    nombre: "Estadios",
    icono: "🏟️",
    filtros: [
      'node["leisure"="stadium"]["name"]',
      'way["leisure"="stadium"]["name"]',
      'way["building"="stadium"]["name"]',
    ],
  },
  restaurantes: {
    nombre: "Restaurantes",
    icono: "🍽️",
    filtros: ['node["amenity"="restaurant"]["name"]'],
  },
  cafes: {
    nombre: "Cafés",
    icono: "☕",
    filtros: ['node["amenity"~"cafe|coffee_shop"]["name"]'],
  },
  bares: {
    nombre: "Bares / Noche",
    icono: "🍸",
    filtros: ['node["amenity"~"bar|pub|nightclub"]["name"]'],
  },
  miradores: {
    nombre: "Miradores",
    icono: "🌅",
    filtros: ['node["tourism"="viewpoint"]["name"]'],
  },
};

// Traduce etiquetas de OSM a categorías legibles en español.
const ETIQUETAS = {
  attraction: "Atracción",
  museum: "Museo",
  viewpoint: "Mirador",
  gallery: "Galería",
  artwork: "Arte público",
  monument: "Monumento",
  memorial: "Memorial",
  castle: "Castillo",
  ruins: "Ruinas",
  monastery: "Monasterio",
  archaeological_site: "Sitio arqueológico",
  palace: "Palacio",
  fort: "Fortaleza",
  place_of_worship: "Templo",
  theme_park: "Parque temático",
  zoo: "Zoológico",
  aquarium: "Acuario",
  restaurant: "Restaurante",
  cafe: "Café",
  coffee_shop: "Café",
  bar: "Bar",
  pub: "Pub",
  nightclub: "Discoteca",
};

import { cacheado, fetchRapido } from "./cache";
import { distanciaMetros } from "./rutas";
import { PRECALC } from "./precalcIndex";

// ¿La ciudad (lat/lon) tiene lugares precalculados? Devuelve el slug del JSON
// estático si hay una ciudad precalculada a menos de ~25 km. Así las ciudades
// top abren al instante y con calidad fija (sin depender de APIs en vivo).
function ciudadPrecalc(lat, lon) {
  let mejor = null;
  let md = Infinity;
  for (const c of PRECALC) {
    const d = Math.hypot(c.lat - lat, c.lon - lon);
    if (d < md) {
      md = d;
      mejor = c;
    }
  }
  return mejor && md < 0.25 ? mejor : null; // ~25 km
}

const TTL_CIUDAD = 1000 * 60 * 60 * 24 * 7; // 7 días
const TTL_LUGARES = 1000 * 60 * 60 * 12; // 12 horas

export async function geocodificar(consulta) {
  return cacheado(`geo:${consulta.toLowerCase()}`, TTL_CIUDAD, async () => {
    const url = `${NOMINATIM}/search?format=json&limit=1&accept-language=es&q=${encodeURIComponent(
      consulta
    )}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("No se pudo buscar la ciudad.");
    const datos = await res.json();
    if (!datos.length) throw new Error("No encontré esa ciudad. Revisa el nombre.");
    const d = datos[0];
    const partes = d.display_name.split(",").map((s) => s.trim());
    return {
      nombre: partes[0],
      pais: partes[partes.length - 1],
      etiquetaCompleta: d.display_name,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
    };
  });
}

// Trae lugares de una categoría alrededor de un punto (con caché).
// v25: ciudades TOP servidas desde precálculo estático (WDQS) → instantáneo y con
// los íconos garantizados (Eiffel, Sagrada Familia, Coliseo…). El motor en vivo
// queda como respaldo liviano para ciudades no precalculadas. Invalida cachés.
const API_VER = "25";

// Radio por categoría: atractivos turísticos pueden estar lejos de la ciudad
// (excursiones de un día); comida/cafés/bares se buscan cerca.
const RADIO_POR_CAT = {
  imperdibles: 90000,
  miradores: 90000,
  museos: 25000,
  monumentos: 25000,
  parques: 25000,
  estadios: 25000,
  restaurantes: 15000,
  cafes: 12000,
  bares: 15000,
};

export async function traerLugares(categoria, lat, lon, radio, limite = 60) {
  const cat = CATEGORIAS[categoria];
  if (!cat) throw new Error("Categoría desconocida");
  const r = radio || RADIO_POR_CAT[categoria] || 12000;
  const clave = `lug${API_VER}:${categoria}:${lat.toFixed(3)},${lon.toFixed(3)}`;
  return cacheado(
    clave,
    TTL_LUGARES,
    async () => {
      // ATAJO: ciudades top precalculadas (solo "imperdibles", la vista por
      // defecto) → JSON estático del CDN: instantáneo y con calidad garantizada
      // (Torre Eiffel, Sacré-Cœur, etc. siempre). El resto sigue en vivo.
      if (categoria === "imperdibles") {
        const pc = ciudadPrecalc(lat, lon);
        if (pc) {
          try {
            const res = await fetchRapido(`/lugares/${pc.s}.json`, {}, 6000);
            if (res.ok) {
              const datos = await res.json();
              const lista = procesarElementos(datos, categoria, lat, lon, limite, cat.nombre, true);
              if (lista.length > 0) return lista;
            }
          } catch {}
        }
      }
      return traerLugaresRed(cat, categoria, lat, lon, r, limite);
    },
    // No cachear resultados vacíos: si una vez no llegó nada (red lenta), que
    // se reintente la próxima en vez de quedar la ciudad vacía 12 horas.
    (d) => Array.isArray(d) && d.length > 0
  );
}

async function traerLugaresRed(cat, categoria, lat, lon, radio, limite) {
  let datos;

  // 1) Pedir a nuestra API (cacheada en el edge de Vercel).
  if (!datos) {
    try {
      // 16s: el servidor responde en ~13s como mucho; esperamos un poco más para
      // que el resultado SÍ alcance a llegar y guardarse en caché (antes 14s
      // abortaba antes de tiempo y la ciudad fallaba sin cachear nada).
      const r = await fetchRapido(
        `/api/lugares?cat=${categoria}&lat=${lat}&lon=${lon}&radio=${radio}&v=${API_VER}`,
        {},
        16000
      );
      if (r.ok) datos = await r.json();
    } catch {}
  }

  // 2) Respaldo: ir directo a los espejos de Overpass.
  if (!datos || datos.error || !datos.elements) {
    const cuerpoFiltros = cat.filtros
      .map((f) => `${f}(around:${radio},${lat},${lon});`)
      .join("\n");
    const query = `[out:json][timeout:10];(${cuerpoFiltros});out center ${limite + 10};`;
    datos = await consultarOverpass(query);
  }

  return procesarElementos(datos, categoria, lat, lon, limite, cat.nombre);
}

// Convierte los elementos crudos (de la API/Overpass en vivo O del JSON
// precalculado) en la lista final de lugares: descarta basura, puntúa, ordena y
// aplica la regla anti-zigzag. Compartido por ambos modos.
function procesarElementos(datos, categoria, lat, lon, limite, catNombre, precalc = false) {
  const vistos = new Set();
  const lugares = [];
  for (const el of datos.elements || []) {
    const t = el.tags || {};
    const nombre = t.name;
    if (!nombre || vistos.has(nombre) || nombreBasura(nombre)) continue;
    if (esRuido(nombre, !!(t.wikidata || t.wikipedia))) continue;
    vistos.add(nombre);

    const coord = el.lat
      ? [el.lat, el.lon]
      : el.center
      ? [el.center.lat, el.center.lon]
      : null;
    if (!coord) continue;

    const tipoRaw =
      t.tourism || t.historic || t.amenity || "";
    const cocina = t.cuisine ? t.cuisine.split(";")[0].replace(/_/g, " ") : null;

    // PUNTUACIÓN DE CALIDAD: para priorizar lugares famosos/bien establecidos
    // sobre los "corrientes". OSM no tiene rating, así que usamos señales.
    // Wikipedia/Wikidata pesan MUCHO: son la mejor señal de "lugar icónico".
    let score = 0;
    if (t.wikipedia) score += 30;     // artículo en Wikipedia = FAMOSO de verdad
    if (t.wikidata) score += 10;      // wikidata = relevante (pero menos que wiki)
    if (t.heritage || t["heritage:operator"]) score += 12; // patrimonio mundial
    if (t.tourism === "museum") score += 10;
    if (t.tourism === "attraction") score += 8;
    if (t.historic === "castle" || t.historic === "palace" || t.historic === "fort") score += 8;
    if (t.tourism === "viewpoint") score += 4;
    if (t.image || t.wikimedia_commons) score += 5; // tiene foto = documentado
    if (t.website || t["contact:website"]) score += 2;
    if (t.opening_hours) score += 1;
    if (t.stars) score += 3;
    // Penalizar fuerte estatuas/monumentos menores (aunque tengan wikidata).
    if (/^\s*(monumento|estatua|busto|placa|fuente|memorial)\s*$/i.test(nombre)) score -= 30;
    if (/^\s*(monumento a|estatua de|busto de|monument |monumento di|statue of|memorial)\b/i.test(nombre)) score -= 20;
    if (t.historic === "memorial" || t.tourism === "artwork") score -= 15;
    if (/^\s*(pizza|burger|pollo|comida|tienda|bar el|cafe el)\b/i.test(nombre)) score -= 4;
    // POPULARIDAD real que añade el servidor (Amadeus POI + sitelinks Wikidata).
    if (el.pop) score += el.pop;

    lugares.push({
      id: `${el.type}/${el.id}`,
      nombre,
      categoria: ETIQUETAS[tipoRaw] || catNombre,
      coord,
      notable: !!(t.wikidata || t.wikipedia),
      wiki: !!t.wikipedia,
      score,
      cocina,
      minutos: sugerirMinutos(categoria, tipoRaw),
    });
  }

  // Ordenar por calidad (score), los mejores primero.
  lugares.sort((a, b) => b.score - a.score);

  // Datos precalculados: ya están curados (famosos y dentro del radio de la
  // ciudad), así que NO les aplicamos la regla anti-zigzag (evita descartar por
  // error íconos algo alejados, p. ej. Versalles).
  if (precalc) return lugares.slice(0, limite);

  // REGLA ANTI-ZIGZAG: los lugares cercanos al centro siempre entran; las
  // excursiones lejanas (>25 km) SOLO si son famosas (Wikipedia) y como máximo
  // las 2 mejor puntuadas. Así una excursión icónica (p. ej. Guatapé) aparece,
  // pero picos/monumentos remotos sin relevancia no dispersan la ruta.
  const CERCA = 25000;
  const LEJOS = 100000;
  const centro = [lat, lon];
  let lejanos = 0;
  const filtrados = [];
  for (const l of lugares) {
    const d = distanciaMetros(centro, l.coord);
    if (d <= CERCA) {
      filtrados.push(l);
    } else if (d <= LEJOS && l.wiki && lejanos < 2) {
      filtrados.push(l);
      lejanos++;
    }
  }

  // Nota: NO descartamos los lugares de menor puntaje (eso dejaba ciudades con
  // muy pocos lugares). Ya quitamos los nombres basura (nombreBasura) y el orden
  // por calidad pone los notables arriba; el relleno válido queda disponible para
  // tener variedad suficiente.
  return filtrados.slice(0, limite);
}

// Nombres genéricos/sin valor (solo el tipo, sin nombre propio) que no aportan.
const NOMBRES_GENERICOS = new Set([
  "park", "palace", "square", "plaza", "square plaza", "garden", "museum",
  "monument", "memorial", "building", "tower", "church", "castle", "fountain",
  "parque", "plaza mayor", "iglesia", "museo", "mirador", "monumento",
  "catedral", "fuente", "capilla", "templo", "rooftop", "bar", "café", "cafe",
]);
const TIPOS_OSM = [
  "museum", "attraction", "viewpoint", "monument", "memorial", "artwork",
  "park", "square", "garden", "theme_park", "zoo", "aquarium", "castle",
];
// ¿El nombre es basura? (genérico, demasiado corto o artefacto de Photon como
// "museum Pablo Escobar" —tipo OSM en minúscula al inicio—).
function nombreBasura(nombre) {
  const n = (nombre || "").trim();
  if (n.length < 3) return true;
  const low = n.toLowerCase();
  if (NOMBRES_GENERICOS.has(low)) return true;
  const prim = n.split(/\s+/)[0];
  if (prim === prim.toLowerCase() && TIPOS_OSM.includes(prim)) return true;
  return false;
}

// Ruido que NO es atractivo turístico: alojamientos (hoteles/hostales),
// hoteles tipo "Park 10", y monumentos MENORES (sin ficha en Wikidata/Wikipedia,
// que en OSM abundan: "Monumento a la X"). Los monumentos famosos (con wikidata)
// se conservan.
function esRuido(nombre, notable) {
  const n = nombre || "";
  if (/\b(hotel|hostal|hostel|motel|lodge|inn|hospedaje|apartament|aparta|suites?|s\.?a\.?s)\b/i.test(n)) return true;
  if (/^park\s*\d/i.test(n)) return true;
  if (/^monumento\s+(a|al|a la|a los|a las)\s+/i.test(n) && !notable) return true;
  return false;
}

function sugerirMinutos(categoria, tipo) {
  if (categoria === "restaurantes") return 75;
  if (categoria === "cafes") return 30;
  if (categoria === "bares") return 90;
  if (categoria === "museos") return 120;
  if (categoria === "parques") return 45;
  if (categoria === "estadios") return 75;
  if (categoria === "monumentos") return 45;
  if (tipo === "museum" || tipo === "gallery") return 120;
  if (tipo === "viewpoint") return 30;
  if (tipo === "castle" || tipo === "archaeological_site") return 90;
  return 60;
}
