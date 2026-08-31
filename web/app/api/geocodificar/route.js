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

function clave(ciudad, pais) {
  const n = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return `geo:ciudad:${n(ciudad)}|${n(pais)}`;
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const ciudad = (searchParams.get("ciudad") || "").trim().slice(0, 80);
  const pais = (searchParams.get("pais") || "").trim().slice(0, 80);
  if (!ciudad) {
    return Response.json({ error: "falta ciudad" }, { status: 400 });
  }

  const k = clave(ciudad, pais);
  if (kvActivo()) {
    const guardado = await kv(["GET", k]);
    if (guardado) {
      try {
        const d = JSON.parse(guardado);
        return Response.json({ ...d, cache: true });
      } catch {}
    }
  }

  const consulta = pais ? `${ciudad}, ${pais}` : ciudad;
  let salida = { encontrado: false };
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 7000);
    // osm_tag=place: evita que "York" resuelva a una calle o a un negocio
    // llamado York; queremos la localidad.
    const url =
      `https://photon.komoot.io/api/?q=${encodeURIComponent(consulta)}` +
      `&limit=1&osm_tag=place:city&osm_tag=place:town&osm_tag=place:village`;
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": UA } });
    clearTimeout(id);
    if (r.ok) {
      const d = await r.json();
      const f = (d.features || [])[0];
      const c = f?.geometry?.coordinates;
      if (Array.isArray(c) && c.length === 2) {
        salida = {
          encontrado: true,
          lat: Math.round(c[1] * 10000) / 10000,
          lon: Math.round(c[0] * 10000) / 10000,
          nombre: f.properties?.name || ciudad,
          pais: f.properties?.country || pais,
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
