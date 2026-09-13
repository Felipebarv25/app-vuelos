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
import { nombrePaisMostrar } from "@/lib/paisesNombres";
import {
  cargarVisas,
  interpretarVisa,
  exigeFiebreAmarilla,
  autorizacionElectronica,
} from "@/lib/requisitos";

// Igual que en PlanRuta: maplibre no puede renderizarse en servidor.
const MapaRuta = dynamic(() => import("./MapaRuta"), { ssr: false });

function fmtMes(mes, lang = "es") {
  if (!/^\d{4}-\d{2}$/.test(String(mes || ""))) return "Fecha por definir";
  const d = new Date(`${mes}-01T00:00:00`);
  return d.toLocaleDateString(lang, { month: "long", year: "numeric" });
}
function nochesTotales(paradas = []) { return paradas.reduce((sum, p) => sum + Math.max(0, Number(p?.noches) || 0), 0); }
function ciudadesUnicas(paradas = []) { const out = []; for (const p of paradas) { const ciudad = String(p?.ciudad || "").trim(); if (ciudad && !out.some((x) => x.toLowerCase() === ciudad.toLowerCase())) out.push(ciudad); } return out; }
function paisesUnicos(paradas = []) { const out = []; for (const p of paradas) { const cc = String(p?.pais || "").trim().toLowerCase(); if (/^[a-z]{2}$/.test(cc) && !out.includes(cc)) out.push(cc); } return out; }
function progreso(ruta) { const p = ruta?.paradas || []; let total = 0; let hecho = 0; const checks = [[p.length >= 2,20],[Boolean(ruta?.mesInicio),15],[p.some((x)=>Number(x?.noches)>0),20],[p.every((x)=>x?.iata||(x?.lat!=null&&x?.lon!=null)),15],[Boolean(ruta?.presupuesto?.overrides&&Object.keys(ruta.presupuesto.overrides).length),15],[Boolean(ruta?.fechaIda),15]]; for (const [ok,peso] of checks) { total += peso; if (ok) hecho += peso; } return Math.round(hecho / total * 100); }
function fuenteTexto(fuente) { return fuente === "detectado" ? "Dato detectado" : fuente === "curado" ? "Referencia curada" : fuente === "estimado" ? "Estimación" : fuente === "incluido" ? "Incluido en el billete" : "Sin dato"; }
function confianzaClase(fuente) { return fuente === "detectado" ? "text-emerald-600" : fuente === "curado" ? "text-sky-600" : fuente === "estimado" ? "text-amber-600" : "text-slate-400"; }
function simboloMoneda(cod) { return cod === "COP" ? "$" : cod === "EUR" ? "€" : cod === "GBP" ? "£" : cod === "CAD" ? "C$" : cod === "MXN" ? "MX$" : cod === "BRL" ? "R$" : cod === "PEN" ? "S/" : cod === "JPY" ? "¥" : cod === "CNY" ? "CN¥" : cod === "AUD" ? "A$" : cod === "CHF" ? "CHF " : cod === "USD" ? "US$" : `${cod} `; }
function formatoMoneda(valor, cod) { if (valor == null || !Number.isFinite(Number(valor))) return "Sin precio"; return `${simboloMoneda(cod)}${Number(valor).toLocaleString(cod === "COP" ? "es-CO" : "en-US", { maximumFractionDigits: 0 })}`; }

// Tonos de la ficha de visa. Mismos colores que RequisitosViaje, para que el
// mismo requisito no se vea de dos maneras distintas segun la pantalla.
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
function Bloque({ icono, titulo, subtitulo, estado = "pendiente", href, onClick }) {
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
        {estado === "listo" ? "Listo" : estado === "sin-modulo" ? "Próximamente" : "Pendiente"}
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
function RequisitosDelViaje({ paises, pasaporte, t, lang }) {
  const [visas, setVisas] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarVisas().then((v) => vivo && setVisas(v));
    return () => { vivo = false; };
  }, []);

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

  // A donde se va a EDITAR. /ruta es el editor de verdad; /mis-viajes es la
  // lista. Antes desde aqui se mandaba a la lista con ?editar=, que abre el
  // planificador incrustado en una pantalla que va de otra cosa.
  const urlEditor = ruta?.id ? `/ruta?id=${encodeURIComponent(ruta.id)}` : "/ruta";

  const analizar = useCallback(async () => {
    if (!ruta || paradas.length < 2) return;
    setAnalizando(true); setErrorAnalisis("");
    try {
      const [r, rd] = await Promise.all([
        fetch("/api/viaje-canonico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ viaje: ruta, origen: "ruta" }) }),
        fetch("/api/viaje-canonico/decisiones", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ viaje: ruta, origen: "ruta" }) }),
      ]);
      const d = await r.json(); const dd = await rd.json();
      if (!r.ok || !d?.ok) throw new Error(d?.motivo || "No se pudo analizar el viaje");
      setAnalisis(d);
      if (rd.ok && dd?.ok) setDecisiones(dd.decisiones);
    } catch (e) { setErrorAnalisis(e?.message || "No pudimos analizar el viaje."); }
    finally { setAnalizando(false); }
  }, [ruta, paradas.length]);

  useEffect(() => { analizar(); }, [analizar]);
  const horas = useMemo(() => (analisis?.tramos || []).reduce((s, tr) => s + (Number(tr.puertaAPuertaRecomendada_h ?? tr.puertaAPuerta_h) || 0), 0), [analisis]);
  const monedaVista = analisis?.presupuesto?.monedaVista || ruta?.monedaVista || "USD";
  const totalVista = analisis?.presupuesto?.totalVista ?? analisis?.presupuesto?.total;
  const transporteVista = analisis?.presupuesto?.transporteVista ?? analisis?.presupuesto?.transporte;
  const tasaEnVivo = Boolean(analisis?.presupuesto?.conversionEnVivo);
  // Un tramo con precio REAL es el que vino de una consulta, no de la tabla.
  const tramosReales = useMemo(
    () => (analisis?.tramos || []).filter((tr) => (tr.fuenteRecomendada || tr.fuente) === "detectado").length,
    [analisis]
  );

  return <section className="mt-4 min-w-0 space-y-5" aria-label="Mi viaje">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-marca-900 via-marca-700 to-emerald-600 p-5 text-white shadow-card sm:p-7"><div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5">{paises.map((cc) => <Bandera key={cc} cc={cc} size={18} />)}<span className="ml-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/65">Mi viaje</span></div><h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{ruta?.nombre || `${ciudades[0] || "Nuevo viaje"} → ${ciudades[ciudades.length - 1] || "Destino"}`}</h2><p className="mt-1.5 text-[13px] text-white/75">{fmtMes(ruta?.mesInicio, lang)} · {ciudades.length} {ciudades.length === 1 ? "ciudad" : "ciudades"} · {noches} {noches === 1 ? "noche" : "noches"}</p><div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold text-white/90">{ciudades.map((ciudad, i) => <span key={`${ciudad}-${i}`} className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{ciudad}</span>)}</div></div><a href={urlEditor} className="rounded-full bg-white px-4 py-2 text-[12.5px] font-extrabold text-marca-800 shadow-sm hover:bg-white/90">Editar ruta</a></div><div className="mt-6 rounded-2xl bg-black/10 p-4 ring-1 ring-white/10"><div className="flex items-end justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/60">Preparación del viaje</div><div className="mt-1 text-xl font-black">{porcentaje}%</div></div><div className="text-right text-[11px] text-white/65">Sin datos inventados</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{ width: `${porcentaje}%` }} /></div></div></div>

    {/* EL MAPA. Es la misma ruta de la que habla todo lo demas, y hasta ahora
        en esta pantalla solo existia como una tira de nombres de ciudad. Se
        reutiliza MapaRuta con las mismas paradas: ni una copia del dato. */}
    {paradas.length > 0 && (
      <div id="mapa" className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-800">
        <MapaRuta paradas={paradas} textoFallo={t("rutaMapaFallo")} lang={lang} t={t} />
      </div>
    )}

    <div className="rounded-2xl border border-marca-200 bg-marca-50 p-4 dark:border-marca-900 dark:bg-marca-900/20"><div className="flex items-start gap-3"><span className="mt-0.5 text-marca-700 dark:text-marca-300"><Icono nombre="compass" size={19} /></span><div className="min-w-0 flex-1"><h3 className="text-[14px] font-extrabold text-marca-900 dark:text-marca-100">{analizando ? "Anduve está analizando tu ruta…" : "Análisis de tu viaje"}</h3><p className="mt-1 text-[12.5px] leading-relaxed text-marca-800/75 dark:text-marca-200/75">Comparamos transporte, tiempo puerta a puerta y coste orientativo. Las fuentes se muestran para que sepas qué tan fiable es cada dato.</p></div><button type="button" onClick={analizar} disabled={analizando} className="shrink-0 rounded-full bg-marca-700 px-3.5 py-2 text-[11.5px] font-extrabold text-white disabled:opacity-60">{analizando ? "Analizando…" : "Actualizar"}</button></div>{errorAnalisis && <p className="mt-3 text-[11.5px] font-semibold text-red-600">{errorAnalisis}</p>}</div>

    {analisis && <><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Coste orientativo</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatoMoneda(totalVista, monedaVista)}</div><div className="mt-1 text-[11px] text-slate-500">Transporte + estancia + contingencia · {monedaVista}{tasaEnVivo ? " · cambio actualizado" : monedaVista !== "USD" ? " · cambio de respaldo" : ""}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Transporte</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{formatoMoneda(transporteVista, monedaVista)}</div><div className="mt-1 text-[11px] text-slate-500">Según datos disponibles para cada tramo</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Tiempo en ruta</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{horas.toFixed(1)} h</div><div className="mt-1 text-[11px] text-slate-500">Puerta a puerta entre ciudades · opción recomendada</div></div></div>
      <div id="transporte" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Transporte</div><h3 className="mt-1 text-[17px] font-extrabold text-slate-900 dark:text-white">Cómo moverte entre tus ciudades</h3></div>{analisis.regreso?.ahorro > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">Regreso incluido en el billete</span>}</div><div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">{(analisis.tramos || []).map((tr) => { const fuente = tr.fuenteRecomendada || tr.fuente; const medio = tr.medioRecomendado || tr.medio; const precio = tr.precioRecomendado ?? tr.precio; const horasTramo = tr.puertaAPuertaRecomendada_h ?? tr.puertaAPuerta_h; return <div key={tr.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{tr.desde} → {tr.hasta}</div><div className="mt-0.5 text-[11px] text-slate-500">{medio === "vuelo" ? "Avión" : medio || "Sin opción"} · {horasTramo != null ? `${horasTramo} h puerta a puerta` : "duración desconocida"} · recomendada</div>{tr.recomendacionExplicacion && <div className="mt-1 text-[11px] leading-relaxed text-slate-500">{tr.recomendacionExplicacion}</div>}</div><div className="sm:text-right"><div className="text-[14px] font-black text-slate-900 dark:text-white">{precio === 0 && fuente === "incluido" ? "Incluido" : precio != null ? formatoMoneda(precio, "USD") : "Sin precio"}</div><div className={`text-[10px] font-bold ${confianzaClase(fuente)}`}>{fuenteTexto(fuente)}{precio != null && monedaVista !== "USD" ? " · precio del tramo en USD" : ""}</div></div></div>; })}</div></div>
      <InteligenciaViaje ruta={ruta} analisis={analisis} decisiones={decisiones} />
      {analisis.optimizacion?.hayZigzag && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-900/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700">Oportunidad de optimización</div><h3 className="mt-1 text-[16px] font-extrabold text-amber-950 dark:text-amber-100">Anduve detectó una ruta potencialmente mejor</h3><p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-900/75 dark:text-amber-100/70">{analisis.optimizacion.mensaje || "Hay un orden alternativo que puede reducir desplazamientos."}</p></div><button type="button" onClick={onOptimizar} className="rounded-full bg-amber-800 px-4 py-2 text-[11.5px] font-extrabold text-white hover:bg-amber-900">Ver alternativa</button></div></div>}
    </>}

    <RequisitosDelViaje paises={paises} pasaporte={ruta?.pasaporte} t={t} lang={lang} />

    {/* LOS MODULOS. Cada uno lleva ahora a donde esa decision se toma de
        verdad, o dice claramente que todavia no existe. */}
    <div className="grid gap-3 sm:grid-cols-2">
      <Bloque icono="plane" titulo="Vuelos" href={urlEditor}
        subtitulo={tramosReales > 0 ? `${tramosReales} ${tramosReales === 1 ? "tramo" : "tramos"} con precio real consultado` : "Consulta precios reales por tramo"}
        estado={tramosReales > 0 ? "listo" : "pendiente"} />
      <Bloque icono="route" titulo="Transporte" href="#transporte"
        subtitulo="Compara avión, tren y bus en cada tramo"
        estado={analisis ? "listo" : "pendiente"} />
      <Bloque icono="calendar" titulo="Itinerario" href={urlEditor}
        subtitulo={tieneNoche ? `${noches} noches distribuidas en la ruta` : "Distribuye las noches por ciudad"}
        estado={tieneNoche ? "listo" : "pendiente"} />
      <Bloque icono="wallet" titulo="Presupuesto" href={urlEditor}
        subtitulo={analisis ? `Coste orientativo: ${formatoMoneda(totalVista, monedaVista)}` : presupuestoManual ? "Ya tienes decisiones de gasto guardadas" : "Todavía no hay presupuesto fijado"}
        estado={analisis || presupuestoManual ? "listo" : "pendiente"} />
      <Bloque icono="shield" titulo="Requisitos de entrada" href="#requisitos"
        subtitulo={paises.length > 1 ? `Visados y autorizaciones de ${paises.length} países` : "Visados y autorizaciones de tu destino"}
        estado={paises.length > 0 ? "listo" : "pendiente"} />
      <Bloque icono="bed" titulo="Alojamiento" estado="sin-modulo"
        subtitulo="Anduve todavía no reserva ni guarda alojamiento" />
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Ruta</div><h3 className="mt-1 text-[16px] font-extrabold text-slate-900 dark:text-slate-100">Así se mueve tu viaje</h3></div><a href={urlEditor} className="text-[12px] font-bold text-marca-700 hover:underline dark:text-marca-300">Cambiar</a></div><div className="mt-5 overflow-x-auto pb-1"><div className="flex min-w-max items-center gap-2">{paradas.map((p, i) => <div key={`${p.ciudad}-${i}`} className="flex items-center gap-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-600 dark:bg-slate-700"><div className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{p.ciudad}</div>{p.noches > 0 && <div className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-300">{p.noches} {p.noches === 1 ? "noche" : "noches"}</div>}</div>{i < paradas.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}</div>)}</div></div></div>
  </section>;
}
