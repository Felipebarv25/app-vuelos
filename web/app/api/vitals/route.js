// Endpoint que recibe las métricas Web Vitals desde VitalsReporter
// (LCP + CLS por visita). Guardamos:
//   - LISTA `vitals:samples` (LPUSH, trim 1000): muestras crudas
//     recientes para calcular percentiles
//   - COUNTER `vitals:visits:YYYY-MM-DD` (INCR + EXPIRE 30d): pageviews
//     diarios para denominador

export const runtime = "edge";

const MAX_SAMPLES = 1000;
const TTL_VISITS = 60 * 60 * 24 * 30; // 30 días

export async function POST(req) {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return new Response(null, { status: 204 });

  let datos;
  try {
    datos = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  // Sanitizar — el browser nos puede mandar cualquier cosa.
  const lcp = typeof datos.lcp === "number" && datos.lcp > 0 && datos.lcp < 60000 ? Math.round(datos.lcp) : null;
  const cls = typeof datos.cls === "number" && datos.cls >= 0 && datos.cls < 10 ? datos.cls : null;
  if (lcp === null && cls === null) return new Response(null, { status: 204 });

  const muestra = {
    lcp,
    cls,
    ruta: typeof datos.ruta === "string" ? datos.ruta.slice(0, 100) : "/",
    ts: Date.now(),
  };

  const hoy = new Date().toISOString().slice(0, 10);

  // LPUSH + LTRIM + INCR del contador diario, todo en un pipeline.
  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([
        ["LPUSH", "vitals:samples", JSON.stringify(muestra)],
        ["LTRIM", "vitals:samples", "0", String(MAX_SAMPLES - 1)],
        ["INCR", `vitals:visits:${hoy}`],
        ["EXPIRE", `vitals:visits:${hoy}`, String(TTL_VISITS)],
      ]),
    });
  } catch {
    // Silencioso. Vitals no es crítico — si KV cae, no pasa nada.
  }

  return new Response(null, { status: 204 });
}

// GET: agrega las muestras y devuelve percentiles p50 / p75 / p90 de
// LCP y CLS para el panel admin. Sin autenticación porque el endpoint
// queda detrás de la auth del /panel cliente (el panel valida con su
// código antes de mostrarlo).
export async function GET() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    return Response.json({ ok: false, error: "kv_no_configurado" }, { status: 503 });
  }

  let samples = [];
  try {
    const r = await fetch(`${url}/lrange/vitals:samples/0/999`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await r.json();
    samples = (data?.result || [])
      .map((s) => {
        try { return JSON.parse(s); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return Response.json({ ok: false, error: "kv_fallo_lectura" }, { status: 503 });
  }

  function percentil(arr, p) {
    if (!arr.length) return null;
    const s = [...arr].sort((a, b) => a - b);
    const i = Math.floor((p / 100) * (s.length - 1));
    return s[i];
  }

  const lcps = samples.filter((m) => m.lcp != null).map((m) => m.lcp);
  const clss = samples.filter((m) => m.cls != null).map((m) => m.cls);

  return Response.json({
    ok: true,
    muestras: samples.length,
    lcp: {
      p50: percentil(lcps, 50),
      p75: percentil(lcps, 75),
      p90: percentil(lcps, 90),
      bueno: 2500,
      malo: 4000,
    },
    cls: {
      p50: percentil(clss, 50),
      p75: percentil(clss, 75),
      p90: percentil(clss, 90),
      bueno: 0.1,
      malo: 0.25,
    },
  });
}
