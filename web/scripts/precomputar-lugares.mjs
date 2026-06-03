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
  return arr.filter((c) => c.lat != null && c.lon != null);
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

const TIPOS_POI = [
  "Q570116",   // atracción turística
  "Q33506",    // museo
  "Q24398318", // edificio religioso (iglesia, catedral, mezquita, basílica...)
  "Q4989906",  // monumento
  "Q5003624",  // memorial
  "Q23413",    // castillo
  "Q16560",    // palacio
  "Q839954",   // sitio arqueológico
  "Q22698",    // parque
  "Q1107656",  // jardín
  "Q12518",    // torre
  "Q12280",    // puente
  "Q174782",   // plaza
  "Q483110",   // estadio
  "Q24354",    // teatro
];

const dormir = (ms) => new Promise((res) => setTimeout(res, ms));

function consultaWDQS(lat, lon, slMin) {
  const allow = TIPOS_POI.map((q) => "wd:" + q).join(" ");
  return `SELECT ?item ?itemLabel ?lat ?lon ?sl WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "20" . }
  ?item wikibase:sitelinks ?sl . FILTER(?sl >= ${slMin})
  ?item wdt:P31/wdt:P279* ?type . VALUES ?type { ${allow} }
  BIND(geof:latitude(?coord) AS ?lat) BIND(geof:longitude(?coord) AS ?lon)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en,fr". ?item rdfs:label ?itemLabel. }
} ORDER BY DESC(?sl) LIMIT 90`;
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
  // Umbral adaptativo: pedimos fama alta; si la ciudad trae poco, bajamos.
  let b = await wdqs(consultaWDQS(c.lat, c.lon, 12));
  if (b.length < 12) {
    await dormir(1500);
    const b2 = await wdqs(consultaWDQS(c.lat, c.lon, 6));
    if (b2.length > b.length) b = b2;
  }
  const vistos = new Set();
  const out = [];
  for (const x of b) {
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
