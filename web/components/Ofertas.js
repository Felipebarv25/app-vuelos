"use client";
import { useEffect, useMemo, useState } from "react";

// Tablero de "vuelos baratos desde Colombia": lee web/public/ofertas.json
// (generado por el detector de precios) y muestra las mejores ofertas
// vigentes desde Bogotá y Medellín, con opción de planear el viaje.
export default function Ofertas({ onPlanear, t = (k) => k, lang = "es" }) {
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState("todos"); // todos | BOG | MDE

  useEffect(() => {
    let vivo = true;
    fetch("/ofertas.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && setData(d))
      .catch(() => vivo && setData({ rutas: [] }));
    return () => { vivo = false; };
  }, []);

  const rutas = useMemo(() => {
    const list = data?.rutas || [];
    return filtro === "todos" ? list : list.filter((r) => r.origen === filtro);
  }, [data, filtro]);

  if (!data) return null; // cargando: no mostramos nada (evita parpadeo)
  if (!data.rutas?.length) return null;

  const origenes = data.origenes || { BOG: "Bogotá", MDE: "Medellín" };

  function fmtFecha(iso) {
    if (!iso) return "";
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(lang, { day: "numeric", month: "short" });
  }
  function fmtUsd(v) {
    return "US$ " + Math.round(v).toLocaleString("en-US");
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">
            {t("ofertasEyebrow")}
          </div>
          <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-marca-900 lg:text-[26px]">
            {t("ofertasTitulo")}
          </h2>
          <p className="mt-1 max-w-xl text-[13.5px] text-slate-500">{t("ofertasSub")}</p>
        </div>

        {/* Filtro de origen */}
        <div className="flex gap-1 rounded-full bg-slate-100 p-1">
          {[["todos", t("ofertasTodos")], ["BOG", origenes.BOG], ["MDE", origenes.MDE]].map(
            ([k, label]) => (
              <button
                key={k}
                onClick={() => setFiltro(k)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                  filtro === k ? "bg-white text-marca-700 shadow" : "text-slate-500"
                }`}
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rutas.map((r) => (
          <div
            key={r.origen + r.destino}
            className="group relative flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-suave transition hover:-translate-y-0.5 hover:shadow-media"
          >
            {r.esGanga && (
              <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                🔥 {t("ofertasGanga")}
              </span>
            )}

            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-500">
              <span>{origenes[r.origen] || r.origen}</span>
              <span className="text-slate-300">→</span>
              <span>{r.bandera} {r.ciudad}</span>
            </div>

            <div className="mt-2 flex items-end gap-2">
              <div className="text-[26px] font-extrabold leading-none text-marca-900">
                {fmtUsd(r.precio)}
              </div>
              {r.descuento > 0 && (
                <div className="mb-0.5 text-[12px] font-bold text-emerald-600">
                  −{r.descuento}%
                </div>
              )}
            </div>
            <div className="text-[12px] text-slate-400">{t("ofertasIdaVuelta")}</div>

            <div className="mt-2 flex items-center gap-1.5 text-[12.5px] text-slate-500">
              📅 {fmtFecha(r.fecha_ida)} – {fmtFecha(r.fecha_vuelta)}
              <span className="text-slate-300">·</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                {r.aerolinea}
              </span>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onPlanear?.(r.q)}
                className="flex-1 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-2.5 text-[13px] font-bold text-white shadow-marca transition hover:brightness-105"
              >
                🗺️ {t("ofertasPlanear")}
              </button>
              <a
                href={r.link}
                target="_blank"
                rel="noopener"
                className="flex items-center justify-center rounded-xl border-[1.5px] border-slate-200 px-3 text-[13px] font-bold text-marca-600 transition hover:bg-slate-50"
              >
                ✈️
              </a>
            </div>
          </div>
        ))}
      </div>

      {data.generado && (
        <div className="mt-3 text-[11px] text-slate-400">
          {t("ofertasActualizado")}: {new Date(data.generado).toLocaleString(lang)} · {t("ofertasFuente")}
        </div>
      )}
    </section>
  );
}
