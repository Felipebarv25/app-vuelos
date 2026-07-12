// Precalcula los "imperdibles" de las ciudades conocidas y los guarda como JSON
// estático en public/lugares/<slug>.json (se sirven desde el CDN en <100ms, así
// esas ciudades abren en menos de 2s sin esperar a Overpass en vivo).
// También genera lib/precalcIndex.js (índice liviano que se empaqueta en el cliente).
//
// Uso:  node scripts/precomputar-lugares.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");

// Ciudades EXTRA a precalcular además de las de presupuesto: prioridad para el
// público colombiano/latino + grandes destinos que faltaban. No afectan el
// módulo de presupuesto (solo se precalculan sus lugares).
const CIUDADES_EXTRA = [
  // Colombia (nuestro público principal)
  { ciudad: "Medellín", pais: "Colombia", lat: 6.2442, lon: -75.5812 },
  { ciudad: "Bogotá", pais: "Colombia", lat: 4.711, lon: -74.0721 },
  { ciudad: "Cartagena", pais: "Colombia", lat: 10.391, lon: -75.4794 },
  { ciudad: "Cali", pais: "Colombia", lat: 3.4516, lon: -76.532 },
  { ciudad: "Santa Marta", pais: "Colombia", lat: 11.2408, lon: -74.199 },
  { ciudad: "Barranquilla", pais: "Colombia", lat: 10.9685, lon: -74.7813 },
  { ciudad: "Pereira", pais: "Colombia", lat: 4.8133, lon: -75.6961 },
  { ciudad: "Bucaramanga", pais: "Colombia", lat: 7.1193, lon: -73.1227 },
  { ciudad: "Manizales", pais: "Colombia", lat: 5.0703, lon: -75.5138 },
  { ciudad: "Villa de Leyva", pais: "Colombia", lat: 5.6325, lon: -73.5247 },
  { ciudad: "San Andrés", pais: "Colombia", lat: 12.5847, lon: -81.7006 },
  { ciudad: "Popayán", pais: "Colombia", lat: 2.4448, lon: -76.6147 },
  // Grandes destinos del mundo que faltaban
  { ciudad: "Estambul", pais: "Turquía", lat: 41.0082, lon: 28.9784 },
  { ciudad: "El Cairo", pais: "Egipto", lat: 30.0444, lon: 31.2357 },
  { ciudad: "Hong Kong", pais: "Hong Kong", lat: 22.3193, lon: 114.1694 },
  { ciudad: "Seúl", pais: "Corea del Sur", lat: 37.5665, lon: 126.978 },
  { ciudad: "Berlín", pais: "Alemania", lat: 52.52, lon: 13.405 },
  { ciudad: "Praga", pais: "Chequia", lat: 50.0755, lon: 14.4378 },
  // ==== EXPANSION 2026-07-11 ("tenemos que dominar"): ~80 ciudades
  // secundarias de alto valor turistico. Coordenadas = centro urbano. ====
  // Colombia profunda
  { ciudad: "Guatapé", pais: "Colombia", lat: 6.2326, lon: -75.1592 },
  { ciudad: "Salento", pais: "Colombia", lat: 4.6372, lon: -75.5703 },
  { ciudad: "Leticia", pais: "Colombia", lat: -4.2153, lon: -69.9406 },
  { ciudad: "Barichara", pais: "Colombia", lat: 6.6349, lon: -73.2228 },
  { ciudad: "Mompox", pais: "Colombia", lat: 9.2422, lon: -74.4261 },
  // LatAm secundaria
  { ciudad: "Oaxaca", pais: "México", lat: 17.0732, lon: -96.7266 },
  { ciudad: "Mérida", pais: "México", lat: 20.9674, lon: -89.5926 },
  { ciudad: "San Miguel de Allende", pais: "México", lat: 20.9144, lon: -100.7452 },
  { ciudad: "Puerto Vallarta", pais: "México", lat: 20.6534, lon: -105.2253 },
  { ciudad: "Tulum", pais: "México", lat: 20.2114, lon: -87.4654 },
  { ciudad: "Guanajuato", pais: "México", lat: 21.019, lon: -101.2574 },
  { ciudad: "Trujillo", pais: "Perú", lat: -8.1091, lon: -79.0215 },
  { ciudad: "Iquitos", pais: "Perú", lat: -3.7437, lon: -73.2516 },
  { ciudad: "Paracas", pais: "Perú", lat: -13.8351, lon: -76.2503 },
  { ciudad: "Salta", pais: "Argentina", lat: -24.7821, lon: -65.4232 },
  { ciudad: "Ushuaia", pais: "Argentina", lat: -54.8019, lon: -68.303 },
  { ciudad: "Córdoba", pais: "Argentina", lat: -31.4201, lon: -64.1888 },
  { ciudad: "Valparaíso", pais: "Chile", lat: -33.0472, lon: -71.6127 },
  { ciudad: "San Pedro de Atacama", pais: "Chile", lat: -22.9098, lon: -68.2003 },
  { ciudad: "Puerto Varas", pais: "Chile", lat: -41.3195, lon: -72.9854 },
  { ciudad: "Salvador", pais: "Brasil", lat: -12.9777, lon: -38.5016 },
  { ciudad: "Recife", pais: "Brasil", lat: -8.0476, lon: -34.877 },
  { ciudad: "Fortaleza", pais: "Brasil", lat: -3.7319, lon: -38.5267 },
  { ciudad: "Foz do Iguaçu", pais: "Brasil", lat: -25.5478, lon: -54.5882 },
  { ciudad: "Manaos", pais: "Brasil", lat: -3.119, lon: -60.0217 },
  { ciudad: "Cuenca", pais: "Ecuador", lat: -2.9001, lon: -79.0059 },
  { ciudad: "Baños", pais: "Ecuador", lat: -1.3928, lon: -78.4269 },
  { ciudad: "Uyuni", pais: "Bolivia", lat: -20.4597, lon: -66.8249 },
  { ciudad: "Sucre", pais: "Bolivia", lat: -19.0196, lon: -65.262 },
  { ciudad: "Santo Domingo", pais: "República Dominicana", lat: 18.4861, lon: -69.9312 },
  { ciudad: "San Juan", pais: "Puerto Rico", lat: 18.4655, lon: -66.1057 },
  { ciudad: "Montego Bay", pais: "Jamaica", lat: 18.4762, lon: -77.8939 },
  { ciudad: "Oranjestad", pais: "Aruba", lat: 12.5211, lon: -70.0349 },
  { ciudad: "Willemstad", pais: "Curazao", lat: 12.1091, lon: -68.9316 },
  // Europa secundaria
  { ciudad: "Granada", pais: "España", lat: 37.1773, lon: -3.5986 },
  { ciudad: "Bilbao", pais: "España", lat: 43.263, lon: -2.935 },
  { ciudad: "San Sebastián", pais: "España", lat: 43.3183, lon: -1.9812 },
  { ciudad: "Toledo", pais: "España", lat: 39.8628, lon: -4.0273 },
  { ciudad: "Córdoba", pais: "España", lat: 37.8882, lon: -4.7794 },
  { ciudad: "Palma de Mallorca", pais: "España", lat: 39.5696, lon: 2.6502 },
  { ciudad: "Brujas", pais: "Bélgica", lat: 51.2093, lon: 3.2247 },
  { ciudad: "Gante", pais: "Bélgica", lat: 51.0543, lon: 3.7174 },
  { ciudad: "Lyon", pais: "Francia", lat: 45.764, lon: 4.8357 },
  { ciudad: "Marsella", pais: "Francia", lat: 43.2965, lon: 5.3698 },
  { ciudad: "Burdeos", pais: "Francia", lat: 44.8378, lon: -0.5792 },
  { ciudad: "Estrasburgo", pais: "Francia", lat: 48.5734, lon: 7.7521 },
  { ciudad: "Turín", pais: "Italia", lat: 45.0703, lon: 7.6869 },
  { ciudad: "Bolonia", pais: "Italia", lat: 44.4949, lon: 11.3426 },
  { ciudad: "Verona", pais: "Italia", lat: 45.4384, lon: 10.9916 },
  { ciudad: "Palermo", pais: "Italia", lat: 38.1157, lon: 13.3615 },
  { ciudad: "Santorini", pais: "Grecia", lat: 36.3932, lon: 25.4615 },
  { ciudad: "Mykonos", pais: "Grecia", lat: 37.4467, lon: 25.3289 },
  { ciudad: "Heraclión", pais: "Grecia", lat: 35.3387, lon: 25.1442 },
  { ciudad: "Dubrovnik", pais: "Croacia", lat: 42.6507, lon: 18.0944 },
  { ciudad: "Split", pais: "Croacia", lat: 43.5081, lon: 16.4402 },
  { ciudad: "Liubliana", pais: "Eslovenia", lat: 46.0569, lon: 14.5058 },
  { ciudad: "Cracovia", pais: "Polonia", lat: 50.0647, lon: 19.945 },
  { ciudad: "Gdansk", pais: "Polonia", lat: 54.352, lon: 18.6466 },
  { ciudad: "Salzburgo", pais: "Austria", lat: 47.8095, lon: 13.055 },
  { ciudad: "Innsbruck", pais: "Austria", lat: 47.2692, lon: 11.4041 },
  { ciudad: "Hamburgo", pais: "Alemania", lat: 53.5511, lon: 9.9937 },
  { ciudad: "Colonia", pais: "Alemania", lat: 50.9375, lon: 6.9603 },
  { ciudad: "Dresde", pais: "Alemania", lat: 51.0504, lon: 13.7373 },
  { ciudad: "Rotterdam", pais: "Países Bajos", lat: 51.9244, lon: 4.4777 },
  { ciudad: "Oxford", pais: "Reino Unido", lat: 51.7548, lon: -1.2544 },
  { ciudad: "Cambridge", pais: "Reino Unido", lat: 52.2053, lon: 0.1218 },
  { ciudad: "Liverpool", pais: "Reino Unido", lat: 53.4084, lon: -2.9916 },
  { ciudad: "Glasgow", pais: "Reino Unido", lat: 55.8642, lon: -4.2518 },
  { ciudad: "Ginebra", pais: "Suiza", lat: 46.2044, lon: 6.1432 },
  { ciudad: "Lucerna", pais: "Suiza", lat: 47.0502, lon: 8.3093 },
  { ciudad: "Interlaken", pais: "Suiza", lat: 46.6863, lon: 7.8632 },
  { ciudad: "Reikiavik", pais: "Islandia", lat: 64.1466, lon: -21.9426 },
  { ciudad: "Helsinki", pais: "Finlandia", lat: 60.1699, lon: 24.9384 },
  { ciudad: "Oslo", pais: "Noruega", lat: 59.9139, lon: 10.7522 },
  { ciudad: "Bergen", pais: "Noruega", lat: 60.3913, lon: 5.3221 },
  { ciudad: "Tallin", pais: "Estonia", lat: 59.437, lon: 24.7536 },
  { ciudad: "Riga", pais: "Letonia", lat: 56.9496, lon: 24.1052 },
  // Asia
  { ciudad: "Nara", pais: "Japón", lat: 34.6851, lon: 135.8048 },
  { ciudad: "Hiroshima", pais: "Japón", lat: 34.3853, lon: 132.4553 },
  { ciudad: "Sapporo", pais: "Japón", lat: 43.0618, lon: 141.3545 },
  { ciudad: "Busán", pais: "Corea del Sur", lat: 35.1796, lon: 129.0756 },
  { ciudad: "Chiang Mai", pais: "Tailandia", lat: 18.7883, lon: 98.9853 },
  { ciudad: "Krabi", pais: "Tailandia", lat: 8.0863, lon: 98.9063 },
  { ciudad: "Hanói", pais: "Vietnam", lat: 21.0278, lon: 105.8342 },
  { ciudad: "Ho Chi Minh", pais: "Vietnam", lat: 10.8231, lon: 106.6297 },
  { ciudad: "Da Nang", pais: "Vietnam", lat: 16.0544, lon: 108.2022 },
  { ciudad: "Siem Reap", pais: "Camboya", lat: 13.3671, lon: 103.8448 },
  { ciudad: "Kuala Lumpur", pais: "Malasia", lat: 3.139, lon: 101.6869 },
  { ciudad: "Manila", pais: "Filipinas", lat: 14.5995, lon: 120.9842 },
  { ciudad: "Cebú", pais: "Filipinas", lat: 10.3157, lon: 123.8854 },
  { ciudad: "Taipéi", pais: "Taiwán", lat: 25.033, lon: 121.5654 },
  { ciudad: "Katmandú", pais: "Nepal", lat: 27.7172, lon: 85.324 },
  { ciudad: "Nueva Delhi", pais: "India", lat: 28.6139, lon: 77.209 },
  { ciudad: "Agra", pais: "India", lat: 27.1767, lon: 78.0081 },
  { ciudad: "Jaipur", pais: "India", lat: 26.9124, lon: 75.7873 },
  { ciudad: "Colombo", pais: "Sri Lanka", lat: 6.9271, lon: 79.8612 },
  // Medio Oriente y Africa
  { ciudad: "Tel Aviv", pais: "Israel", lat: 32.0853, lon: 34.7818 },
  { ciudad: "Jerusalén", pais: "Israel", lat: 31.7683, lon: 35.2137 },
  { ciudad: "Amán", pais: "Jordania", lat: 31.9539, lon: 35.9106 },
  { ciudad: "Doha", pais: "Catar", lat: 25.2854, lon: 51.531 },
  { ciudad: "Mascate", pais: "Omán", lat: 23.588, lon: 58.3829 },
  { ciudad: "Casablanca", pais: "Marruecos", lat: 33.5731, lon: -7.5898 },
  { ciudad: "Fez", pais: "Marruecos", lat: 34.0181, lon: -5.0078 },
  { ciudad: "Túnez", pais: "Túnez", lat: 36.8065, lon: 10.1815 },
  { ciudad: "Nairobi", pais: "Kenia", lat: -1.2921, lon: 36.8219 },
  { ciudad: "Zanzíbar", pais: "Tanzania", lat: -6.1659, lon: 39.2026 },
  { ciudad: "Johannesburgo", pais: "Sudáfrica", lat: -26.2041, lon: 28.0473 },
  // Norteamérica
  { ciudad: "Boston", pais: "Estados Unidos", lat: 42.3601, lon: -71.0589 },
  { ciudad: "Washington", pais: "Estados Unidos", lat: 38.9072, lon: -77.0369 },
  { ciudad: "Seattle", pais: "Estados Unidos", lat: 47.6062, lon: -122.3321 },
  { ciudad: "Nueva Orleans", pais: "Estados Unidos", lat: 29.9511, lon: -90.0715 },
  { ciudad: "Honolulu", pais: "Estados Unidos", lat: 21.3069, lon: -157.8583 },
  { ciudad: "Vancouver", pais: "Canadá", lat: 49.2827, lon: -123.1207 },
  { ciudad: "Quebec", pais: "Canadá", lat: 46.8139, lon: -71.208 },
  // Oceanía
  { ciudad: "Brisbane", pais: "Australia", lat: -27.4698, lon: 153.0251 },
  { ciudad: "Perth", pais: "Australia", lat: -31.9505, lon: 115.8605 },
  { ciudad: "Cairns", pais: "Australia", lat: -16.9186, lon: 145.7781 },
  { ciudad: "Queenstown", pais: "Nueva Zelanda", lat: -45.0312, lon: 168.6626 },
  { ciudad: "Wellington", pais: "Nueva Zelanda", lat: -41.2866, lon: 174.7756 },
];

// --- 1) Cargar la lista de ciudades desde lib/presupuesto.js (sin importar:
//        el archivo usa sintaxis ESM y aquí lo leemos como texto y lo evaluamos).
function cargarCiudades() {
  const txt = readFileSync(join(RAIZ, "lib", "presupuesto.js"), "utf8");
  const ini = txt.indexOf("export const DESTINOS_PRESUPUESTO = [");
  const desde = txt.indexOf("[", ini);
  const hasta = txt.indexOf("];", desde);
  const arrTxt = txt.slice(desde, hasta + 1);
  // eslint-disable-next-line no-eval
  const arr = eval(arrTxt);
  const todas = [...arr, ...CIUDADES_EXTRA].filter((c) => c.lat != null && c.lon != null);
  // Quitar duplicados por slug (p. ej. Berlín/Praga estaban en ambas listas).
  const vistos = new Set();
  return todas.filter((c) => {
    const s = slug(c.ciudad, c.pais);
    if (vistos.has(s)) return false;
    vistos.add(s);
    return true;
  });
}

function slug(ciudad, pais) {
  return `${ciudad}-${pais}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// --- 2) Fuente: Wikidata Query Service (WDQS). En UNA consulta rápida y fiable
//        da los lugares MÁS famosos de la zona (por nº de Wikipedias = sitelinks)
//        con coordenadas y fama incluidas. Filtramos a tipos de POI visitables
//        (museos, templos, monumentos, castillos/palacios, parques, torres,
//        puentes, plazas, estadios, teatros, sitios arqueológicos) vía P31/P279*.
const UA = "Anduve/1.0 (https://anduve-app.vercel.app)";

// Lista AMPLIA de tipos de POI (P31 directo, sin subclases para que sea rápido:
// P279* tardaba ~60s; esto ~15s). Cubre museos, templos, monumentos, castillos/
// palacios, torres, plazas, parques, fuentes, sitios arqueológicos, estadios,
// teatros, etc. — incluyendo subtipos comunes que de otro modo se perdían.
const TIPOS_POI = [
  // Museos y galerías
  "Q33506", "Q207694", "Q3327872", "Q5505137", "Q588140", "Q1568346", "Q1007870",
  // Templos / edificios religiosos
  "Q16970", "Q2977", "Q163687", "Q120560", "Q108325", "Q32815", "Q34627", "Q44539", "Q44613", "Q160742",
  // Monumentos, memoriales, obeliscos, arcos, estatuas
  "Q4989906", "Q575759", "Q5003624", "Q170980", "Q190928", "Q179700", "Q860861",
  // Castillos, palacios, fortalezas, puertas/murallas
  "Q23413", "Q751876", "Q16560", "Q57821", "Q14452", "Q82117",
  // Torres
  "Q12518", "Q200334", "Q1440476",
  // Plazas, parques, jardines
  "Q174782", "Q22698", "Q22746", "Q46169", "Q1107656", "Q167346",
  // Puentes, fuentes, escalinatas
  "Q12280", "Q483453", "Q12511",
  // Sitios arqueológicos / patrimonio
  "Q839954", "Q2087181", "Q358",
  // Estadios, teatros, salas
  "Q483110", "Q641226", "Q24354", "Q153562",
  // Atracciones, miradores, naturaleza, ocio
  "Q570116", "Q2319498", "Q1442406", "Q194195", "Q43501", "Q1244442", "Q39715", "Q34038", "Q35509",
];

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

const ALLOW = new Set(TIPOS_POI);

// NO usamos VALUES dentro de la consulta (forzar el match contra ~58 tipos sobre
// el enorme "around" de ciudades densas como París la hacía caer por timeout).
// En su lugar traemos los P31 con GROUP_CONCAT (rápido) y filtramos en JS.
function consultaWDQS(lat, lon, slMin, radio = 20) {
  return `SELECT ?item ?itemLabel ?lat ?lon ?sl (GROUP_CONCAT(DISTINCT ?t;separator=",") AS ?types) WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "${radio}" . }
  ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${slMin})
  OPTIONAL { ?item wdt:P31 ?t }
  BIND(geof:latitude(?coord) AS ?lat) BIND(geof:longitude(?coord) AS ?lon)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en,fr". ?item rdfs:label ?itemLabel. }
} GROUP BY ?item ?itemLabel ?lat ?lon ?sl ORDER BY DESC(?sl) LIMIT 200`;
}

// Conserva solo las filas cuyo P31 sea un tipo de POI visitable (allowlist).
function soloPOIs(bindings) {
  return bindings.filter((x) => {
    const tipos = (x.types?.value || "").split(",").map((u) => u.split("/").pop());
    return tipos.some((t) => ALLOW.has(t));
  });
}

async function wdqs(query) {
  const url = "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(query);
  for (let i = 0; i < 4; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 55000);
      const r = await fetch(url, {
        headers: { Accept: "application/sparql-results+json", "User-Agent": UA },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.ok) {
        const d = await r.json();
        const b = d.results?.bindings || [];
        if (b.length) return b;
      }
    } catch {}
    await dormir(5000 + i * 5000); // 5,10,15s: 502/timeout transitorios de WDQS
  }
  return [];
}

// Etiqueta OSM-like según el nombre (heurística simple) para que el cliente
// muestre la categoría correcta (Museo, Templo, Monumento, Castillo, Palacio…).
function tagPorNombre(n) {
  const s = n.toLowerCase();
  if (/\b(museo|museu|museum|mus[ée]e|galer|gallery|pinacote)/.test(s)) return { tourism: "museum" };
  if (/\b(bas[íi]lica|catedral|cathedral|cath[ée]drale|iglesia|church|[ée]glise|temple|templo|capilla|chapelle|mezquita|mosque|sinagoga|synagogue|sagrada|duomo|abad[íi]a|abbey)/.test(s))
    return { amenity: "place_of_worship" };
  if (/\b(castillo|castell|castle|ch[âa]teau|fortaleza|fortress|fort|alc[áa]zar|citadel|ciudadela)/.test(s)) return { historic: "castle" };
  if (/\b(palacio|palau|palace|palais|palazzo)/.test(s)) return { historic: "palace" };
  if (/\b(parque|park|parc|jard[íi]n|jardim|garden|jardin|bosque)/.test(s)) return { leisure: "park" };
  if (/\b(estadio|stadium|stade|st[àa]dio|arena)/.test(s)) return { leisure: "stadium" };
  if (/\b(catacumbas|ruinas|ruins|arqueol|teatro romano|anfiteatro)/.test(s)) return { historic: "archaeological_site" };
  return { tourism: "attraction" };
}

async function ciudadElementos(c) {
  // Cascada (radio, umbral) de menos a más permisivo. Para ciudades densas el
  // radio grande puede caer por timeout: si pasa, el siguiente intento usa un
  // radio menor (más rápido). Para ciudades pequeñas, baja el umbral de fama
  // hasta juntar ~25. Nos quedamos con el intento que más lugares devuelva.
  let b = [];
  for (const [radio, sl] of [[20, 10], [14, 5], [9, 2]]) {
    const f = soloPOIs(await wdqs(consultaWDQS(c.lat, c.lon, sl, radio)));
    if (f.length > b.length) b = f;
    if (b.length >= 25) break;
    await dormir(1200);
  }
  const vistos = new Set();
  const out = [];
  for (const x of b) {
    if (out.length >= 45) break; // top ~45 por fama (b va ordenado por sitelinks)
    const nombre = x.itemLabel?.value;
    if (!nombre || /^Q\d+$/.test(nombre)) continue; // sin etiqueta legible
    if (vistos.has(nombre)) continue;
    vistos.add(nombre);
    const qid = x.item.value.split("/").pop();
    const sl = Number(x.sl.value) || 0;
    out.push({
      type: "node",
      id: qid,
      lat: Number(x.lat.value),
      lon: Number(x.lon.value),
      // wikipedia: sitelinks>=6 implica artículo(s) → marcamos notable para el
      // cliente. pop (fama) ordena famoso-primero sin depender de APIs en vivo.
      tags: { name: nombre, wikidata: qid, wikipedia: "es:" + nombre, ...tagPorNombre(nombre) },
      pop: Math.min(30, Math.floor(sl / 6)),
    });
  }
  return out;
}

async function main() {
  const ciudades = cargarCiudades();
  const dir = join(RAIZ, "public", "lugares");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  let i = 0;
  for (const c of ciudades) {
    i++;
    const s = slug(c.ciudad, c.pais);
    const ruta = join(dir, `${s}.json`);
    // REANUDAR: si ya existe el archivo de esta ciudad, no la volvemos a pedir.
    if (existsSync(ruta)) {
      console.log(`[${i}/${ciudades.length}] ${c.ciudad}: ya existe, omitir`);
      continue;
    }
    try {
      const elements = await ciudadElementos(c);
      if (elements.length === 0) {
        console.log(`[${i}/${ciudades.length}] ${c.ciudad}: 0 (sin datos)`);
        continue;
      }
      writeFileSync(ruta, JSON.stringify({ elements }));
      console.log(`[${i}/${ciudades.length}] ${c.ciudad}: ${elements.length} -> ${s}.json`);
    } catch (e) {
      console.log(`[${i}/${ciudades.length}] ${c.ciudad}: ERROR ${e.message}`);
    }
    await dormir(700);
  }

  // ÍNDICE: se construye con TODAS las ciudades que tengan archivo (de esta
  // corrida y de corridas anteriores), no solo las de ahora.
  const indice = ciudades
    .filter((c) => existsSync(join(dir, `${slug(c.ciudad, c.pais)}.json`)))
    .map((c) => ({ s: slug(c.ciudad, c.pais), lat: c.lat, lon: c.lon }));

  const js =
    "// GENERADO por scripts/precomputar-lugares.mjs — no editar a mano.\n" +
    "// Índice de ciudades con lugares precalculados (JSON estático en /lugares/).\n" +
    "export const PRECALC = " +
    JSON.stringify(indice) +
    ";\n";
  writeFileSync(join(RAIZ, "lib", "precalcIndex.js"), js);
  console.log(`\nListo: ${indice.length} ciudades en el índice.`);
}

main();
