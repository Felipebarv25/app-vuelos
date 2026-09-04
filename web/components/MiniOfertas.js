"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icono } from "./Icono";
import Bandera from "./Bandera";
import { nombreAerolinea } from "@/lib/aerolineas";
import { obtenerTasas } from "@/lib/fx";
import { PAISES_ORIGEN } from "@/lib/paisesOrigen";
import { obtenerOfertas } from "@/lib/ofertasDatos";
import { obtenerGeo } from "@/lib/geo";

// Mini-preview de las 3 mejores ofertas que salen del pais del usuario.
// Misma lógica de ordenamiento que Ofertas.js: mayor descuento primero,
// desempatando por más reciente. Comparte la preferencia USD/COP del usuario
// vía localStorage (clave "anduve_moneda_vista").
export default function MiniOfertas({ onPlanear, t = (k) => k, lang = "es" }) {
  const [data, setData] = useState(null);
  const [paisUsuario, setPaisUsuario] = useState("");
  const [copPorUsd, setCopPorUsd] = useState(4000);
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

  // Pais del usuario: su eleccion guardada primero, si no la geolocalizacion.
  useEffect(() => {
    let vivo = true;
    let guardado = "";
    try { guardado = localStorage.getItem("anduve_pais_origen") || ""; } catch {}
    if (guardado) { setPaisUsuario(guardado); return; }
    obtenerGeo()
      .then((g) => { if (vivo && g?.pais) setPaisUsuario(g.pais); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    obtenerTasas().then((r) => vivo && r?.porUsd?.COP && setCopPorUsd(r.porUsd.COP));
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    let vivo = true;
    obtenerOfertas().then((d) => { if (vivo) setData(d); });
    return () => { vivo = false; };
  }, []);

  const top3 = useMemo(() => {
    // Antes esto era `r.origen === "BOG" || r.origen === "MDE"`, que tiraba el
    // 81% de las rutas y le mostraba vuelos desde Colombia a un usuario de
    // cualquier otro pais. Ahora se filtra por los hubs del pais del usuario, y
    // si su pais no tiene rutas detectadas se muestran todas en vez de dejar el
    // banner vacio (el `return null` de abajo lo hacia desaparecer entero).
    const todas = data?.rutas || [];
    const hubs = (PAISES_ORIGEN[paisUsuario]?.hubs || []).map((h) => h.iata);
    const propias = hubs.length ? todas.filter((r) => hubs.includes(r.origen)) : [];
    const list = propias.length ? propias : todas;
    return [...list]
      .sort((a, b) => {
        if (b.descuento !== a.descuento) return b.descuento - a.descuento;
        const ta = a.visto ? new Date(a.visto).getTime() : 0;
        const tb = b.visto ? new Date(b.visto).getTime() : 0;
        return tb - ta;
      })
      .slice(0, 3);
  }, [data, paisUsuario]);

  if (!data || !top3.length) return null;

  const origenes = data.origenes || { BOG: "Bogotá", MDE: "Medellín" };

  function fmtFecha(iso) {
    if (!iso) return "";
    return new Date(iso + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" });
  }
  function fmtUsd(v) {
    return "US$ " + Math.round(v).toLocaleString("en-US");
  }
  function fmtCop(v) {
    return "≈ $ " + Math.round(v * copPorUsd).toLocaleString("es-CO") + " COP";
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-marca-500">
            {t("ofertasEyebrow")}
          </div>
          <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-marca-900 dark:text-slate-100 lg:text-[26px]">
            {t("ofertasTitulo")}
          </h2>
        </div>
        <div className="flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-700">
          {["USD", "COP"].map((m) => (
            <button
              key={m}
              onClick={() => cambiarMonedaVista(m)}
              className={`rounded-full px-3 py-1 text-[12px] font-bold transition ${
                monedaVista === m
                  ? "bg-white text-marca-700 shadow-sm dark:bg-slate-600 dark:text-marca-300"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {top3.map((r) => (
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
{/* PNG y no el emoji de `r.bandera`: en Windows salia "co Cartagena". */}
              <span className="inline-flex items-center gap-1.5">
                <Bandera cc={r.iso} size={14} />
                {r.ciudad}
              </span>
            </div>
            <div className="mt-2 flex items-end gap-2">
              <div className="text-[26px] font-extrabold leading-none text-marca-900 dark:text-slate-100">
                {monedaVista === "COP" ? fmtCop(r.precio) : fmtUsd(r.precio)}
              </div>
              {r.descuento > 0 && (
                <div className="mb-0.5 text-[12px] font-bold text-emerald-600">
                  −{r.descuento}%
                </div>
              )}
            </div>
            <div className="text-[12px] text-slate-400">{t("ofertasIdaVuelta")}</div>
            <div className="text-[12px] font-medium text-slate-500">
              {monedaVista === "COP" ? fmtUsd(r.precio) : fmtCop(r.precio)}
              <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {t("ofertasAproxBadge")}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
              <Icono nombre="calendar" size={13} />
              {fmtFecha(r.fecha_ida)} – {fmtFecha(r.fecha_vuelta)}
              <span className="text-slate-300">·</span>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                {/* El nombre, no el codigo: aqui decia "CM" y en /ofertas "Copa". */}
                {nombreAerolinea(r.aerolinea)}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => onPlanear?.(r.q)}
                className="flex-1 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-2.5 text-[13px] font-bold text-white shadow-marca transition hover:brightness-105"
              >
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Icono nombre="map" size={15} /> {t("ofertasPlanear")}
                </span>
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
          </div>
        ))}
      </div>

      <div className="mt-5 text-center">
        <Link
          href="/ofertas"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-[13.5px] font-semibold text-marca-700 shadow-suave transition hover:border-marca-200 hover:bg-marca-50 dark:border-slate-700 dark:bg-slate-800 dark:text-marca-300 dark:hover:border-marca-700"
        >
          {t("ofertasVerTodas")} <Icono nombre="arrowRight" size={15} />
        </Link>
      </div>
    </section>
  );
}
