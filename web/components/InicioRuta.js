"use client";
// "¿Dónde te hospedas?" — punto de partida de la ruta (request 2026-07-11:
// "si mi hotel está en X, que defina la ruta desde ahí para ahorrar tiempos").
// Autocompletado con Photon (Komoot, gratis, CORS abierto) SESGADO a la
// ciudad abierta: escribir "Suances" u "Hotel Riu" trae resultados cerca.
// Al elegir, el itinerario se rearma desde ese punto (el motor ya soporta
// `inicio`; antes solo se alimentaba con GPS o centro de la ciudad).
//
// Rediseño 2026-07-13 (feedback: "escribo y no pasa nada"):
//   - Las DIRECCIONES de Photon vienen sin `name` (solo street+housenumber)
//     y se descartaban todas -> ahora se componen y aparecen.
//   - Buscar sin resultados ya no es silencio: mensaje con alternativas.
//   - Dos vías nuevas: GPS ("usar mi ubicación") y elegir el punto con un
//     clic/tap en el mapa (modo que activa el padre via onElegirEnMapa).
//
//   <InicioRuta ciudad={ciudad} hospedaje={h} onElegir={(h) => ...}
//               onQuitar={() => ...} onElegirEnMapa={() => ...} t={t} />

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { Icono } from "./Icono";

// Nombre presentable de un feature de Photon. Las direcciones exactas
// ("Calle 10 # 43-20") NO traen `name`: se arma con calle + número.
function nombreDeFeature(p) {
  if (p.name) return p.name;
  if (p.street) return [p.street, p.housenumber].filter(Boolean).join(" ");
  return p.district || p.city || null;
}

export default function InicioRuta({ ciudad, hospedaje, onElegir, onQuitar, onElegirEnMapa, t = (k) => k }) {
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [aviso, setAviso] = useState(null); // GPS lejos / sin permiso
  const [buscandoGps, setBuscandoGps] = useState(false);
  const debounce = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (q.trim().length < 3 || !ciudad) { setSugs([]); setSinResultados(false); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${ciudad.lat}&lon=${ciudad.lon}&limit=8&zoom=14`
        );
        if (!r.ok) { setSinResultados(true); return; }
        const d = await r.json();
        const vistos = new Set();
        const out = [];
        for (const f of d?.features || []) {
          const [lon, lat] = f.geometry?.coordinates || [];
          const p = f.properties || {};
          const nombre = nombreDeFeature(p);
          if (lat == null || lon == null || !nombre) continue;
          // Solo resultados razonablemente cerca de la ciudad (~60 km).
          if (Math.hypot(lat - ciudad.lat, lon - ciudad.lon) > 0.6) continue;
          const detalle = [p.name ? p.street : null, p.district || p.city].filter(Boolean).join(", ");
          const key = `${nombre}|${detalle}`;
          if (vistos.has(key)) continue;
          vistos.add(key);
          out.push({ nombre, detalle, lat, lon });
          if (out.length >= 5) break;
        }
        setSugs(out);
        setAbierto(out.length > 0);
        // Nada cerca: decirlo (antes era silencio y parecia roto).
        setSinResultados(out.length === 0);
      } catch {
        setSinResultados(true);
      }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q, ciudad?.lat, ciudad?.lon]);

  function elegir(h, origen) {
    track("hospedaje_set", { ciudad: ciudad?.nombre, lugar: h.nombre, origen });
    onElegir?.(h);
    setQ("");
    setAbierto(false);
    setSinResultados(false);
    setAviso(null);
  }

  // GPS de una sola lectura: "la ruta arranca desde donde estoy parado".
  function usarGps() {
    setAviso(null);
    if (!navigator.geolocation) { setAviso(t("hospedajeGpsError")); return; }
    setBuscandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setBuscandoGps(false);
        const { latitude: lat, longitude: lon } = p.coords;
        // Un GPS a >60 km de la ciudad no sirve como inicio de ESTA ruta.
        if (ciudad && Math.hypot(lat - ciudad.lat, lon - ciudad.lon) > 0.6) {
          setAviso(t("hospedajeGpsLejos", { ciudad: ciudad?.nombre || "" }));
          return;
        }
        elegir({ nombre: t("hospedajeMiUbicacion"), lat, lon, gps: true }, "gps");
      },
      () => { setBuscandoGps(false); setAviso(t("hospedajeGpsError")); },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 12000 }
    );
  }

  // Ya hay hospedaje elegido: chip con opción de quitar.
  if (hospedaje) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-marca-600 py-1.5 pl-3 pr-1.5 text-[12.5px] font-bold text-white">
          {hospedaje.gps ? "📍" : "🏨"} <span className="truncate">{t("hospedajeDesde")} {hospedaje.nombre}</span>
          <button
            type="button"
            onClick={onQuitar}
            aria-label="Quitar hospedaje"
            className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 hover:bg-white/35"
          >
            <Icono nombre="x" size={12} />
          </button>
        </span>
        <span className="text-[11.5px] text-slate-500">{t("hospedajeNota")}</span>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:border-marca-400 dark:border-slate-600 dark:bg-slate-800">
        <span className="text-[15px]">🏨</span>
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setAviso(null); }}
          onFocus={() => sugs.length && setAbierto(true)}
          placeholder={t("hospedajePlaceholder")}
          className="w-full border-0 bg-transparent text-[13.5px] outline-none placeholder:text-slate-400 dark:text-slate-100"
          aria-label={t("hospedajeLabel")}
        />
      </div>

      {/* Vías alternas: GPS y clic en el mapa (pedido 2026-07-13). */}
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={usarGps}
          disabled={buscandoGps}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 transition hover:border-marca-300 hover:text-marca-700 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300"
        >
          {buscandoGps ? <span className="spin" /> : "📍"} {t("hospedajeGps")}
        </button>
        {onElegirEnMapa && (
          <button
            type="button"
            onClick={() => { setAviso(null); onElegirEnMapa(); }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[12px] font-bold text-slate-600 transition hover:border-marca-300 hover:text-marca-700 dark:border-slate-600 dark:text-slate-300"
          >
            🗺️ {t("hospedajeMapa")}
          </button>
        )}
      </div>

      {aviso && (
        <div className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
          {aviso}
        </div>
      )}
      {sinResultados && q.trim().length >= 3 && !abierto && (
        <div className="mt-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11.5px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          {t("hospedajeVacio", { ciudad: ciudad?.nombre || "" })}
        </div>
      )}

      {abierto && sugs.length > 0 && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          {sugs.map((s, i) => (
            <button
              key={`${s.lat}-${s.lon}-${i}`}
              type="button"
              onClick={() => elegir(s, "buscador")}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition hover:bg-marca-50 dark:hover:bg-slate-700"
            >
              <Icono nombre="pin" size={14} className="shrink-0 text-marca-500" />
              <span className="min-w-0">
                <span className="block truncate text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{s.nombre}</span>
                {s.detalle && <span className="block truncate text-[11.5px] text-slate-400">{s.detalle}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
