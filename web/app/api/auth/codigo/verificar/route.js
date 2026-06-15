// POST /api/auth/codigo/verificar
// Body: { email, codigo, nombre? }
// Si el codigo es valido y no expiro, crea una sesion (30 dias) y devuelve
// el token. El cliente lo guarda en localStorage y lo manda en Authorization.

export const runtime = "nodejs";

import { kvActivo, kv } from "@/lib/kv";
import {
  consumirCodigo,
  crearSesion,
  emailValido,
  normalizarEmail,
} from "@/lib/auth";

export async function POST(req) {
  if (!kvActivo()) {
    return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const email = normalizarEmail(body?.email);
  const codigo = String(body?.codigo || "").replace(/\D/g, "").slice(0, 6);
  const nombreCliente = String(body?.nombre || "").trim().slice(0, 60);

  if (!emailValido(email) || codigo.length !== 6) {
    return Response.json({ ok: false, motivo: "datos-invalidos" }, { status: 400 });
  }

  const valido = await consumirCodigo(email, codigo);
  if (!valido) {
    return Response.json({ ok: false, motivo: "codigo-incorrecto" }, { status: 401 });
  }

  // Crear o recuperar el perfil del usuario. Guardamos el registro maestro
  // en user:<email> para que sirva como base del perfil personalizado en
  // proximas iteraciones (gustos, historial). En esta version es minimo.
  const claveUsuario = `user:${email}`;
  let perfil = null;
  try {
    const raw = await kv(["GET", claveUsuario]);
    perfil = raw ? JSON.parse(raw) : null;
  } catch { perfil = null; }

  if (!perfil) {
    perfil = {
      email,
      nombre: nombreCliente || email.split("@")[0],
      creado: Date.now(),
      gustos: {}, // se ira poblando con eventos de busqueda
    };
    await kv(["SET", claveUsuario, JSON.stringify(perfil)]);
  } else if (nombreCliente && perfil.nombre !== nombreCliente) {
    // El usuario actualizo su nombre al volver a entrar: lo guardamos.
    perfil.nombre = nombreCliente;
    await kv(["SET", claveUsuario, JSON.stringify(perfil)]);
  }

  const usuarioSesion = { email: perfil.email, nombre: perfil.nombre };
  const token = await crearSesion(usuarioSesion);
  if (!token) {
    return Response.json({ ok: false, motivo: "no-sesion" }, { status: 500 });
  }

  return Response.json({
    ok: true,
    token,
    usuario: {
      email: perfil.email,
      nombre: perfil.nombre,
      desde: perfil.creado,
    },
  });
}
