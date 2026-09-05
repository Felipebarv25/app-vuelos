"use client";
// El pasaporte: el mundo apagado, y encendido lo que ya conociste.
//
// No es un formulario, es un marcador. La diferencia manda en todas las
// decisiones de aqui:
//
//   - Lo primero que se ve es el MAPA con las cifras encima. Un contador que
//     sube, y un mundo que se enciende, es lo que convierte una lista en un
//     logro.
//   - Los paises viven en un RIEL al costado del mapa, no en fichas debajo.
//     Las fichas de 86 px hacian bulto: con diez paises la tarjeta se volvia
//     una cuadricula de banderas con un mapa de sombrero. En el costado la
//     lista acompana al mapa —que es lo mismo dicho de otra forma— y la
//     tarjeta conserva su altura crezca lo que crezca la coleccion.
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
import { cargarPasaporte, guardarPasaporte } from "@/lib/pasaporte";
import MapaPasaporte from "./MapaPasaporte";


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
  // la lista se reordenaba sola al anadir una ciudad, justo cuando el usuario
  // esta mirando una bandera concreta.
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

  // EL RIEL. Se le pasa al mapa y se pinta dentro de su misma zona oscura: en
  // escritorio como columna a la derecha, en movil como tira debajo. Por eso
  // las banderas bajan de 34 px a 20: aqui la bandera identifica la fila, no
  // es la protagonista — la protagonista es el mapa.
  //
  // Con scroll propio y altura tope: quien lleve cuarenta paises hace scroll
  // dentro de la lista, no empuja media pagina hacia abajo.
  const riel = (
    <div className="flex h-full flex-col gap-2.5 px-5 py-4 sm:px-6 lg:p-3.5">
      <SelectorPais
        value=""
        onChange={agregarPais}
        etiqueta="paisesAgregar"
        className="self-start lg:self-end"
      />

      {n === 0 ? (
        <p className="text-[11.5px] leading-snug text-white/50">{t("paisesVacio")}</p>
      ) : (
        <div className="flex max-h-[112px] flex-wrap gap-1.5 overflow-y-auto pr-0.5 lg:max-h-[228px] lg:flex-col lg:flex-nowrap">
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
                className={`flex shrink-0 items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-left transition lg:w-full ${
                  activo
                    ? "bg-white/15 ring-1 ring-white/45"
                    : "ring-1 ring-white/10 hover:bg-white/10"
                } ${celebrando === cc ? "animate-pop-bandera" : ""}`}
              >
                <Bandera cc={cc} size={20} />
                <span className="max-w-[92px] truncate text-[12px] font-semibold text-white/90 lg:max-w-none lg:flex-1">
                  {nombrePaisMostrar(cc, lang)}
                </span>
                {cuantas > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 text-[10px] font-bold leading-[16px] text-white">
                    {cuantas}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <section className="mb-12">
      <div className="overflow-hidden rounded-2xl border border-marca-100 bg-white shadow-card dark:border-marca-800 dark:bg-slate-800">
        {/* EL MUNDO, apagado y encendido, con el riel de paises al costado.
            Dice lo mismo que la vieja cabecera de cifras —paises, ciudades,
            porcentaje— y ademas ensena DONDE, que es lo que una cuadricula de
            banderas no puede. */}
        <MapaPasaporte
          paises={paises}
          lang={lang}
          t={t}
          activo={abierto}
          onTocarPais={(cc) => { setAbierto(abierto === cc ? null : cc); setNueva(""); }}
          lateral={riel}
        />

        {/* El cuerpo blanco ya solo sirve para ESCRIBIR: el pais abierto y sus
            ciudades. Sin nada abierto es una linea de pista, no un bloque. */}
        {abierto && paises[abierto] ? (
          <div className="p-5 sm:p-6">
            <div className="animar-subir rounded-xl border border-marca-100 bg-marca-50/50 p-4 dark:border-marca-800 dark:bg-marca-900/20">
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
          </div>
        ) : (
          n > 0 && (
            <p className="px-5 py-3.5 text-[12.5px] text-slate-500 sm:px-6 dark:text-slate-400">
              {t("paisesSub")}
            </p>
          )
        )}
      </div>
    </section>
  );
}
