// POST /api/eventos/asistir  { id, voy: true|false }
// Marca/desmarca "yo voy" a un evento. Requiere sesion (Google o magic code).
// KV: ev:asis:<idEvento> = SET de hashes de email (no exponemos correos).
// TTL 120 dias — los eventos pasan y el set muere solo.

export const runtime = "nodejs";

import { kv, kvActivo, pipeline } from "@/lib/kv";
import { identificarUsuario, hashEmail } from "@/lib/identidad";

const TTL = 60 * 60 * 24 * 120;

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });

  const quien = await identificarUsuario(req);
  if (!quien) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = String(body?.id || "").trim().slice(0, 60);
  const voy = !!body?.voy;
  if (!id || !/^[\w-]+$/.test(id)) {
    return Response.json({ ok: false, motivo: "datos-invalidos" }, { status: 400 });
  }

  const k = `ev:asis:${id}`;
  const yo = hashEmail(quien.email);
  if (voy) {
    await pipeline([["SADD", k, yo], ["EXPIRE", k, String(TTL)]]);
  } else {
    await kv(["SREM", k, yo]);
  }
  const n = Number(await kv(["SCARD", k])) || 0;
  return Response.json({ ok: true, voy, asisten: n });
}
