// Moderacion del chat (2026-07-13) — boton "reportar" antes de crecer usuarios.
//
//   POST /api/eventos/chat/reportar { id, ts, uid }
//
// Reglas:
//   - Solo usuarios logueados reportan (mismo criterio que publicar).
//   - Un mensaje se identifica por <ts>:<uid> dentro de su chat.
//   - Si el que reporta es el AUTOR del mensaje -> se oculta de inmediato
//     (borrar mi propio mensaje usa la misma via, sin endpoint extra).
//   - Con >= UMBRAL reportes de usuarios distintos el mensaje se oculta para
//     todos (el GET del chat filtra contra ev:ocultos:<id>).
//   - Rate limit 1 reporte / 3 s por usuario. TTL igual al del chat (120 dias).

export const runtime = "nodejs";

import { kv, kvActivo, pipeline } from "@/lib/kv";
import { identificarUsuario, hashEmail } from "@/lib/identidad";

const TTL = 60 * 60 * 24 * 120;
const UMBRAL = 2; // comunidad chica: 2 personas distintas bastan para ocultar

function validarId(id) {
  return id && /^[\w-]+$/.test(id) && id.length <= 60;
}

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });

  const quien = await identificarUsuario(req);
  if (!quien) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = String(body?.id || "").trim();
  const ts = Number(body?.ts || 0);
  const uid = String(body?.uid || "").trim();
  if (!validarId(id) || !ts || !/^[a-z0-9]+$/.test(uid)) {
    return Response.json({ ok: false, motivo: "datos-invalidos" }, { status: 400 });
  }

  const yo = hashEmail(quien.email);
  const marca = `${ts}:${uid}`;
  const kOcultos = `ev:ocultos:${id}`;

  // Mi propio mensaje: ocultar directo (equivale a borrarlo).
  if (uid === yo) {
    await pipeline([
      ["SADD", kOcultos, marca],
      ["EXPIRE", kOcultos, String(TTL)],
    ]);
    return Response.json({ ok: true, oculto: true, propio: true });
  }

  // Rate limit 1 reporte / 3 s.
  const rl = await kv(["SET", `ev:rlrep:${yo}`, "1", "EX", "3", "NX"]);
  if (rl === null) {
    return Response.json({ ok: false, motivo: "muy-rapido" }, { status: 429 });
  }

  const kRep = `ev:rep:${id}:${marca}`;
  const [, nReportes] = await pipeline([
    ["SADD", kRep, yo],
    ["SCARD", kRep],
    ["EXPIRE", kRep, String(TTL)],
  ]);

  const oculto = Number(nReportes || 0) >= UMBRAL;
  if (oculto) {
    await pipeline([
      ["SADD", kOcultos, marca],
      ["EXPIRE", kOcultos, String(TTL)],
    ]);
  }
  return Response.json({ ok: true, oculto, reportes: Number(nReportes || 0) });
}
