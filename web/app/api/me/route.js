// GET /api/me
// Devuelve el estado Pro del usuario logueado. El frontend lo usa para
// decidir si abrir el paywall o ejecutar la accion directamente.
//
// Soporta tres mecanismos de identificacion:
//   1) NextAuth (Google): getServerSession con authOptions -> email confiable.
//   2) Magic code (sesion email en KV): Authorization: Bearer <token>
//      -> leerSesion devuelve el email.
//
// Si ninguno hay, retorna { pro: false } anonimo.

export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { leerPro, leerCreditos } from "@/lib/entitlements";
import { usoActual } from "@/lib/guardiaPro";
import { limiteDe } from "@/lib/features";
import { leerSesion } from "@/lib/auth";

function leerTokenEmail(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+([A-Za-z0-9]+)$/i);
  return m ? m[1] : null;
}

export async function GET(req) {
  let email = null;
  let fuente = null;

  // Primero NextAuth (cookie de sesion Google).
  try {
    const session = await getServerSession(authOptions);
    if (session?.user?.email) {
      email = session.user.email.toLowerCase();
      fuente = "google";
    }
  } catch {}

  // Si no, intentamos el token de email magic code.
  if (!email) {
    const tok = leerTokenEmail(req);
    if (tok) {
      const sesion = await leerSesion(tok);
      if (sesion?.email) {
        email = sesion.email.toLowerCase();
        fuente = "email";
      }
    }
  }

  if (!email) {
    return Response.json({ pro: false, anonimo: true });
  }

  const proData = await leerPro(email);
  const [creditosPdf, creditosAlerta] = await Promise.all([
    leerCreditos(email, "pdf"),
    leerCreditos(email, "alerta"),
  ]);

  // LOS LIMITES, CONTADOS POR EL SERVIDOR.
  //
  // La pantalla no adivina cuantas consultas le quedan al viajero: se lo dice
  // quien lleva la cuenta. Asi "te quedan 3 de 5" es un dato, no una
  // estimacion del navegador que cualquiera podria falsear.
  const pro = !!proData;
  const [usoAsesor, usoVuelos] = await Promise.all([
    usoActual("asesor", email),
    usoActual("vuelo_vivo", email),
  ]);
  const limites = {
    asesor: { limite: limiteDe("asesor", pro), usado: usoAsesor },
    vuelo_vivo: { limite: limiteDe("vuelo_vivo", pro), usado: usoVuelos },
    viajes_guardados: { limite: limiteDe("viajes_guardados", pro) },
    alertas_precio: { limite: limiteDe("alertas_precio", pro) },
  };

  return Response.json({
    email,
    fuente,
    pro,
    limites,
    plan: proData?.plan || null,
    until: proData?.until || null,
    // Cancelada pero vigente NO es lo mismo que activa: la primera no se
    // renovara. Solo se devuelve si la pasarela nos lo dijo.
    cancelada: Boolean(proData?.cancelada),
    creditos: {
      pdf: creditosPdf,
      alerta: creditosAlerta,
    },
  });
}
