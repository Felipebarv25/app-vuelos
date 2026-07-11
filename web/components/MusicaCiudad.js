"use client";
// "La banda sonora de tu viaje" — modulo de musica por ciudad (2026-07-11).
// Tres capas: artistas LOCALES curados + Top 50 del pais (tendencia, la cura
// Spotify a diario) + vibe de temporada segun tags de la ciudad y estacion
// en el destino. Todo deep links (cero APIs, cero costo, cero audio propio).
//
//   <MusicaCiudad ciudad="Madrid" pais="España" mesViaje={9} t={t} />

import { musicaPara, linkSpotify, linkYouTube } from "@/lib/musica";
import { track } from "@/lib/track";
import { Icono } from "./Icono";

// Fallback en español si no llega `t` (paginas SSR de /destino) o si la key
// no existe. Leccion del bug del trial (claves i18n crudas en produccion):
// NUNCA renderizar la key tal cual.
const FALLBACK_ES = {
  musicaEyebrow: "Banda sonora de tu viaje",
  musicaTitulo: "Suena en {ciudad}",
  musicaEmblema: "La canción",
  musicaTop: "Lo que suena ahora: Top 50 {pais}",
  musicaVibePlaya: "Para tus días de playa",
  musicaVibeInvierno: "Para el frío del viaje",
  musicaVibeRomantico: "Para una cena romántica",
  musicaVibeNocturna: "Para la noche",
  musicaVibeHistoria: "Clásica para pasear",
  musicaVibeNaturaleza: "Acústica para el paisaje",
};

export default function MusicaCiudad({ ciudad, pais, mesViaje = null, t = null }) {
  const m = musicaPara(ciudad, pais, mesViaje);
  if (!m || (!m.artistas.length && !m.emblema)) return null;

  // t con red de seguridad: si la traduccion devuelve la key cruda o no hay
  // t, cae al español.
  function tt(k) {
    const v = t ? t(k) : null;
    return v && v !== k ? v : (FALLBACK_ES[k] || k);
  }

  function abrir(url, tipo, extra = {}) {
    track("musica_click", { ciudad, tipo, ...extra });
    window.open(url, "_blank", "noopener");
  }

  return (
    <section className="mt-6 rounded-2xl border border-slate-100 bg-white p-5 shadow-suave dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-50 text-marca-700 dark:bg-marca-900/30 dark:text-marca-300">
          <Icono nombre="music" size={18} />
        </span>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-marca-600 dark:text-marca-300">
            {tt("musicaEyebrow")}
          </div>
          <h3 className="text-[16px] font-extrabold tracking-tight text-marca-900 dark:text-slate-100">
            {tt("musicaTitulo").replace("{ciudad}", ciudad)}
            {m.genero && <span className="ml-2 text-[12px] font-semibold text-slate-400">{m.genero}</span>}
          </h3>
        </div>
      </div>

      {/* Artistas locales: chips clickables -> Spotify */}
      {m.artistas.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {m.artistas.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => abrir(linkSpotify(a), "artista", { artista: a })}
              className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12.5px] font-semibold text-slate-700 transition hover:border-marca-300 hover:bg-marca-50 hover:text-marca-800 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:border-marca-500"
            >
              {a}
            </button>
          ))}
        </div>
      )}

      {/* Cancion emblema */}
      {m.emblema && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gradient-to-r from-marca-50 to-marca-100/50 px-4 py-3 dark:from-marca-900/30 dark:to-marca-800/20">
          <div className="min-w-0">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-marca-600 dark:text-marca-300">
              {tt("musicaEmblema")}
            </div>
            <div className="truncate text-[14px] font-extrabold text-marca-900 dark:text-slate-100">
              "{m.emblema.c}" <span className="font-semibold text-slate-500 dark:text-slate-400">— {m.emblema.a}</span>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              type="button"
              onClick={() => abrir(linkSpotify(`${m.emblema.c} ${m.emblema.a}`), "emblema_spotify")}
              className="rounded-full bg-[#1DB954] px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:brightness-110"
            >
              Spotify
            </button>
            <button
              type="button"
              onClick={() => abrir(linkYouTube(`${m.emblema.c} ${m.emblema.a}`), "emblema_youtube")}
              className="rounded-full bg-[#FF0000] px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:brightness-110"
            >
              YouTube
            </button>
          </div>
        </div>
      )}

      {/* Tendencia + vibe de temporada */}
      <div className="mt-3 flex flex-wrap gap-2">
        {m.top && (
          <button
            type="button"
            onClick={() => abrir(m.top.url, "top50")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-bold text-slate-700 transition hover:border-marca-300 hover:text-marca-800 dark:border-slate-600 dark:text-slate-300"
          >
            🔥 {tt("musicaTop").replace("{pais}", m.top.label)}
          </button>
        )}
        {m.vibe && (
          <button
            type="button"
            onClick={() => abrir(linkSpotify(m.vibe.q), "vibe", { vibe: m.vibe.labelKey })}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-[12.5px] font-bold text-slate-700 transition hover:border-marca-300 hover:text-marca-800 dark:border-slate-600 dark:text-slate-300"
          >
            {m.vibe.icono} {tt(m.vibe.labelKey)}
          </button>
        )}
      </div>
    </section>
  );
}
