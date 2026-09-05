"use client";
// El pasaporte: las banderas de los paises que el viajero ya conocio.
//
// No es un formulario, es un marcador. La diferencia manda en todas las
// decisiones de aqui:
//
//   - Lo primero que se ve es el NUMERO, grande, con su barra hacia 195. Un
//     contador que sube es lo que convierte una lista en un logro.
//   - Las banderas van en cuadricula y a buen tamano, no en una lista de
//     texto. Se reconocen de un vistazo y se disfrutan.
//   - Anadir un pais dispara un destello corto en su bandera. Es el unico
//     momento de celebracion que tiene la app y cuesta doce lineas de CSS.
//   - Las ciudades se escriben DENTRO del pais, al tocarlo, y no en un campo
//     aparte: primero el hito (el pais), despues el detalle.
//
// Guarda en la cuenta via lib/pasaporte, con el navegador de respaldo, asi que
// quien todavia no ha entrado tambien puede empezar y no pierde nada al
// registrarse: al iniciar sesion los dos lados se fusionan.

import { useEffect, useMemo, useRef, useState } from "react";
import Bandera from "./Bandera";
import SelectorPais from "./SelectorPais";
import { Icono } from "./Icono";
import { nombrePaisMostrar } from "@/lib/paisesNombres";
import { cargarPasaporte, guardarPasaporte, contarCiudades } from "@/lib/pasaporte";

const TOTAL_PAISES = 195; // estados miembros de la ONU

const sinTildes = (s) =>
  String(s || "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export default function Pasaporte({ t, lang = "es", usuario = null }) {
  const [paises, setPaises] = useState(null); // null = todavia cargando
  const [abierto, setAbierto] = useState(null); // ISO del pais desplegado
  const [nueva, setNueva] = useState("");
  const [celebrando, setCelebrando] = useState(null);
  const inputCiudad = useRef(null);

  useEffect(() => {
    let vivo = true;
    cargarPasaporte(usuario).then((r) => {
      if (vivo) setPaises(r.paises);
    });
    return () => {
      vivo = false;
    };
  }, [usuario]);

  // Orden estable: por fecha de registro y, a igualdad, alfabetico. Sin esto
  // la cuadricula se reordenaba sola al anadir una ciudad, justo cuando el
  // usuario esta mirando una bandera concreta.
  const orden = useMemo(() => {
    if (!paises) return [];
    return Object.entries(paises)
      .sort(
        (a, b) =>
          (a[1].desde || "").localeCompare(b[1].desde || "") ||
          nombrePaisMostrar(a[0], lang).localeCompare(nombrePaisMostrar(b[0], lang))
      )
      .map(([cc]) => cc);
  }, [paises, lang]);

  function persistir(siguiente) {
    setPaises(siguiente);
    guardarPasaporte(usuario, siguiente);
  }

  function agregarPais(iso) {
    const cc = String(iso || "").toLowerCase();
    if (!/^[a-z]{2}$/.test(cc) || paises?.[cc]) return;
    persistir({
      ...paises,
      [cc]: { desde: new Date().toISOString().slice(0, 10), ciudades: [] },
    });
    setCelebrando(cc);
    setTimeout(() => setCelebrando(null), 900);
    setAbierto(cc);
    setNueva("");
  }

  function quitarPais(cc) {
    const siguiente = { ...paises };
    delete siguiente[cc];
    persistir(siguiente);
    setAbierto(null);
  }

  function agregarCiudad(cc) {
    const nombre = nueva.trim();
    if (!nombre) return;
    const actual = paises[cc]?.ciudades || [];
    // "Medellin" despues de "Medellín" no son dos ciudades.
    if (!actual.some((c) => sinTildes(c) === sinTildes(nombre))) {
      persistir({ ...paises, [cc]: { ...paises[cc], ciudades: [...actual, nombre] } });
    }
    setNueva("");
    inputCiudad.current?.focus();
  }

  function quitarCiudad(cc, i) {
    const ciudades = (paises[cc]?.ciudades || []).filter((_, j) => j !== i);
    persistir({ ...paises, [cc]: { ...paises[cc], ciudades } });
  }

  if (paises === null) {
    return (
      <section className="mb-12">
        <div
          aria-busy="true"
          className="h-44 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
        />
      </section>
    );
  }

  const n = orden.length;
  // Minimo visible: con un solo pais la barra seria medio pixel y pareceria
  // rota. El punto es ver que se avanza, no medir con precision.
  const pct = n ? Math.max(1.5, (n / TOTAL_PAISES) * 100) : 0;
  const ciudades = contarCiudades(paises);

  return (
    <section className="mb-12">
      <div className="overflow-hidden rounded-2xl border border-marca-100 bg-white shadow-card dark:border-marca-800 dark:bg-slate-800">
        {/* Cabecera: el numero manda */}
        <div className="bg-gradient-to-br from-marca-800 via-marca-600 to-emerald-500 px-5 py-5 text-white sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">
                {t("paisesTit")}
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-[38px] font-extrabold leading-none tabular-nums">{n}</span>
                <span className="text-[13.5px] text-white/80">
                  {t("paisesContador").replace("{n}", n)}
                </span>
              </div>
              {ciudades > 0 && (
                <div className="mt-1 text-[12.5px] text-white/70">
                  {t("paisesCiudadesContador").replace("{n}", ciudades)}
                </div>
              )}
            </div>
            {/* value="" a proposito: no representa una seleccion actual sino un
                sitio donde anadir. Se limpia solo tras cada eleccion. */}
            <SelectorPais value="" onChange={agregarPais} etiqueta="paisesAgregar" className="shrink-0" />
          </div>

          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
            <div
              className="h-full rounded-full bg-white/90 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <p className="text-[13px] text-slate-500 dark:text-slate-400">{t("paisesSub")}</p>

          {n === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
              {t("paisesVacio")}
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2.5">
              {orden.map((cc) => {
                const activo = abierto === cc;
                const cuantas = paises[cc]?.ciudades?.length || 0;
                return (
                  <button
                    key={cc}
                    type="button"
                    onClick={() => {
                      setAbierto(activo ? null : cc);
                      setNueva("");
                    }}
                    aria-expanded={activo}
                    aria-label={`${nombrePaisMostrar(cc, lang)}${cuantas ? ` — ${cuantas}` : ""}`}
                    className={`relative flex w-[86px] flex-col items-center gap-1.5 rounded-xl border-2 px-2 py-2.5 transition ${
                      activo
                        ? "border-marca-500 bg-marca-50 dark:bg-marca-900/30"
                        : "border-slate-200 hover:border-marca-300 dark:border-slate-700"
                    } ${celebrando === cc ? "animate-pop-bandera" : ""}`}
                  >
                    <Bandera cc={cc} size={34} />
                    <span className="w-full truncate text-[11.5px] font-semibold text-slate-700 dark:text-slate-200">
                      {nombrePaisMostrar(cc, lang)}
                    </span>
                    {cuantas > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-marca-600 px-1 text-[10.5px] font-bold text-white">
                        {cuantas}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Detalle del pais tocado: sus ciudades */}
          {abierto && paises[abierto] && (
            <div className="animar-subir mt-4 rounded-xl border border-marca-100 bg-marca-50/50 p-4 dark:border-marca-800 dark:bg-marca-900/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Bandera cc={abierto} size={22} />
                  <span className="text-[14.5px] font-extrabold text-marca-900 dark:text-marca-200">
                    {nombrePaisMostrar(abierto, lang)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => quitarPais(abierto)}
                  className="text-[12px] font-semibold text-slate-500 underline underline-offset-2 transition hover:text-red-600 dark:text-slate-400"
                >
                  {t("paisesQuitar")}
                </button>
              </div>

              <div className="mt-2 text-[11.5px] font-bold uppercase tracking-wide text-slate-400">
                {t("paisesCiudades")}
              </div>

              {(paises[abierto].ciudades || []).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {paises[abierto].ciudades.map((c, i) => (
                    <span
                      key={c + i}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12.5px] font-medium text-marca-800 ring-1 ring-marca-100 dark:bg-slate-700 dark:text-marca-200 dark:ring-slate-600"
                    >
                      {c}
                      <button
                        type="button"
                        onClick={() => quitarCiudad(abierto, i)}
                        aria-label={`${t("paisesQuitar")}: ${c}`}
                        className="text-slate-300 transition hover:text-red-500"
                      >
                        <Icono nombre="x" size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-2.5 flex gap-2">
                {/* 16px en movil: por debajo de eso iOS hace zoom al enfocar y
                    saca la tarjeta de la pantalla. */}
                <input
                  ref={inputCiudad}
                  type="text"
                  value={nueva}
                  onChange={(e) => setNueva(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarCiudad(abierto);
                    }
                  }}
                  placeholder={t("paisesCiudadPlaceholder")}
                  aria-label={t("paisesCiudades")}
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[16px] outline-none focus:border-marca-500 sm:text-[13.5px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={() => agregarCiudad(abierto)}
                  disabled={!nueva.trim()}
                  aria-label={t("paisesCiudades")}
                  className="shrink-0 rounded-lg bg-marca-700 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-marca-800 disabled:opacity-40"
                >
                  <Icono nombre="plus" size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
