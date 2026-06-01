// API propia en Vercel: consulta Overpass del lado servidor y cachea el
// resultado. Beneficios:
//  - Caché compartida entre usuarios (el 2º que busque una ciudad va instantáneo).
//  - Corre varios espejos en paralelo y usa el más rápido.
//  - La respuesta se sirve desde el edge de Vercel con cache HTTP.

const MIRRORS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
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

function carrera(query) {
  const cuerpo = "data=" + encodeURIComponent(query);
  const intentos = MIRRORS.map((url) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 6000);
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
    intentos.forEach((p) =>
      p.then(resolve).catch(() => {
        if (--pend === 0) reject(new Error("overpass"));
      })
    );
  });
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const cat = searchParams.get("cat") || "imperdibles";
  const lat = parseFloat(searchParams.get("lat"));
  const lon = parseFloat(searchParams.get("lon"));
  const radio = Math.min(parseInt(searchParams.get("radio") || "6000"), 12000);

  if (!FILTROS[cat] || isNaN(lat) || isNaN(lon)) {
    return Response.json({ error: "parámetros" }, { status: 400 });
  }

  const filtros = FILTROS[cat]
    .map((f) => `${f}(around:${radio},${lat},${lon});`)
    .join("");
  const query = `[out:json][timeout:10];(${filtros});out center 40;`;

  try {
    const datos = await carrera(query);
    return new Response(JSON.stringify(datos), {
      headers: {
        "Content-Type": "application/json",
        // Cache en el edge de Vercel: 1 día, y sirve mientras revalida.
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return Response.json({ error: "overpass" }, { status: 502 });
  }
}
