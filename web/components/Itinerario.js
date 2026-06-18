"use client";
import { useEffect, useMemo, useState } from "react";
import { Boton } from "./ui";
import { fotoDeLugar } from "@/lib/imagenes";
import { fmtMin, resumenDia } from "@/lib/itinerario";
import { estadoTiempo, textoEstado } from "@/lib/reloj";
import { Icono, iconoCategoria } from "./Icono";
import { nombreLocalizado } from "@/lib/nombres";
import { linkTourCerca } from "@/lib/afiliados";
import { track } from "@/lib/track";

// Miniatura de la parada: carga la foto de forma perezosa (Wikipedia/Commons).
function FotoMini({ nombre, ciudad, onClick }) {
  const [url, setUrl] = useState(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    let vivo = true;
    setCargando(true);
    fotoDeLugar(nombre, ciudad).then((f) => {
      if (vivo) {
        setUrl(f?.url || null);
        setCargando(false);
      }
    });
    return () => { vivo = false; };
  }, [nombre, ciudad]);
  return (
    <button
      onClick={onClick}
      className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl bg-slate-100"
    >
      {url ? (
        <img src={url} alt={nombre} loading="lazy" onError={() => setUrl(null)} className="h-full w-full object-cover" />
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
  gps,
  ciudad,
  fechaInicio,
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

        {/* Botón de seguimiento por GPS */}
        {dia.paradas.length > 0 && (
          <div className="mt-3">
            {!seguimiento ? (
              <Boton variante="verde" onClick={iniciar} style={{ width: "100%" }}>
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
            <div className="my-2 ml-4 flex items-center gap-2 text-[13px] text-slate-600">
              <span className="text-base">{p.transporte.icono}</span>
              <span>
                {p.transporte.texto} · {fmtMin(p.traslado)} ·{" "}
                {p.metros < 1000 ? `${p.metros} m` : `${(p.metros / 1000).toFixed(1)} km`}
              </span>
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
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
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
                </div>
              </div>

              <FotoMini nombre={nombreLocalizado(p, lang)} ciudad={ciudad} onClick={() => onVerLugar?.(p)} />
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
