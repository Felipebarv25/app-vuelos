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
  restaurant: "Restaurante",
  cafe: "Café",
  coffee_shop: "Café",
  bar: "Bar",
  pub: "Pub",
  nightclub: "Discoteca",
};

import { cacheado, fetchRapido } from "./cache";

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
// radio menor + límite ajustado = consulta más liviana y rápida.
// v3: versión de la API/caché. Subirla invalida cachés viejas (cliente y edge).
const API_VER = "3";

export async function traerLugares(categoria, lat, lon, radio = 8000, limite = 40) {
  const cat = CATEGORIAS[categoria];
  if (!cat) throw new Error("Categoría desconocida");
  const clave = `lug${API_VER}:${categoria}:${lat.toFixed(3)},${lon.toFixed(3)}`;
  return cacheado(clave, TTL_LUGARES, () =>
    traerLugaresRed(cat, categoria, lat, lon, radio, limite)
  );
}

async function traerLugaresRed(cat, categoria, lat, lon, radio, limite) {
  let datos;
  // 1) Intentar nuestra API cacheada en el edge de Vercel (muy rápida en repeticiones).
  try {
    const r = await fetchRapido(
      `/api/lugares?cat=${categoria}&lat=${lat}&lon=${lon}&radio=${radio}&v=${API_VER}`,
      {},
      14000
    );
    if (r.ok) datos = await r.json();
  } catch {}

  // 2) Respaldo: ir directo a los espejos de Overpass.
  if (!datos || datos.error || !datos.elements) {
    const cuerpoFiltros = cat.filtros
      .map((f) => `${f}(around:${radio},${lat},${lon});`)
      .join("\n");
    const query = `[out:json][timeout:10];(${cuerpoFiltros});out center ${limite + 10};`;
    datos = await consultarOverpass(query);
  }

  const vistos = new Set();
  const lugares = [];
  for (const el of datos.elements || []) {
    const t = el.tags || {};
    const nombre = t.name;
    if (!nombre || vistos.has(nombre)) continue;
    vistos.add(nombre);

    const coord = el.lat
      ? [el.lat, el.lon]
      : el.center
      ? [el.center.lat, el.center.lon]
      : null;
    if (!coord) continue;

    const tipoRaw =
      t.tourism || t.historic || t.amenity || "";
    const notable = !!(t.wikidata || t.wikipedia);
    const cocina = t.cuisine ? t.cuisine.split(";")[0].replace(/_/g, " ") : null;

    lugares.push({
      id: `${el.type}/${el.id}`,
      nombre,
      categoria: ETIQUETAS[tipoRaw] || cat.nombre,
      coord,
      notable,
      cocina,
      // Minutos sugeridos de visita según el tipo (heurística sensata)
      minutos: sugerirMinutos(categoria, tipoRaw),
    });
  }

  // Priorizar lugares notables (con Wikipedia/Wikidata)
  lugares.sort((a, b) => (b.notable ? 1 : 0) - (a.notable ? 1 : 0));
  return lugares.slice(0, limite);
}

function sugerirMinutos(categoria, tipo) {
  if (categoria === "restaurantes") return 75;
  if (categoria === "cafes") return 30;
  if (categoria === "bares") return 90;
  if (tipo === "museum" || tipo === "gallery") return 120;
  if (tipo === "viewpoint") return 30;
  if (tipo === "castle" || tipo === "archaeological_site") return 90;
  return 60;
}
