// Tasas de cambio en vivo (USD → monedas locales). Consulta un feed público y
// gratuito (open.er-api.com, sin API key) y lo cachea 6 h en el edge de Vercel
// para no golpear la fuente en cada visita. Si la fuente falla, devuelve los
// valores de respaldo con enVivo:false (la app sigue funcionando con aproximados).
export const runtime = "nodejs";
export const revalidate = 21600; // 6 h

import { PORUSD_FALLBACK, MONEDAS_USADAS } from "@/lib/fx";

const FUENTE = "https://open.er-api.com/v6/latest/USD";

export async function GET() {
  try {
    const r = await fetch(FUENTE, { next: { revalidate: 21600 } });
    if (!r.ok) throw new Error("er-api " + r.status);
    const d = await r.json();
    if (d.result !== "success" || !d.rates) throw new Error("er-api sin rates");

    // Tomamos solo las monedas que la app usa; si alguna falta, usamos su respaldo.
    const porUsd = { USD: 1 };
    for (const cod of MONEDAS_USADAS) {
      const v = d.rates[cod];
      porUsd[cod] = typeof v === "number" && v > 0 ? v : PORUSD_FALLBACK[cod];
    }

    return Response.json(
      {
        base: "USD",
        porUsd,
        fecha: d.time_last_update_utc || null,
        fuente: "open.er-api.com",
        enVivo: true,
      },
      { headers: { "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" } }
    );
  } catch {
    return Response.json({
      base: "USD",
      porUsd: PORUSD_FALLBACK,
      fecha: null,
      fuente: "respaldo",
      enVivo: false,
    });
  }
}
