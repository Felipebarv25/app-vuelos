// GET /api/auth/sesion
// Header: Authorization: Bearer <token>
// Devuelve { ok, usuario } si el token corresponde a una sesion vigente.
//
// POST /api/auth/sesion (sin body)
// Logout: borra la sesion del token enviado.

export const runtime = "nodejs";

import { kvActivo } from "@/lib/kv";
import { leerSesion, borrarSesion } from "@/lib/auth";

function leerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+([A-Za-z0-9]+)$/i);
  return m ? m[1] : null;
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const token = leerToken(req);
  if (!token) return Response.json({ ok: false, motivo: "sin-token" }, { status: 401 });

  const usuario = await leerSesion(token);
  if (!usuario) return Response.json({ ok: false, motivo: "no-existe" }, { status: 401 });

  return Response.json({
    ok: true,
    usuario: {
      email: usuario.email,
      nombre: usuario.nombre,
      desde: usuario.creado || null,
    },
  });
}

export async function POST(req) {
  const token = leerToken(req);
  if (token) await borrarSesion(token);
  return Response.json({ ok: true });
}
