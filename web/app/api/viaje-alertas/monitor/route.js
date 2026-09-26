// EL MONITOR: la unica parte que gasta dinero.
//
// Lo llama el cron con el MISMO secreto compartido que ya usa el detector de
// vuelos (ALERTS_SHARED_SECRET). No hay infraestructura nueva: GitHub Actions
// ya corre tareas programadas en este proyecto y este endpoint es un cliente
// mas de esa costumbre.
//
// EL FRENO DE MANO, QUE AQUI NO ES OPCIONAL
//
// La leccion del Proceso 4 en una linea: abrir "Mi viaje" disparaba nueve
// consultas de pago por carga. Eso no puede repetirse multiplicado por todos
// los viajes guardados y por 24 horas al dia. Por eso el monitor:
//
//   · solo mira viajes que alguien ABRIO al menos una vez (hay snapshot),
//   · salta los que se consultaron hace menos de 12 h,
//   · salta los que no tienen fecha o ya pasaron,
//   · consulta como mucho DOS tramos por viaje, los mas caros y solo aereos,
//   · y atiende como mucho unos pocos viajes por ronda.
//
// Con eso, un viaje cuesta a lo sumo dos consultas cada doce horas, y solo
// mientras siga siendo un viaje futuro que a alguien le importa.
//
// QUE HACE Y QUE NO
//
// Refresca PRECIOS y compara. No recalcula el coste ni las tareas: para eso
// haria falta rehacer el analisis entero del viaje, que es caro y que el
// tablero ya hace cuando el viajero entra. Asi el monitor no puede inventarse
// un cambio de presupuesto que nadie ha comprobado.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { kv, kvActivo } from "@/lib/kv";
import { detectarCambios, fundirAlertas, tocaMonitorear, K_VIGILADOS, UMBRALES } from "@/lib/motorAlertas";

const TTL = 60 * 60 * 24 * 120;
const TOPE_VIAJES_POR_RONDA = 8;

const kAlertas = (rutaId) => `alertasviaje:${rutaId}`;
const kRuta = (rutaId) => `ruta:${rutaId}`;

/** Un viaje que ya paso no necesita que nadie le vigile el precio. */
function viajeVigente(ruta, ahora) {
  const f = String(ruta?.fechaIda || "").trim();
  const m = String(ruta?.mesInicio || "").trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : (/^\d{4}-\d{2}$/.test(m) ? `${m}-01` : null);
  if (!iso) return false;                       // sin fecha no hay precio que consultar
  const salida = new Date(`${iso}T00:00:00`).getTime();
  if (!Number.isFinite(salida) || salida < ahora) return false;
  // Mas alla de nueve meses los precios todavia no son significativos.
  return salida - ahora < 280 * 24 * 60 * 60 * 1000;
}

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });

  const secret = process.env.ALERTS_SHARED_SECRET;
  if (!secret || req.headers.get("x-alert-secret") !== secret) {
    return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });
  }

  const ahora = Date.now();
  const origen = new URL(req.url).origin;
  const ids = (await kv(["SMEMBERS", K_VIGILADOS])) || [];

  const informe = { revisados: 0, consultas: 0, alertasNuevas: 0, saltados: { sinSnapshot: 0, reciente: 0, noVigente: 0, sinTramos: 0, huerfano: 0 } };

  for (const rutaId of ids) {
    if (informe.revisados >= TOPE_VIAJES_POR_RONDA) break;

    const rawRuta = await kv(["GET", kRuta(rutaId)]);
    if (!rawRuta) {
      // La ruta se borro: el vigilado se cae solo, sin dejar basura.
      await kv(["SREM", K_VIGILADOS, rutaId]);
      informe.saltados.huerfano++;
      continue;
    }
    let ruta;
    try { ruta = JSON.parse(rawRuta); } catch { continue; }

    if (!viajeVigente(ruta, ahora)) { await kv(["SREM", K_VIGILADOS, rutaId]); informe.saltados.noVigente++; continue; }

    const rawAl = await kv(["GET", kAlertas(rutaId)]);
    if (!rawAl) { informe.saltados.sinSnapshot++; continue; }
    let guardado;
    try { guardado = JSON.parse(rawAl); } catch { continue; }
    const previo = guardado?.snapshot;
    if (!previo?.tramos) { informe.saltados.sinSnapshot++; continue; }
    if (!tocaMonitorear(previo, ahora)) { informe.saltados.reciente++; continue; }

    // Que tramos: los que el snapshot dice que van en avion, los mas caros
    // primero. Sale de la foto, no de un analisis nuevo.
    const candidatos = Object.entries(previo.tramos)
      .filter(([, t]) => t.medio === "vuelo")
      .sort((a, b) => (Number(b[1].precioVivo ?? b[1].precioEstimado) || 0) - (Number(a[1].precioVivo ?? a[1].precioEstimado) || 0))
      .slice(0, UMBRALES.tramosVigilados);

    if (!candidatos.length) { informe.saltados.sinTramos++; continue; }

    // Los IATA salen de la ruta guardada, por indice del tramo ("3:A:B").
    const paradas = ruta.paradas || [];
    const tramosActualizados = { ...previo.tramos };
    let huboConsulta = false;

    for (const [idTramo] of candidatos) {
      const i = Number(String(idTramo).split(":")[0]);
      const a = paradas[i]; const b = paradas[i + 1];
      if (!/^[A-Z]{3}$/.test(String(a?.iata || "")) || !/^[A-Z]{3}$/.test(String(b?.iata || ""))) continue;

      const params = new URLSearchParams({ iata: String(b.iata).toUpperCase(), origenes: String(a.iata).toUpperCase() });
      // Fecha exacta si la hay; si no, el mes. Son dos promesas distintas y el
      // snapshot se queda con cual de las dos fue.
      if (/^\d{4}-\d{2}-\d{2}$/.test(ruta.fechaIda || "")) params.set("fecha", ruta.fechaIda);
      else params.set("mes", String(ruta.mesInicio || "").slice(0, 7));

      try {
        // Se reutiliza /api/vuelo-vivo tal cual: no hay un segundo cliente de
        // vuelos en el proyecto y no va a haberlo por esto.
        const r = await fetch(`${origen}/api/vuelo-vivo?${params.toString()}`, { cache: "no-store" });
        informe.consultas++;
        huboConsulta = true;
        const d = await r.json();
        if (d?.encontrado && Number(d.precio) > 0) {
          tramosActualizados[idTramo] = {
            ...previo.tramos[idTramo],
            precioVivo: Math.round(Number(d.precio)),
            vivoDe: d.esDeTuFecha ? "fecha" : "mes",
          };
        }
      } catch { /* una consulta fallida no tumba la ronda */ }
    }

    if (!huboConsulta) continue;

    // El "ahora" es la foto anterior con los precios nuevos encima: asi el
    // coste y las tareas NO se tocan y no pueden generar alertas falsas.
    const actual = { ...previo, tomadoEn: ahora, tramos: tramosActualizados };
    const nuevas = detectarCambios({ previo, actual, viaje: ruta, plan: null, existentes: guardado.alertas || [] });
    const alertas = fundirAlertas({ guardadas: guardado.alertas || [], nuevas, plan: null });

    await kv(["SET", kAlertas(rutaId), JSON.stringify({ snapshot: actual, alertas, actualizada: ahora }), "EX", String(TTL)]);
    informe.revisados++;
    informe.alertasNuevas += nuevas.length;
  }

  return Response.json({ ok: true, ...informe, vigilados: ids.length });
}

/** Para comprobar de un vistazo que el monitor esta vivo y a quien vigila. */
export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const secret = process.env.ALERTS_SHARED_SECRET;
  if (!secret || req.headers.get("x-alert-secret") !== secret) {
    return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });
  }
  const ids = (await kv(["SMEMBERS", K_VIGILADOS])) || [];
  return Response.json({ ok: true, vigilados: ids.length, esperaHoras: UMBRALES.esperaMonitorMs / 3600000, tramosPorViaje: UMBRALES.tramosVigilados });
}
