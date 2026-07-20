"use client";
// "Estás en {ciudad}" v2 — hub de la ciudad ACTUAL (2026-07-11).
// Detecta la ciudad por IP (sin permiso GPS) y ofrece:
//   1. RUTA de hoy (motor de itinerarios, 1 dia, nocturno si ya es de noche)
//   2. EVENTOS de hoy/fechas (Anduve Live: yo voy + chat)
//   3. MUSICA local (cancion emblema -> Spotify)
//
//   <EstasEnCiudad t={t} onCrear={(q) => ...} onEventos={(geo) => ...}
//                  onCorregir={() => ...} />

import { useEffect, useState } from "react";
import { track } from "@/lib/track";
import { musicaPara, linkSpotify } from "@/lib/musica";
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

export default function EstasEnCiudad({ t = (k) => k, onCrear, onEventos = null, onCorregir = null }) {
  const [geo, setGeo] = useState(null); // { ciudad, pais, iso } | null

  useEffect(() => {
    let vivo = true;
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!vivo || !g?.ciudad) return;
        setGeo({ ciudad: g.ciudad, pais: PAIS_NOMBRE[g.pais] || "", iso: g.pais || "" });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  if (!geo) return null; // sin ciudad detectada: no ocupar espacio

  const q = geo.pais ? `${geo.ciudad}, ${geo.pais}` : geo.ciudad;
  // Musica local de la ciudad actual (cancion emblema). Best-effort: si el
  // catalogo no tiene la ciudad/pais, la linea no aparece.
  const musica = musicaPara(geo.ciudad, geo.pais || geo.iso);

  function crearRuta() {
    track("estas_en_ruta", { ciudad: geo.ciudad });
    // Si ya es de noche, la ruta de HOY sale nocturna (bares, miradores)
    // en vez de museos cerrados.
    const nocturno = new Date().getHours() >= 18;
    onCrear?.(q, nocturno ? "nocturno" : "diurno");
  }

  return (
    <div className="mt-4 rounded-2xl border border-marca-100 bg-gradient-to-r from-marca-50 to-teal-50/60 px-4 py-3.5 dark:border-marca-800 dark:from-marca-900/25 dark:to-teal-900/15">
      <div className="flex flex-wrap items-center gap-3">
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
          {musica?.emblema && (
            <button
              type="button"
              onClick={() => {
                track("estas_en_musica", { ciudad: geo.ciudad });
                window.open(linkSpotify(`${musica.emblema.c} ${musica.emblema.a}`), "_blank", "noopener");
              }}
              className="mt-1.5 inline-flex max-w-full items-center gap-1 text-[11px] text-slate-500 transition hover:text-marca-700 dark:text-slate-400 dark:hover:text-marca-300"
            >
              <Icono nombre="music" size={11} />
              <span className="truncate">
                {t("estasEnMusica")} {musica.emblema.c} — {musica.emblema.a}
              </span>
              <span className="shrink-0 text-[#1DB954]">▶</span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={crearRuta}
            className="rounded-xl bg-marca-700 px-4 py-2.5 text-[13.5px] font-bold text-white shadow-marca transition hover:bg-marca-800"
          >
            <span className="inline-flex items-center gap-1.5">
              <Icono nombre="map" size={15} /> {t("estasEnCta")}
            </span>
          </button>
          {onEventos && (
            <button
              type="button"
              onClick={() => { track("estas_en_eventos", { ciudad: geo.ciudad }); onEventos(geo); }}
              className="rounded-xl border-2 border-marca-600 bg-white px-4 py-2 text-[13.5px] font-bold text-marca-700 transition hover:bg-marca-50 dark:bg-slate-800 dark:text-marca-300 dark:hover:bg-slate-700"
            >
              🎟️ {t("estasEnEventos")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
