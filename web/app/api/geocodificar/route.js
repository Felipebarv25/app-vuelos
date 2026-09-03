// GET /api/geocodificar?ciudad=Birmingham&pais=Reino%20Unido
//
// Coordenadas de CUALQUIER ciudad del mundo, para que el planificador de rutas
// no dependa del catálogo curado de 207 ciudades. Sin esto, una ruta que pase
// por Birmingham, Manchester o York —o por cualquier ciudad secundaria de
// cualquier país— no puede calcular distancias y se queda sin estimar el tramo.
//
// Usa Photon (Komoot), el mismo geocodificador que ya usa /api/lugares, y
// cachea el resultado en KV para siempre: las ciudades no se mueven de sitio.

export const runtime = "nodejs";

import { kv, kvActivo } from "@/lib/kv";

const UA = "Anduve/1.0 (https://anduve-app.vercel.app)";
const TTL = 60 * 60 * 24 * 365; // un año

// v2 en la clave: la v1 cacheó respuestas erróneas durante un rato (ver abajo)
// y hay que dejarlas atrás sin tener que salir a borrarlas a mano.
function clave(ciudad, iso) {
  const n = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return `geo:v2:${n(ciudad)}|${n(iso)}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ciudad = (searchParams.get("ciudad") || "").trim().slice(0, 80);
  // Código ISO de 2 letras, no el nombre del país. Photon no tiene parámetro de
  // país, así que el nombre había que meterlo en la consulta — y en español no
  // lo entiende: "Birmingham, Reino Unido" resolvía a una localidad de PERÚ
  // llamada "Reino Unido", y Birmingham, Manchester y York devolvían las tres
  // las mismas coordenadas peruanas. Ahora se busca solo la ciudad y se filtra
  // por countrycode, que Photon sí devuelve.
  const iso = (searchParams.get("iso") || "").trim().toUpperCase().slice(0, 2);
  // lista=1 devuelve varios candidatos en vez de uno. Lo usa el planificador de
  // rutas para dejar agregar ciudades SIN AEROPUERTO: el selector normal busca
  // sobre el catalogo IATA, y York, Brujas o Siena no estan ahi aunque sean
  // paradas perfectamente normales de una ruta en tren.
  const lista = searchParams.get("lista") === "1";

  // REVERSE: de coordenadas a ciudad. Lo pide el banner "Estas en {ciudad}".
  //
  // Ese banner se guiaba por la IP (header x-vercel-ip-city de Vercel), y en
  // Colombia la IP resuelve casi siempre a Bogota porque ahi esta la salida
  // del operador: a un usuario en Medellin le decia "Estas en Bogota". No es
  // un fallo del header — desde otra conexion devuelve Medellin bien —, es que
  // la IP dice donde sale tu red, no donde estas tu. La unica forma de saberlo
  // de verdad es preguntarle al GPS, y para traducir esas coordenadas a un
  // nombre de ciudad hace falta esto.
  const lat = Number(searchParams.get("lat"));
  const lon = Number(searchParams.get("lon"));
  if (Number.isFinite(lat) && Number.isFinite(lon)) return await inversa(lat, lon);
  if (!ciudad) {
    return Response.json({ error: "falta ciudad" }, { status: 400 });
  }
  if (lista) return await buscarVarias(ciudad, iso);

  const k = clave(ciudad, iso);
  if (kvActivo()) {
    const guardado = await kv(["GET", k]);
    if (guardado) {
      try {
        const d = JSON.parse(guardado);
        return Response.json({ ...d, cache: true });
      } catch {}
    }
  }

  let salida = { encontrado: false };
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 7000);
    // osm_tag=place: evita que "York" resuelva a una calle o a un negocio
    // llamado York; queremos la localidad.
    // Solo el nombre de la ciudad; el país se aplica después filtrando.
    // limit alto porque hay muchos homónimos (Birmingham hay en Inglaterra y
    // en Alabama) y el correcto puede no ser el primero.
    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(ciudad)}` +
      `&limit=15&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village`;
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    clearTimeout(id);
    if (r.ok) {
      const d = await r.json();
      const todos = d.features || [];
      // Con ISO se exige que el resultado esté en ese país; sin ISO, el primero.
      const f = iso
        ? todos.find((x) => (x.properties?.countrycode || "").toUpperCase() === iso)
        : todos[0];
      const c = f?.geometry?.coordinates;
      if (Array.isArray(c) && c.length === 2) {
        salida = {
          encontrado: true,
          lat: Math.round(c[1] * 10000) / 10000,
          lon: Math.round(c[0] * 10000) / 10000,
          nombre: f.properties?.name || ciudad,
          pais: f.properties?.country || "",
          iso: (f.properties?.countrycode || iso || "").toUpperCase(),
        };
      }
    }
  } catch {
    // Red caída o timeout: se responde "no encontrado" y la UI muestra el
    // tramo sin estimar en vez de inventar una distancia.
  }

  // Solo se cachea lo encontrado. Un fallo puntual de red no debe dejar una
  // ciudad marcada como inexistente durante un año.
  if (salida.encontrado && kvActivo()) {
    await kv(["SET", k, JSON.stringify(salida), "EX", String(TTL)]);
  }

  return new Response(JSON.stringify(salida), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": salida.encontrado
        ? "public, s-maxage=86400, stale-while-revalidate=604800"
        : "no-store",
    },
  });
}

// Varios candidatos para que el usuario elija. Sin caché: son búsquedas
// mientras teclea y el resultado depende de la cadena exacta.
async function inversa(lat, lon) {
  try {
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&lang=es&limit=1`;
    const r = await fetch(url, { headers: { "User-Agent": "Anduve/1.0" } });
    if (!r.ok) throw new Error("photon " + r.status);
    const d = await r.json();
    const p = d?.features?.[0]?.properties;
    if (!p) throw new Error("sin resultado");
    // `city` no siempre viene: en nucleos pequenos Photon devuelve el nombre en
    // `name` y la ciudad grande en `county`/`state`. Se toma el primero que haya.
    const ciudad = p.city || p.name || p.county || p.state || null;
    if (!ciudad) throw new Error("sin ciudad");
    return Response.json({
      encontrado: true,
      ciudad,
      iso: (p.countrycode || "").toUpperCase(),
      pais: p.country || "",
      region: p.state || "",
      lat,
      lon,
    });
  } catch {
    // Sin dato no se inventa nada: quien llama se queda con lo que tenia.
    return Response.json({ encontrado: false }, { status: 200 });
  }
}

async function buscarVarias(texto, iso) {
  const salida = [];
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 7000);
    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(texto)}` +
      `&limit=20&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village`;
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    clearTimeout(id);
    if (r.ok) {
      const d = await r.json();
      const vistos = new Set();
      for (const f of d.features || []) {
        const p = f.properties || {};
        const c = f.geometry?.coordinates;
        if (!Array.isArray(c) || c.length !== 2) continue;
        const cc = (p.countrycode || "").toUpperCase();
        if (iso && cc !== iso) continue;
        const llave = `${(p.name || "").toLowerCase()}|${cc}|${p.state || ""}`;
        if (vistos.has(llave)) continue;
        vistos.add(llave);
        salida.push({
          ciudad: p.name || texto,
          iso: cc,
          pais: p.country || "",
          region: p.state || "",
          lat: Math.round(c[1] * 10000) / 10000,
          lon: Math.round(c[0] * 10000) / 10000,
        });
        if (salida.length >= 6) break;
      }
    }
  } catch {}
  return new Response(JSON.stringify({ resultados: salida }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
