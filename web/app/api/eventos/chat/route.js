// Chat por evento — la capa "red social" de Anduve Live (2026-07-11).
//
//   GET  /api/eventos/chat?id=<evento>       -> ultimos 100 mensajes
//   POST /api/eventos/chat { id, texto }     -> publica (requiere sesion)
//
// Guardias:
//   - Solo usuarios logueados publican (leer es libre para dar FOMO).
//   - Rate limit 1 mensaje / 5s por usuario (SET NX EX).
//   - Max 280 chars, sin URLs (anti-spam de bots), cap 200 mensajes por
//     evento (LTRIM), TTL 120 dias.
//   - El autor se muestra por primer nombre; nunca exponemos el email.

export const runtime = "nodejs";

import { kv, kvActivo, pipeline } from "@/lib/kv";
import { identificarUsuario, hashEmail } from "@/lib/identidad";

const TTL = 60 * 60 * 24 * 120;
const MAX_MENSAJES = 200;

function validarId(id) {
  return id && /^[\w-]+$/.test(id) && id.length <= 60;
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!validarId(id)) return Response.json({ ok: false, motivo: "datos-invalidos" }, { status: 400 });

  const raw = (await kv(["LRANGE", `ev:chat:${id}`, "0", "99"])) || [];
  // LPUSH guarda el mas nuevo primero; la UI quiere cronologico.
  const mensajes = raw
    .map((s) => { try { return JSON.parse(s); } catch { return null; } })
    .filter(Boolean)
    .reverse();
  return Response.json({ ok: true, mensajes });
}

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });

  const quien = await identificarUsuario(req);
  if (!quien) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = String(body?.id || "").trim();
  let texto = String(body?.texto || "").trim().slice(0, 280);
  if (!validarId(id) || !texto) {
    return Response.json({ ok: false, motivo: "datos-invalidos" }, { status: 400 });
  }
  // Anti-spam basico: sin links. El chat es para coordinarse, no para phishing.
  if (/https?:\/\/|www\./i.test(texto)) {
    return Response.json({ ok: false, motivo: "sin-links" }, { status: 422 });
  }

  // Rate limit 1 msg / 5 s por usuario.
  const yo = hashEmail(quien.email);
  const rl = await kv(["SET", `ev:rl:${yo}`, "1", "EX", "5", "NX"]);
  if (rl === null) {
    return Response.json({ ok: false, motivo: "muy-rapido" }, { status: 429 });
  }

  const primerNombre = (quien.nombre || "Viajero").trim().split(/\s+/)[0].slice(0, 20);
  const msg = {
    de: primerNombre.charAt(0).toUpperCase() + primerNombre.slice(1),
    uid: yo, // para que el cliente marque "mis" mensajes
    texto,
    ts: Date.now(),
  };
  const k = `ev:chat:${id}`;
  await pipeline([
    ["LPUSH", k, JSON.stringify(msg)],
    ["LTRIM", k, "0", String(MAX_MENSAJES - 1)],
    ["EXPIRE", k, String(TTL)],
  ]);
  return Response.json({ ok: true, mensaje: msg });
}
