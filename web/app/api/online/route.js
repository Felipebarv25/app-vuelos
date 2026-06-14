// Presencia en vivo: cuantos navegadores tienen la app abierta AHORA mismo.
//
// Modelo: ZSET m:presence donde member = sessionId y score = timestamp ms.
//  - Cada cliente con la app abierta hace POST /api/online cada 60s.
//  - El servidor ZADD actualiza el score de su sessionId al `now` actual.
//  - "En vivo" = sesiones con un ping en los ultimos 90s (ZCOUNT en ventana).
//  - Una limpieza barata se dispara 1 de cada 20 pings: ZREMRANGEBYSCORE
//    corta entradas mas viejas de 10 min para que el set no crezca infinito.
//
// El GET mantiene el conteo agregado "hoy / total" (para la version no-live
// y/o como respaldo si KV no esta listo).

export const runtime = "nodejs";

import { kv, kvActivo, pipeline } from "@/lib/kv";

const hoy = () => new Date().toISOString().slice(0, 10);

// Bots filtrados igual que en /api/track. Sin esto, Googlebot et al. inflarian
// la cuenta "en vivo" cada vez que pidieran ZADD.
const PATRON_BOT = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|pingdom|uptimerobot|monitor|vercel-screenshot|vercel-favicon|vercel-fetch|vercel-edge|vercel-og|headless|chrome-lighthouse|google-inspectiontool|curl\/|wget\/|python-requests|node-fetch|axios|http-client|postmanruntime|insomnia/i;
function esBot(ua) {
  if (!ua) return true;
  return PATRON_BOT.test(ua);
}

const VENTANA_VIVOS_MS = 90 * 1000;
const PURGA_VIEJAS_MS = 10 * 60 * 1000;

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false }, { status: 200 });
  const ua = req.headers.get("user-agent") || "";
  if (esBot(ua)) return Response.json({ ok: true, bot: true, online: 0 });

  let body = {};
  try {
    body = await req.json();
  } catch {}
  const sid = String(body?.sessionId || "").slice(0, 64);
  if (!sid) return Response.json({ ok: false, error: "no-session" }, { status: 200 });

  const ahora = Date.now();
  const desde = ahora - VENTANA_VIVOS_MS;
  const corte = ahora - PURGA_VIEJAS_MS;

  // Pipeline: anotar este ping + (cada cierto rato) limpiar entradas viejas +
  // leer el conteo de la ventana. ZCOUNT no necesita que limpiemos para ser
  // correcto, pero la limpieza evita que el ZSET crezca sin techo.
  const cmds = [["ZADD", "m:presence", String(ahora), sid]];
  // 1 de cada ~20 llamadas hace la purga (estocastico, abarata el costo).
  if (Math.random() < 0.05) {
    cmds.push(["ZREMRANGEBYSCORE", "m:presence", "-inf", String(corte)]);
  }
  cmds.push(["ZCOUNT", "m:presence", String(desde), "+inf"]);

  try {
    const res = await pipeline(cmds);
    const online = Number(res[res.length - 1]) || 0;
    return Response.json({ ok: true, online });
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}

export async function GET() {
  if (!kvActivo()) return Response.json({ ok: false }, { status: 200 });
  try {
    const ahora = Date.now();
    const desde = ahora - VENTANA_VIVOS_MS;
    const [hoyN, totalN, online] = await Promise.all([
      kv(["GET", `m:vis:${hoy()}`]),
      kv(["GET", "m:vis:total"]),
      kv(["ZCOUNT", "m:presence", String(desde), "+inf"]),
    ]);
    return Response.json(
      {
        ok: true,
        hoy: Number(hoyN) || 0,
        total: Number(totalN) || 0,
        online: Number(online) || 0,
      },
      {
        headers: {
          // Cache muy corto (10s) para que el "en vivo" se sienta vivo sin
          // saturar KV si la home recibe trafico alto.
          "Cache-Control": "public, s-maxage=10, stale-while-revalidate=10",
        },
      }
    );
  } catch {
    return Response.json({ ok: false }, { status: 200 });
  }
}
