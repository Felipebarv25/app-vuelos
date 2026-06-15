// GET /api/popular
// Devuelve { ok, ciudades: { "Ciudad, País": N } } con las busquedas
// acumuladas por destino. Lo alimenta el tracker /api/track via
// ZINCRBY m:busc:ciudad cada vez que alguien busca una ciudad.
//
// La home usa esto para mostrar "🔥 N viajeros han buscado X" en las cards
// de Ofertas — social proof real, no inventado.
//
// Cache 5 min: las busquedas son ruido a granularidad de segundos; suficiente
// frescura cada 5 minutos y nos protege a KV de saturarse con el trafico.

export const runtime = "nodejs";

import { kv, kvActivo } from "@/lib/kv";

export async function GET() {
  if (!kvActivo()) {
    return Response.json({ ok: false, motivo: "no-storage" }, { status: 200 });
  }
  try {
    // ZREVRANGE con scores: top 200 ciudades. Upstash REST devuelve un array
    // plano [miembro1, score1, miembro2, score2, ...].
    const raw = await kv(["ZREVRANGE", "m:busc:ciudad", "0", "199", "WITHSCORES"]);
    if (!Array.isArray(raw) || raw.length === 0) {
      return Response.json({ ok: true, ciudades: {} });
    }
    const ciudades = {};
    for (let i = 0; i < raw.length; i += 2) {
      const nombre = String(raw[i]);
      const cuenta = Number(raw[i + 1]) || 0;
      if (cuenta > 0) ciudades[nombre] = cuenta;
    }
    return Response.json(
      { ok: true, ciudades },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
