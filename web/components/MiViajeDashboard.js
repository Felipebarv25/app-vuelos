"use client";
// El tablero de "Mi viaje": el viaje entero en una pantalla.
//
// QUE ES ESTE COMPONENTE Y QUE NO ES
//
// No es un formulario ni un editor. Es el sitio donde el viajero MIRA su viaje
// y decide. Editar la ruta, las noches o el presupuesto se sigue haciendo en
// /ruta, que es el editor de verdad; desde aqui se va alli.
//
// LO QUE NO SE GUARDA
//
// Nada de lo que se ve aqui —precios, tiempos, recomendaciones, requisitos—
// se persiste en el viaje. El viaje guarda identidad y DECISIONES (ciudades,
// noches, mes, nivel, pasaporte, moneda de visualizacion, overrides de
// presupuesto); todo lo demas se pide a su motor cada vez, porque cambia.
// Guardar un precio seria guardar una mentira con fecha de caducidad.
//
// DE DONDE SALE CADA COSA
//
//   ruta            /api/rutas           lo que el viajero decidio
//   tramos, coste   /api/viaje-canonico  rutaViva + comparadorTransporte + FX
//   decisiones      .../decisiones       analizadorDecisionesViaje
//   requisitos      lib/requisitos       dataset de visas + ETIAS/ESTA/eTA
//   mapa            components/MapaRuta  las mismas paradas, sin copia
//
// Ninguno de esos motores se reimplementa aqui: se consumen.

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icono } from "@/components/Icono";
import Bandera from "@/components/Bandera";
import InteligenciaViaje from "@/components/InteligenciaViaje";
import OportunidadesViaje from "@/components/OportunidadesViaje";
import QueSigue from "@/components/QueSigue";
import CambiosViaje from "@/components/CambiosViaje";
import AccionesViaje from "@/components/AccionesViaje";
import { construirAcciones } from "@/lib/accionesViaje";
import AsesorViaje from "@/components/AsesorViaje";
import BloqueAlojamiento from "@/components/BloqueAlojamiento";
import { construirPlan } from "@/lib/ejecutorViaje";
import { nombrePaisMostrar } from "@/lib/paisesNombres";
import {
  cargarVisas,
  interpretarVisa,
  exigeFiebreAmarilla,
  autorizacionElectronica,
  metaVisas,
  diasDesdeVerificacion,
  visasDudosas,
} from "@/lib/requisitos";

// Igual que en PlanRuta: maplibre no puede renderizarse en servidor.
const MapaRuta = dynamic(() => import("./MapaRuta"), { ssr: false });

// Los ayudantes viven fuera del componente, asi que el traductor les llega
// como argumento. El respaldo (k) => k evita que un uso olvidado rompa la
// pantalla: peor traducido, nunca en blanco.
function fmtMes(mes, lang = "es", t = (k) => k) {
  if (!/^\d{4}-\d{2}$/.test(String(mes || ""))) return t("mvFechaPorDefinir");
  const d = new Date(`${mes}-01T00:00:00`);
  return d.toLocaleDateString(lang, { month: "long", year: "numeric" });
}
function nochesTotales(paradas = []) { return paradas.reduce((sum, p) => sum + Math.max(0, Number(p?.noches) || 0), 0); }
function ciudadesUnicas(paradas = []) { const out = []; for (const p of paradas) { const ciudad = String(p?.ciudad || "").trim(); if (ciudad && !out.some((x) => x.toLowerCase() === ciudad.toLowerCase())) out.push(ciudad); } return out; }
function paisesUnicos(paradas = []) { const out = []; for (const p of paradas) { const cc = String(p?.pais || "").trim().toLowerCase(); if (/^[a-z]{2}$/.test(cc) && !out.includes(cc)) out.push(cc); } return out; }
function progreso(ruta) { const p = ruta?.paradas || []; let total = 0; let hecho = 0; const checks = [[p.length >= 2,20],[Boolean(ruta?.mesInicio),15],[p.some((x)=>Number(x?.noches)>0),20],[p.every((x)=>x?.iata||(x?.lat!=null&&x?.lon!=null)),15],[Boolean(ruta?.presupuesto?.overrides&&Object.keys(ruta.presupuesto.overrides).length),15],[Boolean(ruta?.fechaIda),15]]; for (const [ok,peso] of checks) { total += peso; if (ok) hecho += peso; } return Math.round(hecho / total * 100); }
function fuenteTexto(fuente, t = (k) => k) { return t(fuente === "detectado" ? "iaFuenteDetectado" : fuente === "curado" ? "iaFuenteCurado" : fuente === "estimado" ? "iaFuenteEstimado" : fuente === "incluido" ? "mvFuenteIncluido" : "iaFuenteNinguno"); }
function confianzaClase(fuente) { return fuente === "detectado" ? "text-emerald-600" : fuente === "curado" ? "text-sky-600" : fuente === "estimado" ? "text-amber-600" : "text-slate-400"; }
function simboloMoneda(cod) { return cod === "COP" ? "$" : cod === "EUR" ? "€" : cod === "GBP" ? "£" : cod === "CAD" ? "C$" : cod === "MXN" ? "MX$" : cod === "BRL" ? "R$" : cod === "PEN" ? "S/" : cod === "JPY" ? "¥" : cod === "CNY" ? "CN¥" : cod === "AUD" ? "A$" : cod === "CHF" ? "CHF " : cod === "USD" ? "US$" : `${cod} `; }
function formatoMoneda(valor, cod, t = (k) => k) { if (valor == null || !Number.isFinite(Number(valor))) return t("mvSinPrecio"); return `${simboloMoneda(cod)}${Number(valor).toLocaleString(cod === "COP" ? "es-CO" : "en-US", { maximumFractionDigits: 0 })}`; }

// Tonos de la ficha de visa. Mismos colores que RequisitosViaje, para que el
// mismo requisito no se vea de dos maneras distintas segun la pantalla.
const MEDIO = { vuelo: "iaMedioVuelo", tren: "iaMedioTren", bus: "iaMedioBus", ferry: "iaMedioFerry" };
const iconoMedio = { tren: "🚆", vuelo: "✈️", bus: "🚌", ferry: "⛴️" };
// Las mismas explicaciones codificadas que traduce el panel de oportunidades.
const CLAVE_EXPLICACION = { mejorEstimado: "iaExpMejorEstimado", mejorFiable: "iaExpMejorFiable", competitiva: "iaExpCompetitiva", razonable: "iaExpRazonable", pierde: "iaExpPierde" };

const TONO = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
  amber: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100",
  rose: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/20 dark:text-rose-100",
  slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

/**
 * Un modulo del viaje. Tres estados, y el tercero existe por honestidad:
 *
 *   listo         hay datos y se pueden ver
 *   pendiente     falta una decision del viajero, y hay donde tomarla
 *   sin-modulo    la funcion todavia no existe en Anduve
 *
 * Antes los seis bloques eran botones SIN onClick: se veian pulsables y no
 * hacian nada, y dos de ellos prometian funciones que no existen. Un tablero
 * que miente sobre lo que sabe hacer es peor que uno incompleto.
 */
function Bloque({ icono, titulo, subtitulo, estado = "pendiente", href, onClick, t = (k) => k }) {
  const contenido = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-marca-700 dark:bg-slate-700 dark:text-marca-300">
        <Icono nombre={icono} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-extrabold text-slate-900 dark:text-slate-100">{titulo}</span>
        <span className="mt-0.5 block text-[12px] text-slate-500 dark:text-slate-400">{subtitulo}</span>
      </span>
      <span className={`shrink-0 text-[11px] font-bold ${estado === "listo" ? "text-emerald-600" : estado === "sin-modulo" ? "text-slate-300 dark:text-slate-600" : "text-slate-400"}`}>
        {t(estado === "listo" ? "mvListo" : estado === "sin-modulo" ? "mvProximamente" : "mvPendiente")}
      </span>
    </>
  );
  const clases = "group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition dark:border-slate-700 dark:bg-slate-800";

  if (estado === "sin-modulo") {
    return <div className={`${clases} opacity-60`} aria-disabled="true">{contenido}</div>;
  }
  if (href) {
    return <a href={href} className={`${clases} hover:border-marca-300 hover:shadow-sm`}>{contenido}</a>;
  }
  return <button type="button" onClick={onClick} className={`${clases} hover:border-marca-300 hover:shadow-sm`}>{contenido}</button>;
}

/**
 * Requisitos de entrada del VIAJE, no de una ciudad.
 *
 * El viaje ya guardaba el pasaporte del viajero y aqui no se usaba para nada:
 * el dato estaba y la pantalla no lo aprovechaba. Se recorre cada pais de la
 * ruta y se resuelve con el mismo dataset y las mismas funciones que usa
 * RequisitosViaje —no hay una segunda logica de visas—, con las claves de
 * traduccion que ya existian.
 *
 * El pais del propio pasaporte se salta: nadie necesita visa para volver a
 * casa, y en el viaje de referencia Colombia aparece dos veces.
 */
function RequisitosDelViaje({ paises, pasaporte, t, lang, visas }) {
  const nacionalidad = String(pasaporte || "CO").toUpperCase();
  const destinos = useMemo(
    () => paises.map((cc) => cc.toUpperCase()).filter((cc) => cc !== nacionalidad),
    [paises, nacionalidad]
  );
  if (!destinos.length) return null;

  return (
    <div id="requisitos" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Requisitos</div>
          <h3 className="mt-1 text-[17px] font-extrabold text-slate-900 dark:text-white">Qué necesitas para entrar</h3>
          <p className="mt-1 text-[12px] text-slate-500 dark:text-slate-400">
            Con pasaporte de {nombrePaisMostrar(nacionalidad.toLowerCase(), lang)} · {t("reqVisaNota")}
          </p>
          {/* De cuando son las reglas. Mismo criterio que RequisitosViaje: si
              no hay fecha no se afirma frescura, se dice que no se sabe. */}
          {visas && (() => {
            const meta = metaVisas();
            if (!meta) return <p className="mt-1 text-[12px] font-semibold text-amber-700 dark:text-amber-400">{t("reqVisaSinFecha")}</p>;
            if (visasDudosas()) return <p className="mt-1 text-[12px] font-semibold text-amber-700 dark:text-amber-400">{t("reqVisaCaduco").replace("{dias}", String(diasDesdeVerificacion()))}</p>;
            return <p className="mt-1 text-[12px] text-slate-400 dark:text-slate-500">{t("reqVisaVerificado").replace("{fecha}", meta.verificado)}</p>;
          })()}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {destinos.map((iso) => {
          const info = interpretarVisa(visas?.[nacionalidad]?.[iso]);
          const autoriz = autorizacionElectronica(iso, nacionalidad);
          const fiebre = exigeFiebreAmarilla(iso);
          return (
            <div key={iso} className={`rounded-xl border p-3 ${TONO[info?.color] || TONO.slate}`}>
              <div className="flex items-center gap-2">
                <Bandera cc={iso.toLowerCase()} size={18} />
                <span className="text-[13.5px] font-extrabold">{nombrePaisMostrar(iso.toLowerCase(), lang)}</span>
              </div>
              <div className="mt-2 text-[11px] font-bold uppercase tracking-wide opacity-70">{t("reqVisa")}</div>
              <div className="mt-0.5 text-[14.5px] font-extrabold">
                {!visas
                  ? "…"
                  : info
                    ? info.tipo === "sinvisaDias"
                      ? t("req_sinvisaDias").replace("{n}", info.dias)
                      : t("req_" + info.tipo)
                    : t("req_desconocido")}
              </div>

              {autoriz && (
                <div className="mt-2 rounded-lg bg-white/60 px-2 py-1.5 text-[11.5px] font-semibold dark:bg-black/20">
                  {autoriz.tipo} · {t("reqAutorizRequerida")}
                </div>
              )}
              {fiebre && (
                <div className="mt-1.5 text-[11.5px] font-semibold opacity-90">💉 {t("reqFiebreSi")}</div>
              )}

              <a href={`/requisitos/${iso.toLowerCase()}`} className="mt-2 inline-block text-[12px] font-bold underline-offset-2 hover:underline">
                {t("reqVerOficial")} →
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * UN TRAMO, COMO ALGO QUE SE DECIDE.
 *
 * Antes esta fila solo informaba: "Londres → Edimburgo, tren, 4.5 h". El
 * viajero leia la recomendacion y no tenia donde decir que si —ni donde decir
 * que no—, asi que al volver al tablero la pantalla no recordaba nada.
 *
 * Ahora se puede elegir. Y elegir aqui NO reescribe la ruta:
 *
 *   · el orden de las ciudades no cambia
 *   · las noches no cambian
 *   · el viaje guardado no se toca
 *
 * Solo se anota "en este tramo voy en tren", en la capa de ejecucion, y se
 * puede deshacer volviendo a la recomendacion. Cambiar la ruta de verdad
 * sigue siendo cosa del editor, que es donde el viajero espera que pase.
 *
 * El precio y el tiempo que se enseñan son los de la opcion ELEGIDA, no los
 * de la recomendada: si eliges el bus, el numero que ves es el del bus.
 */
function TramoOperativo({ tr, t, monedaVista, elegido, onElegir, puedeGuardar, guardando }) {
  const opciones = (tr.alternativas || []).filter((o) => o && o.medio);
  const dela = elegido ? opciones.find((o) => o.medio === elegido) : null;
  const medio = dela?.medio || tr.medioRecomendado || tr.medio;
  const fuente = dela?.fuente || tr.fuenteRecomendada || tr.fuente;
  const precio = dela ? dela.precio : (tr.precioRecomendado ?? tr.precio);
  const horasTramo = dela ? dela.puertaAPuerta_h : (tr.puertaAPuertaRecomendada_h ?? tr.puertaAPuerta_h);
  const explicacion = dela
    ? (CLAVE_EXPLICACION[dela.explicacionCodigo] ? t(CLAVE_EXPLICACION[dela.explicacionCodigo]) : dela.explicacion)
    : (CLAVE_EXPLICACION[tr.recomendacionExplicacionCodigo] ? t(CLAVE_EXPLICACION[tr.recomendacionExplicacionCodigo]) : tr.recomendacionExplicacion);
  // Solo hay algo que elegir cuando hay mas de una opcion real.
  const hayQueElegir = opciones.length > 1;

  return (
    <div className="py-3 first:pt-0">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{tr.desde} → {tr.hasta}</span>
            {elegido && <span className="rounded-full bg-marca-100 px-2 py-0.5 text-[9.5px] font-black text-marca-800 dark:bg-marca-900/40 dark:text-marca-200">{t("ejMedioElegido")}</span>}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {MEDIO[medio] ? t(MEDIO[medio]) : medio || t("iaMedioNinguno")} · {horasTramo != null ? t("iaPuertaAPuerta", { h: horasTramo }) : t("mvDuracionDesconocida")}
            {!elegido && <> · {t("mvRecomendada")}</>}
          </div>
          {explicacion && <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{explicacion}</div>}
        </div>
        <div className="shrink-0 sm:text-right">
          <div className="text-[14px] font-black text-slate-900 dark:text-white">{precio === 0 && fuente === "incluido" ? t("mvIncluido") : precio != null ? formatoMoneda(precio, "USD", t) : t("mvSinPrecio")}</div>
          <div className={`text-[10px] font-bold ${confianzaClase(fuente)}`}>{fuenteTexto(fuente, t)}{precio != null && monedaVista !== "USD" ? t("mvPrecioEnUsd") : ""}</div>
        </div>
      </div>

      {puedeGuardar && hayQueElegir && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {opciones.map((o) => {
            const activo = medio === o.medio;
            return (
              <button
                key={o.medio}
                type="button"
                disabled={guardando}
                onClick={() => onElegir(tr.id, activo && elegido ? null : o.medio)}
                className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition disabled:opacity-60 ${activo ? "bg-marca-700 text-white" : "border border-slate-200 text-slate-600 hover:border-marca-300 dark:border-slate-600 dark:text-slate-300"}`}
              >
                {iconoMedio[o.medio] || "🚐"} {MEDIO[o.medio] ? t(MEDIO[o.medio]) : o.medio}
                {o.precio != null && <span className="ml-1.5 font-semibold opacity-70">{formatoMoneda(o.precio, "USD", t)}</span>}
              </button>
            );
          })}
          {elegido && (
            <button type="button" disabled={guardando} onClick={() => onElegir(tr.id, null)}
              className="rounded-full px-2.5 py-1.5 text-[11px] font-bold text-slate-400 hover:underline disabled:opacity-60">
              {t("ejVolverRecomendado")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export default function MiViajeDashboard({ ruta, lang = "es", t = (k) => k, onOptimizar }) {
  const paradas = ruta?.paradas || [];
  const ciudades = useMemo(() => ciudadesUnicas(paradas), [paradas]);
  const paises = useMemo(() => paisesUnicos(paradas), [paradas]);
  const noches = useMemo(() => nochesTotales(paradas), [paradas]);
  const porcentaje = useMemo(() => progreso(ruta), [ruta]);
  const presupuestoManual = Object.keys(ruta?.presupuesto?.overrides || {}).length > 0;
  const tieneFecha = Boolean(ruta?.mesInicio);
  const tieneNoche = noches > 0;
  const [analisis, setAnalisis] = useState(null);
  const [decisiones, setDecisiones] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState("");

  // LA CAPA DE EJECUCION.
  //
  // `ejecucion` es lo unico que el viajero ha decidido a mano: que tareas
  // dio por hechas y que medio eligio en cada tramo. Vive en su propia clave
  // de KV (ver app/api/ejecucion), no dentro del viaje: marcar una casilla
  // no puede implicar reescribir la ruta entera.
  //
  // Si no se puede guardar —viaje sin id, sin sesion, KV caida— el panel
  // sigue funcionando en modo lectura y lo dice, en vez de ofrecer botones
  // que no van a recordar nada.
  const [visas, setVisas] = useState(null);
  const [ejecucion, setEjecucion] = useState(null);
  const [puedeGuardar, setPuedeGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorEjecucion, setErrorEjecucion] = useState("");

  // LOS CAMBIOS DESDE LA ULTIMA VEZ.
  //
  // La deteccion se dispara al tener el analisis y NO consulta precios: solo
  // compara lo que ya esta en pantalla contra la foto guardada. Las consultas
  // de pago viven en el monitor, que corre por cron con su propio freno.
  const [alertas, setAlertas] = useState([]);
  const [resumenAl, setResumenAl] = useState(null);

  useEffect(() => {
    let vivo = true;
    cargarVisas().then((v) => vivo && setVisas(v));
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    const id = ruta?.id;
    setEjecucion(null); setPuedeGuardar(false); setErrorEjecucion("");
    if (!id) return undefined;
    (async () => {
      try {
        const r = await fetch(`/api/ejecucion?id=${encodeURIComponent(id)}`, { cache: "no-store" });
        const d = await r.json();
        if (!vivo) return;
        if (r.ok && d?.ok) { setEjecucion(d.ejecucion || { tareas: {}, tramos: {} }); setPuedeGuardar(true); }
      } catch { /* modo lectura */ }
    })();
    return () => { vivo = false; };
  }, [ruta?.id]);

  // Guardar es idempotente: se manda la ejecucion entera, no un parche, y
  // el optimismo se revierte si el servidor dice que no.
  const guardarEjecucion = useCallback(async (siguiente) => {
    const id = ruta?.id;
    const previo = ejecucion;
    setEjecucion(siguiente);
    if (!id || !puedeGuardar) return;
    setGuardando(true); setErrorEjecucion("");
    try {
      const r = await fetch("/api/ejecucion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ejecucion: siguiente }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error("ejErrorGuardar");
      setEjecucion(d.ejecucion);
    } catch {
      setEjecucion(previo);
      setErrorEjecucion("ejErrorGuardar");
    } finally { setGuardando(false); }
  }, [ruta?.id, ejecucion, puedeGuardar]);

  const cambiarEstadoTarea = useCallback((idTarea, estado) => {
    const base = ejecucion || { tareas: {}, tramos: {} };
    const tareas = { ...(base.tareas || {}) };
    if (estado === "pendiente") delete tareas[idTarea];
    else tareas[idTarea] = { estado, actualizada: Date.now() };
    guardarEjecucion({ ...base, tareas });
  }, [ejecucion, guardarEjecucion]);

  // Elegir un medio NO reordena ni reescribe la ruta: solo anota la eleccion
  // de ese tramo, y se puede deshacer volviendo a la recomendacion.
  const elegirMedio = useCallback((idTramo, medio) => {
    const base = ejecucion || { tareas: {}, tramos: {} };
    const tramos = { ...(base.tramos || {}) };
    if (!medio) delete tramos[idTramo];
    else tramos[idTramo] = { medioElegido: medio, actualizada: Date.now() };
    guardarEjecucion({ ...base, tramos });
  }, [ejecucion, guardarEjecucion]);

  // A donde se va a EDITAR. /ruta es el editor de verdad; /mis-viajes es la
  // lista. Antes desde aqui se mandaba a la lista con ?editar=, que abre el
  // planificador incrustado en una pantalla que va de otra cosa.
  const urlEditor = ruta?.id ? `/ruta?id=${encodeURIComponent(ruta.id)}` : "/ruta";

  const analizar = useCallback(async () => {
    if (!ruta || paradas.length < 2) return;
    setAnalizando(true); setErrorAnalisis("");
    try {
      // UNA peticion, no dos.
      //
      // Antes se pedian /api/viaje-canonico y /api/viaje-canonico/decisiones
      // en paralelo: dos analisis del MISMO viaje, con su doble coste de
      // servidor. El primero ya devuelve las decisiones y la inteligencia.
      const r = await fetch("/api/viaje-canonico", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viaje: ruta, origen: "ruta" }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.motivo || "mvErrorAnalisis");
      setAnalisis(d);
      setDecisiones(d.decisiones || null);
    } catch (e) { setErrorAnalisis(e?.message || "mvErrorAnalisisGenerico"); }
    finally { setAnalizando(false); }
  }, [ruta, paradas.length]);

  useEffect(() => { analizar(); }, [analizar]);
  const horas = useMemo(() => (analisis?.tramos || []).reduce((s, tr) => s + (Number(tr.puertaAPuertaRecomendada_h ?? tr.puertaAPuerta_h) || 0), 0), [analisis]);
  const monedaVista = analisis?.presupuesto?.monedaVista || ruta?.monedaVista || "USD";
  const totalVista = analisis?.presupuesto?.totalVista ?? analisis?.presupuesto?.total;
  const transporteVista = analisis?.presupuesto?.transporteVista ?? analisis?.presupuesto?.transporte;
  const tasaEnVivo = Boolean(analisis?.presupuesto?.conversionEnVivo);
  // Los requisitos, ya interpretados, en la forma que espera el motor de
  // ejecucion. Se usan las MISMAS funciones que pintan la ficha de cada pais:
  // no hay una segunda logica de visas en el proyecto.
  const requisitosLista = useMemo(() => {
    const nacionalidad = String(ruta?.pasaporte || "CO").toUpperCase();
    if (!visas) return [];
    return paises
      .map((cc) => cc.toUpperCase())
      .filter((cc) => cc !== nacionalidad)
      .map((iso) => {
        const info = interpretarVisa(visas?.[nacionalidad]?.[iso]);
        const autoriz = autorizacionElectronica(iso, nacionalidad);
        return {
          iso,
          pais: nombrePaisMostrar(iso.toLowerCase(), lang),
          tipo: info?.tipo || "desconocido",
          autorizacion: autoriz?.tipo || null,
          fiebreAmarilla: exigeFiebreAmarilla(iso),
        };
      });
  }, [visas, paises, ruta?.pasaporte, lang]);

  // Se detecta cuando ya hay analisis Y plan: sin el plan no se sabe que
  // tareas siguen pendientes y las alertas de tarea saldrian mal.
  const detectarCambiosViaje = useCallback(async (planActual) => {
    const id = ruta?.id;
    if (!id || !analisis || !planActual?.tareas?.length) return;
    try {
      const r = await fetch("/api/viaje-alertas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, analisis, plan: planActual, preciosVivos: {} }),
      });
      const d = await r.json();
      if (r.ok && d?.ok) { setAlertas(d.alertas || []); setResumenAl(d.resumen || null); }
    } catch { /* sin alertas, el tablero sigue entero */ }
  }, [ruta?.id, analisis]);

  const accionAlerta = useCallback(async (accion, alertaId) => {
    const id = ruta?.id;
    if (!id) return;
    const previo = alertas;
    // Optimista, y se revierte si el servidor dice que no.
    setAlertas(previo.map((a) => (accion === "leer-todas" ? { ...a, leida: true }
      : a.id !== alertaId ? a
      : accion === "resolver" ? { ...a, estado: "resuelta" } : { ...a, leida: true })));
    try {
      const r = await fetch("/api/viaje-alertas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, accion, alertaId }),
      });
      const d = await r.json();
      if (r.ok && d?.ok) { setAlertas(d.alertas || []); setResumenAl(d.resumen || null); }
      else setAlertas(previo);
    } catch { setAlertas(previo); }
  }, [ruta?.id, alertas]);

  // LAS ACCIONES. Se calculan, no se guardan: los enlaces dependen de
  // precios y fechas que cambian, y guardarlos seria guardar una promesa
  // caducada. Todas salen de lib/afiliados o del enlace que devolvio el
  // proveedor; ninguna se escribe a mano.
  const acciones = useMemo(() => construirAcciones({
    viaje: ruta, analisis, ejecucion, requisitos: requisitosLista,
  }), [ruta, analisis, ejecucion, requisitosLista]);

  // Anotar una reserva NO la hace Anduve: la aporta el viajero. Se guarda
  // en la misma capa de ejecucion del Proceso 4, no en una nueva.
  const anotarReserva = useCallback((idAccion, datos) => {
    const base = ejecucion || { tareas: {}, tramos: {}, reservas: {} };
    const reservas = { ...(base.reservas || {}) };
    reservas[idAccion] = { ...datos, anotadaEn: Date.now() };
    guardarEjecucion({ ...base, reservas });
  }, [ejecucion, guardarEjecucion]);

  const borrarReserva = useCallback((idAccion) => {
    const base = ejecucion || { tareas: {}, tramos: {}, reservas: {} };
    const reservas = { ...(base.reservas || {}) };
    delete reservas[idAccion];
    guardarEjecucion({ ...base, reservas });
  }, [ejecucion, guardarEjecucion]);

  const plan = useMemo(() => construirPlan({
    viaje: ruta,
    tramos: analisis?.tramos || [],
    estadia: analisis?.estadia || [],
    requisitos: requisitosLista,
    ejecucion,
  }), [ruta, analisis, requisitosLista, ejecucion]);

  useEffect(() => { detectarCambiosViaje(plan); }, [detectarCambiosViaje, plan]);

  // Un tramo con precio REAL es el que vino de una consulta, no de la tabla.
  const tramosReales = useMemo(
    () => (analisis?.tramos || []).filter((tr) => (tr.fuenteRecomendada || tr.fuente) === "detectado").length,
    [analisis]
  );

  return <section className="mt-4 min-w-0 space-y-5" aria-label="Mi viaje">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-marca-900 via-marca-700 to-emerald-600 p-5 text-white shadow-card sm:p-7"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5">{paises.map((cc) => <Bandera key={cc} cc={cc} size={18} />)}<span className="ml-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/65">{t("navMiViaje")}</span></div><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{ruta?.nombre || `${ciudades[0] || t("mvNuevoViaje")} → ${ciudades[ciudades.length - 1] || t("mvDestino")}`}</h2><p className="mt-1.5 text-[13px] text-white/75">{fmtMes(ruta?.mesInicio, lang, t)} · {t(ciudades.length === 1 ? "mvCiudadUna" : "mvCiudadVarias", { n: ciudades.length })} · {t(noches === 1 ? "mvNocheUna" : "mvNocheVarias", { n: noches })}</p><div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold text-white/90">{ciudades.map((ciudad, i) => <span key={`${ciudad}-${i}`} className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{ciudad}</span>)}</div></div><a href={urlEditor} className="rounded-full bg-white px-4 py-2 text-[12.5px] font-extrabold text-marca-800 shadow-sm hover:bg-white/90">{t("mvEditarRuta")}</a></div><div className="mt-6 rounded-2xl bg-black/10 p-4 ring-1 ring-white/10"><div className="flex items-end justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/60">{t("mvPreparacion")}</div><div className="mt-1 text-xl font-black">{porcentaje}%</div></div><div className="text-right text-[11px] text-white/65">{t("mvSinInventar")}</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{ width: `${porcentaje}%` }} /></div></div></div>

    {/* "¿QUE SIGUE?" va lo primero despues de la portada.

        El resto del tablero describe el viaje; esto es lo unico que pide una
        accion, asi que abre. Aparece en cuanto hay analisis: sin tramos no
        hay tareas reales que generar y el motor devuelve el plan vacio. */}
    {/* LO QUE CAMBIO va antes incluso que "¿que sigue?": si algo se movio
        desde la ultima visita, es lo primero que hay que saber. Cuando no
        hay nada, es una sola linea y no estorba. */}
    {analisis && (
      <CambiosViaje
        alertas={alertas}
        resumen={resumenAl}
        onLeer={() => accionAlerta("leer-todas")}
        onResolver={(idAlerta) => accionAlerta("resolver", idAlerta)}
        money={(v) => formatoMoneda(v, "USD", t)}
        compacto
      />
    )}

    {plan.tareas.length > 0 && (
      <QueSigue
        plan={plan}
        onEstado={cambiarEstadoTarea}
        guardando={guardando}
        puedeGuardar={puedeGuardar}
        error={errorEjecucion}
      />
    )}

    {/* EL MAPA. Es la misma ruta de la que habla todo lo demas, y hasta ahora
        en esta pantalla solo existia como una tira de nombres de ciudad. Se
        reutiliza MapaRuta con las mismas paradas: ni una copia del dato. */}
    {paradas.length > 0 && (
      <div id="mapa" className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
        <MapaRuta paradas={paradas} textoFallo={t("rutaMapaFallo")} lang={lang} t={t} />
      </div>
    )}

    <div className="rounded-2xl border border-marca-200 bg-marca-50 p-4 dark:border-marca-900 dark:bg-marca-900/20"><div className="flex items-start gap-3"><span className="mt-0.5 text-marca-700 dark:text-marca-300"><Icono nombre="compass" size={19} /></span><div className="min-w-0 flex-1"><h3 className="text-[14px] font-extrabold text-marca-900 dark:text-marca-100">{analizando ? t("mvAnalizandoTitulo") : t("mvAnalisisTitulo")}</h3><p className="mt-1 text-[12.5px] leading-relaxed text-marca-800/75 dark:text-marca-200/75">{t("mvAnalisisIntro")}</p></div><button type="button" onClick={analizar} disabled={analizando} className="shrink-0 rounded-full bg-marca-700 px-3.5 py-2 text-[11.5px] font-extrabold text-white disabled:opacity-60">{analizando ? t("mvAnalizandoBoton") : t("mvActualizar")}</button></div>{errorAnalisis && <p className="mt-3 text-[11.5px] font-semibold text-red-600">{t(errorAnalisis)}</p>}</div>

    {analisis && <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("mvCosteOrientativo")}</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatoMoneda(totalVista, monedaVista, t)}</div><div className="mt-1 text-[11px] text-slate-500">{t("mvCosteDetalle", { moneda: monedaVista })}{tasaEnVivo ? t("mvCambioActualizado") : monedaVista !== "USD" ? t("mvCambioRespaldo") : ""}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("mvTransporte")}</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatoMoneda(transporteVista, monedaVista, t)}</div><div className="mt-1 text-[11px] text-slate-500">{t("mvTransporteDetalle")}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("mvTiempoRuta")}</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{horas.toFixed(1)} h</div><div className="mt-1 text-[11px] text-slate-500">{t("mvTiempoDetalle")}</div></div></div>
      <div id="transporte" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("mvTransporte")}</div><h3 className="mt-1 text-[17px] font-extrabold text-slate-900 dark:text-white">{t("mvComoMoverte")}</h3></div>{analisis.regreso?.ahorro > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">{t("mvRegresoIncluido")}</span>}</div><div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">{(analisis.tramos || []).map((tr) => <TramoOperativo key={tr.id} tr={tr} t={t} monedaVista={monedaVista} elegido={ejecucion?.tramos?.[tr.id]?.medioElegido || null} onElegir={elegirMedio} puedeGuardar={puedeGuardar} guardando={guardando} />)}</div></div>
      {/* DONDE DORMIR. El presupuesto ya lo contaba, pero sumado: aqui se ve
          ciudad por ciudad, que es como se decide. */}
      <BloqueAlojamiento
        estadia={analisis.estadia || []}
        tareas={plan.tareas}
        onEstado={cambiarEstadoTarea}
        guardando={guardando}
        puedeGuardar={puedeGuardar}
        money={(v) => formatoMoneda(v, "USD", t)}
      />
      {/* Y DESPUES DE TODO LO ANTERIOR, donde hacerlo. La recomendacion va
          primero: esto cierra la frase, no la abre. */}
      <AccionesViaje
        acciones={acciones}
        reservas={ejecucion?.reservas || {}}
        onReservar={anotarReserva}
        onBorrarReserva={borrarReserva}
        puedeGuardar={puedeGuardar}
        money={(v) => formatoMoneda(v, "USD", t)}
      />

      {/* La sintesis va ANTES del detalle: primero que deberias cambiar,
          y luego los numeros que lo sostienen. */}
      <OportunidadesViaje inteligencia={analisis.inteligencia} presupuesto={analisis.presupuesto} />
      <div id="decisiones" />
      <InteligenciaViaje ruta={ruta} analisis={analisis} decisiones={decisiones} />
      <AsesorViaje viaje={ruta} analisis={analisis} plan={plan} />
      {analisis.optimizacion?.hayZigzag && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-900/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700">{t("mvOportunidadOptim")}</div><h3 className="mt-1 text-[16px] font-extrabold text-amber-950 dark:text-amber-100">{t("mvRutaMejor")}</h3><p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-900/75 dark:text-amber-100/70">{analisis.optimizacion.mensaje || t("mvOrdenAlternativo")}</p></div><button type="button" onClick={onOptimizar} className="rounded-full bg-amber-800 px-4 py-2 text-[11.5px] font-extrabold text-white hover:bg-amber-900">{t("mvVerAlternativa")}</button></div></div>}
    </>}

    <RequisitosDelViaje paises={paises} pasaporte={ruta?.pasaporte} t={t} lang={lang} visas={visas} />

    {/* LOS MODULOS. Cada uno lleva ahora a donde esa decision se toma de
        verdad, o dice claramente que todavia no existe. */}
    <div className="grid gap-3 sm:grid-cols-2">
      <Bloque icono="plane" titulo={t("mvBlqVuelos")} href={urlEditor} t={t}
        subtitulo={tramosReales > 0 ? t(tramosReales === 1 ? "mvBlqVuelosListoUno" : "mvBlqVuelosListoVarios", { n: tramosReales }) : t("mvBlqVuelosPend")}
        estado={tramosReales > 0 ? "listo" : "pendiente"} />
      <Bloque icono="route" titulo={t("mvTransporte")} href="#transporte" t={t}
        subtitulo={t("mvBlqTransporteSub")}
        estado={analisis ? "listo" : "pendiente"} />
      <Bloque icono="calendar" titulo={t("mvBlqItinerario")} href={urlEditor} t={t}
        subtitulo={tieneNoche ? t("mvBlqItinerarioListo", { n: noches }) : t("mvBlqItinerarioPend")}
        estado={tieneNoche ? "listo" : "pendiente"} />
      <Bloque icono="wallet" titulo={t("mvBlqPresupuesto")} href={urlEditor} t={t}
        subtitulo={analisis ? t("mvBlqPresupuestoListo", { v: formatoMoneda(totalVista, monedaVista, t) }) : presupuestoManual ? t("mvBlqPresupuestoManual") : t("mvBlqPresupuestoPend")}
        estado={analisis || presupuestoManual ? "listo" : "pendiente"} />
      <Bloque icono="shield" titulo={t("mvBlqRequisitos")} href="#requisitos" t={t}
        subtitulo={paises.length > 1 ? t("mvBlqRequisitosVarios", { n: paises.length }) : t("mvBlqRequisitosUno")}
        estado={paises.length > 0 ? "listo" : "pendiente"} />
      <Bloque icono="bed" titulo={t("mvBlqAlojamiento")} estado="sin-modulo" t={t}
        subtitulo={t("mvBlqAlojamientoSub")} />
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("mvRuta")}</div><h3 className="mt-1 text-[16px] font-extrabold text-slate-900 dark:text-slate-100">{t("mvAsiSeMueve")}</h3></div><a href={urlEditor} className="text-[12px] font-bold text-marca-700 hover:underline dark:text-marca-300">{t("mvCambiar")}</a></div><div className="mt-5 overflow-x-auto pb-1"><div className="flex min-w-max items-center gap-2">{paradas.map((p, i) => <div key={`${p.ciudad}-${i}`} className="flex items-center gap-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-600 dark:bg-slate-700"><div className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{p.ciudad}</div>{p.noches > 0 && <div className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-300">{t(p.noches === 1 ? "mvNocheUna" : "mvNocheVarias", { n: p.noches })}</div>}</div>{i < paradas.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}</div>)}</div></div></div>
  </section>;
}
