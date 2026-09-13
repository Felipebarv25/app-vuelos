import { evaluarTramo, detectarZigzag, ajustarIdaYVuelta } from "@/lib/rutaViva";
import { normalizarViaje } from "@/lib/viajeCanonico";
import { costoDiario } from "@/lib/rutaViva";
import { compararTransporte } from "@/lib/comparadorTransporte";
import { optimizarViaje } from "@/lib/optimizadorViaje";
import { obtenerTasasServidor } from "@/lib/fx";
import { analizarDecisionesViaje } from "@/lib/analizadorDecisionesViaje";
import { analizarViaje } from "@/lib/inteligenciaViaje";
import { cargarOfertasServidor } from "@/lib/ofertasServidor";
import { ofertaParaOrigen } from "@/lib/preciosVuelos";
import { llaveCiudad, DESTINOS_PRESUPUESTO } from "@/lib/presupuesto";
import { hubsDe, nombreDeIATA } from "@/lib/paisesOrigen";

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
    const recomendada = comparacion.alternativas?.find((a) => a.recomendado) || comparacion.alternativas?.[0] || null;
    out.push({
      id: `${i}:${desde.ciudad}:${hasta.ciudad}`,
      desde: desde.ciudad, hasta: hasta.ciudad,
      medio: recomendada?.medio || t.medio,
      precio: money(recomendada?.precio ?? t.precio),
      precioOriginal: money(t.precio),
      precioRecomendado: money(recomendada?.precio ?? t.precio),
      medioOriginal: t.medio, medioRecomendado: recomendada?.medio || t.medio,
      duracion_h: t.duracion_h,
      puertaAPuerta_h: recomendada?.puertaAPuerta_h ?? t.puertaAPuerta_h,
      puertaAPuertaOriginal_h: t.puertaAPuerta_h,
      puertaAPuertaRecomendada_h: recomendada?.puertaAPuerta_h ?? t.puertaAPuerta_h,
      operador: recomendada?.operador || t.operador,
      fuente: recomendada?.fuente || t.fuente,
      fuenteOriginal: t.fuente,
      fuenteRecomendada: recomendada?.fuente || t.fuente,
      km: t.km, alternativas: comparacion.alternativas,
      recomendacionExplicacion: recomendada?.explicacion || "",
    });
  }
  return out;
}

function construirEstadia(paradas, nivel = "medio") {
  const factor = nivel === "mochilero" ? 0.72 : nivel === "comodo" ? 1.35 : 1;
  return paradas.reduce((total, p) => !p.noches ? total : total + (costoDiario(p.ciudad, p.paisNombre || p.pais).usd || 0) * p.noches * factor, 0);
}

async function presupuestoResumen(viaje, tramos) {
  const transporte = tramos.reduce((s, t) => s + (Number(t.precioRecomendado ?? t.precio) || 0), 0);
  const estadia = construirEstadia(viaje.paradas, viaje.nivel);
  const subtotal = transporte + estadia;
  const contingencia = subtotal * (Number(viaje.presupuesto?.ajustes?.contingenciaPct) || 0.1);
  const overrides = viaje.presupuesto?.overrides || {};
  const manual = Object.values(overrides).reduce((s, v) => s + (Number(v) || 0), 0);
  const fuentes = [...new Set(tramos.map((t) => t.fuenteRecomendada).filter(Boolean))];
  const totalUsd = Math.round(subtotal + contingencia + manual);
  const moneda = /^[A-Z]{3}$/.test(viaje?.monedaVista || "") ? viaje.monedaVista : "USD";
  const tasas = await obtenerTasasServidor();
  const porUsd = tasas.porUsd || {};
  const tasa = moneda === "USD" ? 1 : (Number(porUsd[moneda]) > 0 ? Number(porUsd[moneda]) : 1);
  const convertir = (n) => Math.round(Number(n || 0) * tasa);
  const enVista = moneda !== "USD";
  return {
    transporte: Math.round(transporte), alojamientoYVida: Math.round(estadia), subtotal: Math.round(subtotal),
    contingencia: Math.round(contingencia), manual: Math.round(manual), total: totalUsd,
    moneda: "USD", monedaVista: moneda,
    transporteVista: convertir(transporte), alojamientoYVidaVista: convertir(estadia),
    subtotalVista: convertir(subtotal), contingenciaVista: convertir(contingencia), manualVista: convertir(manual),
    totalVista: convertir(totalUsd), tasaVistaPorUsd: tasa,
    conversionEsRespaldo: enVista && !tasas.enVivo,
    conversionEnVivo: Boolean(tasas.enVivo),
    fechaTasa: tasas.fecha || null, fuenteTasa: tasas.fuente || null,
    fuenteTransporte: fuentes.length === 1 ? fuentes[0] : "mixto",
  };
}

function simboloMoneda(codigo) {
  return codigo === "EUR" ? "€" : codigo === "GBP" ? "£" : codigo === "COP" ? "$" : codigo === "USD" ? "US$" : `${codigo} `;
}

function recomendacionTramos(tramos, monedaVista = "USD", tasaVistaPorUsd = 1) {
  return tramos.filter((t) => t.medio || t.alternativas?.length).map((t) => {
    const mejor = (t.alternativas || []).find((a) => a.recomendado) || t.alternativas?.[0];
    if (!mejor) return { id: t.id, titulo: `${t.desde} → ${t.hasta}`, recomendacion: "No hay una opción suficientemente fiable para recomendar.", score: null, explicacion: "", confianza: "nula", fuente: "sin_dato" };
    const precioVista = Math.round(Number(mejor.precio || 0) * Number(tasaVistaPorUsd || 1));
    const precioTexto = monedaVista === "USD" ? `US$${mejor.precio}` : `${simboloMoneda(monedaVista)}${precioVista.toLocaleString("es-CO")}`;
    return { id: t.id, titulo: `${t.desde} → ${t.hasta}`, recomendacion: `Anduve recomienda ${mejor.medio}: ~${precioTexto} y ${mejor.puertaAPuerta_h} h puerta a puerta.`, score: mejor?.score ?? null, explicacion: mejor?.explicacion || "", confianza: mejor?.fuente === "detectado" ? "alta" : mejor?.fuente === "curado" ? "media" : mejor?.fuente === "estimado" ? "baja" : "nula", fuente: mejor?.fuente || "sin_dato" };
  });
}

// Coordenadas de una ciudad del catalogo, por nombre. Sirve para medir el
// trayecto por tierra hasta un aeropuerto alternativo con el MISMO motor de
// tramos que usa el resto del viaje.
function ciudadDelCatalogo(nombre) {
  const n = String(nombre || "").trim().toLowerCase();
  return DESTINOS_PRESUPUESTO.find((d) => d.ciudad.toLowerCase() === n) || null;
}

/**
 * ¿Saldria mas barato desde otro aeropuerto del pais?
 *
 * Y la pregunta completa, que es la que casi nadie hace: ¿sigue saliendo mas
 * barato DESPUES de pagar el traslado hasta alli y perder esas horas? Un vuelo
 * 80 USD mas barato desde Bogota no compensa si llegar cuesta 90 y medio dia.
 *
 * Solo se compara dato real contra dato real: si no hay precio detectado para
 * los dos aeropuertos, no hay comparacion que hacer y se devuelve null.
 */
async function origenAlternativo(viaje) {
  const salida = viaje.paradas[0];
  const entrada = viaje.paradas[1];
  if (!salida?.iata || !entrada?.ciudad) return null;

  const ofertas = await cargarOfertasServidor();
  const llave = llaveCiudad({ ciudad: entrada.ciudad, pais: entrada.paisNombre || entrada.pais });
  const actual = ofertaParaOrigen(ofertas, llave, salida.iata);
  // Sin precio real DESDE su aeropuerto no hay contra que comparar.
  if (!actual || actual.origen !== salida.iata) return null;

  const paisSalida = String(salida.pais || "").toUpperCase();
  const hubs = hubsDe(paisSalida).filter((h) => h.iata !== salida.iata).slice(0, 4);
  const ciudadSalida = ciudadDelCatalogo(salida.ciudad);

  let mejor = null;
  for (const h of hubs) {
    const o = ofertaParaOrigen(ofertas, llave, h.iata);
    if (!o || o.origen !== h.iata || o.precio >= actual.precio) continue;

    const ahorroVuelo = (actual.precio - o.precio) * (viaje.viajeros || 1);
    // El traslado hasta ese aeropuerto, con el motor de tramos de siempre.
    const ciudadHub = ciudadDelCatalogo(h.ciudad);
    let costeLlegar = 0;
    let horasExtra = 0;
    if (ciudadSalida && ciudadHub) {
      const t = evaluarTramo({ desde: ciudadSalida, hasta: ciudadHub });
      // Ida y vuelta: se va y se vuelve por el mismo sitio.
      costeLlegar = (Number(t.precio) || 0) * 2 * (viaje.viajeros || 1);
      horasExtra = (Number(t.puertaAPuerta_h) || 0) * 2;
    }
    const neto = ahorroVuelo - costeLlegar;
    if (!mejor || neto > mejor.ahorroNetoUsd) {
      mejor = {
        iata: h.iata,
        ciudad: h.ciudad,
        ciudadActual: nombreDeIATA(salida.iata),
        ahorroVueloUsd: Math.round(ahorroVuelo),
        costeLlegarUsd: Math.round(costeLlegar),
        horasExtra: Number(horasExtra.toFixed(1)),
        ahorroNetoUsd: Math.round(neto),
        // Los dos precios vienen del detector; el traslado es estimado, y por
        // eso la oportunidad nace con confianza media y no alta.
        fuente: "detectado",
        trasladoEstimado: true,
      };
    }
  }
  return mejor;
}

export async function POST(req) {
  let body; try { body = await req.json(); } catch { return Response.json({ ok: false, motivo: "json" }, { status: 400 }); }
  const viaje = normalizarViaje(body?.viaje || body, body?.origen === "legacy" ? "legacy" : "ruta");
  if (!viaje || viaje.paradas.length < 2) return Response.json({ ok: false, motivo: "faltan-paradas" }, { status: 400 });
  const tramosOriginales = construirTramos(viaje.paradas, viaje);
  const ajustado = ajustarIdaYVuelta(tramosOriginales);
  const presupuesto = await presupuestoResumen(viaje, ajustado.tramos);
  const zigzag = detectarZigzag(viaje.paradas, 12);
  const optimizacion = optimizarViaje(viaje.paradas);

  // Las decisiones se calculan AQUI y viajan en esta respuesta.
  //
  // Antes el tablero pedia /api/viaje-canonico y /api/viaje-canonico/decisiones
  // en paralelo: dos peticiones para dos analisis del mismo viaje. El segundo
  // endpoint se queda para quien lo use suelto, pero desde aqui ya no hace
  // falta pedirlo.
  const decisiones = analizarDecisionesViaje(viaje.paradas);
  const alternativa = await origenAlternativo(viaje);

  const inteligencia = analizarViaje({
    viaje,
    tramos: ajustado.tramos,
    presupuesto,
    decisiones,
    // optimizacion.orden es lo que devuelve optimizarViaje; el objeto de
    // fuera mezcla eso con el zigzag.
    optimizacion,
    origenAlternativo: alternativa,
    gustos: body?.gustos || null,
  });

  return Response.json({
    ok: true,
    viaje,
    tramos: ajustado.tramos,
    regreso: ajustado.regresoIncluido,
    presupuesto,
    optimizacion: { ...zigzag, orden: optimizacion },
    decisiones,
    origenAlternativo: alternativa,
    inteligencia,
    recomendaciones: recomendacionTramos(ajustado.tramos, presupuesto.monedaVista, presupuesto.tasaVistaPorUsd),
    generadoEn: Date.now(),
  }, { headers: { "Cache-Control": "no-store" } });
}
