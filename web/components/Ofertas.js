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
// Timestamps del detector -> epoch ms, forzando UTC si vienen naive.
// El detector corre en GitHub Actions (UTC); las filas nuevas ya traen
// +00:00 pero las viejas son naive. `new Date("...T10:15:07")` sin sufijo
// se parsea como hora LOCAL del navegador: en Colombia (UTC-5) el precio se
// veia 5 horas mas fresco de lo real (lectura 360 2026-07-11).
function tsUTC(iso) {
  if (!iso) return NaN;
  const s = /Z|[+-]\d{2}:\d{2}$/.test(iso) ? iso : iso + "Z";
  return new Date(s).getTime();
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

// Codigo IATA de aerolinea -> nombre legible. El detector guarda el codigo
// crudo ("DM", "Y4"...) que para el usuario no significa nada (lectura 360
// 2026-07-11: "¿qué es DM?"). Cubre las aerolineas que aparecen en rutas
// desde los hubs trackeados; si falta alguna, se muestra el codigo tal cual.
const AEROLINEAS = {
  AV: "Avianca", LA: "LATAM", DM: "Arajet", JA: "JetSMART", Y4: "Volaris",
  VB: "Viva Aerobus", AM: "Aeroméxico", CM: "Copa", P5: "Wingo", AR: "Aerolíneas Argentinas",
  G3: "Gol", AD: "Azul", H2: "Sky Airline", AC: "Air Canada", AA: "American",
  DL: "Delta", UA: "United", B6: "JetBlue", NK: "Spirit", F9: "Frontier",
  IB: "Iberia", UX: "Air Europa", TP: "TAP", AF: "Air France", KL: "KLM",
  LH: "Lufthansa", BA: "British Airways", AZ: "ITA Airways", LX: "Swiss",
  TK: "Turkish Airlines", EK: "Emirates", QR: "Qatar Airways", ET: "Ethiopian",
  AL: "Air Leisure", "2D": "Aero VIP",
  FR: "Ryanair", W4: "Wizz Air", BF: "French Bee", G4: "Allegiant",
  XL: "LATAM Ecuador", PU: "Plus Ultra", F8: "Flair", CA: "Air China", AS: "Alaska Airlines",
};
function nombreAerolinea(cod) {
  const c = (cod || "").trim().toUpperCase();
  return AEROLINEAS[c] || cod || "—";
}

// sinCabecera: la pagina /ofertas ya tiene su propio H1 con el mismo texto;
// con esta prop el componente omite su titulo interno (se veia doble cabecera
// "Ofertas detectadas" + "Vuelos baratos detectados", lectura 360 2026-07-11)
// pero conserva el chip de frescura y el toggle USD/COP.
export default function Ofertas({ onPlanear, t = (k) => k, lang = "es", rango = null, sinCabecera = false }) {
  const [data, setData] = useState(null);
  const [filtro, setFiltro] = useState("colombia"); // colombia | BOG | MDE | todos
  // Busqueda por ciudad destino (feedback 2026-07-11: "si busco una ciudad
  // en especial quiero poderla filtrar").
  const [buscar, setBuscar] = useState("");
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
    let filtradas =
      filtro === "todos" ? list
      : filtro === "colombia" ? list.filter((r) => r.origen === "BOG" || r.origen === "MDE")
      : list.filter((r) => r.origen === filtro);
    // Filtro por texto: ciudad o pais destino, sin acentos.
    const q = buscar.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (q) {
      filtradas = filtradas.filter((r) => {
        const txt = `${r.ciudad} ${r.pais}`.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
        return txt.includes(q);
      });
    }
    // Orden: mayor descuento primero; si empatan, más reciente primero.
    return [...filtradas].sort((a, b) => {
      if (b.descuento !== a.descuento) return b.descuento - a.descuento;
      const ta = a.visto ? tsUTC(a.visto) : 0;
      const tb = b.visto ? tsUTC(b.visto) : 0;
      return tb - ta;
    });
  }, [data, filtro, buscar]);

  // Mejor precio y menor duracion POR DESTINO entre las tarjetas visibles.
  //
  // La comparacion se hace dentro del mismo destino a proposito: un vuelo de
  // 1h10 a Cartagena no compite con uno de 25h50 a Tokio, y un badge global de
  // "mas rapido" seria puro ruido. Solo se marca cuando hay al menos dos
  // tarjetas del mismo destino, porque con una sola no hay comparacion posible.
  //
  // Las duraciones solo existen en las filas escritas desde el 2026-07-26 (antes
  // se descartaba el dato que ya mandaba la API), asi que el badge de "mas
  // rapido" va apareciendo a medida que el cron reescribe el historial.
  const referencias = useMemo(() => {
    const porDestino = {};
    for (const r of rutas) {
      const d = r.destino;
      const dur = (Number(r.duracion_ida) || 0) + (Number(r.duracion_vuelta) || 0);
      const acc = (porDestino[d] ||= { n: 0, minPrecio: Infinity, minDur: Infinity });
      acc.n += 1;
      if (r.precio < acc.minPrecio) acc.minPrecio = r.precio;
      if (dur > 0 && dur < acc.minDur) acc.minDur = dur;
    }
    return porDestino;
  }, [rutas]);

  // Frescura GLOBAL: el escaneo mas reciente entre todas las rutas. Sirve para
  // el sello "actualizado hace X" del header (prueba social honesta de que
  // los precios son de hoy, no estimados).
  const ultimoEscaneo = useMemo(() => {
    let max = 0;
    for (const r of data?.rutas || []) {
      const ts = r.visto ? tsUTC(r.visto) : 0;
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
  // Escalas de un tramo. null/undefined = desconocido (filas viejas del
  // historial): se devuelve null para no afirmar que era directo.
  function textoEscalas(n) {
    if (n === null || n === undefined || Number.isNaN(Number(n))) return null;
    const k = Number(n);
    if (k === 0) return t("escalaDirecto");
    if (k === 1) return t("escalaUna");
    return t("escalaVarias").replace("{n}", k);
  }
  // Minutos de vuelo -> "25h50". Solo lo traen las filas escritas desde el
  // 2026-07-26, antes se descartaba el dato que ya mandaba la API.
  function fmtDuracion(min) {
    const m = Number(min);
    if (!Number.isFinite(m) || m <= 0) return null;
    return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
  }
  // "visto hace X" (frescura del precio) a partir del timestamp del último escaneo.
  function fmtHace(iso) {
    if (!iso) return "";
    const ms = Date.now() - tsUTC(iso);
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
          {!sinCabecera && (
            <>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-marca-500">
                {t("ofertasEyebrow")}
              </div>
              <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-marca-900 lg:text-[26px]">
                {t("ofertasTitulo")}
              </h2>
              <p className="mt-1 max-w-xl text-[13.5px] text-slate-500">{t("ofertasSub")}</p>
            </>
          )}
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
        <div className="flex gap-1 overflow-x-auto rounded-full bg-slate-100 p-1 dark:bg-slate-700">
          {[
            ["colombia", "Colombia"],
            ["BOG", origenes.BOG || "Bogotá"],
            ["MDE", origenes.MDE || "Medellín"],
            ["todos", t("ofertasTodos")],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => { setFiltro(k); setVisibles(LOTE); }}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${
                filtro === k ? "bg-white text-marca-700 shadow dark:bg-slate-600 dark:text-marca-300" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Buscador por ciudad destino */}
      <div className="mt-4 flex max-w-md items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 focus-within:border-marca-400 dark:border-slate-600 dark:bg-slate-800">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-slate-400">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={buscar}
          onChange={(e) => { setBuscar(e.target.value); setVisibles(LOTE); }}
          placeholder={t("ofertasBuscarCiudad")}
          className="w-full border-0 bg-transparent text-[14px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          aria-label={t("ofertasBuscarCiudad")}
        />
        {buscar && (
          <button type="button" onClick={() => setBuscar("")} className="text-slate-400 hover:text-slate-600" aria-label="Limpiar">✕</button>
        )}
      </div>

      {buscar.trim() && rutas.length === 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[13.5px] text-slate-500 dark:border-slate-700 dark:bg-slate-800">
          {t("ofertasBuscarSinResultados").replace("{q}", buscar.trim())}
        </div>
      )}

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
              {/* "Mas barato" / "Mas rapido" comparando SOLO contra las otras
                  tarjetas del mismo destino, y solo si hay mas de una: con una
                  sola tarjeta el badge no dice nada. */}
              {(() => {
                const ref = referencias[r.destino];
                if (!ref || ref.n < 2) return null;
                const dur = (Number(r.duracion_ida) || 0) + (Number(r.duracion_vuelta) || 0);
                const esBarato = r.precio === ref.minPrecio;
                const esRapido = dur > 0 && dur === ref.minDur;
                if (!esBarato && !esRapido) return null;
                return (
                  <div className="mb-0.5 flex flex-wrap gap-1">
                    {esBarato && (
                      <span className="whitespace-nowrap rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                        {t("ofertasBadgeBarato")}
                      </span>
                    )}
                    {esRapido && (
                      <span className="whitespace-nowrap rounded-full bg-sky-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
                        {t("ofertasBadgeRapido")}
                      </span>
                    )}
                  </div>
                );
              })()}
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
                {nombreAerolinea(r.aerolinea)}
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
                const min = Math.round((Date.now() - tsUTC(ts)) / 60000);
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

            {/* Escalas y duracion, para que estas tarjetas digan lo mismo que las
                del banner de alertas. Cada "Ida: 1 escala" va en un span
                whitespace-nowrap y el contenedor es flex-wrap, asi el salto de
                linea cae entre unidades y nunca parte la frase. */}
            {(() => {
              const escIda = textoEscalas(r.escalas_ida);
              const escVuelta = textoEscalas(r.escalas_vuelta);
              if (!escIda && !escVuelta) return null;
              const durIda = fmtDuracion(r.duracion_ida);
              const durVuelta = fmtDuracion(r.duracion_vuelta);
              const verde = "text-emerald-600 dark:text-emerald-400";
              return (
                <div className="mt-1.5 flex items-start gap-1.5 text-[12px] text-slate-500 dark:text-slate-400">
                  {/* Mismo SVG de tres puntos que usa la tarjeta de alertas
                      (no hay icono "dots" en Icono.js). */}
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-[3px] shrink-0 text-slate-400">
                    <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                  </svg>
                  <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {escIda && (
                      <span className="whitespace-nowrap">
                        {t("escalaIda")}: <b className={r.escalas_ida === 0 ? verde : ""}>{escIda}</b>
                        {durIda && <span className="text-slate-400"> · {durIda}</span>}
                      </span>
                    )}
                    {escIda && escVuelta && (
                      <span aria-hidden="true" className="text-slate-300 dark:text-slate-600">·</span>
                    )}
                    {escVuelta && (
                      <span className="whitespace-nowrap">
                        {t("escalaVuelta")}: <b className={r.escalas_vuelta === 0 ? verde : ""}>{escVuelta}</b>
                        {durVuelta && <span className="text-slate-400"> · {durVuelta}</span>}
                      </span>
                    )}
                  </span>
                </div>
              );
            })()}

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
          {t("ofertasActualizado")}: {new Date(tsUTC(data.generado)).toLocaleString(lang)} · {t("ofertasFuente")}
        </div>
      )}
    </section>
  );
}
