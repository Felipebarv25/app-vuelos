"use client";

import { useEffect, useMemo, useState } from "react";

const iconoMedio = { tren: "🚆", vuelo: "✈️", bus: "🚌", ferry: "⛴️" };
function money(v) { return v == null ? "—" : `US$${Number(v).toLocaleString("en-US")}`; }
function fuente(f) { return f === "detectado" ? "Dato detectado" : f === "curado" ? "Referencia curada" : f === "estimado" ? "Estimación" : f === "vivo" ? "Precio consultado en vivo" : "Sin dato"; }
function horas(v) { return v == null ? "—" : `${(Number(v) / 60).toFixed(1)} h`; }

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
  const eliminaciones = decisiones?.eliminar || [];
  const mejor = decisiones?.mejorEliminacion;
  const alternativas = useMemo(() => (analisis?.tramos || []).map((t) => ({ ...t, opciones: t.alternativas || [] })), [analisis]);
  const [vuelosVivos, setVuelosVivos] = useState({});
  const [consultandoVuelos, setConsultandoVuelos] = useState(false);

  useEffect(() => {
    let activo = true;
    const paradas = ruta?.paradas || [];
    const fecha = String(ruta?.fechaIda || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || paradas.length < 2) { setVuelosVivos({}); return undefined; }
    const tramos = paradas.map((p, i) => ({ origen: p, destino: paradas[i + 1], indice: i })).filter((x) => x.destino && /^[A-Z]{3}$/.test(String(x.origen?.iata || "")) && /^[A-Z]{3}$/.test(String(x.destino?.iata || "")));
    if (!tramos.length) return undefined;
    setConsultandoVuelos(true);
    Promise.all(tramos.map(async ({ origen, destino, indice }) => {
      try {
        const qs = new URLSearchParams({ iata: String(destino.iata).toUpperCase(), origenes: String(origen.iata).toUpperCase(), fecha });
        const r = await fetch(`/api/vuelo-vivo?${qs.toString()}`, { cache: "no-store" });
        const d = await r.json();
        return d?.encontrado ? [indice, d] : [indice, null];
      } catch { return [indice, null]; }
    })).then((entries) => { if (!activo) return; setVuelosVivos(Object.fromEntries(entries)); setConsultandoVuelos(false); });
    return () => { activo = false; };
  }, [ruta]);

  const alternativasVivas = useMemo(() => alternativas.map((t, i) => {
    const vivo = vuelosVivos[i];
    if (!vivo || !Number.isFinite(Number(vivo.precio))) return t;
    const opcionesBase = t.opciones.map((o) => ({ ...o, recomendado: false }));
    const minutos = Number(vivo.duracion_ida);
    const puertaAPuerta_h = Number.isFinite(minutos) && minutos > 0 ? Number((minutos / 60 + 1.5).toFixed(1)) : null;
    const score = puntuarVueloVivo(Number(vivo.precio), Number.isFinite(minutos) ? minutos : 240, opcionesBase);
    const vuelo = { medio: "vuelo", precio: Number(vivo.precio), puertaAPuerta_h, score, fuente: "vivo", operador: vivo.aerolinea, recomendado: false, explicacion: "Precio real consultado para la fecha exacta. Incluye una penalización aproximada por aeropuerto para compararlo de forma puerta a puerta." };
    const todas = [...opcionesBase, vuelo].sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    const ganador = todas[0];
    const confianza = ganador.fuente === "vivo" ? "alta" : ganador.fuente;
    return { ...t, opciones: todas.map((o) => ({ ...o, recomendado: o === ganador })), recomendacionViva: ganador.fuente === "vivo" ? `Con el precio real consultado, el avión pasa a ser la mejor opción para este tramo.` : `El dato real del avión no supera la alternativa ${ganador.medio || "actual"}.`, confianzaViva: confianza };
  }), [alternativas, vuelosVivos]);

  if (!analisis && !decisiones) return null;

  return <section className="space-y-3">
    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 dark:border-violet-900/60 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0 flex-1"><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">Anduve Intelligence</div><h3 className="mt-1 text-[17px] font-black text-violet-950 dark:text-violet-100">No solo calculamos tu viaje. Lo cuestionamos.</h3><p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-violet-900/75 dark:text-violet-100/70">Comparamos alternativas y buscamos decisiones que puedan hacer tu ruta más barata, rápida o sencilla. Cuando tenemos un precio real para la fecha exacta, entra en la recomendación.</p></div></div>
      <div className="mt-4 space-y-3">{alternativasVivas.map((t, i) => <div key={t.id} className="rounded-2xl border border-white/80 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-[13px] font-extrabold text-slate-900 dark:text-white">{t.desde} → {t.hasta}</div><span className="text-[10px] font-bold text-slate-400">{t.km ? `${Math.round(t.km)} km` : "distancia no disponible"}</span></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{t.opciones.map((o, j) => <div key={`${o.medio}-${j}`} className={`rounded-xl border p-3 ${o.recomendado ? "border-violet-300 bg-violet-50/70 dark:border-violet-800 dark:bg-violet-950/20" : "border-slate-200 dark:border-slate-700"}`}><div className="flex items-center justify-between gap-2"><span className="font-extrabold text-slate-800 dark:text-slate-100">{iconoMedio[o.medio] || "🚐"} {o.medio === "vuelo" ? "Avión" : o.medio || "Sin opción"}</span>{o.recomendado && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">RECOMENDADO</span>}</div><div className="mt-2 text-[15px] font-black text-slate-900 dark:text-white">{money(o.precio)}</div><div className="text-[11px] text-slate-500">{o.puertaAPuerta_h != null ? `${o.puertaAPuerta_h} h puerta a puerta` : "Tiempo desconocido"} · {o.score != null ? `${o.score}/100` : "sin score"}</div><div className={`mt-1 text-[9.5px] font-bold ${o.fuente === "estimado" ? "text-amber-600" : "text-emerald-600"}`}>{fuente(o.fuente)}{o.operador ? ` · ${o.operador}` : ""}</div><p className="mt-2 text-[10.5px] leading-relaxed text-slate-500">{o.explicacion || o.nota}</p></div>)}</div>
        {t.recomendacionViva && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100">{t.recomendacionViva} <span className="font-normal opacity-70">Confianza: {t.confianzaViva}.</span></div>}
        {vuelosVivos[i] && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20"><div className="flex flex-wrap items-center justify-between gap-2"><div><div className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">✈️ Vuelo real consultado</div><div className="mt-1 text-[12px] font-extrabold text-emerald-950 dark:text-emerald-100">{vuelosVivos[i].aerolinea || "Aerolínea disponible"} · {vuelosVivos[i].fecha_ida}</div></div><div className="text-right"><div className="text-[16px] font-black text-emerald-900 dark:text-emerald-100">{money(vuelosVivos[i].precio)}</div><div className="text-[10px] text-emerald-700">{vuelosVivos[i].escalas_ida === 0 ? "Directo" : vuelosVivos[i].escalas_ida != null ? `${vuelosVivos[i].escalas_ida} escala(s)` : "Escalas no confirmadas"}{vuelosVivos[i].duracion_ida ? ` · ${horas(vuelosVivos[i].duracion_ida)}` : ""}</div></div></div>{vuelosVivos[i].link && <a href={vuelosVivos[i].link} target="_blank" rel="noreferrer" className="mt-2 inline-flex rounded-full bg-emerald-700 px-3 py-1.5 text-[10.5px] font-extrabold text-white hover:bg-emerald-800">Ver disponibilidad</a>}<p className="mt-2 text-[10px] leading-relaxed text-emerald-800/70">Precio real para la fecha exacta. Puede cambiar antes de comprar.</p></div>}
      </div>}
      {consultandoVuelos && <div className="rounded-xl border border-slate-200 bg-white p-3 text-[11px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-800">Consultando vuelos reales para las fechas de tu viaje…</div>}
      {Object.values(vuelosVivos).some(Boolean) && <p className="text-[10px] text-slate-400">Los vuelos reales ya participan en la recomendación del tramo; no se mezclan con datos estimados sin marcar su fuente.</p>}
      <div className="mt-5 border-t border-violet-200/70 pt-5 dark:border-violet-900/50">{mejor ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-amber-700">Mayor impacto potencial</div><h4 className="mt-1 text-[15px] font-black text-amber-950 dark:text-amber-100">¿Qué pasa si eliminas {mejor.ciudad}?</h4><p className="mt-1.5 text-[12px] text-amber-900/75 dark:text-amber-100/70">{mejor.razon}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">Impacto neto</div><div className={`text-[15px] font-black ${mejor.impactoNetoEstimado < 0 ? "text-red-600" : "text-slate-900"}`}>{mejor.impactoNetoEstimado < 0 ? "−" : ""}{money(Math.abs(mejor.impactoNetoEstimado))}</div></div><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">Cambio en transporte</div><div className="text-[15px] font-black">{mejor.ahorroTransporteEstimado >= 0 ? "−" : "+"}{money(Math.abs(mejor.ahorroTransporteEstimado))}</div></div><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">Noches de esa parada</div><div className="text-[15px] font-black">{mejor.nochesLiberadas}</div></div><div className="rounded-xl bg-white/80 p-3"><div className="text-[9px] font-bold text-slate-400">Confianza</div><div className="text-[15px] font-black capitalize">{mejor.confianza}</div></div></div><p className="mt-3 text-[10.5px] leading-relaxed text-amber-900/70 dark:text-amber-100/65">El impacto neto es orientativo: combina el cambio de transporte con el coste diario estimado de la parada. Las noches indicadas no significan necesariamente menos días de viaje.</p></div> : <div className="rounded-xl border border-slate-200 bg-white p-4 text-[12px] text-slate-500 dark:border-slate-700 dark:bg-slate-800">No hay una eliminación claramente beneficiosa con los datos disponibles.</div>}
        {eliminaciones.length > 1 && <div className="mt-3 space-y-2">{eliminaciones.slice(1, 4).map((d) => <div key={`${d.ciudad}-${d.indice}`} className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"><span className="text-[12px] font-extrabold">Quitar {d.ciudad}</span><span className={`text-[11px] font-bold ${d.impactoNetoEstimado < 0 ? "text-red-600" : "text-slate-500"}`}>{d.impactoNetoEstimado > 0 ? `~${money(d.impactoNetoEstimado)}` : d.impactoNetoEstimado < 0 ? `+${money(Math.abs(d.impactoNetoEstimado))}` : "sin impacto neto"} · {d.ahorroHoras >= 0 ? `−${d.ahorroHoras} h` : `+${Math.abs(d.ahorroHoras)} h`}</span></div>)}</div>}
        <p className="mt-3 text-[10.5px] text-slate-400">El coste diario incluye cama, comida, transporte local y ocio; no es un precio puro de alojamiento.</p>
      </div>
    </div>
  </section>;
}
