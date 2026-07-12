// GET /api/eventos?ciudad=Medellin&pais=CO&desde=2026-08-28&hasta=2026-08-29
//
// Agenda de eventos reales (conciertos, deporte, teatro) de la ciudad via
// Ticketmaster Discovery API (gratis, 5.000 calls/dia con API key gratuita:
// developer.ticketmaster.com -> TICKETMASTER_API_KEY en Vercel).
//
// Capa social propia sobre KV: por cada evento devolvemos cuantos usuarios
// de Anduve dijeron "yo voy" (SCARD) y, si la peticion trae sesion, si el
// usuario actual va (SISMEMBER). El detalle social vive en
// /api/eventos/asistir y /api/eventos/chat.
//
// Cache edge 30 min por combinacion ciudad+fechas (los eventos no cambian
// minuto a minuto y cuidamos la cuota gratuita).

export const runtime = "nodejs";

import { kv, kvActivo, pipeline } from "@/lib/kv";
import { identificarUsuario, hashEmail } from "@/lib/identidad";

const TIPOS = {
  Music: "musica",
  Sports: "deporte",
  "Arts & Theatre": "arte",
  Film: "cine",
  Miscellaneous: "otro",
};

function normalizarEvento(e) {
  const venue = e._embedded?.venues?.[0] || {};
  const img = (e.images || [])
    .filter((i) => i.ratio === "16_9" && i.width >= 600)
    .sort((a, b) => a.width - b.width)[0];
  return {
    id: e.id,
    nombre: e.name,
    tipo: TIPOS[e.classifications?.[0]?.segment?.name] || "otro",
    fecha: e.dates?.start?.localDate || "",
    hora: (e.dates?.start?.localTime || "").slice(0, 5),
    lugar: venue.name || "",
    lat: venue.location?.latitude ? Number(venue.location.latitude) : null,
    lon: venue.location?.longitude ? Number(venue.location.longitude) : null,
    img: img?.url || e.images?.[0]?.url || "",
    url: e.url || "",
    precioDesde: e.priceRanges?.[0]?.min || null,
    moneda: e.priceRanges?.[0]?.currency || null,
  };
}

export async function GET(req) {
  const apiKey = process.env.TICKETMASTER_API_KEY;
  const sp = new URL(req.url).searchParams;
  const ciudad = (sp.get("ciudad") || "").trim().slice(0, 60);
  const pais = (sp.get("pais") || "").trim().toUpperCase().slice(0, 2);
  const desde = sp.get("desde") || new Date().toISOString().slice(0, 10);
  const hasta = sp.get("hasta") || desde;

  if (!apiKey) {
    // Sin key configurada: la UI muestra un estado "agenda en camino" en vez
    // de romperse. Configurar TICKETMASTER_API_KEY en Vercel (gratis).
    return Response.json({ ok: false, motivo: "no-configurado" }, { status: 503 });
  }
  if (!ciudad) {
    return Response.json({ ok: false, motivo: "sin-ciudad" }, { status: 400 });
  }

  try {
    const qs = new URLSearchParams({
      apikey: apiKey,
      city: ciudad,
      size: "40",
      sort: "date,asc",
      startDateTime: `${desde}T00:00:00Z`,
      endDateTime: `${hasta}T23:59:59Z`,
    });
    if (pais) qs.set("countryCode", pais);
    const r = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?${qs}`,
      { next: { revalidate: 1800 } } // 30 min de cache
    );
    if (!r.ok) throw new Error(`ticketmaster ${r.status}`);
    const d = await r.json();
    const eventos = (d._embedded?.events || []).map(normalizarEvento);

    // Capa social: contador "yo voy" + si el usuario actual va. Best-effort:
    // si KV no esta, los eventos salen sin contadores (asisten: 0).
    if (kvActivo() && eventos.length) {
      try {
        const counts = await pipeline(eventos.map((e) => ["SCARD", `ev:asis:${e.id}`]));
        eventos.forEach((e, i) => { e.asisten = Number(counts?.[i]) || 0; });
        const quien = await identificarUsuario(req);
        if (quien) {
          const yo = hashEmail(quien.email);
          const flags = await pipeline(eventos.map((e) => ["SISMEMBER", `ev:asis:${e.id}`, yo]));
          eventos.forEach((e, i) => { e.voy = Number(flags?.[i]) === 1; });
        }
      } catch {}
    }

    return Response.json(
      { ok: true, ciudad, desde, hasta, eventos },
      { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=3600" } }
    );
  } catch (e) {
    return Response.json({ ok: false, motivo: "fuente-fallo" }, { status: 502 });
  }
}
