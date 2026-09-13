"use client";
// Anduve Intelligence: lo que cambiaríamos de tu viaje.
//
// POR QUE ESTE COMPONENTE NO ES UNA LISTA MAS
//
// El tablero ya enseñaba datos: cuanto cuesta, cuanto tarda, que transporte
// lleva cada tramo. Eso contesta "¿como es mi viaje?". Esto contesta la otra
// pregunta, que es la que de verdad ayuda: "¿que deberia cambiar?".
//
// TRES COSAS QUE NO SE MEZCLAN
//
//   prioridad    cuanto mejora el viaje: dinero Y tiempo, no solo dinero
//   confianza    cuanto nos fiamos del dato que sostiene la recomendacion
//   fuente       de donde sale ese dato
//
// Una recomendacion puede ser de alta prioridad y baja confianza —"esto te
// ahorraria mucho, pero es una estimacion"— y el viajero tiene derecho a
// verlo asi, en vez de recibir un consejo con aire de certeza.
//
// Y CUANDO NO HAY NADA QUE DECIR, SE DICE
//
// Un panel de inteligencia que siempre encuentra algo que "mejorar" acaba
// inventando. Si la ruta ya es razonable con los datos que hay, eso es una
// respuesta completa y se muestra tal cual.
//
// QUIEN REDACTA
//
// El motor (lib/inteligenciaViaje) decide QUE decir y con que cifras; esta
// tarjeta decide COMO decirlo: en el idioma del viajero y en su moneda. Por
// eso las oportunidades llegan con `datos` sueltos y no con la frase hecha.
// Redactar en el motor ya provoco el fallo de enseñar "3429 USD" dentro de
// una tarjeta que hablaba en pesos.

import { Icono } from "@/components/Icono";
import { useApp } from "@/lib/AppContext";

const PRIORIDAD = {
  alta: { emoji: "🔴", clave: "opPrioAlta", clase: "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20" },
  media: { emoji: "🟠", clave: "opPrioMedia", clase: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20" },
  baja: { emoji: "🟢", clave: "opPrioBaja", clase: "border-emerald-200 bg-emerald-50 dark:border-emerald-900/60 dark:bg-emerald-950/20" },
};

const CONFIANZA = {
  alta: { clave: "opConfAlta", clase: "text-emerald-700 dark:text-emerald-300" },
  media: { clave: "opConfMedia", clase: "text-sky-700 dark:text-sky-300" },
  baja: { clave: "opConfBaja", clase: "text-amber-700 dark:text-amber-300" },
  nula: { clave: "opConfNula", clase: "text-slate-400" },
};

// Los medios, en la forma que pide una frase ("frente al tren…"), distinta de
// la etiqueta de una tarjeta ("Tren").
const MEDIO = { vuelo: "opMedioVuelo", tren: "opMedioTren", bus: "opMedioBus", ferry: "opMedioFerry" };
// Las explicaciones que codifica lib/puntuadorTransporte.
const EXPLICACION = { mejorEstimado: "iaExpMejorEstimado", mejorFiable: "iaExpMejorFiable", competitiva: "iaExpCompetitiva", razonable: "iaExpRazonable", pierde: "iaExpPierde" };
// Las razones que codifica lib/analizadorDecisionesViaje.
const RAZON = { simplificaYLibera: "iaRazonSimplificaYLibera", reduceTiempo: "iaRazonReduceTiempo", liberaPresupuesto: "iaRazonLiberaPresupuesto", liberaNochesPeroCuesta: "iaRazonLiberaNochesPeroCuesta", simplificaPoco: "iaRazonSimplificaPoco" };
// Los avisos y faltantes, que ya venian con clave estable desde el motor.
const AVISO = { "transporte-alto": "opAvisoTransporteAlto", "estancia-alta": "opAvisoEstanciaAlta", "tramo-caro": "opAvisoTramoCaro" };
const FALTANTE = {
  "sin-fecha": () => "opFaltaSinFecha",
  "sin-fecha-exacta": () => "opFaltaSinFechaExacta",
  "sin-vuelo-real": (v) => (Number(v?.n) === 1 ? "opFaltaSinVueloRealUno" : "opFaltaSinVueloRealVarios"),
  "tramos-sin-dato": (v) => (Number(v?.n) === 1 ? "opFaltaSinDatoUno" : "opFaltaSinDatoVarios"),
  "sin-noches": (v) => (Number(v?.n) === 1 ? "opFaltaSinNochesUna" : "opFaltaSinNochesVarias"),
};

function money(v, cod, tasa) {
  if (v == null || !Number.isFinite(Number(v))) return null;
  const enVista = cod && cod !== "USD" && Number.isFinite(Number(tasa));
  const valor = enVista ? Math.round(Number(v) * Number(tasa)) : Math.round(Number(v));
  const simbolo = !enVista ? "US$" : cod === "COP" ? "$" : cod === "EUR" ? "€" : cod === "GBP" ? "£" : `${cod} `;
  return `${simbolo}${valor.toLocaleString(cod === "COP" ? "es-CO" : "en-US")}`;
}

export default function OportunidadesViaje({ inteligencia, presupuesto }) {
  const { t } = useApp();
  if (!inteligencia) return null;
  const { oportunidades = [], confianza, presupuestoInsight, faltantes = [], sinOportunidades } = inteligencia;
  const cod = presupuesto?.monedaVista || "USD";
  const tasa = presupuesto?.tasaVistaPorUsd || 1;
  const dinero = (v) => money(v, cod, tasa);
  const medio = (m) => (MEDIO[m] ? t(MEDIO[m]) : m || t("opMedioOtro"));

  // El TITULO de cada oportunidad. Cuatro tipos, cuatro frases: un switch
  // explicito se lee mejor que un sistema generico de plantillas, y si el
  // motor manda un tipo que no conocemos se usa su texto en español.
  function titulo(o) {
    const d = o.datos || {};
    if (o.tipo === "transporte" && d.desde) return t("opTitTransporte", { desde: d.desde, hasta: d.hasta, medio: medio(d.medioRec) });
    if (o.tipo === "eliminar-ciudad" && d.ciudad) return t("opTitEliminar", { ciudad: d.ciudad });
    if (o.tipo === "reordenar") return t("opTitReordenar");
    if (o.tipo === "aeropuerto-alternativo" && d.ciudad) return t("opTitOrigen", { ciudad: d.ciudad, ciudadActual: d.ciudadActual });
    return o.titulo;
  }

  // La VENTAJA de cambiar de medio, en la moneda que el viajero esta mirando.
  function ventaja(o) {
    const partes = [];
    if (o.dinero > 0) partes.push(t("opVentajaAhorra", { v: dinero(o.dinero) }));
    else if (o.dinero < 0) partes.push(t("opVentajaCuesta", { v: dinero(-o.dinero) }));
    if (o.horas > 0) partes.push(t("opVentajaGana", { h: o.horas.toFixed(1) }));
    else if (o.horas < 0) partes.push(t("opVentajaTarda", { h: (-o.horas).toFixed(1) }));
    return partes.join(t("opVentajaUnion")) || t("opVentajaIgual");
  }

  // EL PORQUE.
  function porque(o) {
    const d = o.datos || {};
    if (o.tipo === "aeropuerto-alternativo" && o.detalleOrigen) {
      return t("opDetalleOrigen", {
        ahorro: dinero(o.detalleOrigen.ahorroVuelo),
        ciudad: o.detalleOrigen.ciudad,
        coste: dinero(o.detalleOrigen.costeLlegar),
        horas: o.detalleOrigen.horasExtra.toFixed(1),
      });
    }
    if (o.tipo === "transporte") {
      if (EXPLICACION[d.explicacionCodigo]) return t(EXPLICACION[d.explicacionCodigo]);
      if (d.medioOrig) return t("opPorqueTransporte", { medioOrig: medio(d.medioOrig), ventaja: ventaja(o) });
    }
    if (o.tipo === "eliminar-ciudad" && RAZON[d.razonCodigo]) return t(RAZON[d.razonCodigo], { ciudad: d.ciudad });
    if (o.tipo === "reordenar" && d.orden) return t("opPorqueReordenar", { orden: d.orden });
    return o.porque;
  }

  return (
    <section id="inteligencia" className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 dark:border-violet-900/60 dark:from-violet-950/30 dark:to-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
            <Icono nombre="zap" size={13} /> Anduve Intelligence
          </div>
          <h3 className="mt-1 text-[18px] font-black text-slate-900 dark:text-white">{t("opTitulo")}</h3>
        </div>

        {/* La confianza del ANALISIS, separada de la calidad del viaje. */}
        {confianza && (
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("opDatosApoyo")}</div>
            <div className="mt-0.5 text-[15px] font-black text-slate-800 dark:text-slate-100">
              {confianza.pct}<span className="text-[11px] font-bold text-slate-400">/100</span>
            </div>
            <div className="text-[10.5px] text-slate-500 dark:text-slate-400">
              {t("opFuentesResumen", { r: confianza.reales, c: confianza.curados, e: confianza.estimados })}
            </div>
          </div>
        )}
      </div>

      {sinOportunidades ? (
        <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {t("opSinOportunidades")}
        </p>
      ) : (
        <ol className="mt-4 space-y-3">
          {oportunidades.map((o, i) => {
            const p = PRIORIDAD[o.prioridad] || PRIORIDAD.baja;
            const c = CONFIANZA[o.confianza] || CONFIANZA.nula;
            return (
              <li key={o.id} className={`rounded-2xl border p-4 ${p.clase}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      {p.emoji} {i === 0 ? t("opMayorCambio") : t(p.clave)}
                    </div>
                    {/* QUE */}
                    <h4 className="mt-1 text-[15px] font-extrabold leading-snug text-slate-900 dark:text-white">{titulo(o)}</h4>
                    {/* POR QUE */}
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">{porque(o)}</p>
                  </div>
                </div>

                {/* CUANTO */}
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                  {o.dinero !== 0 && (
                    <span className={o.dinero > 0 ? "font-bold text-emerald-700 dark:text-emerald-300" : "font-bold text-rose-700 dark:text-rose-300"}>
                      {o.dinero > 0 ? t("opAhorras", { v: dinero(o.dinero) }) : t("opCuesta", { v: dinero(-o.dinero) })}
                    </span>
                  )}
                  {Math.abs(o.horas) >= 0.1 && (
                    <span className={o.horas > 0 ? "font-semibold text-emerald-700 dark:text-emerald-300" : "font-semibold text-amber-700 dark:text-amber-300"}>
                      {o.horas > 0 ? t("opMenosHoras", { h: o.horas.toFixed(1) }) : t("opMasHoras", { h: Math.abs(o.horas).toFixed(1) })}
                    </span>
                  )}
                  {/* CON QUE CONFIANZA, y de donde */}
                  <span className={`font-semibold ${c.clase}`}>{t(c.clave)}</span>
                  <span className="text-slate-400">· {o.fuenteClave ? t(o.fuenteClave) : o.fuenteEtiqueta}</span>
                </div>

                {/* El desglose honesto: lo que se ahorra de transporte NO es lo
                    mismo que las noches que dejas de pagar. */}
                {o.detalle && (
                  <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-[11.5px] leading-relaxed text-slate-600 dark:bg-black/20 dark:text-slate-300">
                    {t(o.detalle.nochesLiberadas === 1 ? "opLiberaUna" : "opLiberaVarias", { n: o.detalle.nochesLiberadas })}
                    {o.detalle.costeEstanciaLiberado > 0 && t("opReinvertir", { v: dinero(o.detalle.costeEstanciaLiberado) })}
                    {". "}
                    {t("opSoloTransporte")}
                  </p>
                )}

                {/* Ruta actual vs propuesta: se enseña, no se aplica sola. */}
                {o.rutaPropuesta && (
                  <div className="mt-2 grid gap-2 text-[11.5px] sm:grid-cols-2">
                    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("opTuRuta")}</div>
                      <div className="mt-0.5 text-slate-700 dark:text-slate-200">{o.rutaActual?.join(" → ")}</div>
                    </div>
                    <div className="rounded-lg bg-white/70 px-3 py-2 dark:bg-black/20">
                      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("opPropuesta")}</div>
                      <div className="mt-0.5 font-semibold text-slate-800 dark:text-slate-100">{o.rutaPropuesta.join(" → ")}</div>
                    </div>
                  </div>
                )}

                {o.ancla && (
                  <a href={o.ancla} className="mt-2 inline-block text-[12px] font-bold text-marca-700 hover:underline dark:text-marca-300">
                    {t("opVerDetalle")} →
                  </a>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* DONDE SE VA EL DINERO */}
      {presupuestoInsight?.avisos?.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("opDondeGasto")}</div>
          <ul className="mt-1.5 space-y-1 text-[12.5px] leading-relaxed text-slate-600 dark:text-slate-300">
            {presupuestoInsight.avisos.map((a) => <li key={a.clave}>· {AVISO[a.clave] ? t(AVISO[a.clave], a.vars) : a.texto}</li>)}
          </ul>
        </div>
      )}

      {/* LO QUE NO SABEMOS. Es una función, no un fallo. */}
      {faltantes.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 dark:border-slate-600">
          <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("opLoQueNoSabemos")}</div>
          <ul className="mt-1.5 space-y-1 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
            {faltantes.map((f) => <li key={f.clave}>· {FALTANTE[f.clave] ? t(FALTANTE[f.clave](f.vars), f.vars) : f.texto}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
