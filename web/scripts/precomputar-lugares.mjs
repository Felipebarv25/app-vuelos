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
const UA = "Viajero360/1.0 (https://app-vuelos-mfos.vercel.app)";

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
