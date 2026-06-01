// API propia en Vercel para traer lugares. Estrategia robusta de 2 fuentes:
//  1) Overpass (OpenStreetMap) — trae todo lo de la zona por categoría.
//  2) Photon (Komoot) como RESPALDO — rápido y estable, busca por palabras.
// Si una falla o viene vacía, usamos la otra. Así la categoría NUNCA queda vacía.
// Cachea en el edge de Vercel solo cuando hay datos.

const MIRRORS = [
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const FILTROS = {
  imperdibles: [
    'node["tourism"~"attraction|museum|viewpoint|gallery|artwork"]["name"]',
    'node["historic"~"monument|memorial|castle|ruins|monastery|archaeological_site"]["name"]',
  ],
  restaurantes: ['node["amenity"="restaurant"]["name"]'],
  cafes: ['node["amenity"~"cafe|coffee_shop"]["name"]'],
  bares: ['node["amenity"~"bar|pub|nightclub"]["name"]'],
  miradores: ['node["tourism"="viewpoint"]["name"]'],
};

// Términos de búsqueda para el respaldo Photon, por categoría.
const TERMINOS_PHOTON = {
  imperdibles: ["museo", "monumento", "plaza", "parque", "catedral", "mirador"],
  restaurantes: ["restaurante", "restaurant"],
  cafes: ["cafe", "coffee"],
  bares: ["bar", "pub"],
  miradores: ["mirador", "viewpoint", "torre", "observation deck"],
};

function carrera(query) {
  const cuerpo = "data=" + encodeURIComponent(query);
  const intentos = MIRRORS.map((url) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 8000);
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
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

// RESPALDO: busca en Photon varios términos en paralelo y unifica.
async function desdePhoton(cat, lat, lon) {
  const terminos = TERMINOS_PHOTON[cat] || ["turismo"];
  const llamadas = terminos.map((t) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 6000);
    return fetch(
      `https://photon.komoot.io/api/?q=${encodeURIComponent(
        t
      )}&lat=${lat}&lon=${lon}&limit=20`,
      { signal: ctrl.signal }
    )
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
      // Filtrar a la zona (~15 km) para no traer cosas lejanas.
      const dist = Math.hypot(coords[1] - lat, coords[0] - lon);
      if (dist > 0.15) continue;
      vistos.add(nombre);
      out.push({
        type: "node",
        id: p.osm_id || nombre,
        lat: coords[1],
        lon: coords[0],
        tags: {
          name: nombre,
          [p.osm_key || "tourism"]: p.osm_value || "attraction",
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

  let elementos = [];

  // 1) Intentar Overpass (con radio ampliado para cubrir ciudades grandes)
  try {
    const radioAmplio = Math.min(radio + 4000, 12000);
    const filtros = FILTROS[cat]
      .map((f) => `${f}(around:${radioAmplio},${lat},${lon});`)
      .join("");
    const query = `[out:json][timeout:9];(${filtros});out center 60;`;
    const datos = await carrera(query);
    elementos = desdeOverpass(datos);
  } catch {
    elementos = [];
  }

  // 2) Si Overpass trajo POCOS (no solo cero), complementar con Photon.
  //    Así ciudades grandes siempre tienen una buena variedad de lugares.
  if (elementos.length < 10) {
    try {
      const extra = await desdePhoton(cat, lat, lon);
      const vistos = new Set(elementos.map((e) => e.tags?.name));
      for (const e of extra) {
        if (!vistos.has(e.tags?.name)) {
          elementos.push(e);
          vistos.add(e.tags?.name);
        }
      }
    } catch {}
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
