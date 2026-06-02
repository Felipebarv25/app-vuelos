"use client";
import { useEffect, useMemo, useState } from "react";
import { Boton } from "./ui";
import { fotoDeLugar } from "@/lib/imagenes";
import { fmtMin, resumenDia } from "@/lib/itinerario";
import { estadoTiempo, textoEstado } from "@/lib/reloj";

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
          {cargando ? <span className="spin" /> : <span className="text-xl">🏞️</span>}
        </div>
      )}
    </button>
  );
}

// Emoji según el tipo de lugar (para identificar de un vistazo en la lista).
function emojiCat(cat = "") {
  const c = cat.toLowerCase();
  if (c.includes("muse") || c.includes("galer")) return "🖼️";
  if (c.includes("restaur")) return "🍽️";
  if (c.includes("caf")) return "☕";
  if (c.includes("bar") || c.includes("pub") || c.includes("disco")) return "🍸";
  if (c.includes("mirad") || c.includes("viewpoint")) return "🌅";
  if (c.includes("castil") || c.includes("castle") || c.includes("fort")) return "🏰";
  if (c.includes("monu") || c.includes("memor")) return "🗿";
  if (c.includes("igle") || c.includes("church") || c.includes("templ") || c.includes("mosq")) return "⛪";
  if (c.includes("parq") || c.includes("park")) return "🌳";
  return "📍";
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
  t = (k) => k,
}) {
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
    <div>
      {/* Resumen del día */}
      <div className="mb-3 rounded-2xl border border-marca-100 bg-gradient-to-br from-marca-50 to-violet-50 p-4 shadow-suave">
        <div className="flex flex-wrap justify-between gap-2">
          <div>
            <div className="text-[19px] font-extrabold tracking-tight text-marca-900">
              {t("dia")} {numeroDia}
            </div>
            <div className="mt-0.5 text-[13px] text-slate-500">
              {r.paradas} {t("paradas")} · {r.totalTexto} {t("enTotal")}
            </div>
          </div>
          <div className="flex gap-2">
            <Stat num={r.visitaTexto} lbl={`👣 ${t("visitas")}`} />
            <Stat num={r.trasladoTexto} lbl={`🚇 ${t("traslados")}`} />
          </div>
        </div>

        {/* Botón de seguimiento por GPS */}
        {dia.paradas.length > 0 && (
          <div className="mt-3">
            {!seguimiento ? (
              <Boton variante="verde" onClick={iniciar} style={{ width: "100%" }}>
                ▶️ {t("empezarGps")}
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
            className={`mb-1 rounded-2xl border bg-white p-4 transition ${
              seguimiento && i === paradaActual
                ? "border-emerald-400 shadow-[0_0_0_2px_rgba(16,185,129,.7),0_2px_10px_rgba(15,23,42,.06)]"
                : "border-slate-100 shadow-suave"
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
                  {p.nombre}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
                  <span>{emojiCat(p.categoria)} {p.categoria}</span>
                  {p.cocina && <span>· {p.cocina}</span>}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11.5px] font-semibold text-slate-500">
                    ⏱️ {fmtMin(p.minutos)}
                  </span>
                  {p.notable && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11.5px] font-semibold text-amber-800">
                      ⭐ Top
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    className="rounded-[10px] bg-marca-50 px-3 py-2 text-[13px] font-semibold text-marca-600 transition hover:bg-marca-100"
                    onClick={() => onVerLugar?.(p)}
                  >
                    📷 {t("verFoto")}
                  </button>
                  {alternativas?.length > 0 && (
                    <button
                      className="rounded-[10px] bg-slate-100 px-3 py-2 text-[13px] font-semibold text-marca-900 transition hover:bg-slate-200"
                      onClick={() => onCambiarParada(i)}
                    >
                      🔄 {t("cambiar")}
                    </button>
                  )}
                  <button
                    className="rounded-[10px] bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-600 transition hover:bg-red-100"
                    onClick={() => onQuitarParada(i)}
                  >
                    ✕ {t("quitar")}
                  </button>
                </div>
              </div>

              <FotoMini nombre={p.nombre} ciudad={ciudad} onClick={() => onVerLugar?.(p)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Stat({ num, lbl }) {
  return (
    <div className="min-w-[64px] rounded-xl bg-white/70 px-3 py-2 text-center">
      <div className="text-sm font-extrabold text-marca-900">{num}</div>
      <div className="mt-px text-[10.5px] text-slate-500">{lbl}</div>
    </div>
  );
}

function PanelTiempo({ estado, paradaActual, total, onSiguiente, onParar, t = (k) => k }) {
  const est = estado ? textoEstado(estado, t) : null;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
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
