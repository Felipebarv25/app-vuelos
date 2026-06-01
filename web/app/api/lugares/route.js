// API propia en Vercel para traer lugares. Estrategia robusta de 2 fuentes:
//  1) Overpass (OpenStreetMap) — trae todo lo de la zona por categoría.
//  2) Photon (Komoot) como RESPALDO — rápido y estable, busca por palabras.
// Si una falla o viene vacía, usamos la otra. Así la categoría NUNCA queda vacía.
// Cachea en el edge de Vercel solo cuando hay datos.

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
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
  restaurantes: ['node["amenity"="restaurant"]["name"]'],
  cafes: ['node["amenity"~"cafe|coffee_shop"]["name"]'],
  bares: ['node["amenity"~"bar|pub|nightclub"]["name"]'],
  miradores: ['node["tourism"="viewpoint"]["name"]'],
};

// Respaldo Photon: términos descriptivos por categoría (en inglés, que es como
// suelen estar las etiquetas). Buscar por palabra + cercanía funciona mejor que
// q=a. Se prueban varios y se unifican.
const TERMINOS_PHOTON = {
  imperdibles: ["monument", "museum", "palace", "temple", "church", "mosque", "castle", "square", "park", "viewpoint"],
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
    const id = setTimeout(() => ctrl.abort(), 13000);
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

// RESPALDO: Photon buscando por TÉRMINOS descriptivos cerca del punto.
// Buscar "monument", "palace", "mosque"... + lat/lon trae lugares reales del
// tipo correcto y cercanos. Filtramos por bbox para descartar lo lejano.
async function desdePhoton(cat, lat, lon) {
  const terminos = TERMINOS_PHOTON[cat] || ["attraction"];
  // bbox ~ ±0.2° (~22 km): minLon,minLat,maxLon,maxLat
  const d = 0.2;
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
      // Descartar lo que se salga del bbox (~28 km) y resultados sin tipo útil.
      const dist = Math.hypot(coords[1] - lat, coords[0] - lon);
      if (dist > 0.28) continue;
      // Evitar traer ciudades/calles/parkings/estaciones: solo puntos relevantes.
      const key = p.osm_key || "";
      const val = p.osm_value || "";
      if (["place", "highway", "boundary", "railway", "aeroway", "public_transport"].includes(key)) continue;
      if (["parking", "fuel", "bus_stop", "parking_entrance", "station", "stop_position"].includes(val)) continue;
      // Descartar por nombre cosas que claramente no son lugares de interés.
      // (estaci → cubre "estación", "estació", "estación de"; gare/bahnhof otros idiomas)
      if (/\b(parking|aparcamiento|estaci[óo]?|station|gare|bahnhof|aeropuerto|airport|parada|metro|terminal)\b/i.test(nombre)) continue;
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

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const cat = searchParams.get("cat") || "imperdibles";
  const lat = parseFloat(searchParams.get("lat"));
  const lon = parseFloat(searchParams.get("lon"));
  const radio = Math.min(parseInt(searchParams.get("radio") || "6000"), 12000);

  if (!FILTROS[cat] || isNaN(lat) || isNaN(lon)) {
    return Response.json({ error: "parámetros", elements: [] }, { status: 400 });
  }

  // Lanzamos AMBAS fuentes EN PARALELO (no secuencial). Overpass suele traer
  // más cantidad; Photon es rápido y estable. Así una ciudad lenta en Overpass
  // no nos hace esperar 13s: Photon ya viene en camino y unimos lo que llegue.
  const radioAmplio = Math.min(radio + 4000, 12000);
  const filtros = FILTROS[cat]
    .map((f) => `${f}(around:${radioAmplio},${lat},${lon});`)
    .join("");
  const query = `[out:json][timeout:9];(${filtros});out center 60;`;

  const pOverpass = carrera(query)
    .then((d) => desdeOverpass(d))
    .catch(() => []);
  const pPhoton = desdePhoton(cat, lat, lon).catch(() => []);

  // Esperamos Photon (rápido) primero. Luego a Overpass le damos un margen
  // ADAPTATIVO: si Photon ya trajo suficientes lugares (>=20), solo esperamos
  // 3s extra a Overpass (prioriza VELOCIDAD); si Photon trajo pocos, esperamos
  // hasta 9s (prioriza COBERTURA). Así la app se siente rápida sin quedar vacía.
  const phot = await pPhoton;
  const margenOverpass = phot.length >= 20 ? 3000 : 9000;
  const overp = await Promise.race([
    pOverpass,
    new Promise((res) => setTimeout(() => res([]), margenOverpass)),
  ]);

  // Unir sin duplicar nombres; Overpass primero (suele ser más rico/limpio).
  const vistos = new Set();
  let elementos = [];
  for (const e of [...overp, ...phot]) {
    const n = e.tags?.name;
    if (!n || vistos.has(n)) continue;
    vistos.add(n);
    elementos.push(e);
  }

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
