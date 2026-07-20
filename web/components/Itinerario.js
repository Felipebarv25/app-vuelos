"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Boton } from "./ui";
import { fotoDeLugar } from "@/lib/imagenes";
import { fmtMin, resumenDia } from "@/lib/itinerario";
import { estadoTiempo, textoEstado } from "@/lib/reloj";
import BadgeApertura from "./BadgeApertura";
import { Icono, iconoCategoria } from "./Icono";
import { nombreLocalizado } from "@/lib/nombres";
import { linkTourCerca, linkCivitatisCerca } from "@/lib/afiliados";
import { track } from "@/lib/track";

function linkGoogleMaps(paradas, hospedaje, lang) {
  if (!paradas.length) return null;
  const pts = [];
  if (hospedaje?.lat != null) pts.push(`${hospedaje.lat},${hospedaje.lon}`);
  for (const p of paradas) pts.push(`${p.coord[0]},${p.coord[1]}`);
  if (pts.length < 2) return null;
  const origen = pts[0];
  const destino = pts[pts.length - 1];
  const waypoints = pts.length > 2 ? pts.slice(1, -1).join("|") : "";
  let url = `https://www.google.com/maps/dir/?api=1&origin=${origen}&destination=${destino}&travelmode=walking`;
  if (waypoints) url += `&waypoints=${encodeURIComponent(waypoints)}`;
  return url;
}

// Miniatura de la parada: carga la foto de forma perezosa. Cascada Wikipedia
// -> Commons texto -> Commons GEO (con `coord` del lugar): asi TODOS los
// lugares tienen foto, no solo los famosos (no-negociable 2026-07-11).
function FotoMini({ nombre, ciudad, coord = null, wd = null, onClick }) {
  const [url, setUrl] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fotoDeLugar(nombre, ciudad, coord, wd).then((f) => {
      if (vivo) {
        setUrl(f?.url || null);
        setCargando(false);
      }
    });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nombre, ciudad]);
  return (
    <button
      onClick={onClick}
      className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-slate-100"
    >
      {url ? (
        <img src={url} alt={nombre} loading="lazy" width="60" height="60" onError={() => setUrl(null)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-slate-300">
          {cargando ? <span className="spin" /> : <Icono nombre="image" size={20} />}
        </div>
      )}
    </button>
  );
}

// Muestra el itinerario de UN día: paradas, traslados, transporte, tiempos,
// y el seguimiento por GPS (si está activo).
export default function Itinerario({
  dia,
  numeroDia,
  alternativas,
  onCambiarParada,
  onQuitarParada,
  onVerLugar,
  onMoverParada,
  onReordenar,
  onOptimizar,
  totalDias = 1,
  gps,
  ciudad,
  hospedaje = null,
  fechaInicio,
  husoDestino,
  lang = "es",
  t = (k) => k,
}) {
  // Fecha real de ESTE día (si el usuario eligió fechas de viaje).
  let fechaDia = "";
  if (fechaInicio) {
    const d = new Date(fechaInicio + "T00:00:00");
    d.setDate(d.getDate() + (numeroDia - 1));
    fechaDia = d.toLocaleDateString(lang, { weekday: "short", day: "numeric", month: "short" });
  }
  const r = resumenDia(dia);
  const [seguimiento, setSeguimiento] = useState(false);
  const [inicioMs, setInicioMs] = useState(null);
  const [paradaActual, setParadaActual] = useState(0);

  const estado = useMemo(() => {
    if (!seguimiento || inicioMs == null) return null;
    return estadoTiempo(dia, paradaActual, inicioMs, Date.now());
  }, [seguimiento, inicioMs, paradaActual, dia, gps]);

  function iniciar() {
    setInicioMs(Date.now());
    setParadaActual(0);
    setSeguimiento(true);
  }

  return (
    <div className="animar-aparecer">
      {/* Resumen del día */}
      <div className="mb-3 rounded-2xl border border-marca-100 bg-gradient-to-br from-marca-50 to-violet-50 p-4 shadow-suave dark:border-marca-900 dark:from-slate-800 dark:to-slate-800">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <div className="text-[19px] font-extrabold tracking-tight text-marca-900">
              {t("dia")} {numeroDia}
              {fechaDia && <span className="ml-2 text-[13px] font-semibold capitalize text-marca-500">{fechaDia}</span>}
            </div>
            <div className="mt-0.5 text-[13px] text-slate-500">
              {r.paradas} {t("paradas")} · {r.totalTexto} {t("enTotal")}
            </div>
          </div>
          <div className="flex gap-2">
            <Stat num={r.visitaTexto} ico="footprints" lbl={t("visitas")} />
            <Stat num={r.trasladoTexto} ico="route" lbl={t("traslados")} />
          </div>
        </div>

        {/* Botones de acción: GPS + Google Maps + Optimizar */}
        {dia.paradas.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {onOptimizar && dia.paradas.length >= 3 && (
              <button
                onClick={onOptimizar}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-50 px-3.5 py-2.5 text-[13px] font-bold text-amber-700 shadow-sm transition hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-300 dark:hover:bg-amber-900/50"
              >
                <Icono nombre="zap" size={15} /> {t("optimizarRuta")}
              </button>
            )}
            {!seguimiento ? (
              <Boton variante="verde" onClick={iniciar} style={{ flex: 1 }}>
                <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="play" size={15} /> {t("empezarGps")}</span>
              </Boton>
            ) : (
              <PanelTiempo
                estado={estado}
                gps={gps}
                t={t}
                paradaActual={paradaActual}
                total={dia.paradas.length}
                onSiguiente={() => setParadaActual((x) => Math.min(x + 1, dia.paradas.length - 1))}
                onParar={() => setSeguimiento(false)}
              />
            )}
            {linkGoogleMaps(dia.paradas, hospedaje, lang) && (
              <a
                href={linkGoogleMaps(dia.paradas, hospedaje, lang)}
                target="_blank"
                rel="noopener"
                onClick={() => track("gmaps_export", { dia: numeroDia, paradas: dia.paradas.length })}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-50 px-3.5 py-2.5 text-[13px] font-bold text-blue-700 shadow-sm transition hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#4285F4"/><circle cx="12" cy="9" r="2.5" fill="#fff"/></svg>
                {t("abrirGoogleMaps")}
              </a>
            )}
          </div>
        )}
      </div>

      {dia.paradas.length === 0 && (
        <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
          <p className="text-sm text-slate-500">{t("sinParadas")}</p>
        </div>
      )}

      {/* Lista de paradas */}
      {dia.paradas.map((p, i) => (
        <div key={p.id || i}>
          {i > 0 && (
            <div className="my-1 ml-[15px] flex items-center gap-0">
              {/* Línea vertical de conexión */}
              <div className="flex flex-col items-center">
                <div className="h-3 w-[2px] bg-slate-200 dark:bg-slate-600" />
                <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-600 shadow-sm dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  <span className="text-sm">{p.transporte.icono}</span>
                  {fmtMin(p.traslado)}
                  <span className="text-[11px] font-normal text-slate-400">
                    {p.metros < 1000 ? `${p.metros} m` : `${(p.metros / 1000).toFixed(1)} km`}
                  </span>
                </div>
                <div className="h-3 w-[2px] bg-slate-200 dark:bg-slate-600" />
              </div>
            </div>
          )}

          <div
            className={`mb-1 rounded-2xl border p-4 transition dark:bg-slate-800 ${
              seguimiento && i === paradaActual
                ? "border-emerald-400 bg-white shadow-[0_0_0_2px_rgba(16,185,129,.7),0_2px_10px_rgba(15,23,42,.06)]"
                : "border-slate-100 bg-white shadow-suave dark:border-slate-700"
            }`}
          >
            <div className="flex gap-3">
              <div
                onClick={() => onVerLugar?.(p)}
                className="flex h-[34px] min-w-[34px] flex-shrink-0 cursor-pointer items-center justify-center rounded-xl bg-gradient-to-br from-marca-400 to-marca-600 text-base font-extrabold text-white shadow-[0_4px_10px_rgba(79,70,229,.35)]"
              >
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div
                  onClick={() => onVerLugar?.(p)}
                  className="cursor-pointer break-words text-[16.5px] font-bold tracking-tight"
                >
                  {nombreLocalizado(p, lang)}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
                  <span className="inline-flex items-center gap-1"><Icono nombre={iconoCategoria(p.categoria)} size={13} /> {p.categoria}</span>
                  {p.cocina && <span>· {p.cocina}</span>}
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-500">
                    <Icono nombre="clock" size={11} /> {fmtMin(p.minutos)}
                  </span>
                  {p.wiki ? (
                    /* Lugar con articulo de Wikipedia = senal de calidad verificable.
                       Es la prueba mas fuerte (la auditoria pidio que el usuario vea
                       POR QUE este lugar esta en la lista, no solo "Top" generico). */
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800" title={t("itinSenalWikipedia")}>
                      <Icono nombre="star" size={11} /> {t("itinBadgeWikipedia")}
                    </span>
                  ) : p.notable ? (
                    /* Tiene entrada en Wikidata pero sin articulo de Wikipedia:
                       relevante pero menos famoso. */
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-700" title={t("itinSenalNotable")}>
                      <Icono nombre="star" size={11} /> {t("itinBadgeNotable")}
                    </span>
                  ) : null}
                  {/* QW1 — Badge "Abierto ahora · cierra a las X" / "Cerrado".
                      Solo aparece si OSM trajo opening_hours y conocemos el
                      huso del destino. */}
                  <BadgeApertura lugar={p} huso={husoDestino} t={t} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {/* Flechas reordenar */}
                  {onReordenar && dia.paradas.length > 1 && (
                    <div className="flex overflow-hidden rounded-[10px] border border-slate-200 dark:border-slate-600">
                      <button
                        disabled={i === 0}
                        onClick={() => onReordenar(i, -1)}
                        className="px-2 py-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                        title={t("subirParada")}
                      >
                        <Icono nombre="chevronUp" size={15} />
                      </button>
                      <button
                        disabled={i === dia.paradas.length - 1}
                        onClick={() => onReordenar(i, 1)}
                        className="border-l border-slate-200 px-2 py-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:border-slate-600 dark:hover:bg-slate-700"
                        title={t("bajarParada")}
                      >
                        <Icono nombre="chevronDown" size={15} />
                      </button>
                    </div>
                  )}
                  <button
                    className="rounded-[10px] bg-marca-50 px-3 py-2 text-[13px] font-semibold text-marca-600 transition hover:bg-marca-100 dark:bg-marca-900/30 dark:text-marca-300"
                    onClick={() => onVerLugar?.(p)}
                  >
                    <span className="inline-flex items-center gap-1.5"><Icono nombre="camera" size={14} /> {t("verFoto")}</span>
                  </button>
                  {alternativas?.length > 0 && (
                    <button
                      className="rounded-[10px] bg-slate-100 px-3 py-2 text-[13px] font-semibold text-marca-900 transition hover:bg-slate-200"
                      onClick={() => onCambiarParada(i)}
                    >
                      <span className="inline-flex items-center gap-1.5"><Icono nombre="refresh" size={14} /> {t("cambiar")}</span>
                    </button>
                  )}
                  {/* Mover a otro día */}
                  {onMoverParada && totalDias > 1 && (
                    <MoverADia
                      paradaIdx={i}
                      numeroDia={numeroDia}
                      totalDias={totalDias}
                      onMover={onMoverParada}
                      t={t}
                    />
                  )}
                  <button
                    className="rounded-[10px] bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600 transition hover:bg-red-100"
                    onClick={() => onQuitarParada(i)}
                  >
                    <span className="inline-flex items-center gap-1.5"><Icono nombre="x" size={14} /> {t("quitar")}</span>
                  </button>
                  {/* Tour cerca de ESTA parada (GetYourGuide via afiliado).
                      Es la palanca de monetizacion mejor posicionada del
                      itinerario: el usuario esta planeando el dia y mira
                      directamente el lugar. Comision ~8% por reserva. */}
                  {p.coord && (
                    <a
                      href={linkTourCerca({
                        nombre: nombreLocalizado(p, lang),
                        ciudad,
                        lat: p.coord[0],
                        lon: p.coord[1],
                      })}
                      target="_blank"
                      rel="sponsored noopener"
                      onClick={() => track("afiliado_clic", { cat: "tour_parada", lugar: nombreLocalizado(p, lang) })}
                      className="rounded-[10px] bg-gradient-to-r from-acento-400 to-acento-600 px-3 py-2 text-[13px] font-semibold text-white shadow-suave transition hover:brightness-105"
                    >
                      <span className="inline-flex items-center gap-1.5"><Icono nombre="ticket" size={14} /> {t("afTourCerca")}</span>
                    </a>
                  )}
                  {p.coord && (
                    <a
                      href={linkCivitatisCerca({ ciudad, nombre: nombreLocalizado(p, lang) })}
                      target="_blank"
                      rel="sponsored noopener"
                      onClick={() => track("afiliado_clic", { cat: "civitatis_parada", lugar: nombreLocalizado(p, lang) })}
                      className="rounded-[10px] bg-gradient-to-r from-orange-400 to-orange-600 px-3 py-2 text-[13px] font-semibold text-white shadow-suave transition hover:brightness-105"
                    >
                      <span className="inline-flex items-center gap-1.5"><Icono nombre="compass" size={14} /> Civitatis</span>
                    </a>
                  )}
                </div>
              </div>

              <FotoMini nombre={nombreLocalizado(p, lang)} ciudad={ciudad} coord={p.coord} wd={p.wd} onClick={() => onVerLugar?.(p)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ num, lbl, ico }) {
  return (
    <div className="min-w-[64px] rounded-xl bg-white/70 px-3 py-2 text-center dark:bg-slate-700/60">
      <div className="text-sm font-extrabold text-marca-900">{num}</div>
      <div className="mt-px inline-flex items-center gap-1 text-[10.5px] text-slate-500">
        {ico && <Icono nombre={ico} size={11} />} {lbl}
      </div>
    </div>
  );
}

function MoverADia({ paradaIdx, numeroDia, totalDias, onMover, t }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!abierto) return;
    function cerrar(e) { if (ref.current && !ref.current.contains(e.target)) setAbierto(false); }
    document.addEventListener("pointerdown", cerrar);
    return () => document.removeEventListener("pointerdown", cerrar);
  }, [abierto]);
  const opciones = [];
  for (let d = 1; d <= totalDias; d++) {
    if (d !== numeroDia) opciones.push(d);
  }
  if (!opciones.length) return null;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setAbierto((v) => !v)}
        className="rounded-[10px] bg-violet-50 px-3 py-2 text-[13px] font-semibold text-violet-700 transition hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300"
      >
        <span className="inline-flex items-center gap-1.5"><Icono nombre="arrowRight" size={14} /> {t("moverADia")}</span>
      </button>
      {abierto && (
        <div className="absolute left-0 top-full z-30 mt-1 flex gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg dark:border-slate-600 dark:bg-slate-800">
          {opciones.map((d) => (
            <button
              key={d}
              onClick={() => { onMover(paradaIdx, d - 1); setAbierto(false); }}
              className="rounded-lg px-3 py-1.5 text-[13px] font-bold text-marca-700 transition hover:bg-marca-50 dark:text-marca-300 dark:hover:bg-marca-900/40"
            >
              {t("dia")} {d}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PanelTiempo({ estado, paradaActual, total, onSiguiente, onParar, t = (k) => k }) {
  const est = estado ? textoEstado(estado, t) : null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center justify-between">
        <div className="font-bold" style={{ color: est?.color }}>
          {est?.emoji} {est?.texto}
        </div>
        <div className="text-xs text-slate-500">
          {t("parada")} {paradaActual + 1}/{total}
        </div>
      </div>
      {estado && (
        <div className="mt-1 text-xs text-slate-500">
          {fmtMin(estado.planeado)} · {fmtMin(estado.transcurrido)}
        </div>
      )}
      <div className="mt-2.5 flex gap-2">
        <Boton onClick={onSiguiente} style={{ flex: 1 }}>
          ✓ {t("llegueSiguiente")}
        </Boton>
        <Boton variante="sec" onClick={onParar} style={{ flex: 1 }}>
          ⏹️ {t("terminar")}
        </Boton>
      </div>
    </div>
  );
}
