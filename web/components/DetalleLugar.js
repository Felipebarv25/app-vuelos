"use client";
import { useEffect, useState } from "react";
import { fotoDeLugar } from "@/lib/imagenes";
import { planTransporte, trazarRuta, perfilDeModo } from "@/lib/rutaReal";
import { distanciaMetros } from "@/lib/rutas";
import { fmtMin } from "@/lib/itinerario";

// Emoji representativo según el tipo de lugar (para cuando no hay foto).
function emojiCategoria(cat = "") {
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

// Panel/modal que muestra TODO sobre un lugar SIN salir de la app:
// foto, descripción, y cómo llegar desde la ubicación del usuario
// (transporte, tiempo, costo y ruta dibujada en nuestro mapa).
export default function DetalleLugar({ lugar, ciudad, origen, onCerrar, onTrazarRuta, t = (k) => k }) {
  const [foto, setFoto] = useState(null);
  const [cargandoFoto, setCargandoFoto] = useState(true);
  const [modoSel, setModoSel] = useState(null);

  const metros = origen ? distanciaMetros(origen, lugar.coord) : null;
  const transportes = metros != null ? planTransporte(metros) : [];

  useEffect(() => {
    let vivo = true;
    setCargandoFoto(true);
    setFoto(null);
    fotoDeLugar(lugar.nombre, ciudad?.nombre).then((f) => {
      if (vivo) {
        setFoto(f);
        setCargandoFoto(false);
      }
    });
    return () => {
      vivo = false;
    };
  }, [lugar, ciudad]);

  async function elegirTransporte(tr) {
    setModoSel(tr.modo);
    if (!origen) return;
    const ruta = await trazarRuta(origen, lugar.coord, perfilDeModo(tr.modo));
    onTrazarRuta?.({ ...ruta, modo: tr.modo, lugar });
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-end justify-center bg-slate-900/55 animar-aparecer"
      onClick={onCerrar}
    >
      <div
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] bg-white shadow-[0_-8px_30px_rgba(0,0,0,.3)] animar-subir"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asa para arrastrar (estética móvil) */}
        <div className="mx-auto mb-1 mt-2.5 h-[5px] w-[42px] rounded-full bg-slate-300" />

        {/* Foto del lugar */}
        <div className="relative h-[220px] overflow-hidden bg-slate-200">
          {cargandoFoto ? (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <span className="spin" />
            </div>
          ) : foto?.url ? (
            <img src={foto.url} alt={lugar.nombre} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-marca-400 to-marca-900">
              <span className="text-[58px]">{emojiCategoria(lugar.categoria)}</span>
            </div>
          )}
          <button
            className="absolute right-3 top-3 flex h-[34px] w-[34px] items-center justify-center rounded-full border-0 bg-black/50 text-base text-white"
            onClick={onCerrar}
          >
            ✕
          </button>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3.5 pt-8 text-white">
            <div className="text-[22px] font-extrabold">{lugar.nombre}</div>
            <div className="text-[13px] opacity-95">
              {lugar.categoria}
              {lugar.cocina ? ` · ${lugar.cocina}` : ""}
              {lugar.notable ? " · ⭐ Destacado" : ""}
            </div>
          </div>
        </div>

        <div className="p-4">
          {/* Descripción (de Wikipedia) */}
          {foto?.extracto && (
            <p className="mb-3.5 text-sm leading-relaxed text-slate-700">
              {foto.extracto.length > 240
                ? foto.extracto.slice(0, 240) + "…"
                : foto.extracto}
            </p>
          )}

          {/* Cómo llegar desde tu ubicación */}
          <div className="mb-2 font-bold text-marca-900">
            🧭 {t("comoLlegar")} {origen ? t("desdeTuUbicacion") : ""}
          </div>

          {!origen && (
            <div className="rounded-[10px] bg-amber-100 p-3 text-[13px] leading-snug text-amber-800">
              📍 {t("activaGps")}
            </div>
          )}

          {origen && (
            <>
              <div className="mb-2.5 text-[13px] text-slate-500">
                {t("estasA")}{" "}
                <b>
                  {metros < 1000
                    ? `${Math.round(metros)} m`
                    : `${(metros / 1000).toFixed(1)} km`}
                </b>{" "}
                {t("deAqui")}
              </div>
              <div className="grid gap-2">
                {transportes.map((tr) => (
                  <button
                    key={tr.modo}
                    onClick={() => elegirTransporte(tr)}
                    className={`flex items-center gap-3 rounded-xl border p-3 transition ${
                      modoSel === tr.modo
                        ? "border-marca-500 bg-marca-50"
                        : tr.recomendado
                        ? "border-slate-100 bg-emerald-50"
                        : "border-slate-100 bg-white"
                    }`}
                  >
                    <span className="text-[22px]">{tr.icono}</span>
                    <div className="flex-1 text-left">
                      <div className="text-[15px] font-bold">
                        {tr.nombre}
                        {tr.recomendado && (
                          <span className="ml-2 rounded-full bg-emerald-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">
                            {t("recomendado")}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        ⏱️ {fmtMin(tr.minutos)} · 💵 {tr.costo}
                      </div>
                    </div>
                    <span className="text-[13px] font-bold text-marca-600">
                      {t("verRuta")} →
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-2 text-[11px] text-slate-400">
                {t("aproxAviso")}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
