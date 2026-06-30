// POST /api/alertas/disparar
// Llamado por el DETECTOR (Python cron cada 3h) cuando encuentra precios
// nuevos. El detector pasa el precio observado y nosotros buscamos las
// alertas que cumplen (umbral >= precio), las disparamos y mandamos email.
//
// Auth: ALERTS_SHARED_SECRET en header X-Alert-Secret. Sin esto, cualquier
// bot podria spamear "Madrid US$10!" y mandar emails falsos a los usuarios.
//
// Body: { iata, origen, precio, fecha_ida, fecha_vuelta, link, aerolinea }

export const runtime = "nodejs";

import { kvActivo } from "@/lib/kv";
import {
  idsAlertasPorIATA,
  leerAlerta,
  marcarDisparada,
} from "@/lib/alertas";
import { enviarAlertaPrecio } from "@/lib/email";

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });

  const secret = process.env.ALERTS_SHARED_SECRET;
  const enviado = req.headers.get("x-alert-secret");
  if (!secret || enviado !== secret) {
    return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const iata = String(body?.iata || "").toUpperCase();
  const precio = Number(body?.precio);
  if (!/^[A-Z]{3}$/.test(iata) || !Number.isFinite(precio) || precio <= 0) {
    return Response.json({ ok: false, motivo: "datos-invalidos" }, { status: 400 });
  }

  // FILTRO ANTI-SPAM (2026-06-29): solo enviamos email si el precio esta al
  // menos 20% por debajo del promedio historico de la ruta. Asi evitamos
  // notificar precios que apenas cumplen el umbral pero no son notable
  // ganga. El detector calcula el promedio y nos lo manda en `promedio_ruta`.
  // Si no viene (ruta sin historia), aplicamos solo el umbral del usuario.
  const promedioRuta = Number(body?.promedio_ruta);
  const tienePromedio = Number.isFinite(promedioRuta) && promedioRuta > 0;
  const UMBRAL_GANGA = 0.80; // precio <= promedio * 0.80 = 20% bajo el avg
  if (tienePromedio && precio > promedioRuta * UMBRAL_GANGA) {
    return Response.json({
      ok: true,
      disparadas: 0,
      motivo: "no-es-ganga",
      precio,
      promedio: Math.round(promedioRuta),
      umbral_ganga: Math.round(promedioRuta * UMBRAL_GANGA),
    });
  }

  const ids = await idsAlertasPorIATA(iata);
  if (!ids.length) return Response.json({ ok: true, disparadas: 0 });

  let disparadas = 0;
  let errores = 0;

  for (const id of ids) {
    const a = await leerAlerta(id);
    if (!a || !a.activa) continue;
    if (precio > a.umbral) continue;

    try {
      const env = await enviarAlertaPrecio({
        to: a.email,
        ciudad: a.ciudad,
        pais: a.pais,
        precio,
        umbral: a.umbral,
        origen: body?.origen || "",
        fecha_ida: body?.fecha_ida || "",
        fecha_vuelta: body?.fecha_vuelta || "",
        link: body?.link || "",
        aerolinea: body?.aerolinea || "",
        lang: a.lang || "es",
      });
      if (env?.ok) {
        await marcarDisparada(id);
        disparadas++;
      } else {
        errores++;
      }
    } catch {
      errores++;
    }
  }

  return Response.json({ ok: true, disparadas, errores });
}
