"use client";
import { useEffect, useMemo, useState } from "react";
import { Icono } from "./Icono";

// Tablero de "vuelos baratos desde Colombia": lee web/public/ofertas.json
// (generado por el detector de precios) y muestra las mejores ofertas
// vigentes desde Bogotá y Medellín, con opción de planear el viaje.
// Construye un deep-link de Aviasales para las fechas que eligió el usuario,
// reutilizando el marker de afiliado que ya viene en el enlace de la oferta.
function ddmm(iso) {
  return iso && iso.length >= 10 ? iso.slice(8, 10) + iso.slice(5, 7) : "";
}
function markerDe(link) {
  const m = (link || "").match(/[?&]marker=([^&]+)/);
  return m ? m[1] : "";
}
function linkMisFechas(r, rango) {
  const di = ddmm(rango.inicio);
  if (!di) return "";
  const code = `${r.origen}${di}${r.destino}${ddmm(rango.fin)}1`;
  const mk = markerDe(r.link);
  return `https://www.aviasales.com/search/${code}` + (mk ? `?marker=${mk}` : "");
}

export default function Ofertas({ onPlanear, t = (k) => k, lang = "es", rango = null }) {
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
  // "visto hace X" (frescura del precio) a partir del timestamp del último escaneo.
  function fmtHace(iso) {
    if (!iso) return "";
    const ms = Date.now() - new Date(iso).getTime();
    if (Number.isNaN(ms)) return "";
    const min = Math.round(ms / 60000);
    if (min < 60) return t("ofertasHaceMin").replace("{n}", Math.max(1, min));
    const h = Math.round(min / 60);
    if (h < 24) return t("ofertasHaceHoras").replace("{n}", h);
    const d = Math.round(h / 24);
    return t("ofertasHaceDias").replace("{n}", d);
  }
  // Aproximación a pesos colombianos (tasa orientativa ~4000 COP/USD).
  function fmtCop(v) {
    return "≈ $ " + Math.round(v * 4000).toLocaleString("es-CO") + " COP";
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-marca-500">
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
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-acento-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Icono nombre="flame" size={11} /> {t("ofertasGanga")}
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
            <div className="text-[12px] font-medium text-slate-500">{fmtCop(r.precio)}</div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
              <Icono nombre="calendar" size={13} /> {fmtFecha(r.fecha_ida)} – {fmtFecha(r.fecha_vuelta)}
              <span className="text-slate-300">·</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500">
                {r.aerolinea}
              </span>
              {r.visto && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Icono nombre="clock" size={11} /> {fmtHace(r.visto)}</span>
                </>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onPlanear?.(r.q)}
                className="flex-1 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-2.5 text-[13px] font-bold text-white shadow-marca transition hover:brightness-105"
              >
                <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="map" size={15} /> {t("ofertasPlanear")}</span>
              </button>
              <a
                href={r.link}
                target="_blank"
                rel="sponsored noopener"
                aria-label={t("ofertasVerVuelos") || "Ver vuelos"}
                title={t("ofertasVerVuelos") || "Ver vuelos"}
                className="flex items-center justify-center rounded-xl border-[1.5px] border-slate-200 px-3 text-marca-600 transition hover:bg-slate-50"
              >
                <Icono nombre="plane" size={18} />
              </a>
            </div>

            {/* Si el usuario eligió fechas: buscar vuelos para ESAS fechas. */}
            {rango && (
              <a
                href={linkMisFechas(r, rango)}
                target="_blank"
                rel="sponsored noopener"
                className="mt-2 block rounded-xl border border-marca-200 bg-marca-50 py-2 text-center text-[12.5px] font-bold text-marca-700 transition hover:bg-marca-100"
              >
                <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="search" size={14} /> {t("ofertasMisFechas")}</span>
              </a>
            )}

            {/* Verificación honesta: comparar el precio en Google Vuelos */}
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{t("ofertasAprox")}</span>
              {r.link_google && (
                <a href={r.link_google} target="_blank" rel="noopener" className="font-semibold text-marca-500 hover:underline">
                  {t("ofertasComparar")} ↗
                </a>
              )}
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
