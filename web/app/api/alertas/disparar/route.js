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

  // Escalas del vuelo visto. El detector manda escalas_ida/vuelta (entero o
  // null = desconocido). "Peor" = el maximo de los dos tramos; si ALGUNO es
  // desconocido, el total es desconocido (no podemos prometer "directo").
  const escIda = Number.isInteger(body?.escalas_ida) ? body.escalas_ida : null;
  const escVuelta = Number.isInteger(body?.escalas_vuelta) ? body.escalas_vuelta : null;
  const peorEscalas = escIda != null && escVuelta != null ? Math.max(escIda, escVuelta) : null;
  const origenVuelo = String(body?.origen || "").toUpperCase();

  let disparadas = 0;
  let errores = 0;

  for (const id of ids) {
    const a = await leerAlerta(id);
    if (!a || !a.activa) continue;
    if (precio > a.umbral) continue;

    // Filtro de ORIGEN: si la alerta pide salir de un hub especifico, solo
    // dispara con vuelos desde ese hub (feedback 2026-07-11: usuario en
    // Medellin recibia alertas saliendo de Bogota). Alertas viejas sin
    // `origen` mantienen el comportamiento anterior (cualquier origen).
    if (a.origen && origenVuelo && a.origen !== origenVuelo) continue;

    // Filtro de ESCALAS: escalasMax 0 = solo directo (default de alertas
    // nuevas), 1 = hasta 1 escala, 99 = cualquiera. Alertas viejas sin el
    // campo se tratan como 99 (no romper lo que ya existia). Si las escalas
    // del vuelo son DESCONOCIDAS solo disparan las alertas que aceptan
    // cualquier vuelo — nunca prometemos "directo" sin dato.
    const maxAceptado = Number.isFinite(Number(a.escalasMax)) ? Number(a.escalasMax) : 99;
    if (maxAceptado < 99) {
      if (peorEscalas == null || peorEscalas > maxAceptado) continue;
    }

    try {
      const env = await enviarAlertaPrecio({
        to: a.email,
        ciudad: a.ciudad,
        pais: a.pais,
        precio,
        umbral: a.umbral,
        origen: origenVuelo,
        fecha_ida: body?.fecha_ida || "",
        fecha_vuelta: body?.fecha_vuelta || "",
        link: body?.link || "",
        aerolinea: body?.aerolinea || "",
        lang: a.lang || "es",
        escalas: peorEscalas,
        moneda: a.moneda || "",
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
