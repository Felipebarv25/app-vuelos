// POST /api/alertas/crear
// Body: { ciudad, pais, iata, umbral, lang? }
// Headers: Authorization Bearer <token>  (sesion email magic code)
//          O cookie de NextAuth Google
//
// Gate Free/Pro: el usuario gratuito puede tener 1 alerta activa.
// A partir de la 2da devuelve 402 (paywall) y el frontend abre el modal.

export const runtime = "nodejs";

import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { leerSesion } from "@/lib/auth";
import { kvActivo } from "@/lib/kv";
import { crearAlerta, contarAlertasUsuario } from "@/lib/alertas";
import { isPro } from "@/lib/entitlements";

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

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });

  const email = await identificar(req);
  if (!email) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const ciudad = String(body?.ciudad || "").trim().slice(0, 80);
  const pais = String(body?.pais || "").trim().slice(0, 80);
  const iata = String(body?.iata || "").trim().toUpperCase().slice(0, 3);
  const umbral = Number(body?.umbral);
  const lang = ["es", "en", "pt", "fr"].includes(body?.lang) ? body.lang : "es";
  // Origen preferido (IATA de hub, "" = cualquiera) — para que el usuario de
  // Medellin no reciba gangas saliendo de Bogota.
  const origenRaw = String(body?.origen || "").trim().toUpperCase().slice(0, 3);
  const origen = /^[A-Z]{3}$/.test(origenRaw) ? origenRaw : "";
  // Filtro de escalas: 0 (solo directo, default) | 1 | 99 (cualquiera).
  const escalasNum = Number(body?.escalasMax);
  const escalasMax = [0, 1, 99].includes(escalasNum) ? escalasNum : 0;
  // Moneda local del usuario para mostrar el precio convertido en el email.
  const monedaRaw = String(body?.moneda || "").trim().toUpperCase().slice(0, 3);
  const moneda = /^[A-Z]{3}$/.test(monedaRaw) ? monedaRaw : "";

  if (!ciudad || !pais || !/^[A-Z]{3}$/.test(iata) || !Number.isFinite(umbral) || umbral <= 0) {
    return Response.json({ ok: false, motivo: "datos-invalidos" }, { status: 400 });
  }

  // Gate Free/Pro: 1 alerta para usuarios gratuitos.
  const usuarioPro = await isPro(email);
  if (!usuarioPro) {
    const yaTiene = await contarAlertasUsuario(email);
    if (yaTiene >= 1) {
      return Response.json(
        { ok: false, motivo: "limite-free", limite: 1 },
        { status: 402 }
      );
    }
  }

  const alerta = await crearAlerta({ email, ciudad, pais, iata, umbral, lang, origen, escalasMax, moneda });
  if (!alerta) return Response.json({ ok: false, motivo: "no-creada" }, { status: 500 });

  return Response.json({ ok: true, alerta });
}
