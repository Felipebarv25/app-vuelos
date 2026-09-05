"use client";
// El mapa del pasaporte: el mundo apagado, y encendido lo que ya conociste.
//
// POR QUE UN MAPA Y NO LA CUADRICULA DE BANDERAS
//
// La version anterior listaba banderas en fichas. Se entendia, pero no decia
// nada que la lista no dijera ya. Un mapa dice DE UN VISTAZO dos cosas que la
// cuadricula no puede: donde has estado, y —sobre todo— cuanto mundo te
// queda. Ese contraste entre lo apagado y lo encendido ES el logro.
//
// POR QUE SVG Y NO MAPLIBRE
//
// Aqui no hace falta un mapa de verdad: no se navega, no se hace zoom, no se
// leen calles. Un SVG de 63 KB pinta esto sin tiles, sin red, sin WebGL y sin
// que el movil sude — y se colorea pais por pais con una linea de CSS, que
// con tiles vectoriales seria una capa y una expresion de estilo.

import { useMemo, useState } from "react";
import {
  CONTORNOS,
  COLOR_PAIS,
  MUNDO_ANCHO,
  MUNDO_ALTO,
  TOTAL_PAISES,
} from "@/data/mundoPaises";

// Apagado: el teal de marca, muy oscurecido. No es gris neutro a proposito —
// el mundo por descubrir sigue siendo "de Anduve", solo que sin encender.
const APAGADO = "#123c3a";
const BORDE = "#0b2b2a";
const FONDO = "#08211f";

export default function MapaPasaporte({
  paises = {},
  lang = "es",
  t = (k) => k,
  onTocarPais = null,
  activo = null,
}) {
  const [encima, setEncima] = useState(null);

  const visitados = useMemo(() => Object.keys(paises || {}), [paises]);
  const ciudades = useMemo(
    () => Object.values(paises || {}).reduce((s, p) => s + (p?.ciudades?.length || 0), 0),
    [paises]
  );

  // Un decimal a proposito: con 10 paises el entero dice "5%" y se pierde el
  // avance de anadir uno mas. "5,1%" -> "5,6%" si se nota, y eso es justo lo
  // que tiene que premiar un marcador.
  const pct = (visitados.length / TOTAL_PAISES) * 100;
  const pctTexto = pct.toLocaleString(lang, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  return (
    <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: FONDO }}>
      {/* --- Las cifras --- */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-5 pt-5 sm:px-6">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/60">
            {t("paisesTit")}
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-5 gap-y-1">
            <Cifra valor={visitados.length} etiqueta={t("paisesDe195")} />
            <Cifra valor={ciudades} etiqueta={t("paisesCiudadesCorto")} />
            <Cifra valor={`${pctTexto}%`} etiqueta={t("paisesDelMundo")} destacado />
          </div>
        </div>
      </div>

      {/* --- El mundo --- */}
      <div className="relative mt-4">
        <svg
          viewBox={`0 0 ${MUNDO_ANCHO} ${MUNDO_ALTO}`}
          className="block w-full"
          style={{ maxHeight: 260 }}
          role="img"
          aria-label={t("paisesContador").replace("{n}", visitados.length)}
        >
          {/* Primero TODO el mundo apagado y de una sola vez: 174 paises en un
              solo <path> es un nodo en el DOM en lugar de 174. Los encendidos
              se pintan encima. */}
          <path
            d={Object.values(CONTORNOS).join("")}
            fill={APAGADO}
            stroke={BORDE}
            strokeWidth="0.6"
          />

          {visitados.map((cc) => {
            const d = CONTORNOS[cc];
            if (!d) return null; // pais sin contorno en el mapa (micro-estados)
            const resaltado = encima === cc || activo === cc;
            return (
              <path
                key={cc}
                d={d}
                fill={COLOR_PAIS[cc] || "#3fb1a8"}
                stroke={resaltado ? "#ffffff" : "rgba(255,255,255,.35)"}
                strokeWidth={resaltado ? 1.8 : 0.7}
                style={{
                  cursor: onTocarPais ? "pointer" : "default",
                  transition: "filter .15s ease",
                  filter: resaltado ? "brightness(1.25)" : "none",
                }}
                onMouseEnter={() => setEncima(cc)}
                onMouseLeave={() => setEncima((v) => (v === cc ? null : v))}
                onClick={() => onTocarPais?.(cc)}
              />
            );
          })}
        </svg>

        {/* Micro-estados: Andorra, Monaco, Singapur y compania no tienen
            contorno visible a esta escala. Encenderlos y que no se vea nada
            seria peor que decirlo, asi que se listan como puntos aparte. */}
        {visitados.some((cc) => !CONTORNOS[cc]) && (
          <div className="px-5 pb-1 text-[11px] text-white/50 sm:px-6">
            {t("paisesMinusculos")}{" "}
            {visitados.filter((cc) => !CONTORNOS[cc]).join(", ").toUpperCase()}
          </div>
        )}
      </div>

      {/* --- La barra --- */}
      <div className="px-5 pb-5 sm:px-6">
        <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-marca-400 to-emerald-300 transition-all duration-700"
            // Minimo visible: con un pais la barra seria medio pixel y
            // pareceria rota. Lo que cuenta es ver que se avanza.
            style={{ width: `${visitados.length ? Math.max(1.5, pct) : 0}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Cifra({ valor, etiqueta, destacado = false }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className={`font-extrabold leading-none tabular-nums ${
          destacado ? "text-[26px] text-emerald-300" : "text-[26px] text-white"
        }`}
      >
        {valor}
      </span>
      <span className="text-[12px] leading-tight text-white/60">{etiqueta}</span>
    </div>
  );
}
