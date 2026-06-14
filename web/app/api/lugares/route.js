// API propia en Vercel para traer lugares. Estrategia robusta de 2 fuentes:
//  1) Overpass (OpenStreetMap) — trae todo lo de la zona por categoría.
//  2) Photon (Komoot) como RESPALDO — rápido y estable, busca por palabras.
// Si una falla o viene vacía, usamos la otra. Así la categoría NUNCA queda vacía.
// POPULARIDAD: además se enriquece el puntaje con Amadeus POI (visitas reales) y
// con los sitelinks de Wikidata (fama editorial), sin reemplazar la heurística.
// Cachea en el edge de Vercel solo cuando hay datos.

import { poisAmadeus } from "@/lib/amadeus";

// Permite a la función de Vercel correr hasta 20s (Overpass puede tardar varios
// segundos en zonas amplias). El resultado se cachea, así solo la 1ª vez es lenta.
export const maxDuration = 20;

const MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
];

const FILTROS = {
  // "imperdibles" amplio: incluye templos/iglesias (atracciones top en muchas
  // culturas), plazas y parques notables.
  imperdibles: [
    // Atracciones turísticas reales (sin "artwork" = estatuas/grafitis menores).
    'node["tourism"~"attraction|museum|theme_park|zoo|aquarium"]["name"]',
    'way["tourism"~"attraction|museum|theme_park"]["name"]',
    // Históricos que SÍ son destinos (sin "memorial" = monumentos menores/placas).
    'node["historic"~"castle|fort|monastery|archaeological_site|palace|monument"]["name"]["wikidata"]',
    'way["historic"~"castle|fort|monastery|archaeological_site|palace"]["name"]',
    // Miradores y templos notables (con wikidata = relevantes).
    'node["tourism"="viewpoint"]["name"]["wikidata"]',
    'node["amenity"="place_of_worship"]["name"]["wikidata"]',
    'way["amenity"="place_of_worship"]["name"]["wikidata"]',
  ],
  // Filtros opcionales por TIPO (chips además de "Imperdibles").
  museos: [
    'node["tourism"~"museum|gallery"]["name"]',
    'way["tourism"~"museum|gallery"]["name"]',
  ],
  monumentos: [
    'node["tourism"="attraction"]["name"]',
    'node["historic"~"castle|fort|monastery|archaeological_site|palace"]["name"]',
    // Antes exigia ["wikidata"]: muchos monumentos no lo tienen y la ciudad
    // quedaba vacia. El score penaliza estatuas/placas genericas.
    'node["historic"~"monument|memorial"]["name"]',
    'way["historic"~"castle|fort|monastery|palace"]["name"]',
    'node["man_made"="tower"]["name"]',
  ],
  parques: [
    // Antes exigia ["wikidata"] y dejaba en cero ciudades con muchos parques
    // sin tag de wikidata (Rio, etc.). El score de procesarElementos ya
    // ordena por relevancia despues; aqui solo necesitamos traer candidatos.
    'node["leisure"~"park|garden"]["name"]',
    'way["leisure"~"park|garden"]["name"]',
    'node["tourism"="theme_park"]["name"]',
    'way["tourism"="theme_park"]["name"]',
  ],
  estadios: [
    'node["leisure"="stadium"]["name"]',
    'way["leisure"="stadium"]["name"]',
    'way["building"="stadium"]["name"]',
  ],
  restaurantes: ['node["amenity"="restaurant"]["name"]'],
  cafes: ['node["amenity"~"cafe|coffee_shop"]["name"]'],
  bares: ['node["amenity"~"bar|pub|nightclub"]["name"]'],
  miradores: ['node["tourism"="viewpoint"]["name"]'],
};

// Para RADIO AMPLIO (>=30 km): consulta LIVIANA = solo nodos NOTABLES (con
// wikidata) y SIN "way" (que es lo pesado y disparaba el tiempo a 90s+). Así
// Overpass responde rápido en áreas grandes. Las ciudades TOP ya no dependen de
// esto (usan el precálculo estático con WDQS); esta consulta es solo el respaldo
// en vivo para ciudades no precalculadas, donde la prioridad es que abra rápido.
const FILTROS_AMPLIO = {
  imperdibles: [
    'node["tourism"~"attraction|museum|theme_park|zoo|aquarium|viewpoint"]["name"]["wikidata"]',
    'node["historic"~"castle|fort|monastery|archaeological_site|palace|monument"]["name"]["wikidata"]',
    'node["amenity"="place_of_worship"]["name"]["wikidata"]',
    'node["natural"~"peak|volcano|waterfall"]["name"]["wikidata"]',
  ],
  miradores: ['node["tourism"="viewpoint"]["name"]["wikidata"]'],
};

// Respaldo Photon: términos descriptivos por categoría (en inglés, que es como
// suelen estar las etiquetas). Buscar por palabra + cercanía funciona mejor que
// q=a. Se prueban varios y se unifican.
const TERMINOS_PHOTON = {
  imperdibles: ["monument", "museum", "palace", "temple", "church", "mosque", "castle", "square", "park", "viewpoint"],
  // Antes solo estaban imperdibles/comida; para museos/monumentos/parques/
  // estadios la categoria caia al "attraction" generico de Photon y ciudades
  // grandes (Rio, etc.) podian quedar vacias si Overpass tardaba o filtraba mucho.
  museos: ["museum", "gallery", "exhibition", "pinacoteca", "musee"],
  monumentos: ["monument", "memorial", "palace", "castle", "fort", "fortress", "tower", "obelisk", "arch", "ruins"],
  parques: ["park", "garden", "botanical", "promenade", "parque", "jardim", "jardin"],
  estadios: ["stadium", "arena", "coliseum", "estadio"],
  restaurantes: ["restaurant", "food", "grill", "bbq", "kitchen", "bistro", "diner"],
  cafes: ["cafe", "coffee", "bakery", "tea"],
  bares: ["bar", "pub", "club", "lounge", "brewery"],
  miradores: ["viewpoint", "tower", "lookout", "observation"],
};

// User-Agent identificable: varias APIs gratuitas (Photon/Nominatim/Overpass)
// rechazan peticiones sin UA, sobre todo desde IPs de datacenter como Vercel.
const UA = "Viajero360/1.0 (https://app-vuelos-mfos.vercel.app)";

function carrera(query) {
  const cuerpo = "data=" + encodeURIComponent(query);
  const intentos = MIRRORS.map((url) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 14000);
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": UA,
      },
      body: cuerpo,
      signal: ctrl.signal,
    }).then(async (r) => {
      clearTimeout(id);
      if (!r.ok) throw new Error("mirror " + r.status);
      return r.json();
    });
  });

  return new Promise((resolve, reject) => {
    let pend = intentos.length;
    let vacio = null;
    intentos.forEach((p) =>
      p
        .then((data) => {
          if ((data?.elements?.length || 0) > 0) resolve(data);
          else {
            vacio = data;
            if (--pend === 0) resolve(vacio || { elements: [] });
          }
        })
        .catch(() => {
          if (--pend === 0) (vacio ? resolve(vacio) : reject(new Error("overpass")));
        })
    );
  });
}

// Puntuación de calidad de un lugar (para ordenar los mejores primero).
function puntuar(t = {}) {
  const nombre = t.name || "";
  let s = 0;
  if (t.wikipedia) s += 30;
  if (t.wikidata) s += 10;
  if (t.heritage || t["heritage:operator"]) s += 12;
  if (t.tourism === "museum") s += 10;
  if (t.tourism === "attraction") s += 8;
  if (t.historic === "castle" || t.historic === "palace" || t.historic === "fort") s += 8;
  if (t.tourism === "viewpoint") s += 4;
  if (t.image || t.wikimedia_commons) s += 5;
  if (t.website || t["contact:website"]) s += 2;
  if (/^\s*(monumento|estatua|busto|placa|fuente|memorial)\s*$/i.test(nombre)) s -= 30;
  if (/^\s*(monumento a|estatua de|busto de|monument |monumento di|statue of|memorial)\b/i.test(nombre)) s -= 20;
  if (t.historic === "memorial" || t.tourism === "artwork") s -= 15;
  return s;
}

// --- POPULARIDAD ---------------------------------------------------------
// Bonus por aparecer en la lista curada de Amadeus (atracciones más visitadas).
// rank menor = más popular; estar presente ya es buena señal.
function bonusAmadeus(lat, lon, pois) {
  let mejor = null;
  let md = Infinity;
  for (const p of pois) {
    const d = Math.hypot(p.lat - lat, p.lon - lon);
    if (d < md) {
      md = d;
      mejor = p;
    }
  }
  if (!mejor || md > 0.0025) return 0; // ~250 m de tolerancia
  return Number.isFinite(mejor.rank) ? Math.max(8, 35 - Math.min(mejor.rank, 27)) : 15;
}

// Nº de Wikipedias (sitelinks) por entidad de Wikidata = fama global. Una sola
// llamada en lote (hasta 50 IDs). Si falla, no pasa nada (devuelve {}).
async function sitelinksWikidata(ids) {
  if (!ids.length) return {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join(
        "|"
      )}&props=sitelinks&format=json&origin=*`,
      { headers: { "User-Agent": UA }, signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!r.ok) return {};
    const d = await r.json();
    const out = {};
    for (const [qid, ent] of Object.entries(d.entities || {})) {
      out[qid] = Object.keys(ent.sitelinks || {}).length;
    }
    return out;
  } catch {
    return {};
  }
}

// Aplica las señales de popularidad como campo `pop` (se suma al puntaje, aquí
// y en el cliente). Fuentes: Amadeus (cercanía) + sitelinks de Wikidata. Los
// elementos icónicos ya traen su fama (`slWiki`) gratis desde la consulta WDQS.
async function aplicarPopularidad(elementos, pois) {
  for (const e of elementos) {
    let p = bonusAmadeus(e.lat, e.lon, pois);
    if (e.slWiki) p += Math.min(28, Math.floor(e.slWiki / 6)); // íconos: muy famosos
    e.pop = p;
  }
  // sitelinks para los NO-íconos con wikidata (1 sola llamada en lote).
  const conQ = elementos
    .filter((e) => !e.slWiki && /^Q\d+$/.test(e.tags?.wikidata || ""))
    .sort((a, b) => puntuar(b.tags) + (b.pop || 0) - (puntuar(a.tags) + (a.pop || 0)))
    .slice(0, 50);
  if (conQ.length) {
    const sl = await sitelinksWikidata(conQ.map((e) => e.tags.wikidata));
    for (const e of elementos) {
      if (e.slWiki) continue;
      const n = e.tags?.wikidata ? sl[e.tags.wikidata] : 0;
      if (n) e.pop = (e.pop || 0) + Math.min(22, Math.floor(n / 7));
    }
  }
}

// Convierte la respuesta de Overpass al formato unificado {elements:[...]}.
function desdeOverpass(datos) {
  return (datos.elements || [])
    .filter((e) => e.tags?.name)
    .map((e) => ({
      type: e.type,
      id: e.id,
      lat: e.lat ?? e.center?.lat,
      lon: e.lon ?? e.center?.lon,
      tags: e.tags,
    }))
    .filter((e) => e.lat && e.lon);
}

// --- ICÓNICOS (Wikidata → OSM) -------------------------------------------
// Garantiza que SIEMPRE entren los lugares más famosos de una ciudad (la Torre
// Eiffel, el Coliseo, etc.). Wikidata da los puntos más célebres por nº de
// Wikipedias (sitelinks); luego los buscamos en OSM POR su id de wikidata
// (indexado → rápido). Lo que no es un lugar físico (eventos, tratados, idiomas)
// no existe como POI en OSM y queda descartado automáticamente.
async function wikidataFamosos(lat, lon, intentos = 1) {
  const q = `SELECT ?item ?sl WHERE {
    SERVICE wikibase:around {
      ?item wdt:P625 ?c .
      bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
      bd:serviceParam wikibase:radius "22" .
    }
    ?item wikibase:sitelinks ?sl . FILTER(?sl >= 18)
  } ORDER BY DESC(?sl) LIMIT 60`;
  for (let i = 0; i <= intentos; i++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      const r = await fetch(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`,
        { headers: { Accept: "application/sparql-results+json", "User-Agent": UA }, signal: ctrl.signal }
      );
      clearTimeout(t);
      if (r.ok) {
        const d = await r.json();
        const filas = d.results?.bindings || [];
        if (filas.length)
          return filas.map((b) => ({
            qid: b.item.value.split("/").pop(),
            sl: Number(b.sl.value) || 0,
          }));
      }
    } catch {}
    // WDQS a veces responde 200 vacío bajo carga: reintentamos una vez.
  }
  return [];
}

async function iconosCiudad(lat, lon) {
  const fam = await wikidataFamosos(lat, lon);
  if (!fam.length) return [];
  const slPorQid = Object.fromEntries(fam.map((f) => [f.qid, f.sl]));
  const filtros = fam.map((f) => `nwr["wikidata"="${f.qid}"];`).join("");
  let datos;
  try {
    datos = await carrera(`[out:json][timeout:20];(${filtros});out center tags;`);
  } catch {
    return [];
  }
  // Estos POIs ya son FAMOSOS (vienen de la lista por sitelinks de Wikidata).
  // Aceptamos los tipos físicos visitables (incluidos templos icónicos, parques,
  // torres y puentes célebres) y descartamos barrios y límites administrativos.
  return desdeOverpass(datos)
    .filter((e) => {
      const t = e.tags || {};
      if (t.place || t.boundary || t.admin_level) return false;
      return (
        t.tourism ||
        t.historic ||
        t.amenity === "place_of_worship" ||
        t.leisure === "park" ||
        t.leisure === "garden" ||
        t.man_made === "tower" ||
        t.man_made === "bridge" ||
        /church|cathedral|basilica|chapel|temple|mosque|synagogue/i.test(t.building || "")
      );
    })
    .map((e) => ({ ...e, slWiki: slPorQid[e.tags.wikidata] || 0 }));
}

// RESPALDO: Photon buscando por TÉRMINOS descriptivos cerca del punto.
// Buscar "monument", "palace", "mosque"... + lat/lon trae lugares reales del
// tipo correcto y cercanos. Filtramos por bbox para descartar lo lejano.
async function desdePhoton(cat, lat, lon, radio = 12000) {
  const terminos = TERMINOS_PHOTON[cat] || ["attraction"];
  // bbox proporcional al radio pedido (grados ≈ metros/111000), tope ~100 km.
  const d = Math.min(0.9, Math.max(0.2, radio / 111000));
  const bbox = `${lon - d},${lat - d},${lon + d},${lat + d}`;

  const llamadas = terminos.map((term) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 6000);
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      term
    )}&bbox=${bbox}&lat=${lat}&lon=${lon}&limit=20`;
    return fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } })
      .then((r) => {
        clearTimeout(id);
        return r.ok ? r.json() : { features: [] };
      })
      .catch(() => {
        clearTimeout(id);
        return { features: [] };
      });
  });
  const resultados = await Promise.all(llamadas);

  const vistos = new Set();
  const out = [];
  for (const res of resultados) {
    for (const f of res.features || []) {
      const p = f.properties || {};
      const nombre = p.name;
      const coords = f.geometry?.coordinates; // [lon, lat]
      if (!nombre || !coords || vistos.has(nombre)) continue;
      // Descartar lo que se salga del radio pedido (con un pequeño margen).
      const dist = Math.hypot(coords[1] - lat, coords[0] - lon);
      if (dist > d * 1.25) continue;
      // Evitar traer ciudades/calles/parkings/estaciones: solo puntos relevantes.
      const key = p.osm_key || "";
      const val = p.osm_value || "";
      if (["place", "highway", "boundary", "railway", "aeroway", "public_transport", "waterway", "natural"].includes(key)) continue;
      if (["parking", "fuel", "bus_stop", "parking_entrance", "station", "stop_position",
           "school", "college", "university", "kindergarten", "hospital", "clinic",
           "pharmacy", "supermarket", "convenience", "doctors", "dentist"].includes(val)) continue;
      // Descartar por nombre cosas que claramente no son lugares de interés.
      if (/\b(parking|aparcamiento|estaci[óo]?|station|gare|bahnhof|aeropuerto|airport|parada|metro|terminal)\b/i.test(nombre)) continue;
      // Centros educativos, de salud y quebradas/ríos: no son atractivos turísticos.
      if (/\b(colegio|escuela|liceo|institut|instituci[óo]n educativa|educativ|universidad|jard[íi]n infantil|hospital|cl[íi]nica|eps|ips|quebrada|r[íi]o|arroyo|caja de)\b/i.test(nombre)) continue;
      vistos.add(nombre);
      out.push({
        type: "node",
        id: p.osm_id || nombre,
        lat: coords[1],
        lon: coords[0],
        tags: {
          name: nombre,
          [key || "tourism"]: p.osm_value || "attraction",
        },
      });
    }
  }
  return out;
}

// --- POIs vía Wikidata BAJO DEMANDA (para CUALQUIER ciudad no precalculada) ---
// Misma fuente de calidad que el precálculo, pero al vuelo: una consulta rápida
// que da los lugares notables con coordenadas y fama. Corre en paralelo con
// Overpass (si falla o tarda, Overpass cubre → sin regresión) y se cachea.
const TIPOS_POI_WD = new Set([
  "Q33506", "Q207694", "Q3327872", "Q5505137", "Q588140", "Q1568346", "Q1007870",
  "Q16970", "Q2977", "Q163687", "Q120560", "Q108325", "Q32815", "Q34627", "Q44539", "Q44613", "Q160742",
  "Q4989906", "Q575759", "Q5003624", "Q170980", "Q190928", "Q179700", "Q860861",
  "Q23413", "Q751876", "Q16560", "Q57821", "Q14452", "Q82117",
  "Q12518", "Q200334", "Q1440476", "Q174782", "Q22698", "Q22746", "Q46169", "Q1107656", "Q167346",
  "Q12280", "Q483453", "Q12511", "Q839954", "Q2087181", "Q358",
  "Q483110", "Q641226", "Q24354", "Q153562", "Q570116", "Q2319498", "Q1442406",
  "Q194195", "Q43501", "Q1244442", "Q39715", "Q34038", "Q35509",
]);

function tagWD(n) {
  const s = (n || "").toLowerCase();
  if (/\b(museo|museu|museum|mus[ée]e|galer|gallery|pinacote)/.test(s)) return { tourism: "museum" };
  if (/\b(bas[íi]lica|catedral|cathedral|iglesia|church|[ée]glise|temple|templo|capilla|chapelle|mezquita|mosque|sinagoga|sagrada|duomo|abad)/.test(s)) return { amenity: "place_of_worship" };
  if (/\b(castillo|castle|ch[âa]teau|fortaleza|fort|alc[áa]zar|citadel|ciudadela)/.test(s)) return { historic: "castle" };
  if (/\b(palacio|palau|palace|palais|palazzo)/.test(s)) return { historic: "palace" };
  if (/\b(parque|park|parc|jard[íi]n|jardim|garden|bosque)/.test(s)) return { leisure: "park" };
  if (/\b(estadio|stadium|stade|st[àa]dio|arena)/.test(s)) return { leisure: "stadium" };
  return { tourism: "attraction" };
}

async function poisWikidata(lat, lon) {
  // Traemos labels en los 4 idiomas soportados por la UI (es/en/pt/fr). El
  // backend los inyecta como tags name:xx para que la UI use el correcto sin
  // llamadas extra. `itemLabel` (con fallback "es,en") se usa como nombre base.
  const q = `SELECT ?item ?itemLabel ?labEs ?labEn ?labPt ?labFr ?lat ?lon ?sl (GROUP_CONCAT(DISTINCT ?t;separator=",") AS ?types) WHERE {
  SERVICE wikibase:around { ?item wdt:P625 ?coord .
    bd:serviceParam wikibase:center "Point(${lon} ${lat})"^^geo:wktLiteral .
    bd:serviceParam wikibase:radius "20" . }
  ?item wikibase:sitelinks ?sl . FILTER(?sl >= 4)
  OPTIONAL { ?item wdt:P31 ?t }
  OPTIONAL { ?item rdfs:label ?labEs . FILTER(LANG(?labEs)="es") }
  OPTIONAL { ?item rdfs:label ?labEn . FILTER(LANG(?labEn)="en") }
  OPTIONAL { ?item rdfs:label ?labPt . FILTER(LANG(?labPt)="pt") }
  OPTIONAL { ?item rdfs:label ?labFr . FILTER(LANG(?labFr)="fr") }
  BIND(geof:latitude(?coord) AS ?lat) BIND(geof:longitude(?coord) AS ?lon)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". ?item rdfs:label ?itemLabel. }
} GROUP BY ?item ?itemLabel ?labEs ?labEn ?labPt ?labFr ?lat ?lon ?sl ORDER BY DESC(?sl) LIMIT 150`;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 14000);
    const r = await fetch(
      "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(q),
      { headers: { Accept: "application/sparql-results+json", "User-Agent": UA }, signal: ctrl.signal }
    );
    clearTimeout(t);
    if (!r.ok) return [];
    const d = await r.json();
    const out = [];
    const vistos = new Set();
    for (const x of d.results?.bindings || []) {
      if (out.length >= 60) break;
      const nombre = x.itemLabel?.value;
      if (!nombre || /^Q\d+$/.test(nombre) || vistos.has(nombre)) continue;
      const tipos = (x.types?.value || "").split(",").map((u) => u.split("/").pop());
      if (!tipos.some((tt) => TIPOS_POI_WD.has(tt))) continue;
      vistos.add(nombre);
      const qid = x.item.value.split("/").pop();
      const tags = { name: nombre, wikidata: qid, wikipedia: "es:" + nombre, ...tagWD(nombre) };
      if (x.labEs?.value) tags["name:es"] = x.labEs.value;
      if (x.labEn?.value) tags["name:en"] = x.labEn.value;
      if (x.labPt?.value) tags["name:pt"] = x.labPt.value;
      if (x.labFr?.value) tags["name:fr"] = x.labFr.value;
      out.push({
        type: "node",
        id: qid,
        lat: Number(x.lat.value),
        lon: Number(x.lon.value),
        tags,
        slWiki: Number(x.sl.value) || 0, // fama → aplicarPopularidad la convierte en pop
      });
    }
    return out;
  } catch {
    return [];
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const cat = searchParams.get("cat") || "imperdibles";
  const lat = parseFloat(searchParams.get("lat"));
  const lon = parseFloat(searchParams.get("lon"));
  // Radio hasta 100 km (para incluir atractivos cercanos a la ciudad, p. ej.
  // Guatapé desde Medellín). El cliente pide más radio para imperdibles/miradores.
  const radio = Math.min(parseInt(searchParams.get("radio") || "8000"), 100000);

  if (!FILTROS[cat] || isNaN(lat) || isNaN(lon)) {
    return Response.json({ error: "parámetros", elements: [] }, { status: 400 });
  }

  const deadline = (ms, val) => new Promise((res) => setTimeout(() => res(val), ms));
  const construir = (filtros, r, lim) =>
    `[out:json][timeout:15];(${filtros
      .map((f) => `${f}(around:${r},${lat},${lon});`)
      .join("")});out center ${lim};`;

  // DOS consultas a Overpass EN PARALELO (la lección clave de rendimiento):
  //  · CERCANA: área pequeña (≤25 km). Es la crítica y la RÁPIDA (~5s). En áreas
  //    amplias usamos la versión liviana (solo nodos con wikidata, SIN "way"):
  //    el "way" y los radios enormes eran justo lo que disparaba el tiempo a 20s+
  //    y hacía fallar ciudades grandes como Madrid.
  //  · LEJANA: radio amplio pero best-effort (no bloquea). Trae las pocas
  //    excursiones icónicas (p. ej. Guatapé); si tarda, seguimos con lo cercano.
  // Photon (Komoot) va también en paralelo como respaldo rápido y estable.
  const esAmplio = radio >= 30000;
  const filtroNear = (esAmplio && FILTROS_AMPLIO[cat]) || FILTROS[cat];
  const radioNear = esAmplio ? 25000 : radio;
  const pNear = carrera(construir(filtroNear, radioNear, 80))
    .then(desdeOverpass)
    .catch(() => []);

  let pFar = Promise.resolve([]);
  if (esAmplio && FILTROS_AMPLIO[cat]) {
    pFar = carrera(construir(FILTROS_AMPLIO[cat], Math.min(radio + 5000, 100000), 40))
      .then(desdeOverpass)
      .catch(() => []);
  }

  const pPhoton = desdePhoton(cat, lat, lon, radio).catch(() => []);
  // Solo para "imperdibles"/"miradores" y en paralelo:
  //  · ICÓNICOS: los lugares más famosos (Wikidata → OSM). GARANTIZA la Eiffel.
  //  · Amadeus POI: popularidad por visitas reales (si hay credenciales).
  const conIconos = cat === "imperdibles" || cat === "miradores";
  const pIconos = conIconos ? iconosCiudad(lat, lon).catch(() => []) : Promise.resolve([]);
  const pPop = conIconos ? poisAmadeus(lat, lon, 20).catch(() => []) : Promise.resolve([]);
  // Wikidata bajo demanda: POIs de calidad para CUALQUIER ciudad (no solo las
  // precalculadas). Paralelo y best-effort; si tarda/falla, Overpass cubre.
  const pWiki = conIconos ? poisWikidata(lat, lon).catch(() => []) : Promise.resolve([]);

  // La CERCANA manda el ritmo (tope 13s); las demás son best-effort con topes
  // más cortos para no estirar la respuesta. Todo cabe en maxDuration=20s y el
  // cliente espera 16s, así el resultado SÍ alcanza a guardarse en caché.
  const [wiki, iconos, near, far, phot, pop] = await Promise.all([
    Promise.race([pWiki, deadline(14000, [])]),
    Promise.race([pIconos, deadline(11000, [])]),
    Promise.race([pNear, deadline(13000, [])]),
    Promise.race([pFar, deadline(11000, [])]),
    Promise.race([pPhoton, deadline(8000, [])]),
    Promise.race([pPop, deadline(7000, [])]),
  ]);

  // Unir sin duplicar nombres. WIKIDATA primero (calidad + fama), luego ICÓNICOS,
  // cercanos, lejanos y Photon.
  const vistos = new Set();
  let elementos = [];
  for (const e of [...wiki, ...iconos, ...near, ...far, ...phot]) {
    const n = e.tags?.name;
    if (!n || vistos.has(n)) continue;
    vistos.add(n);
    elementos.push(e);
  }

  // Enriquecer con POPULARIDAD (Amadeus + sitelinks de Wikidata) → campo `pop`.
  await aplicarPopularidad(elementos, pop || []);

  // Ordenar por CALIDAD + POPULARIDAD: los lugares icónicos y más visitados
  // primero. Así el cliente recibe ya los mejores arriba aunque corte la lista.
  elementos.sort((a, b) => puntuar(b.tags) + (b.pop || 0) - (puntuar(a.tags) + (a.pop || 0)));

  const tieneDatos = elementos.length > 0;
  return new Response(JSON.stringify({ elements: elementos }), {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": tieneDatos
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "no-store",
    },
  });
}
