import { evaluarTramo, detectarZigzag, ajustarIdaYVuelta } from "@/lib/rutaViva";
import { normalizarViaje } from "@/lib/viajeCanonico";
import { costoDiario } from "@/lib/rutaViva";
import { compararTransporte } from "@/lib/comparadorTransporte";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function money(n) { return n == null || !Number.isFinite(Number(n)) ? null : Math.round(Number(n)); }

function construirTramos(paradas, viaje) {
  const out = [];
  const prioridad = viaje?.preferencias?.prioridadTransporte || viaje?.prioridadTransporte || "equilibrado";
  for (let i = 0; i < paradas.length - 1; i++) {
    const desde = paradas[i]; const hasta = paradas[i + 1];
    const t = evaluarTramo({ desde, hasta });
    const comparacion = compararTransporte(desde, hasta, { nivel: viaje?.nivel || "medio", prioridad });
    out.push({ id: `${i}:${desde.ciudad}:${hasta.ciudad}`, desde: desde.ciudad, hasta: hasta.ciudad, medio: t.medio, precio: money(t.precio), duracion_h: t.duracion_h, puertaAPuerta_h: t.puertaAPuerta_h, operador: t.operador, fuente: t.fuente, km: t.km, alternativas: comparacion.alternativas });
  }
  return out;
}

function construirEstadia(paradas, nivel = "medio") {
  const factor = nivel === "mochilero" ? 0.72 : nivel === "comodo" ? 1.35 : 1;
  return paradas.reduce((total, p) => !p.noches ? total : total + (costoDiario(p.ciudad, p.paisNombre || p.pais).usd || 0) * p.noches * factor, 0);
}

function presupuestoResumen(viaje, tramos) {
  const transporte = tramos.reduce((s, t) => s + (Number(t.precio) || 0), 0);
  const estadia = construirEstadia(viaje.paradas, viaje.nivel);
  const subtotal = transporte + estadia;
  const contingencia = subtotal * (Number(viaje.presupuesto?.ajustes?.contingenciaPct) || 0.1);
  const overrides = viaje.presupuesto?.overrides || {};
  const manual = Object.values(overrides).reduce((s, v) => s + (Number(v) || 0), 0);
  return { transporte: Math.round(transporte), alojamientoYVida: Math.round(estadia), subtotal: Math.round(subtotal), contingencia: Math.round(contingencia), manual: Math.round(manual), total: Math.round(subtotal + contingencia + manual), moneda: "USD" };
}

function recomendacionTramos(tramos) {
  return tramos.filter((t) => t.medio || t.alternativas?.length).map((t) => {
    const mejor = (t.alternativas || []).find((a) => a.recomendado) || t.alternativas?.[0];
    return { id: t.id, titulo: `${t.desde} → ${t.hasta}`, recomendacion: mejor ? `Anduve recomienda ${mejor.medio}: ~US$${mejor.precio} y ${mejor.puertaAPuerta_h} h puerta a puerta.` : `No hay una opción suficientemente fiable para recomendar.`, score: mejor?.score ?? null, explicacion: mejor?.explicacion || "", confianza: mejor?.fuente === "detectado" ? "alta" : mejor?.fuente === "curado" ? "media" : mejor?.fuente === "estimado" ? "baja" : "nula", fuente: mejor?.fuente || "sin_dato" };
  });
}

export async function POST(req) {
  let body; try { body = await req.json(); } catch { return Response.json({ ok: false, motivo: "json" }, { status: 400 }); }
  const viaje = normalizarViaje(body?.viaje || body, body?.origen === "legacy" ? "legacy" : "ruta");
  if (!viaje || viaje.paradas.length < 2) return Response.json({ ok: false, motivo: "faltan-paradas" }, { status: 400 });
  const tramosOriginales = construirTramos(viaje.paradas, viaje);
  const ajustado = ajustarIdaYVuelta(tramosOriginales);
  const presupuesto = presupuestoResumen(viaje, ajustado.tramos);
  const zigzag = detectarZigzag(viaje.paradas, 12);
  return Response.json({ ok: true, viaje, tramos: ajustado.tramos, regreso: ajustado.regresoIncluido, presupuesto, optimizacion: zigzag, recomendaciones: recomendacionTramos(ajustado.tramos), generadoEn: Date.now() }, { headers: { "Cache-Control": "no-store" } });
}
