"use client";
// "¿Dónde te hospedas?" — punto de partida de la ruta (request 2026-07-11:
// "si mi hotel está en X, que defina la ruta desde ahí para ahorrar tiempos").
// Autocompletado con Photon (Komoot, gratis, CORS abierto) SESGADO a la
// ciudad abierta: escribir "Suances" u "Hotel Riu" trae resultados cerca.
// Al elegir, el itinerario se rearma desde ese punto (el motor ya soporta
// `inicio`; antes solo se alimentaba con GPS o centro de la ciudad).
//
//   <InicioRuta ciudad={ciudad} hospedaje={h} onElegir={(h) => ...}
//               onQuitar={() => ...} t={t} />

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { Icono } from "./Icono";

export default function InicioRuta({ ciudad, hospedaje, onElegir, onQuitar, t = (k) => k }) {
  const [q, setQ] = useState("");
  const [sugs, setSugs] = useState([]);
  const [abierto, setAbierto] = useState(false);
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
    if (q.trim().length < 3 || !ciudad) { setSugs([]); return; }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lat=${ciudad.lat}&lon=${ciudad.lon}&limit=6&zoom=14`
        );
        if (!r.ok) return;
        const d = await r.json();
        const vistos = new Set();
        const out = [];
        for (const f of d?.features || []) {
          const [lon, lat] = f.geometry?.coordinates || [];
          const p = f.properties || {};
          if (lat == null || lon == null || !p.name) continue;
          // Solo resultados razonablemente cerca de la ciudad (~60 km).
          if (Math.hypot(lat - ciudad.lat, lon - ciudad.lon) > 0.6) continue;
          const detalle = [p.street, p.district || p.city].filter(Boolean).join(", ");
          const key = `${p.name}|${detalle}`;
          if (vistos.has(key)) continue;
          vistos.add(key);
          out.push({ nombre: p.name, detalle, lat, lon });
          if (out.length >= 5) break;
        }
        setSugs(out);
        setAbierto(out.length > 0);
      } catch {}
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q, ciudad?.lat, ciudad?.lon]);

  // Ya hay hospedaje elegido: chip con opción de quitar.
  if (hospedaje) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-marca-600 py-1.5 pl-3 pr-1.5 text-[12.5px] font-bold text-white">
          🏨 <span className="truncate">{t("hospedajeDesde")} {hospedaje.nombre}</span>
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
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => sugs.length && setAbierto(true)}
          placeholder={t("hospedajePlaceholder")}
          className="w-full border-0 bg-transparent text-[13.5px] outline-none placeholder:text-slate-400 dark:text-slate-100"
          aria-label={t("hospedajeLabel")}
        />
      </div>
      {abierto && sugs.length > 0 && (
        <div className="absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          {sugs.map((s, i) => (
            <button
              key={`${s.lat}-${s.lon}-${i}`}
              type="button"
              onClick={() => {
                track("hospedaje_set", { ciudad: ciudad?.nombre, lugar: s.nombre });
                onElegir?.(s);
                setQ("");
                setAbierto(false);
              }}
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
