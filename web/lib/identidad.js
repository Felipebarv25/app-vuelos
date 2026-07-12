// Identificacion unificada del usuario en API routes: sesion Google
// (NextAuth) o token Bearer del magic code. Extraido de alertas/crear
// (2026-07-11) para reusar en eventos (asistir/chat) sin duplicar.
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { leerSesion } from "@/lib/auth";

function leerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+([A-Za-z0-9]+)$/i);
  return m ? m[1] : null;
}

// Devuelve { email, nombre } o null si no hay sesion valida.
export async function identificarUsuario(req) {
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      return {
        email: session.user.email.toLowerCase(),
        nombre: session.user.name || session.user.email.split("@")[0],
      };
    }
  } catch {}
  const tok = leerToken(req);
  if (tok) {
    const sesion = await leerSesion(tok);
    if (sesion?.email) {
      return {
        email: sesion.email.toLowerCase(),
        nombre: sesion.nombre || sesion.email.split("@")[0],
      };
    }
  }
  return null;
}

// Hash corto y estable del email para usarlo como member en sets de KV sin
// exponer el correo (los contadores de "yo voy" son visibles publicamente).
export function hashEmail(email) {
  let h = 5381;
  const s = String(email || "").toLowerCase();
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
