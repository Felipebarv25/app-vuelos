// Devuelve un conteo agregado de visitantes (hoy y total). El "live" real
// requiere presencia con TTL (caro en KV free); en vez de eso usamos la metrica
// de visitas unicas por sesion ya existente (track.js -> trackVisita), que es
// una proxy razonable de "viajeros activos hoy" para la prueba social del HERO.

export const runtime = "nodejs";

import { kv, kvActivo } from "@/lib/kv";

const hoy = () => new Date().toISOString().slice(0, 10);

export async function GET() {
  // Si KV no esta configurado, devolvemos null y la UI esconde el chip.
  if (!kvActivo()) return Response.json({ ok: false }, { status: 200 });
  try {
    const [hoyN, totalN] = await Promise.all([
      kv(["GET", `m:vis:${hoy()}`]),
      kv(["GET", "m:vis:total"]),
    ]);
    return Response.json(
      {
        ok: true,
        hoy: Number(hoyN) || 0,
        total: Number(totalN) || 0,
      },
      {
        headers: {
          // Cache de 60s en el edge — no necesitamos precision al segundo y
          // protege a KV de saturarse si la home recibe trafico alto.
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60",
        },
      }
    );
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
