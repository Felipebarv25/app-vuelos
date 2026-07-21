// GET /api/alertas
// Lista las alertas del usuario logueado.
//
// DELETE /api/alertas?id=xyz
// Borra una alerta del usuario.

export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { leerSesion } from "@/lib/auth";
import { kvActivo } from "@/lib/kv";
import { listarAlertasUsuario, borrarAlerta, leerAlerta, actualizarAlerta } from "@/lib/alertas";

function leerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+([A-Za-z0-9]+)$/i);
  return m ? m[1] : null;
}

async function identificar(req) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) return session.user.email.toLowerCase();
  } catch {}
  const tok = leerToken(req);
  if (tok) {
    const sesion = await leerSesion(tok);
    if (sesion?.email) return sesion.email.toLowerCase();
  }
  return null;
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const email = await identificar(req);
  if (!email) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });
  const alertas = await listarAlertasUsuario(email);
  return Response.json({ ok: true, alertas });
}

export async function DELETE(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const email = await identificar(req);
  if (!email) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ ok: false, motivo: "sin-id" }, { status: 400 });

  // Verificar que la alerta es del usuario antes de borrar.
  const a = await leerAlerta(id);
  if (!a) return Response.json({ ok: false, motivo: "no-existe" }, { status: 404 });
  if (a.email !== email) return Response.json({ ok: false, motivo: "no-autorizado" }, { status: 403 });

  await borrarAlerta(id);
  return Response.json({ ok: true });
}

export async function PATCH(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const email = await identificar(req);
  if (!email) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body?.id) return Response.json({ ok: false, motivo: "sin-id" }, { status: 400 });

  const a = await leerAlerta(body.id);
  if (!a) return Response.json({ ok: false, motivo: "no-existe" }, { status: 404 });
  if (a.email !== email) return Response.json({ ok: false, motivo: "no-autorizado" }, { status: 403 });

  const campos = {};
  if (body.umbral !== undefined) {
    const u = Number(body.umbral);
    if (!Number.isFinite(u) || u <= 0) return Response.json({ ok: false, motivo: "umbral-invalido" }, { status: 400 });
    campos.umbral = Math.round(u);
  }
  if (body.activa !== undefined) campos.activa = !!body.activa;
  if (body.origen !== undefined) campos.origen = body.origen;
  if (body.escalasMax !== undefined) campos.escalasMax = body.escalasMax;

  if (!Object.keys(campos).length) return Response.json({ ok: false, motivo: "sin-cambios" }, { status: 400 });

  const actualizada = await actualizarAlerta(body.id, campos);
  if (!actualizada) return Response.json({ ok: false, motivo: "error-actualizando" }, { status: 500 });

  return Response.json({ ok: true, alerta: actualizada });
}
