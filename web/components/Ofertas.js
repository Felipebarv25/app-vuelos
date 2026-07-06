"use client";
import { useEffect, useMemo, useState } from "react";
import { Icono } from "./Icono";
import { obtenerTasas } from "@/lib/fx";
import { isoDesdeNombre } from "@/lib/requisitos";
import AlertaPrecio from "./AlertaPrecio";

// Bandera PNG via flagcdn: los emoji de bandera (🇺🇸) NO renderizan en Windows
// (segoe UI emoji no incluye flags) y se ven como "us" — lo que confunde al
// usuario ("us Nueva York" en vez de "🇺🇸 Nueva York"). Usamos flagcdn como en
// SelectorPais para tener rendering consistente en todo OS.
function BanderaCC({ cc, size = 14 }) {
  if (!cc) return null;
  const lo = cc.toLowerCase();
  return (
    <img
      src={`https://flagcdn.com/${size}x${Math.round(size * 0.75)}/${lo}.png`}
      srcSet={`https://flagcdn.com/${size * 2}x${Math.round(size * 1.5)}/${lo}.png 2x`}
      alt=""
      width={size}
      height={Math.round(size * 0.75)}
      className="inline-block rounded-[2px] align-middle"
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}

// Tablero de "vuelos baratos detectados": lee web/public/ofertas.json
// (generado por el detector de precios) y muestra las mejores ofertas
// vigentes desde los hubs trackeados, con opción de planear el viaje.
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

const LOTE = 12; // tarjetas por lote inicial y por "Ver más"

export default function Ofertas({ onPlanear, t = (k) => k, lang = "es", rango = null }) {
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState("colombia"); // colombia | BOG | MDE | todos
  const [visibles, setVisibles] = useState(LOTE); // cuántas tarjetas mostrar
  const [copPorUsd, setCopPorUsd] = useState(4000); // tasa COP en vivo (respaldo 4000)
  // Popularidad real por destino (cuantas busquedas ha tenido). Behavioral
  // econ: social proof aumenta CTR cuando es VERIDICO. Si no hay datos
  // (KV vacio), el badge no se muestra.
  const [popularidad, setPopularidad] = useState({});
  useEffect(() => {
    let vivo = true;
    fetch("/api/popular")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d?.ok && d.ciudades && setPopularidad(d.ciudades))
      .catch(() => {});
    return () => { vivo = false; };
  }, []);
  // Moneda principal de visualizacion. Persiste en localStorage: si el usuario
  // colombiano abre y prefiere COP, no se lo volvemos a preguntar la proxima vez.
  const [monedaVista, setMonedaVista] = useState("USD");
  useEffect(() => {
    try {
      const g = localStorage.getItem("anduve_moneda_vista");
      if (g === "USD" || g === "COP") setMonedaVista(g);
    } catch {}
  }, []);
  function cambiarMonedaVista(m) {
    setMonedaVista(m);
    try { localStorage.setItem("anduve_moneda_vista", m); } catch {}
  }

  useEffect(() => {
    let vivo = true;
    obtenerTasas().then((r) => vivo && r?.porUsd?.COP && setCopPorUsd(r.porUsd.COP));
    return () => { vivo = false; };
  }, []);

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
    const filtradas =
      filtro === "todos" ? list
      : filtro === "colombia" ? list.filter((r) => r.origen === "BOG" || r.origen === "MDE")
      : list.filter((r) => r.origen === filtro);
    // Orden: mayor descuento primero; si empatan, más reciente primero.
    return [...filtradas].sort((a, b) => {
      if (b.descuento !== a.descuento) return b.descuento - a.descuento;
      const ta = a.visto ? new Date(a.visto).getTime() : 0;
      const tb = b.visto ? new Date(b.visto).getTime() : 0;
      return tb - ta;
    });
  }, [data, filtro]);

  // Frescura GLOBAL: el escaneo mas reciente entre todas las rutas. Sirve para
  // el sello "actualizado hace X" del header (prueba social honesta de que
  // los precios son de hoy, no estimados).
  const ultimoEscaneo = useMemo(() => {
    let max = 0;
    for (const r of data?.rutas || []) {
      const ts = r.visto ? new Date(r.visto).getTime() : 0;
      if (ts > max) max = ts;
    }
    return max || null;
  }, [data]);

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
  // Aproximación a pesos colombianos con la tasa del día (lib/fx).
  function fmtCop(v) {
    return "≈ $ " + Math.round(v * copPorUsd).toLocaleString("es-CO") + " COP";
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
          {ultimoEscaneo && (
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {t("ofertasActualizado")} {fmtHace(new Date(ultimoEscaneo).toISOString())}
            </div>
          )}
        </div>

        {/* Toggle USD / COP: muchos colombianos quieren ver el precio en
            pesos directamente. Usuario decide y queda guardado. */}
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-700">
          {["USD", "COP"].map((m) => (
            <button
              key={m}
              onClick={() => cambiarMonedaVista(m)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${
                monedaVista === m ? "bg-white text-marca-700 shadow-sm dark:bg-slate-600 dark:text-marca-300" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Filtro de origen: Colombia (BOG+MDE) es el default para que el
            título sea coherente; "Todos" expande a ofertas internacionales. */}
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-700">
          {[
            ["colombia", "Colombia"],
            ["BOG", origenes.BOG || "Bogotá"],
            ["MDE", origenes.MDE || "Medellín"],
            ["todos", t("ofertasTodos")],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setFiltro(k); setVisibles(LOTE); }}
              className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                filtro === k ? "bg-white text-marca-700 shadow dark:bg-slate-600 dark:text-marca-300" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rutas.slice(0, visibles).map((r) => (
          <div
            key={r.origen + r.destino}
            className="group relative flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-suave transition hover:-translate-y-0.5 hover:shadow-media dark:border-slate-700 dark:bg-slate-800"
          >
            {r.esGanga && (
              <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-acento-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                <Icono nombre="flame" size={11} /> {t("ofertasGanga")}
              </span>
            )}

            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-slate-500">
              <span>{origenes[r.origen] || r.origen}</span>
              <span className="text-slate-300">→</span>
              <span className="inline-flex items-center gap-1.5">
                <BanderaCC cc={isoDesdeNombre(r.pais)} size={14} />
                {r.ciudad}
              </span>
            </div>
            {/* Social proof real: muestra cuantos viajeros han buscado este
                destino. Solo aparece cuando hay datos reales en KV (umbral
                minimo de 3 para no destacar destinos sin trafico). */}
            {popularidad[r.q] && popularidad[r.q] >= 3 && (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-bold text-amber-700 ring-1 ring-amber-100">
                🔥 {Number(popularidad[r.q]).toLocaleString(lang)} {t("ofertasViajerosVieron")}
              </div>
            )}

            <div className="mt-2 flex items-end gap-2">
              <div className="text-[26px] font-extrabold leading-none text-marca-900">
                {monedaVista === "COP" ? fmtCop(r.precio) : fmtUsd(r.precio)}
              </div>
              {r.descuento > 0 && (
                <div className="mb-0.5 text-[12px] font-bold text-emerald-600">
                  −{r.descuento}%
                </div>
              )}
            </div>
            <div className="text-[12px] text-slate-400">{t("ofertasIdaVuelta")}</div>
            {/* Mostramos la moneda secundaria (la NO elegida) en pequeno como
                cross-reference. Etiqueta "aprox" adyacente — disclaimer junto al
                precio, no solo en el footer (feedback auditoria). */}
            <div className="text-[12px] font-medium text-slate-500">
              {monedaVista === "COP" ? fmtUsd(r.precio) : fmtCop(r.precio)}
              <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {t("ofertasAproxBadge")}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
              <Icono nombre="calendar" size={13} /> {fmtFecha(r.fecha_ida)} – {fmtFecha(r.fecha_vuelta)}
              <span className="text-slate-300">·</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {r.aerolinea}
              </span>
              {/* QW2: frescura del precio. Si la oferta tiene `visto` propio,
                  lo usamos; si no, caemos al timestamp global del archivo
                  (data.generado). Así NUNCA mostramos un precio sin frescura. */}
              {(r.visto || data.generado) && (() => {
                // Badge honesto de frescura (audit 2026-07-05):
                //   < 3h : verde con check (precio recien verificado)
                //   3-6h : amarillo (aun vigente pero no super fresco)
                //   > 6h : rojo (el detector Python ya omite estos, pero por
                //          seguridad si aparece uno lo marcamos claramente).
                // El detector corre cada 3h; con ventana de 6h en generar_ofertas.py
                // dejamos 1 corrida de margen antes de considerar el precio obsoleto.
                const ts = r.visto || data.generado;
                const min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
                const clase = min <= 180
                  ? "text-emerald-600 dark:text-emerald-400"
                  : min <= 360
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-500";
                const icono = min <= 180 ? "check" : "clock";
                return (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${clase}`}>
                      <Icono nombre={icono} size={11} /> {fmtHace(ts)}
                    </span>
                  </>
                );
              })()}
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
                className="flex items-center justify-center rounded-xl border-[1.5px] border-slate-200 px-3 text-marca-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-marca-400 dark:hover:bg-slate-700"
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

            {/* Alerta de precio: el usuario fija un umbral y le avisamos por
                email cuando el detector vea un vuelo abajo. Gate Free 1 alerta. */}
            <div className="mt-2.5">
              <AlertaPrecio
                ciudad={r.ciudad}
                pais={r.pais}
                iata={r.destino}
                precioActual={r.precio}
              />
            </div>

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

      {/* Contador + paginación */}
      <div className="mt-5 flex flex-col items-center gap-3">
        <p className="text-[12.5px] text-slate-400">
          Mostrando {Math.min(visibles, rutas.length)} de {rutas.length} oferta{rutas.length !== 1 ? "s" : ""}
        </p>
        {visibles < rutas.length && (
          <button
            onClick={() => setVisibles((v) => v + LOTE)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[13.5px] font-semibold text-marca-700 shadow-suave transition hover:border-marca-200 hover:bg-marca-50"
          >
            Ver más ofertas ({Math.min(LOTE, rutas.length - visibles)} más)
          </button>
        )}
      </div>

      {data.generado && (
        <div className="mt-3 text-[11px] text-slate-400">
          {t("ofertasActualizado")}: {new Date(data.generado).toLocaleString(lang)} · {t("ofertasFuente")}
        </div>
      )}
    </section>
  );
}
