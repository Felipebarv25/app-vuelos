// API propia en Vercel: consulta Overpass del lado servidor y cachea el
// resultado. Beneficios:
//  - Caché compartida entre usuarios (el 2º que busque una ciudad va instantáneo).
//  - Corre varios espejos en paralelo y usa el más rápido.
//  - La respuesta se sirve desde el edge de Vercel con cache HTTP.

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

// Lanza la consulta a todos los espejos en paralelo y se queda con la PRIMERA
// respuesta que trae datos reales (elements no vacío). Si todas las que llegan
// vienen vacías, devuelve la última (vacía) en vez de fallar.
function carrera(query) {
  const cuerpo = "data=" + encodeURIComponent(query);
  const intentos = MIRRORS.map((url) => {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 12000);
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
    let vacio = null; // guardamos una respuesta vacía por si todas lo son
    intentos.forEach((p) =>
      p
        .then((data) => {
          const n = data?.elements?.length || 0;
          if (n > 0) {
            resolve(data); // ¡con datos! ganadora
          } else {
            vacio = data;
            if (--pend === 0) resolve(vacio || { elements: [] });
          }
        })
        .catch(() => {
          if (--pend === 0) {
            if (vacio) resolve(vacio);
            else reject(new Error("overpass"));
          }
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
    const tieneDatos = (datos?.elements?.length || 0) > 0;
    return new Response(JSON.stringify(datos), {
      headers: {
        "Content-Type": "application/json",
        // Solo cacheamos respuestas CON datos. Las vacías no se cachean
        // (así un fallo temporal no deja la categoría vacía 24h).
        "Cache-Control": tieneDatos
          ? "public, s-maxage=86400, stale-while-revalidate=604800"
          : "no-store",
      },
    });
  } catch {
    return Response.json({ error: "overpass", elements: [] }, { status: 502 });
  }
}
