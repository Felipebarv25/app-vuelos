"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/AppContext";

const iconoMedio = { tren: "🚆", vuelo: "✈️", bus: "🚌", ferry: "⛴️" };
function money(v) { return v == null ? "—" : `US$${Number(v).toLocaleString("en-US")}`; }
function horas(v) { return v == null ? "—" : `${(Number(v) / 60).toFixed(1)} h`; }

// El motor decide QUE decir; aqui se decide en que idioma.
//
// Estos mapas traducen los codigos que emiten lib/puntuadorTransporte y
// lib/analizadorDecisionesViaje. Cada uno lleva su respaldo: si algun dia el
// motor devuelve un codigo que no conocemos, se pinta la frase en español que
// el propio motor trae, en vez de un hueco o el nombre del codigo.
const CLAVE_FUENTE = { detectado: "iaFuenteDetectado", curado: "iaFuenteCurado", estimado: "iaFuenteEstimado", vivo: "iaFuenteVivo" };
const CLAVE_MEDIO = { vuelo: "iaMedioVuelo", tren: "iaMedioTren", bus: "iaMedioBus", ferry: "iaMedioFerry" };
const CLAVE_EXPLICACION = {
  mejorEstimado: "iaExpMejorEstimado",
  mejorFiable: "iaExpMejorFiable",
  competitiva: "iaExpCompetitiva",
  razonable: "iaExpRazonable",
  pierde: "iaExpPierde",
};
const CLAVE_RAZON = {
  simplificaYLibera: "iaRazonSimplificaYLibera",
  reduceTiempo: "iaRazonReduceTiempo",
  liberaPresupuesto: "iaRazonLiberaPresupuesto",
  liberaNochesPeroCuesta: "iaRazonLiberaNochesPeroCuesta",
  simplificaPoco: "iaRazonSimplificaPoco",
};
// La confianza llega a veces como nivel (alta/media/baja) y a veces como
// fuente del dato ganador (curado/estimado/detectado). Se traducen las dos.
const CLAVE_NIVEL = {
  alta: "iaNivelAlta", media: "iaNivelMedia", baja: "iaNivelBaja",
  detectado: "iaFuenteDetectado", curado: "iaFuenteCurado", estimado: "iaFuenteEstimado", vivo: "iaFuenteVivo",
};

function puntuarVueloVivo(precio, minutos, opciones) {
  const nums = opciones.map((o) => Number(o.precio)).filter((n) => Number.isFinite(n) && n > 0);
  const tiempos = opciones.map((o) => Number(o.puertaAPuerta_h)).filter((n) => Number.isFinite(n) && n > 0);
  const minP = nums.length ? Math.min(...nums) : precio;
  const maxP = nums.length ? Math.max(...nums) : precio;
  const minT = tiempos.length ? Math.min(...tiempos) : minutos / 60 + 1.5;
  const maxT = tiempos.length ? Math.max(...tiempos) : minT;
  const precioScore = maxP === minP ? 85 : 100 - ((precio - minP) / (maxP - minP)) * 60;
  const tiempoH = minutos / 60 + 1.5;
  const tiempoScore = maxT === minT ? 85 : 100 - ((tiempoH - minT) / (maxT - minT)) * 45;
  return Math.max(5, Math.min(98, Math.round(precioScore * 0.55 + tiempoScore * 0.45)));
}

export default function InteligenciaViaje({ ruta, analisis, decisiones }) {
  const { t } = useApp();
  const eliminaciones = decisiones?.eliminar || [];
  const mejor = decisiones?.mejorEliminacion;
  const alternativas = useMemo(() => (analisis?.tramos || []).map((x) => ({ ...x, opciones: x.alternativas || [] })), [analisis]);
  const [vuelosVivos, setVuelosVivos] = useState({});
  const [consultandoVuelos, setConsultandoVuelos] = useState(false);
  const [modoConsultaVuelos, setModoConsultaVuelos] = useState(null);

  const fuente = useCallback((f) => (CLAVE_FUENTE[f] ? t(CLAVE_FUENTE[f]) : t("iaFuenteNinguno")), [t]);
  const nombreMedio = useCallback((m) => (CLAVE_MEDIO[m] ? t(CLAVE_MEDIO[m]) : m || t("iaMedioNinguno")), [t]);

  // CONSULTA BAJO DEMANDA, no al abrir la pagina.
  //
  // Esto era un useEffect con dependencia [ruta]: al abrir Mi viaje salian
  // NUEVE peticiones a /api/vuelo-vivo, una por tramo, y volvian a salir cada
  // vez que cambiaba la identidad del objeto ruta. Son llamadas a una API de
  // pago para enseñar un dato que casi nadie mira en los primeros segundos.
  //
  // Ahora las dispara el viajero. El resto del analisis —precios curados,
  // estimaciones, comparativa de medios— no depende de esto y se ve igual;
  // lo que se gana al pulsar es cambiar estimaciones por precios reales, y
  // eso puede cambiar la recomendacion de un tramo.
  //
  // El resultado se queda en memoria: moverse por la pagina no vuelve a
  // consultar.
  const [consultado, setConsultado] = useState(false);

  // Que podemos prometer: con fecha exacta consultamos ese dia; con solo mes,
  // el mejor precio del mes. Se sabe antes de pulsar, asi que el boton lo dice.
  const modoDisponible = useMemo(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(ruta?.fechaIda || "").trim())) return "fecha";
    if (/^\d{4}-\d{2}$/.test(String(ruta?.mesInicio || "").trim())) return "mes";
    return null;
  }, [ruta]);

  const tramosConsultables = useMemo(() => {
    const paradas = ruta?.paradas || [];
    if (!modoDisponible || paradas.length < 2) return [];
    return paradas
      .map((p, i) => ({ origen: p, destino: paradas[i + 1], indice: i }))
      .filter((x) => x.destino && /^[A-Z]{3}$/.test(String(x.origen?.iata || "")) && /^[A-Z]{3}$/.test(String(x.destino?.iata || "")));
  }, [ruta, modoDisponible]);

  // Si cambia el viaje, lo consultado antes ya no vale.
  useEffect(() => { setVuelosVivos({}); setConsultado(false); setModoConsultaVuelos(null); }, [ruta]);

  const consultarVuelos = useCallback(async () => {
    if (!tramosConsultables.length || consultandoVuelos) return;
    const fecha = String(ruta?.fechaIda || "").trim();
    const mes = String(ruta?.mesInicio || "").trim();
    const tieneFecha = modoDisponible === "fecha";
    setConsultandoVuelos(true);
    setModoConsultaVuelos(modoDisponible);
    const entries = await Promise.all(
      tramosConsultables.map(async ({ origen, destino, indice }) => {
        try {
          const params = { iata: String(destino.iata).toUpperCase(), origenes: String(origen.iata).toUpperCase() };
          if (tieneFecha) params.fecha = fecha;
          else params.mes = mes;
          const qs = new URLSearchParams(params);
          const r = await fetch(`/api/vuelo-vivo?${qs.toString()}`, { cache: "no-store" });
          const d = await r.json();
          return d?.encontrado ? [indice, d] : [indice, null];
        } catch { return [indice, null]; }
      })
    );
    setVuelosVivos(Object.fromEntries(entries));
    setConsultandoVuelos(false);
    setConsultado(true);
  }, [tramosConsultables, consultandoVuelos, modoDisponible, ruta]);

  const alternativasVivas = useMemo(() => alternativas.map((tr, i) => {
    const vivo = vuelosVivos[i];
    if (!vivo || !Number.isFinite(Number(vivo.precio))) return tr;
    const opcionesBase = tr.opciones.map((o) => ({ ...o, recomendado: false }));
    const minutos = Number(vivo.duracion_ida);
    const puertaAPuerta_h = Number.isFinite(minutos) && minutos > 0 ? Number((minutos / 60 + 1.5).toFixed(1)) : null;
    const score = puntuarVueloVivo(Number(vivo.precio), Number.isFinite(minutos) ? minutos : 240, opcionesBase);
    const cuando = vivo.esDeTuFecha
      ? t("iaCuandoFechaExacta")
      : vivo.esDeTuMes
        ? t("iaCuandoMes", { mes: vivo.mesConsultado || t("iaMesDelViaje") })
        : t("iaCuandoPeriodo");
    const vuelo = { medio: "vuelo", precio: Number(vivo.precio), puertaAPuerta_h, score, fuente: "vivo", operador: vivo.aerolinea, recomendado: false, explicacion: t("iaExpVueloVivo", { cuando }) };
    const todas = [...opcionesBase, vuelo].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const ganador = todas[0];
    const confianza = ganador.fuente === "vivo" ? "alta" : ganador.fuente;
    return {
      ...tr,
      opciones: todas.map((o) => ({ ...o, recomendado: o === ganador })),
      recomendacionViva: ganador.fuente === "vivo" ? t("iaVueloGana") : t("iaVueloNoGana", { medio: nombreMedio(ganador.medio) }),
      confianzaViva: confianza,
    };
  }), [alternativas, vuelosVivos, t, nombreMedio]);

  if (!analisis && !decisiones) return null;

  const nTramos = tramosConsultables.length;
  const cuandoConsulta = modoDisponible === "fecha" ? t("iaCuandoTusFechas") : t("iaCuandoMesViaje");

  return <section className="space-y-3">
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/60 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Anduve Intelligence</div><h3 className="mt-1 text-[17px] font-black text-violet-950 dark:text-violet-100">{t("iaTitulo")}</h3><p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-violet-900/75 dark:text-violet-100/70">{t("iaIntro")}</p></div></div>
      <div className="mt-4 space-y-3">{alternativasVivas.map((tr, i) => <div key={tr.id} className="rounded-2xl border border-white/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[13px] font-extrabold text-slate-900 dark:text-white">{tr.desde} → {tr.hasta}</div><span className="text-[10px] font-bold text-slate-400">{tr.km ? `${Math.round(tr.km)} km` : t("iaSinDistancia")}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{tr.opciones.map((o, j) => <div key={`${o.medio}-${j}`} className={`rounded-xl border p-3 ${o.recomendado ? "border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/20" : "border-slate-200 dark:border-slate-700"}`}><div className="flex items-center justify-between gap-2"><span className="font-extrabold text-slate-800 dark:text-slate-100">{iconoMedio[o.medio] || "🚐"} {nombreMedio(o.medio)}</span>{o.recomendado && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">{t("iaRecomendado")}</span>}</div><div className="mt-2 text-[15px] font-black text-slate-900 dark:text-white">{money(o.precio)}</div><div className="text-[11px] text-slate-500">{o.puertaAPuerta_h != null ? t("iaPuertaAPuerta", { h: o.puertaAPuerta_h }) : t("iaTiempoDesconocido")} · {o.score != null ? `${o.score}/100` : t("iaSinScore")}</div><div className={`mt-1 text-[9.5px] font-bold ${o.fuente === "estimado" ? "text-amber-600" : "text-emerald-600"}`}>{fuente(o.fuente)}{o.operador ? ` · ${o.operador}` : ""}</div><p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">{CLAVE_EXPLICACION[o.explicacionCodigo] ? t(CLAVE_EXPLICACION[o.explicacionCodigo]) : (o.explicacion || o.nota)}</p></div>)}</div>
        {tr.recomendacionViva && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100">{tr.recomendacionViva} <span className="font-normal opacity-70">{t("iaConfianzaEtiqueta", { nivel: CLAVE_NIVEL[tr.confianzaViva] ? t(CLAVE_NIVEL[tr.confianzaViva]) : tr.confianzaViva })}</span></div>}
        {vuelosVivos[i] && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">✈️ {t("iaVueloRealTit")}</div><div className="mt-1 text-[12px] font-extrabold text-emerald-950 dark:text-emerald-100">{vuelosVivos[i].aerolinea || t("iaAerolineaDisponible")} · {vuelosVivos[i].fecha_ida}</div></div><div className="text-right"><div className="text-[16px] font-black text-emerald-900 dark:text-emerald-100">{money(vuelosVivos[i].precio)}</div><div className="text-[10px] text-emerald-700">{vuelosVivos[i].escalas_ida === 0 ? t("iaDirecto") : vuelosVivos[i].escalas_ida != null ? t(vuelosVivos[i].escalas_ida === 1 ? "iaEscalaUna" : "iaEscalasVarias", { n: vuelosVivos[i].escalas_ida }) : t("iaEscalasSinConfirmar")}{vuelosVivos[i].duracion_ida ? ` · ${horas(vuelosVivos[i].duracion_ida)}` : ""}</div></div></div>{vuelosVivos[i].link && <a href={vuelosVivos[i].link} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full bg-emerald-700 px-3 py-1.5 text-[10.5px] font-extrabold text-white hover:bg-emerald-800">{t("iaVerDisponibilidad")}</a>}<p className="mt-2 text-[10px] leading-relaxed text-emerald-800/70">{vuelosVivos[i].esDeTuFecha ? t("iaAvisoFechaExacta") : t("iaAvisoMes", { mes: vuelosVivos[i].mesConsultado || t("iaMesDelViaje") })}</p></div>}
      </div>)}</div>
      {nTramos > 0 && !consultado && !consultandoVuelos && <div className="flex flex-col items-stretch gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-slate-700 dark:bg-slate-800"><p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{t(nTramos === 1 ? "iaOfrecerConsultaUno" : "iaOfrecerConsultaVarios", { n: nTramos, cuando: cuandoConsulta })}</p><button type="button" onClick={consultarVuelos} className="w-full shrink-0 rounded-full bg-marca-700 px-4 py-2.5 sm:w-auto sm:py-2 text-[11.5px] font-extrabold text-white hover:bg-marca-800">{t("iaConsultarPrecios")}</button></div>}
      {consultandoVuelos && <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800">{modoConsultaVuelos === "mes" ? t("iaBuscandoMes") : t("iaBuscandoFecha")}</div>}
      {/* Consultar y no ver nada es peor que no haber consultado: si la API no
          devolvio ningun precio se dice, y se puede repetir. */}
      {consultado && !Object.values(vuelosVivos).some(Boolean) && <div className="flex flex-col items-stretch gap-2.5 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3 dark:border-slate-700 dark:bg-slate-800"><p className="min-w-0 flex-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">{t(nTramos === 1 ? "iaSinResultadosUno" : "iaSinResultadosVarios", { n: nTramos })}</p><button type="button" onClick={() => { setConsultado(false); consultarVuelos(); }} className="w-full shrink-0 rounded-full border border-slate-300 px-3 py-2 sm:w-auto sm:py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">{t("iaReintentarConsulta")}</button></div>}
      {Object.values(vuelosVivos).some(Boolean) && <p className="text-[10px] text-slate-400">{t("iaPieVuelosReales")}</p>}
      <div className="mt-5 border-t border-violet-200/70 pt-5 dark:border-violet-900/50">{mejor ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">{t("iaMayorImpacto")}</div><h4 className="mt-1 text-[15px] font-black text-amber-950 dark:text-amber-100">{t("iaQuePasaSiEliminas", { ciudad: mejor.ciudad })}</h4><p className="mt-1.5 text-[12px] text-amber-900/75 dark:text-amber-100/70">{CLAVE_RAZON[mejor.razonCodigo] ? t(CLAVE_RAZON[mejor.razonCodigo], { ciudad: mejor.ciudad }) : mejor.razon}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">{t("iaImpactoNeto")}</div><div className={`text-[15px] font-black ${mejor.impactoNetoEstimado < 0 ? "text-red-600" : "text-slate-900"}`}>{mejor.impactoNetoEstimado < 0 ? "−" : ""}{money(Math.abs(mejor.impactoNetoEstimado))}</div></div><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">{t("iaCambioTransporte")}</div><div className="text-[15px] font-black">{mejor.ahorroTransporteEstimado >= 0 ? "−" : "+"}{money(Math.abs(mejor.ahorroTransporteEstimado))}</div></div><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">{t("iaNochesParada")}</div><div className="text-[15px] font-black">{mejor.nochesLiberadas}</div></div><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">{t("iaConfianza")}</div><div className="text-[15px] font-black capitalize">{CLAVE_NIVEL[mejor.confianza] ? t(CLAVE_NIVEL[mejor.confianza]) : mejor.confianza}</div></div></div><p className="mt-3 text-[10.5px] leading-relaxed text-amber-900/70 dark:text-amber-100/65">{t("iaImpactoDisclaimer")}</p></div> : <div className="rounded-xl border border-slate-200 bg-white p-4 text-[12px] text-slate-500 dark:border-slate-700 dark:bg-slate-800">{t("iaSinEliminacion")}</div>}
        {eliminaciones.length > 1 && <div className="mt-3 space-y-2">{eliminaciones.slice(1, 4).map((d) => <div key={`${d.ciudad}-${d.indice}`} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"><span className="text-[12px] font-extrabold">{t("iaQuitarCiudad", { ciudad: d.ciudad })}</span><span className={`text-[11px] font-bold ${d.impactoNetoEstimado < 0 ? "text-red-600" : "text-slate-500"}`}>{d.impactoNetoEstimado > 0 ? `~${money(d.impactoNetoEstimado)}` : d.impactoNetoEstimado < 0 ? `+${money(Math.abs(d.impactoNetoEstimado))}` : t("iaSinImpactoNeto")} · {d.ahorroHoras >= 0 ? `−${d.ahorroHoras} h` : `+${Math.abs(d.ahorroHoras)} h`}</span></div>)}</div>}
        <p className="mt-3 text-[10.5px] text-slate-400">{t("iaCosteDiarioNota")}</p>
      </div>
    </div>
  </section>;
}
