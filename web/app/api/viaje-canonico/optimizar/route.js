import { normalizarViaje } from "@/lib/viajeCanonico";
import { optimizarViaje } from "@/lib/optimizadorViaje";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch { return Response.json({ ok: false, motivo: "json" }, { status: 400 }); }

  const viaje = normalizarViaje(body?.viaje || body, body?.origen === "legacy" ? "legacy" : "ruta");
  if (!viaje || viaje.paradas.length < 2) {
    return Response.json({ ok: false, motivo: "faltan-paradas" }, { status: 400 });
  }

  const resultado = optimizarViaje(viaje.paradas);
  return Response.json({
    ok: true,
    viajeId: viaje.id,
    ...resultado,
    generadoEn: Date.now(),
  }, { headers: { "Cache-Control": "no-store" } });
}
