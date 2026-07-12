// GET /api/foto-calle?lat=..&lon=..
// NIVEL 4 de la cascada de fotos (no-negociable "todos los lugares con
// foto"): imagen a NIVEL DE CALLE via Mapillary (gratis con token; crear en
// mapillary.com/dashboard/developers y setear MAPILLARY_TOKEN en Vercel).
// Cubre bares, discotecas, tiendas — sitios que Wikipedia/Commons no tienen.
// Sin token responde {ok:false} y la cascada simplemente termina sin foto.
// El token vive AQUI (server) para no exponerlo en el bundle del cliente.

export const runtime = "edge";

export async function GET(req) {
  const token = process.env.MAPILLARY_TOKEN;
  const sp = new URL(req.url).searchParams;
  const lat = parseFloat(sp.get("lat"));
  const lon = parseFloat(sp.get("lon"));
  if (!token) return Response.json({ ok: false, motivo: "no-configurado" });
  if (isNaN(lat) || isNaN(lon)) {
    return Response.json({ ok: false, motivo: "coords" }, { status: 400 });
  }

  // bbox de ~120m alrededor del punto (grados aprox a nivel urbano).
  const dLat = 0.0011, dLon = 0.0014;
  const bbox = `${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}`;
  try {
    const r = await fetch(
      `https://graph.mapillary.com/images?fields=thumb_1024_url&bbox=${bbox}&limit=1`,
      {
        headers: { Authorization: `OAuth ${token}` },
        next: { revalidate: 60 * 60 * 24 * 30 }, // 30 dias
      }
    );
    if (!r.ok) return Response.json({ ok: false, motivo: "fuente" });
    const d = await r.json();
    const url = d?.data?.[0]?.thumb_1024_url || null;
    return Response.json(
      { ok: !!url, url },
      { headers: { "Cache-Control": "public, s-maxage=2592000, stale-while-revalidate=86400" } }
    );
  } catch {
    return Response.json({ ok: false, motivo: "error" });
  }
}
