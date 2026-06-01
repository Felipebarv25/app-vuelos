// Utilidades para hablar con OpenStreetMap (gratis, sin API key):
// - Nominatim: geocodificar (nombre de ciudad -> coordenadas)
// - Overpass: traer lugares reales (atracciones, restaurantes, cafés...)

const NOMINATIM = "https://nominatim.openstreetmap.org";
const OVERPASS = "https://overpass-api.de/api/interpreter";

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

export async function geocodificar(consulta) {
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
}

// Trae lugares de una categoría alrededor de un punto.
export async function traerLugares(categoria, lat, lon, radio = 9000, limite = 40) {
  const cat = CATEGORIAS[categoria];
  if (!cat) throw new Error("Categoría desconocida");

  const cuerpoFiltros = cat.filtros
    .map((f) => `${f}(around:${radio},${lat},${lon});`)
    .join("\n");
  const query = `[out:json][timeout:25];(${cuerpoFiltros});out center ${limite * 3};`;

  const res = await fetch(OVERPASS, {
    method: "POST",
    body: "data=" + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error("No se pudieron cargar los lugares.");
  const datos = await res.json();

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
