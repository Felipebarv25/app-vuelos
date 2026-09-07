"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Icono } from "@/components/Icono";
import Bandera from "@/components/Bandera";

function fmtMes(mes, lang = "es") {
  if (!/^\d{4}-\d{2}$/.test(String(mes || ""))) return "Fecha por definir";
  const d = new Date(`${mes}-01T00:00:00`);
  return d.toLocaleDateString(lang, { month: "long", year: "numeric" });
}
function nochesTotales(paradas = []) { return paradas.reduce((sum, p) => sum + Math.max(0, Number(p?.noches) || 0), 0); }
function ciudadesUnicas(paradas = []) {
  const out = [];
  for (const p of paradas) { const ciudad = String(p?.ciudad || "").trim(); if (ciudad && !out.some((x) => x.toLowerCase() === ciudad.toLowerCase())) out.push(ciudad); }
  return out;
}
function paisesUnicos(paradas = []) {
  const out = [];
  for (const p of paradas) { const cc = String(p?.pais || "").trim().toLowerCase(); if (/^[a-z]{2}$/.test(cc) && !out.includes(cc)) out.push(cc); }
  return out;
}
function progreso(ruta) {
  const p = ruta?.paradas || []; let total = 0; let hecho = 0;
  const checks = [[p.length >= 2,20],[Boolean(ruta?.mesInicio),15],[p.some((x)=>Number(x?.noches)>0),20],[p.every((x)=>x?.iata||(x?.lat!=null&&x?.lon!=null)),15],[Boolean(ruta?.presupuesto?.overrides&&Object.keys(ruta.presupuesto.overrides).length),15],[Boolean(ruta?.fechaIda),15]];
  for (const [ok,peso] of checks) { total += peso; if (ok) hecho += peso; }
  return Math.round(hecho / total * 100);
}
function fuenteTexto(fuente) { return fuente === "detectado" ? "Dato detectado" : fuente === "curado" ? "Referencia curada" : fuente === "estimado" ? "Estimación" : fuente === "incluido" ? "Incluido en el billete" : "Sin dato"; }
function confianzaClase(fuente) { return fuente === "detectado" ? "text-emerald-600" : fuente === "curado" ? "text-sky-600" : fuente === "estimado" ? "text-amber-600" : "text-slate-400"; }
function Bloque({ icono, titulo, subtitulo, estado = "pendiente", onClick }) {
  return <button type="button" onClick={onClick} className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-marca-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-marca-700 dark:bg-slate-700 dark:text-marca-300"><Icono nombre={icono} size={18} /></span>
    <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-extrabold text-slate-900 dark:text-slate-100">{titulo}</span><span className="mt-0.5 block text-[12px] text-slate-500 dark:text-slate-400">{subtitulo}</span></span>
    <span className={`shrink-0 text-[11px] font-bold ${estado === "listo" ? "text-emerald-600" : "text-slate-400"}`}>{estado === "listo" ? "Listo" : "Pendiente"}</span>
  </button>;
}

export default function MiViajeDashboard({ ruta, lang = "es", onEditarRuta, onOptimizar }) {
  const paradas = ruta?.paradas || [];
  const ciudades = useMemo(() => ciudadesUnicas(paradas), [paradas]);
  const paises = useMemo(() => paisesUnicos(paradas), [paradas]);
  const noches = useMemo(() => nochesTotales(paradas), [paradas]);
  const porcentaje = useMemo(() => progreso(ruta), [ruta]);
  const presupuestoManual = Object.keys(ruta?.presupuesto?.overrides || {}).length > 0;
  const tieneFecha = Boolean(ruta?.mesInicio);
  const tieneNoche = noches > 0;
  const [analisis, setAnalisis] = useState(null);
  const [analizando, setAnalizando] = useState(false);
  const [errorAnalisis, setErrorAnalisis] = useState("");

  const analizar = useCallback(async () => {
    if (!ruta || paradas.length < 2) return;
    setAnalizando(true); setErrorAnalisis("");
    try {
      const r = await fetch("/api/viaje-canonico", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ viaje: ruta, origen: "ruta" }) });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error(d?.motivo || "No se pudo analizar el viaje");
      setAnalisis(d);
    } catch (e) { setErrorAnalisis(e?.message || "No pudimos analizar el viaje."); }
    finally { setAnalizando(false); }
  }, [ruta, paradas.length]);

  useEffect(() => { analizar(); }, [analizar]);
  const horas = useMemo(() => (analisis?.tramos || []).reduce((s, t) => s + (Number(t.puertaAPuerta_h) || 0), 0), [analisis]);

  return <section className="mt-4 space-y-5" aria-label="Mi viaje">
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-marca-900 via-marca-700 to-emerald-600 p-5 text-white shadow-card sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-5"><div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">{paises.map((cc) => <Bandera key={cc} cc={cc} size={18} />)}<span className="ml-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/65">Mi viaje</span></div>
        <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{ruta?.nombre || `${ciudades[0] || "Nuevo viaje"} → ${ciudades[ciudades.length - 1] || "Destino"}`}</h2>
        <p className="mt-1.5 text-[13px] text-white/75">{fmtMes(ruta?.mesInicio, lang)} · {ciudades.length} {ciudades.length === 1 ? "ciudad" : "ciudades"} · {noches} {noches === 1 ? "noche" : "noches"}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-[12px] font-semibold text-white/90">{ciudades.map((ciudad, i) => <span key={`${ciudad}-${i}`} className="rounded-full bg-white/10 px-2.5 py-1 ring-1 ring-white/10">{ciudad}</span>)}</div>
      </div><button type="button" onClick={onEditarRuta} className="rounded-full bg-white px-4 py-2 text-[12.5px] font-extrabold text-marca-800 shadow-sm hover:bg-white/90">Editar ruta</button></div>
      <div className="mt-6 rounded-2xl bg-black/10 p-4 ring-1 ring-white/10"><div className="flex items-end justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/60">Preparación del viaje</div><div className="mt-1 text-xl font-black">{porcentaje}%</div></div><div className="text-right text-[11px] text-white/65">Sin datos inventados</div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white" style={{ width: `${porcentaje}%` }} /></div></div>
    </div>

    <div className="rounded-2xl border border-marca-200 bg-marca-50 p-4 dark:border-marca-900 dark:bg-marca-900/20"><div className="flex items-start gap-3"><span className="mt-0.5 text-marca-700 dark:text-marca-300"><Icono nombre="compass" size={19} /></span><div className="min-w-0 flex-1"><h3 className="text-[14px] font-extrabold text-marca-900 dark:text-marca-100">{analizando ? "Anduve está analizando tu ruta…" : "Análisis de tu viaje"}</h3><p className="mt-1 text-[12.5px] leading-relaxed text-marca-800/75 dark:text-marca-200/75">Comparamos transporte, tiempo puerta a puerta y coste orientativo. Las fuentes se muestran para que sepas qué tan fiable es cada dato.</p></div><button type="button" onClick={analizar} disabled={analizando} className="shrink-0 rounded-full bg-marca-700 px-3.5 py-2 text-[11.5px] font-extrabold text-white disabled:opacity-60">{analizando ? "Analizando…" : "Actualizar"}</button></div>{errorAnalisis && <p className="mt-3 text-[11.5px] font-semibold text-red-600">{errorAnalisis}</p>}</div>

    {analisis && <>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Coste orientativo</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">US${Number(analisis.presupuesto?.total || 0).toLocaleString("en-US")}</div><div className="mt-1 text-[11px] text-slate-500">Transporte + estancia + contingencia</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Transporte</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">US${Number(analisis.presupuesto?.transporte || 0).toLocaleString("en-US")}</div><div className="mt-1 text-[11px] text-slate-500">Según datos disponibles para cada tramo</div></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Tiempo en ruta</div><div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{horas.toFixed(1)} h</div><div className="mt-1 text-[11px] text-slate-500">Puerta a puerta entre ciudades</div></div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Transporte</div><h3 className="mt-1 text-[17px] font-extrabold text-slate-900 dark:text-white">Cómo moverte entre tus ciudades</h3></div>{analisis.regreso?.ahorro > 0 && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">Regreso incluido en el billete</span>}</div>
        <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">{(analisis.tramos || []).map((t) => <div key={t.id} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><div className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{t.desde} → {t.hasta}</div><div className="mt-0.5 text-[11px] text-slate-500">{t.medio === "vuelo" ? "Avión" : t.medio || "Sin opción"} · {t.puertaAPuerta_h != null ? `${t.puertaAPuerta_h} h puerta a puerta` : "duración desconocida"}</div></div><div className="sm:text-right"><div className="text-[14px] font-black text-slate-900 dark:text-white">{t.precio === 0 && t.fuente === "incluido" ? "Incluido" : t.precio != null ? `US$${Number(t.precio).toLocaleString("en-US")}` : "Sin precio"}</div><div className={`text-[10px] font-bold ${confianzaClase(t.fuente)}`}>{fuenteTexto(t.fuente)}</div></div></div>)}</div>
      </div>
      {analisis.optimizacion?.hayZigzag && <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-900/20"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-amber-700">Oportunidad de optimización</div><h3 className="mt-1 text-[16px] font-extrabold text-amber-950 dark:text-amber-100">Anduve detectó una ruta potencialmente mejor</h3><p className="mt-1.5 text-[12.5px] leading-relaxed text-amber-900/75 dark:text-amber-100/70">{analisis.optimizacion.mensaje || "Hay un orden alternativo que puede reducir desplazamientos."}</p></div><button type="button" onClick={onOptimizar} className="rounded-full bg-amber-800 px-4 py-2 text-[11.5px] font-extrabold text-white hover:bg-amber-900">Ver alternativa</button></div></div>}
    </>}

    <div className="grid gap-3 sm:grid-cols-2">
      <Bloque icono="plane" titulo="Vuelos" subtitulo="Añade o compara tus vuelos" />
      <Bloque icono="train" titulo="Transporte" subtitulo="Compara cada tramo de la ruta" estado={analisis ? "listo" : "pendiente"} />
      <Bloque icono="home" titulo="Alojamiento" subtitulo="Define dónde dormir y cuánto quieres gastar" />
      <Bloque icono="calendar" titulo="Itinerario" subtitulo={tieneNoche ? `${noches} noches distribuidas en la ruta` : "Distribuye las noches por ciudad"} estado={tieneNoche ? "listo" : "pendiente"} />
      <Bloque icono="dollar" titulo="Presupuesto" subtitulo={analisis ? `Coste orientativo: US$${Number(analisis.presupuesto?.total || 0).toLocaleString("en-US")}` : presupuestoManual ? "Ya tienes decisiones de gasto guardadas" : "Todavía no hay presupuesto fijado"} estado={analisis || presupuestoManual ? "listo" : "pendiente"} />
      <Bloque icono="clipboard" titulo="Requisitos y checklist" subtitulo={tieneFecha ? "Podemos preparar las tareas previas" : "Completa primero la fecha del viaje"} estado={tieneFecha ? "listo" : "pendiente"} />
    </div>

    <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800"><div className="flex items-center justify-between gap-3"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Ruta</div><h3 className="mt-1 text-[16px] font-extrabold text-slate-900 dark:text-slate-100">Así se mueve tu viaje</h3></div><button type="button" onClick={onEditarRuta} className="text-[12px] font-bold text-marca-700 hover:underline dark:text-marca-300">Cambiar</button></div><div className="mt-5 overflow-x-auto pb-1"><div className="flex min-w-max items-center gap-2">{paradas.map((p, i) => <div key={`${p.ciudad}-${i}`} className="flex items-center gap-2"><div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 dark:border-slate-600 dark:bg-slate-700"><div className="text-[13px] font-extrabold text-slate-800 dark:text-slate-100">{p.ciudad}</div>{p.noches > 0 && <div className="mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-300">{p.noches} {p.noches === 1 ? "noche" : "noches"}</div>}</div>{i < paradas.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}</div>)}</div></div></div>
  </section>;
}
