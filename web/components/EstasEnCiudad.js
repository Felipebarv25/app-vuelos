"use client";
// "Estás en {ciudad}" — entrada directa para armar la ruta de visita de la
// ciudad donde el usuario esta AHORA (request 2026-07-11: "si estoy en
// Medellín, que me genere la ruta como lo haciamos antes").
//
// La ciudad sale de /api/geo (header x-vercel-ip-city, sin pedir permiso de
// GPS). Un tap dispara el motor de itinerarios existente via onCrear(q) con
// "Ciudad, Pais". Si la IP falla o el usuario no esta ahi, el link "¿No
// estas en X?" enfoca el buscador manual.
//
//   <EstasEnCiudad t={t} onCrear={(q) => pruebaRapida({ q, dias: 1 })}
//                  onCorregir={() => enfocarBuscador()} />

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { Icono } from "./Icono";

// ISO -> nombre del pais para armar el query "Medellín, Colombia" que el
// geocodificador resuelve sin ambiguedad.
const PAIS_NOMBRE = {
  CO: "Colombia", MX: "México", EC: "Ecuador", PE: "Perú", CL: "Chile",
  AR: "Argentina", BR: "Brasil", VE: "Venezuela", ES: "España",
  US: "Estados Unidos", PA: "Panamá", CR: "Costa Rica", UY: "Uruguay",
  BO: "Bolivia", PY: "Paraguay", GT: "Guatemala", DO: "República Dominicana",
  CA: "Canadá", GB: "Reino Unido", FR: "Francia", DE: "Alemania", IT: "Italia",
  PT: "Portugal", NL: "Países Bajos",
};

export default function EstasEnCiudad({ t = (k) => k, onCrear, onCorregir = null }) {
  const [geo, setGeo] = useState(null); // { ciudad, pais } | null

  useEffect(() => {
    let vivo = true;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!vivo || !g?.ciudad) return;
        setGeo({ ciudad: g.ciudad, pais: PAIS_NOMBRE[g.pais] || "" });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!geo) return null; // sin ciudad detectada: no ocupar espacio

  const q = geo.pais ? `${geo.ciudad}, ${geo.pais}` : geo.ciudad;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-marca-100 bg-gradient-to-r from-marca-50 to-teal-50/60 px-4 py-3.5 dark:border-marca-800 dark:from-marca-900/25 dark:to-teal-900/15">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca-600 text-white shadow-marca">
        <Icono nombre="pin" size={18} />
        <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-extrabold text-marca-900 dark:text-marca-200">
          {t("estasEnTit").replace("{ciudad}", geo.ciudad)}
        </div>
        <div className="text-[12.5px] text-slate-600 dark:text-slate-400">
          {t("estasEnSub")}
          {onCorregir && (
            <>
              {" "}
              <button
                type="button"
                onClick={onCorregir}
                className="font-semibold text-marca-600 underline-offset-2 hover:underline dark:text-marca-300"
              >
                {t("estasEnNo").replace("{ciudad}", geo.ciudad)}
              </button>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          track("estas_en_ruta", { ciudad: geo.ciudad });
          onCrear?.(q);
        }}
        className="shrink-0 rounded-xl bg-marca-700 px-4 py-2.5 text-[13.5px] font-bold text-white shadow-marca transition hover:bg-marca-800"
      >
        <span className="inline-flex items-center gap-1.5">
          <Icono nombre="map" size={15} /> {t("estasEnCta")}
        </span>
      </button>
    </div>
  );
}
