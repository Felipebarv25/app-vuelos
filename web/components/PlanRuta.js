"use client";
// Planificador de RUTAS MULTIPARADA.
//
// El planificador de presupuesto pregunta "¿cuánta plata tienes?" y propone
// ciudades. Este hace lo contrario: el viajero ya sabe sus ciudades y su orden,
// y aquí se le dice qué cuesta, cómo moverse y cuánto tiempo pierde en camino.
//
// TRANSVERSAL POR DISEÑO: nada aquí asume un país de origen ni una lista de
// ciudades. Las paradas salen del catálogo IATA completo (~7.000 aeropuertos),
// las coordenadas del catálogo curado o del geocodificador, y el costo diario
// de la ciudad, del país o de la región, en ese orden. Cada cifra dice de dónde
// viene para no vender una estimación como si fuera un precio de mercado.
import dynamic from "next/dynamic";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import SelectorAeropuerto from "./SelectorAeropuerto";
import Bandera from "./Bandera";
import DesglosePresupuesto from "./DesglosePresupuesto";
import IlustracionRuta from "./IlustracionRuta";
import { construirPresupuesto } from "@/lib/presupuestoConstruir";
import { lineasMigracion } from "@/lib/migracion";
import { cargarVisas, listaPaises } from "@/lib/requisitos";
import { obtenerTasas } from "@/lib/fx";
import { convertir, NIVELES, NIVEL_POR_DEFECTO } from "@/lib/presupuestoLineas";
import { nombrePaisMostrar } from "@/lib/paisesNombres";
import { Icono } from "./Icono";
import { obtenerOfertas } from "@/lib/ofertasDatos";
import {
  coordsCuradas,
  evaluarTramo,
  detectarZigzag,
  resumenRuta,
  ajustarIdaYVuelta,
  tramoSinVueloLargo,
  hubsSugeridos,
} from "@/lib/rutaViva";
import { fmtDuracion } from "@/lib/tramos";
import {
  linkTransporte,
  linkCarro,
  linkHoteles,
  linkCivitatis,
  linkVuelos,
  linkTren,
  linkBus,
} from "@/lib/afiliados";
import { track } from "@/lib/track";
import { leerLocales, escribirLocal, borrarLocal, nuevoUid } from "@/lib/rutasLocales";
import { ubicarPorIATA } from "@/lib/coordsAeropuerto";

// maplibre pesa y no todo el mundo abre un viaje: se carga solo cuando hay
// mapa que pintar.
const MapaRuta = dynamic(() => import("./MapaRuta"), { ssr: false });

// "2027-04-02" y "2027-04" entran igual y salen como "2027-04". El formato
// largo es el que guardaban las rutas antes de pasar a mes.
const conMayuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const aMes = (s) => (/^\d{4}-\d{2}/.test(s || "") ? String(s).slice(0, 7) : "");

// Donde entra una parada nueva.
//
// Se anadia siempre al final, y en un viaje que ya cierra en casa eso deja la
// ciudad nueva DESPUES del regreso: el itinerario terminaba Glasgow ->
// Medellin -> York, con un vuelo Medellin -> York de largo radio que nadie
// planeo. La ultima parada es el regreso: la nueva va justo antes.
function posicionParaNueva(paradas) {
  if (paradas.length < 2) return paradas.length;
  const primera = paradas[0];
  const ultima = paradas[paradas.length - 1];
  const cierra =
    (primera.iata && primera.iata === ultima.iata) || primera.ciudad === ultima.ciudad;
  return cierra ? paradas.length - 1 : paradas.length;
}

// Nacionalidades para el selector. PAISES_ISO guarda el ISO como "nombre"
// ("GB": {nombre: "GB"}), asi que el nombre legible sale de
// nombrePaisMostrar y la lista se ordena ya traducida.
function nacionalidades(lang) {
  return listaPaises()
    .map((x) => ({ cc: x.cc, nombre: nombrePaisMostrar(x.cc, lang) || x.cc }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

const sinAcentos = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const ICONO_MEDIO = { vuelo: "plane", tren: "route", bus: "route", ferry: "route", carro: "car" };

function Sello({ fuente, t }) {
  const mapa = {
    detectado: ["bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", t("rutaFuenteDetectado")],
    curado: ["bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300", t("rutaFuenteCurado")],
    estimado: ["bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", t("rutaFuenteEstimado")],
    "sin-datos": ["bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300", t("rutaFuenteSinDatos")],
    incluido: ["bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", t("rutaFuenteIncluido")],
  };
  const [clase, texto] = mapa[fuente] || mapa["sin-datos"];
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${clase}`}>{texto}</span>;
}

function Chip({ children, fuerte = false }) {
  return <span className={`rounded-full px-2.5 py-1 text-[12px] font-bold backdrop-blur ${fuerte ? "bg-white text-marca-800" : "bg-white/15 text-white"}`}>{children}</span>;
}

function Paso({ n, titulo, sub = null }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-50 text-[12px] font-extrabold tabular-nums text-marca-700 dark:bg-marca-900/40 dark:text-marca-300">{n}</span>
      <div className="min-w-0"><div className="text-[14.5px] font-extrabold text-slate-900 dark:text-slate-100">{titulo}</div>{sub && <div className="text-[12.5px] text-slate-500 dark:text-slate-400">{sub}</div>}</div>
    </div>
  );
}

export default function PlanRuta({ t = (k) => k, lang = "es", usuario = null, rutaInicial = null, alGuardar = null, onVolver = null }) {
  // Si se llega a un viaje guardado desde la lista, su pantalla canónica es
  // /mi-viaje?id=... . El editor se reserva para el flujo explícito
  // /mis-viajes?editar=... . Esta redirección evita tener dos "detalles" del
  // mismo viaje y hace que el botón Abrir sea coherente con el dashboard.
  useEffect(() => {
    if (!rutaInicial?.id || typeof window === "undefined") return;
    if (window.location.pathname !== "/mis-viajes") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("editar")) return;
    window.location.replace(`/mi-viaje?id=${encodeURIComponent(rutaInicial.id)}`);
  }, [rutaInicial?.id]);

  const [inicio, uid] = useMemo(() => {
    if (typeof window === "undefined") return [rutaInicial, nuevoUid()];
    if (!rutaInicial || rutaInicial.nueva) return [null, nuevoUid()];
    if (rutaInicial.uid) return [rutaInicial, rutaInicial.uid];
    const local = leerLocales().find((x) => x.id && x.id === rutaInicial.id);
    return [local || rutaInicial, local?.uid || nuevoUid()];
  }, []);
  const [paradas, setParadas] = useState(() => inicio?.paradas || []);
  const [viajeros, setViajeros] = useState(() => inicio?.viajeros || 1);
  const [nombre, setNombre] = useState(() => inicio?.nombre || "");
  const [mesInicio, setMesInicio] = useState(() => aMes(inicio?.mesInicio || inicio?.fechaInicio));
  const [recuperado, setRecuperado] = useState(() => Boolean(inicio && inicio !== rutaInicial && inicio?.paradas?.length));
  const [ofertas, setOfertas] = useState(null);
  const [vivos, setVivos] = useState(() => inicio?.vivos || {});
  const [buscando, setBuscando] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [idRuta, setIdRuta] = useState(inicio?.id || null);
  const [aviso, setAviso] = useState(null);
  const [pasaporte, setPasaporte] = useState(() => inicio?.pasaporte || "CO");
  const [monedaVista, setMonedaVista] = useState(() => inicio?.monedaVista || "COP");
  const [nivel, setNivel] = useState(() => inicio?.nivel || NIVEL_POR_DEFECTO);
  const [fechaIda, setFechaIda] = useState(() => inicio?.fechaIda || "");
  const sumaDias = useCallback((iso, n) => { const d = new Date(iso + "T00:00:00"); if (Number.isNaN(d.getTime())) return iso; d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }, []);
  const fmtMes = useCallback((m) => { const d = new Date(m + "-01T00:00:00"); return Number.isNaN(d.getTime()) ? m : d.toLocaleDateString(lang, { month: "long", year: "numeric" }); }, [lang]);
  const fmtDia = useCallback((iso) => { if (!iso) return ""; const d = new Date(iso + "T00:00:00"); return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" }); }, [lang]);
  const [visas, setVisas] = useState(null);
  const [tasas, setTasas] = useState(null);
  const [overrides, setOverrides] = useState(() => inicio?.presupuesto?.overrides || {});
  const [ajustes, setAjustes] = useState(() => inicio?.presupuesto?.ajustes || { contingenciaPct: 0.1, margenCambiarioPct: 0.03 });
  const [nSelector, setNSelector] = useState(0);
  const [paradaActiva, setParadaActiva] = useState(null);

  useEffect(() => {
    let vivo = true;
    const faltan = paradas.some((p) => (p?.lat === null || p?.lat === undefined) && /^[A-Za-z]{3}$/.test(p?.iata || ""));
    if (!faltan) return;
    ubicarPorIATA(paradas).then((res) => { if (!vivo) return; const cambio = res.some((p, i) => p.lat !== paradas[i]?.lat); if (cambio) setParadas(res); });
    return () => { vivo = false; };
  }, [paradas]);
  useEffect(() => { obtenerOfertas().then(setOfertas); }, []);
  useEffect(() => { if (paradas.length > 0 && !visas) cargarVisas().then(setVisas); }, [paradas.length, visas]);
  useEffect(() => { obtenerTasas().then(setTasas); }, []);
  useEffect(() => {
    if (!paradas.length && !nombre && !mesInicio) { borrarLocal(uid); return; }
    escribirLocal({ uid, id: idRuta, paradas, viajeros, nombre, mesInicio, vivos, pasaporte, monedaVista, nivel, fechaIda, presupuesto: { overrides, ajustes } });
  }, [uid, paradas, viajeros, nombre, mesInicio, idRuta, vivos, overrides, ajustes, pasaporte, monedaVista, nivel, fechaIda]);

  function nuevoViaje() { setParadas([]); setViajeros(1); setNombre(""); setMesInicio(""); setOverrides({}); setIdRuta(null); setVivos({}); setRecuperado(false); borrarLocal(uid); }
  const fmtUsd = (v) => "US$ " + Math.round(v || 0).toLocaleString("en-US");

  const agregar = useCallback(async (a) => {
    if (!a?.ciudad) return;
    const base = { ciudad: a.ciudad, pais: a.pais, paisNombre: a.paisNombre || a.pais, iata: a.iata, noches: 2, lat: null, lon: null };
    if (Number.isFinite(a.lat) && Number.isFinite(a.lon)) { base.lat = a.lat; base.lon = a.lon; setParadas((prev) => [...prev.slice(0, posicionParaNueva(prev)), base, ...prev.slice(posicionParaNueva(prev))]); setNSelector((n) => n + 1); track("ruta_parada_agregada", { ciudad: a.ciudad, iata: a.iata || "sin-aeropuerto" }); return; }
    const cur = coordsCuradas(a.ciudad, a.paisNombre || a.pais); if (cur) Object.assign(base, cur);
    setParadas((prev) => [...prev.slice(0, posicionParaNueva(prev)), base, ...prev.slice(posicionParaNueva(prev))]);
    if (!cur) { try { const r = await fetch(`/api/geocodificar?ciudad=${encodeURIComponent(a.ciudad)}&iso=${encodeURIComponent(a.pais || "")}`); const d = r.ok ? await r.json() : null; if (d?.encontrado) setParadas((prev) => prev.map((p) => p.ciudad === base.ciudad && p.iata === base.iata && p.lat == null ? { ...p, lat: d.lat, lon: d.lon } : p)); } catch {} }
    setNSelector((n) => n + 1); track("ruta_parada_agregada", { ciudad: a.ciudad, iata: a.iata });
  }, []);
  const quitar = (i) => setParadas((p) => p.filter((_, k) => k !== i));
  const mover = (i, delta) => setParadas((p) => { const j = i + delta; if (j < 0 || j >= p.length) return p; const c = [...p]; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const cambiarNoches = (i, n) => setParadas((p) => p.map((x, k) => (k === i ? { ...x, noches: Math.max(0, Number(n) || 0) } : x)));

  const vueloDetectado = useCallback((desde, hasta) => { const rutas = ofertas?.rutas || []; const c = sinAcentos(hasta.ciudad); const hit = rutas.find((r) => r.origen === desde.iata && (r.destino === hasta.iata || sinAcentos(r.ciudad) === c)); if (!hit) return null; const durH = hit.duracion_ida != null ? Number(hit.duracion_ida) / 60 : null; return { precio: hit.precio, duracion_h: durH, aerolinea: hit.aerolinea }; }, [ofertas]);
  const paradasCalc = useDeferredValue(paradas);
  const recalculando = paradasCalc !== paradas;
  const tramosCrudos = useMemo(() => { const out = []; for (let i = 0; i < paradasCalc.length - 1; i++) { const desde = paradasCalc[i]; const hasta = paradasCalc[i + 1]; const clave = `${desde.iata}-${hasta.iata}-${i}`; const real = vivos[clave] || vueloDetectado(desde, hasta); out.push({ ...evaluarTramo({ desde, hasta, vueloReal: real }), desde, hasta, clave }); } return out; }, [paradasCalc, vivos, vueloDetectado]);
  const { tramos, regresoIncluido, aviso: avisoIdaVuelta } = useMemo(() => ajustarIdaYVuelta(tramosCrudos), [tramosCrudos]);
  const resumen = useMemo(() => resumenRuta({ paradas: paradasCalc, tramos, viajeros }), [paradasCalc, tramos, viajeros]);
  const porUsd = tasas?.porUsd || {};
  const extrasMigracion = useMemo(() => (visas ? lineasMigracion({ paradas: paradasCalc, pasaporte, viajeros, visas }) : []), [visas, paradasCalc, pasaporte, viajeros]);
  const presupuesto = useMemo(() => construirPresupuesto({ paradas: paradasCalc, tramos, viajeros, overrides, ajustes, extras: extrasMigracion, porUsd, nivel }), [paradasCalc, tramos, viajeros, overrides, ajustes, extrasMigracion, porUsd, nivel]);
  const fmtVista = useCallback((usd) => { const v = convertir(usd, "USD", monedaVista, porUsd); const dec = monedaVista === "COP" || monedaVista === "CLP" ? 0 : 0; return `${monedaVista === "USD" ? "US$" : ""}${Math.round(v).toLocaleString("es-CO", { maximumFractionDigits: dec })}${monedaVista === "USD" ? "" : " " + monedaVista}`; }, [monedaVista, porUsd]);
  const totalDeCategorias = useCallback((cats) => (presupuesto.porCategoria || []).filter((c) => cats.includes(c.categoria)).reduce((s, c) => s + c.total, 0), [presupuesto]);
  const mejorFecha = useMemo(() => { if (!mesInicio) return null; for (const t of tramos) { const meses = vivos[t.clave]?.porMes; if (!meses?.length) continue; const tuyo = meses.find((m) => m.mes === mesInicio); const barato = meses.reduce((a, b) => (b.precio < a.precio ? b : a), meses[0]); if (!barato?.mes || barato.mes === mesInicio) continue; const ahorro = (tuyo?.precio || t.precio || 0) - barato.precio; if (ahorro >= 40) return { ...barato, ahorro, tramo: `${t.desde?.ciudad} → ${t.hasta?.ciudad}` }; } return null; }, [tramos, vivos, mesInicio]);
  const fijarLinea = useCallback((id, monto) => { setOverrides((prev) => { const sig = { ...prev }; if (monto == null || !Number.isFinite(Number(monto))) delete sig[id]; else sig[id] = Math.max(0, Math.round(Number(monto))); return sig; }); track("presupuesto_linea_fijada", { id }); }, []);
  const zigzag = useMemo(() => detectarZigzag(paradasCalc), [paradasCalc]);
  const dias = useMemo(() => { if (!paradas.length) return null; const porParada = []; let acum = 0; paradas.forEach((p, i) => { const desde = acum + 1; if (i > 0) acum += Math.max(0, Number(p.noches) || 0); porParada.push({ desde, hasta: acum + 1 }); }); return { porParada, noches: acum, total: acum + 1 }; }, [paradas]);
  const paisesRuta = useMemo(() => { const vistos = []; for (const p of paradas) { const cc = String(p.pais || "").trim().toLowerCase(); if (/^[a-z]{2}$/.test(cc) && !vistos.includes(cc)) vistos.push(cc); } return vistos; }, [paradas]);
  const recorrido = useMemo(() => { if (paradas.length < 2) return ""; const nombres = []; for (const p of paradas) { const nom = p.paisNombre || nombrePaisMostrar(p.pais, lang) || p.ciudad; if (nombres[nombres.length - 1] !== nom) nombres.push(nom); } return nombres.length > 4 ? [nombres[0], "…", nombres[nombres.length - 1]].join(" → ") : nombres.join(" → "); }, [paradas, lang]);
  const tramosReales = useMemo(() => tramos.filter((t) => t.fuente === "detectado").length, [tramos]);
  const porDia = presupuesto.dias > 0 ? Math.round(presupuesto.total / presupuesto.dias) : 0;
  const [mesLlano, mesLabel] = useMemo(() => { if (!mesInicio) return ["", ""]; const d = new Date(mesInicio + "-01T00:00:00"); if (Number.isNaN(d.getTime())) return ["", ""]; const llano = d.toLocaleDateString(lang, { month: "long", year: "numeric" }); return [llano, conMayuscula(llano)]; }, [mesInicio, lang]);
  const proximosMeses = useMemo(() => { const base = new Date(); const out = []; for (let i = 0; i < 24; i++) { const m = new Date(base.getFullYear(), base.getMonth() + i, 1); out.push({ clave: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`, etiqueta: conMayuscula(m.toLocaleDateString(lang, { month: "long", year: "numeric" })) }); } return out; }, [lang]);

  async function buscarReal(tr) {
    if (!tr.desde.iata || !tr.hasta.iata) return;
    setBuscando((b) => ({ ...b, [tr.clave]: true }));
    try {
      const r = await fetch(`/api/vuelo-vivo?iata=${tr.hasta.iata}&origenes=${tr.desde.iata}` + (fechaIda ? `&fecha=${fechaIda}` : ""));
      const d = r.ok ? await r.json() : null;
      if (d?.encontrado) {
        setVivos((v) => ({ ...v, [tr.clave]: { precio: d.precio, duracion_h: d.duracion_ida ? d.duracion_ida / 60 : null, aerolinea: d.aerolinea, porMes: Array.isArray(d.porMes) ? d.porMes : [], esDeTuFecha: !!d.esDeTuFecha } }));
      } else {
        setAviso(fechaIda ? t("rutaSinVueloEseDia").replace("{ruta}", `${tr.desde.ciudad} → ${tr.hasta.ciudad}`).replace("{fecha}", fmtDia(fechaIda)) : t("rutaSinVueloReal").replace("{ruta}", `${tr.desde.ciudad} → ${tr.hasta.ciudad}`));
      }
    } catch { setAviso(t("rutaErrorRed")); }
    setBuscando((b) => ({ ...b, [tr.clave]: false }));
  }

  async function guardar() {
    if (paradas.length < 2) return;
    setGuardando(true);
    try {
      const h = { "Content-Type": "application/json" };
      try { const tk = localStorage.getItem("anduve_auth_token") || sessionStorage.getItem("anduve_auth_token"); if (tk) h.Authorization = `Bearer ${tk}`; } catch {}
      const r = await fetch("/api/rutas", { method: "POST", headers: h, body: JSON.stringify({ id: idRuta, paradas, viajeros, nombre, mesInicio, pasaporte, monedaVista, nivel, fechaIda, presupuesto: { overrides, ajustes } }) });
      const d = await r.json();
      if (d?.ok) { setIdRuta(d.ruta.id); setAviso(t("rutaGuardada")); track("ruta_guardada", { paradas: paradas.length }); alGuardar?.(d.ruta); }
      else setAviso(d?.motivo === "no-auth" ? t("rutaEntraParaGuardar") : t("rutaErrorGuardar"));
    } catch { setAviso(t("rutaErrorGuardar")); }
    setGuardando(false);
  }
  const enlaceCompartir = idRuta ? `${typeof window !== "undefined" ? window.location.origin : ""}/ruta?id=${idRuta}` : null;
  const tituloViaje = nombre.trim() || (paradas.length >= 2 ? `${paradas[0].ciudad} → ${paradas[paradas.length - 1].ciudad}` : paradas.length === 1 ? paradas[0].ciudad : t("rutaSinNombre"));

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
      <div className="relative overflow-hidden bg-gradient-to-br from-marca-800 via-marca-600 to-emerald-500 px-5 py-6 text-white sm:px-7">
        <IlustracionRuta className="hidden sm:block" />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">{t("rutaIdentidadEyebrow")}</div>
          {onVolver ? null : (paradas.length > 0 && <button type="button" onClick={() => { if (idRuta || window.confirm(t("rutaNuevoConfirmar"))) nuevoViaje(); }} className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-bold text-white transition hover:bg-white/20">+ {t("rutaNuevo")}</button>)}
        </div>
        <div className="relative z-10 mt-2 flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 sm:max-w-[64%]"><h3 className={`text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px] ${nombre.trim() ? "" : "text-white/70"}`}>{tituloViaje}</h3>{paisesRuta.length > 0 && <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5">{paisesRuta.map((cc) => <Bandera key={cc} cc={cc} size={20} />)}</span>}</div>
        {recorrido && <p className="relative z-10 mt-1.5 max-w-full text-[13px] font-medium leading-relaxed text-white/80 sm:max-w-[64%]">{recorrido}{presupuesto.dias > 0 && <> {" · "}{t("rutaBannerDuracion").replace("{dias}", presupuesto.dias).replace("{noches}", presupuesto.noches)}</>}{paradas.length > 0 && ` · ${t("rutasNParadas").replace("{n}", paradas.length)}`}</p>}
        {paradas.length >= 2 && <div className="relative z-10 mt-4 flex max-w-full flex-wrap items-end gap-x-5 gap-y-2 sm:max-w-[64%]"><div><div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">{t("rutaBannerPresupuesto")}</div><div className="text-[30px] font-bold leading-none tabular-nums">{fmtVista(presupuesto.total)}</div></div><div className="pb-0.5 text-[12.5px] font-medium text-white/80">{t("rutaBannerPorDia").replace("{porDia}", fmtVista(porDia)).replace("{viajeros}", (viajeros === 1 ? t("rutaChipViajero") : t("rutaChipViajeros")).replace("{n}", viajeros))}</div></div>}
        <div className="relative z-10 mt-3.5 flex flex-wrap items-center gap-1.5">{zigzag.hayZigzag && zigzag.ahorroPct > 0 && <span className="rounded-full bg-acento-500 px-2.5 py-1 text-[12px] font-bold text-white shadow-sm">{t("rutaBannerRodeo").replace("{pct}", zigzag.ahorroPct)}</span>}<Chip>{mesLabel || t("rutasSinFecha")}</Chip>{tramosReales > 0 && <Chip>{t("rutaBannerReales").replace("{n}", tramosReales)}</Chip>}</div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6">
        <section><Paso n={1} titulo={t("rutaPaso1")} /><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="block"><span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">{t("rutaNombre")}</span><input type="text" value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder={paradas.length >= 2 ? `${paradas[0].ciudad} → ${paradas[paradas.length - 1].ciudad}` : t("rutaNombrePlaceholder")} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /></label><label className="block"><span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">{t("rutaMesSalida")}</span><select value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"><option value="">{t("rutaMesSinDefinir")}</option>{mesInicio && !proximosMeses.some((m) => m.clave === mesInicio) && <option value={mesInicio}>{mesLabel || mesInicio}</option>}{proximosMeses.map((m) => <option key={m.clave} value={m.clave}>{m.etiqueta}</option>)}</select></label></div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="block"><span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">{t("rutaPasaporte")}</span><select value={pasaporte} onChange={(e) => setPasaporte(e.target.value)} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{nacionalidades(lang).map((x) => <option key={x.cc} value={x.cc}>{x.nombre}</option>)}</select><span className="mt-1 block text-[11.5px] text-slate-400">{t("rutaPasaporteAyuda")}</span></label><label className="block"><span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">{t("rutaMonedaVista")}</span><select value={monedaVista} onChange={(e) => setMonedaVista(e.target.value)} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100">{["COP", "USD", "EUR", "GBP", "MXN", "PEN", "CLP", "ARS", "BRL"].map((m) => <option key={m} value={m}>{m}</option>)}</select></label></div>
          {mesInicio && <div className="mt-3"><label className="block sm:max-w-xs"><span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">{t("rutaFechaExacta")}</span><input type="date" value={fechaIda} min={`${mesInicio}-01`} max={`${mesInicio}-31`} onChange={(e) => setFechaIda(e.target.value)} className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" /></label><p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">{fechaIda ? t("rutaFechaExactaPuesta") : t("rutaFechaExactaAyuda")}</p>{fechaIda && <button type="button" onClick={() => setFechaIda("")} className="mt-1 text-[11.5px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:text-slate-400">{t("rutaFechaQuitar")}</button>}</div>}
          {mejorFecha && <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20"><div className="text-[13px] font-bold text-emerald-900 dark:text-emerald-200">{t("rutaMejorFechaTit").replace("{mes}", fmtMes(mejorFecha.mes)).replace("{ahorro}", fmtVista(mejorFecha.ahorro))}</div><p className="mt-0.5 text-[12px] leading-relaxed text-emerald-800 dark:text-emerald-300">{t("rutaMejorFechaSub").replace("{tramo}", mejorFecha.tramo)}</p><button type="button" onClick={() => { setMesInicio(mejorFecha.mes); setFechaIda(""); track("ruta_mes_barato", { mes: mejorFecha.mes }); }} className="mt-2 rounded-full bg-emerald-700 px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-emerald-800">{t("rutaMejorFechaUsar")}</button></div>}
          <div className="mt-4"><span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">{t("rutaNivelLabel")}</span><div className="grid gap-2 sm:grid-cols-3">{["mochilero", "medio", "comodo"].map((k) => { const activo = nivel === k; return <button key={k} type="button" onClick={() => { setNivel(k); track("ruta_nivel", { nivel: k }); }} aria-pressed={activo} className={`rounded-xl border-2 p-2.5 text-left transition ${activo ? "border-marca-500 bg-marca-50 dark:border-marca-500 dark:bg-marca-900/30" : "border-slate-200 bg-white hover:border-marca-300 dark:border-slate-700 dark:bg-slate-800"}`}><span className={`block text-[13.5px] font-extrabold ${activo ? "text-marca-800 dark:text-marca-200" : "text-slate-700 dark:text-slate-200"}`}>{t("nivel_" + k)}</span><span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">{t("nivelSub_" + k)}</span></button>; })}</div></div>
          {(mesLabel || dias) && <p className="mt-2 text-[12.5px] text-slate-500 dark:text-slate-400">{(mesLabel ? t("rutaMesResumen") : t("rutaMesResumenSinMes")).replace("{mes}", mesLlano).replace("{n}", dias ? dias.noches : 0).replace("{d}", dias ? dias.total : 0)}</p>}
        </section>
        {recuperado && <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200"><span>{t("rutaBorradorRecuperado")}</span><button type="button" onClick={() => setRecuperado(false)} className="ml-auto font-bold text-emerald-700 hover:underline dark:text-emerald-300">{t("rutaEntendido")}</button></div>}
        <section className="border-t border-slate-100 pt-5 dark:border-slate-700"><Paso n={2} titulo={t("rutaPaso2")} sub={paradas.length === 0 ? t("rutaAgregarPrimera") : t("rutaAgregarSiguiente")} /><div className="mt-3 max-w-md"><SelectorAeropuerto key={nSelector} filtroPais={false} incluirSinAeropuerto value="" onChange={agregar} placeholder={t("rutaBuscarCiudad")} ariaLabel={t("rutaBuscarCiudad")} lang={lang} t={t} /></div></section>
        {paradas.length > 0 && <>
          <div className="flex flex-wrap items-center gap-3"><label className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">{t("rutaViajeros")}</label><div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-700">{[1, 2, 3, 4].map((n) => <button key={n} onClick={() => setViajeros(n)} className={`h-8 w-8 rounded-full text-[13px] font-bold transition ${viajeros === n ? "bg-white text-marca-700 shadow dark:bg-slate-600 dark:text-marca-300" : "text-slate-500 dark:text-slate-400"}`}>{n}</button>)}</div></div>
          {zigzag.hayZigzag && (() => { const soloFusion = zigzag.fusionoRepetidas && !(zigzag.ahorroPct > 0); return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20"><div className="text-[13.5px] font-bold text-amber-900 dark:text-amber-200">{zigzag.arreglaImposibles > 0 ? t("rutaZigzagImposibleTitulo") : soloFusion ? t("rutaZigzagSoloFusionTitulo") : t("rutaZigzagTitulo").replace("{pct}", zigzag.ahorroPct)}</div><p className="mt-1 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">{zigzag.arreglaImposibles > 0 ? t("rutaZigzagImposibleAyuda") : soloFusion ? t("rutaZigzagSoloFusionAyuda") : t("rutaZigzagAyuda").replace("{actual}", zigzag.kmActual.toLocaleString("es-CO")).replace("{optimo}", zigzag.kmOptimo.toLocaleString("es-CO"))}{!soloFusion && zigzag.fusionoRepetidas && " " + t("rutaZigzagFusion")}</p><div className="mt-2 text-[12.5px] font-semibold text-amber-900 dark:text-amber-200">{zigzag.ordenSugerido.join("  →  ")}</div>{zigzag.paradasSugeridas?.length >= 2 && <button type="button" onClick={() => { setParadas(zigzag.paradasSugeridas); track("ruta_reordenada", { ahorroPct: zigzag.ahorroPct, fusiono: !!zigzag.fusionoRepetidas }); }} className="mt-3 rounded-full bg-amber-800 px-4 py-1.5 text-[12px] font-bold text-white transition hover:bg-amber-900">{t("rutaZigzagAplicar")}</button>}</div>; })()}
          <MapaRuta paradas={paradas} textoFallo={t("rutaMapaFallo")} seleccionada={paradaActiva} onSeleccionar={setParadaActiva} lang={lang} t={t} />
          <ol className="grid gap-0">{paradas.map((p, i) => { const tr = tramos[i]; const esUltima = i === paradas.length - 1; return <li key={`${p.iata}-${i}`}><div onClick={() => setParadaActiva(i + 1)} className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-white p-3.5 transition dark:bg-slate-800 ${paradaActiva === i + 1 ? "border-marca-500 ring-2 ring-marca-200 dark:ring-marca-800" : "border-slate-200 hover:border-marca-300 dark:border-slate-700"}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-[12px] font-bold tabular-nums text-marca-700 dark:bg-marca-900/40 dark:text-marca-300">{i + 1}</span><div className="min-w-0 flex-1 basis-full sm:basis-0"><div className="flex items-center gap-1.5 truncate text-[15px] font-bold text-slate-900 dark:text-slate-100"><span className="truncate">{p.ciudad}</span><Bandera cc={p.pais} size={16} className="shrink-0" />{p.iata && <span className="shrink-0 text-[12.5px] font-normal text-slate-400">{p.iata}</span>}</div>{dias && <div className="text-[11.5px] font-semibold text-marca-700 dark:text-marca-300">{fechaIda ? i === 0 ? t("rutaSalesEl").replace("{fecha}", fmtDia(sumaDias(fechaIda, 0))) : t("rutaEstasDel").replace("{desde}", fmtDia(sumaDias(fechaIda, dias.porParada[i].desde - 1))).replace("{hasta}", fmtDia(sumaDias(fechaIda, dias.porParada[i].hasta - 1))) : i === 0 ? t("rutaDiaSalida") : t("rutaDiasParada").replace("{desde}", dias.porParada[i].desde).replace("{hasta}", dias.porParada[i].hasta)}</div>}{p.lat == null && <div className="text-[11.5px] text-amber-700 dark:text-amber-400">{t("rutaSinCoordenadas")}</div>}</div>{i > 0 && <label className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 dark:text-slate-400"><input type="number" min="0" max="365" value={p.noches} onChange={(e) => cambiarNoches(i, e.target.value)} className="w-14 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-[13px] tabular-nums dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100" />{t("rutaNoches")}</label>}<div className="flex items-center gap-1"><button onClick={() => mover(i, -1)} disabled={i === 0} aria-label={t("rutaSubir")} title={t("rutaSubir")} className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700">↑</button><button onClick={() => mover(i, 1)} disabled={esUltima} aria-label={t("rutaBajar")} title={t("rutaBajar")} className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700">↓</button><button onClick={() => quitar(i)} aria-label={t("rutaQuitar")} title={t("rutaQuitar")} className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">×</button></div>{i > 0 && <div className="flex w-full flex-wrap gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-700"><a href={linkHoteles({ ciudad: p.ciudad, pais: p.paisNombre || nombrePaisMostrar(p.pais, lang), lat: p.lat, lon: p.lon })} target="_blank" rel="sponsored noopener" className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">{t("rutaDormir")}</a><a href={linkCivitatis({ ciudad: p.ciudad })} target="_blank" rel="sponsored noopener" className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">{t("rutaHacer")}</a><a href={linkCarro({ ciudad: p.ciudad, pais: p.paisNombre })} target="_blank" rel="sponsored noopener" className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">{t("rutaCarro")}</a></div>}</div>{!esUltima && tr && tr.fuente !== "misma-ciudad" && <div className="ml-3.5 border-l-2 border-dashed border-slate-200 py-2 pl-5 dark:border-slate-700"><div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]"><span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200"><Icono nombre={ICONO_MEDIO[tr.medio] || "arrowRight"} size={15} />{tr.medio ? t("rutaMedio_" + tr.medio) : "—"}{tr.operador && <span className="font-normal text-slate-400">· {tr.operador}</span>}</span>{tr.fuente === "incluido" ? <span className="inline-flex items-baseline gap-1.5"><span className="font-bold text-emerald-700 dark:text-emerald-300">{t("rutaIncluido")}</span>{tr.precioSuelto > 0 && <span className="text-[12px] tabular-nums text-slate-400 line-through">{fmtVista(tr.precioSuelto)}</span>}</span> : <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{tr.precio != null ? fmtVista(tr.precio) : "—"}</span>}{tr.puertaAPuerta_h != null && <span className="text-slate-500 dark:text-slate-400">{fmtDuracion(tr.puertaAPuerta_h)} {t("rutaPuertaAPuerta")}</span>}{tr.km != null && <span className="tabular-nums text-slate-400">{tr.km.toLocaleString("es-CO")} km</span>}<Sello fuente={tr.fuente} t={t} /></div><div className="mt-1.5 flex flex-wrap gap-1.5">{tr.fuente !== "incluido" && <a href={tr.medio === "vuelo" ? linkVuelos({ ciudad: tr.hasta.ciudad, pais: tr.hasta.paisNombre || nombrePaisMostrar(tr.hasta.pais, lang) }) : tr.medio === "tren" ? linkTren({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad }) : tr.medio === "bus" ? linkBus({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad }) : linkTransporte({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad })} target="_blank" rel="sponsored noopener" onClick={() => track("reserva_tramo", { medio: tr.medio })} className="rounded-lg bg-marca-700 px-2.5 py-1 text-[12px] font-bold text-white transition hover:bg-marca-800">{t("rutaReservar")}</a>}{<a href={linkTransporte({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad })} target="_blank" rel="sponsored noopener" className="rounded-lg bg-marca-50 px-2.5 py-1 text-[12px] font-bold text-marca-700 transition hover:bg-marca-100 dark:bg-marca-900/30 dark:text-marca-300">{t("rutaVerOpciones")}</a>}{tr.fuente !== "incluido" && tr.desde.iata && tr.hasta.iata && <button onClick={() => buscarReal(tr)} disabled={buscando[tr.clave]} className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">{buscando[tr.clave] ? t("rutaBuscandoReal") : tr.fuente === "detectado" ? t("rutaVerMeses") : t("rutaBuscarReal")}</button>}</div>{(() => { const falla = tramoSinVueloLargo(tr.desde, tr.hasta, tr.km); if (!falla) return null; const problema = falla.salida ? tr.desde : tr.hasta; const hubs = hubsSugeridos(problema, paradas); return <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20"><div className="text-[12.5px] font-bold text-amber-900 dark:text-amber-200">{t(falla.salida ? "rutaSinVueloSalida" : "rutaSinVueloLlegada").replace("{desde}", tr.desde.ciudad).replace("{hasta}", tr.hasta.ciudad)}</div><p className="mt-1 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">{t("rutaSinVueloAyuda")}</p>{hubs.length > 0 && <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="text-[11.5px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">{t("rutaSinVueloEscala")}</span>{hubs.map((h) => <button key={h.iata} type="button" onClick={() => insertarEscala(i + 1, h)} className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-bold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200">+ {h.etiqueta}</button>)}</div>}</div>; })()}</div>}</li>; })}</ol>
          {paradas.length >= 2 && <section className="border-t border-slate-100 pt-5 dark:border-slate-700"><Paso n={3} titulo={t("rutaPaso3")} sub={t("rutaResumen")} /><div className="mt-3 grid gap-3 sm:grid-cols-3"><div><div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaTransporte")}</div><div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{fmtVista(totalDeCategorias(["transporte_internacional", "transporte_entre_ciudades"]))}</div></div><div><div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaEstadia").replace("{noches}", presupuesto.noches)}</div><div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{fmtVista(totalDeCategorias(["hospedaje", "alimentacion", "transporte_local", "actividades"]))}</div></div><div><div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaEnMovimiento")}</div><div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{fmtDuracion(resumen.horasEnMovimiento)}</div></div></div><div aria-busy={recalculando} className={`mt-5 transition-opacity ${recalculando ? "opacity-50" : ""}`}><DesglosePresupuesto presupuesto={presupuesto} overrides={overrides} onFijar={fijarLinea} fmt={fmtVista} moneda={monedaVista} porUsd={porUsd} t={t} /><p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-400">{t("rutaCategoriasNota")}</p>{regresoIncluido && <p className="mt-2.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] leading-relaxed text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">{t("rutaRegresoNota").replace("{ahorro}", fmtVista(regresoIncluido.ahorro)).replace("{ciudad}", regresoIncluido.ciudad).replace("{casa}", regresoIncluido.casa)}</p>}{avisoIdaVuelta && <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">{t(avisoIdaVuelta === "sin-regreso" ? "rutaAvisoSinRegreso" : "rutaAvisoOtraCiudad")}</p>}</div><div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-slate-100 pt-4 dark:border-slate-700"><span className="text-[13px] text-slate-500 dark:text-slate-400">{t("rutaPorPersona")}</span><span className="text-[17px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmtVista(presupuesto.totalPorPersona)}</span><span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">{t("rutaTotal").replace("{n}", presupuesto.viajeros)}</span><span className="text-[26px] font-extrabold tabular-nums tracking-tight text-marca-700 dark:text-marca-300">{fmtVista(presupuesto.total)}</span></div><p className="mt-3 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{t("rutaConfianza").replace("{detectados}", resumen.confianza.detectados).replace("{curados}", resumen.confianza.curados).replace("{estimados}", resumen.confianza.estimados)}</p><div className="mt-4 flex flex-wrap gap-2"><button onClick={guardar} disabled={guardando} className="rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-marca transition hover:brightness-105 disabled:opacity-60">{guardando ? t("rutaGuardando") : idRuta ? t("rutaActualizar") : t("rutaGuardar")}</button>{enlaceCompartir && <button onClick={() => { try { navigator.clipboard.writeText(enlaceCompartir); setAviso(t("rutaEnlaceCopiado")); } catch {} }} className="rounded-xl border-[1.5px] border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">{t("rutaCompartir")}</button>}</div></section>}
        </>}
        {aviso && <div role="status" className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-700 shadow-suave dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{aviso}{" "}<button onClick={() => setAviso(null)} className="ml-1 font-bold text-slate-400 hover:text-slate-600">×</button></div>}
      </div>
    </div>
  );
}
