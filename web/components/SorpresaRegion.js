"use client";
// "Sorpréndeme" — ruleta de regiones con mecanica de "mano que suelta al walker".
//
// Flujo:
// 1. Esperando: planeta estatico + walker COLGANDO de una mano que lo sujeta
//    por la mochila + boton "Girar el planeta".
// 2. Girando: planeta empieza a rotar. La mano sigue sosteniendo al walker
//    los primeros 2.5s para construir suspense.
// 3. A los 2.5s: la mano se abre y sube fuera del cuadro. El walker CAE sobre
//    el planeta con un pequeno rebote al aterrizar.
// 4. El planeta sigue girando hasta los 5s totales, desacelerando estilo
//    ruleta de fortuna.
// 5. Reveal: nombre de la region grande + botones.
//
// Decisiones de diseño:
// - El walker es EXACTAMENTE el del logo (paths copiados de AnduveIcon.js).
// - El planeta usa la imagen REAL del mapa mundial de NASA Land/Ocean/Ice
//   (public domain, hosted en Wikimedia Commons) wrappeada en una esfera
//   circular. La rotacion se hace animando background-position-x = el mapa
//   pasa horizontalmente dentro del circulo, dando ilusion de globo girando.
// - Curva: cubic-bezier(.05,.95,.3,1) = arranque rapido + freno suave.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const REGIONES_KEYS = ["sudamerica", "norteamerica", "europa", "asia", "africa", "oceania"];
const SPIN_MS = 5000;
const RELEASE_MS = 2500;

// Mapa mundial real — NASA Land/Ocean/Ice composite (public domain).
// Wikimedia esta permitido por nuestro CSP (next.config.mjs img-src).
// 640px ancho × 320px alto = aspecto 2:1 (equirectangular), perfecto para
// envolver alrededor del globo via background-repeat horizontal.
const MAPA_MUNDIAL_URL =
  "https://upload.wikimedia.org/wikipedia/commons/thumb/8/89/Land_ocean_ice_2048.jpg/640px-Land_ocean_ice_2048.jpg";

export default function SorpresaRegion({ regionesLabel, onElegir, onCerrar }) {
  const [fase, setFase] = useState("esperando"); // esperando | girando | revelando
  const [walkerSuelto, setWalkerSuelto] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [montado, setMontado] = useState(false);
  const decididoRef = useRef(null);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCerrar?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  function girar() {
    decididoRef.current = REGIONES_KEYS[Math.floor(Math.random() * REGIONES_KEYS.length)];
    setFase("girando");
    setWalkerSuelto(false);
    // A los RELEASE_MS la mano suelta al walker. El walker cae con animacion.
    const tRelease = setTimeout(() => setWalkerSuelto(true), RELEASE_MS);
    const tReveal = setTimeout(() => {
      setResultado(decididoRef.current);
      setFase("revelando");
    }, SPIN_MS);
    return () => { clearTimeout(tRelease); clearTimeout(tReveal); };
  }

  function confirmar() {
    if (resultado) onElegir?.(resultado);
    onCerrar?.();
  }

  function girarOtraVez() {
    setResultado(null);
    setWalkerSuelto(false);
    setFase("esperando");
  }

  if (!montado) return null;

  return createPortal(
    <div
      className="animar-aparecer fixed inset-0 z-[5500] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-white p-8 text-center shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCerrar}
          aria-label="Cerrar"
          className="absolute right-3 top-3 z-50 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>

        {(fase === "esperando" || fase === "girando") && (
          <>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-marca-700 dark:text-marca-300">
              Ruleta de destinos
            </div>
            <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {fase === "girando" ? "Buscando tu destino…" : "¿A dónde te lleva Anduve?"}
            </h2>

            {/* Stage: hand + walker + planet. Altura fija para que el walker
                pueda caer con animacion CSS predecible. */}
            <div className="relative mx-auto mt-6 h-64 w-64">
              {/* MANO. Cuando walkerSuelto, se desliza hacia arriba y desvanece. */}
              <div
                className={`absolute left-1/2 top-0 z-20 -translate-x-1/2 transition-all duration-500 ease-in ${
                  walkerSuelto ? "-translate-y-10 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                <ManoSVG />
              </div>

              {/* WALKER. Hangs at top:36px (justo bajo la mano). Cuando suelto,
                  animacion CSS lo hace caer al planeta. */}
              <div
                className={`absolute left-1/2 z-10 -translate-x-1/2 ${
                  walkerSuelto ? "animate-walker-cae" : "top-[36px]"
                }`}
              >
                <WalkerLogo size={70} />
              </div>

              {/* PLANETA con mapa mundial real. */}
              <div className="absolute inset-x-0 bottom-0 mx-auto h-52 w-52">
                <TierraGlobe girando={fase === "girando"} />
              </div>
            </div>

            {fase === "esperando" && (
              <button
                onClick={girar}
                className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-marca-600 to-marca-800 px-7 py-3 text-[14.5px] font-bold text-white shadow-cta transition hover:-translate-y-0.5 hover:from-marca-700 hover:to-marca-900"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12a9 9 0 1 1-9-9c2.4 0 4.6.9 6.3 2.5L21 8" />
                  <path d="M21 3v5h-5" />
                </svg>
                Girar el planeta
              </button>
            )}

            {fase === "girando" && (
              <p className="mt-5 text-[12.5px] text-slate-500 dark:text-slate-400">
                {walkerSuelto ? "¡Cayendo!" : "Preparando la caída…"}
              </p>
            )}
          </>
        )}

        {fase === "revelando" && resultado && (
          <>
            <div className="animar-pop mx-auto h-32 w-32 rounded-full bg-gradient-to-br from-marca-500 to-marca-800 p-1.5 shadow-[0_10px_40px_rgba(12,95,88,.45)]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-800">
                <WalkerLogo size={72} />
              </div>
            </div>

            <div className="mt-5 text-[10.5px] font-bold uppercase tracking-[0.22em] text-marca-700 dark:text-marca-300">
              ¡Tu próxima aventura es!
            </div>
            <h2 className="mt-1 font-display text-[32px] font-extrabold tracking-tight text-marca-900 dark:text-marca-200">
              {regionesLabel[resultado] || resultado}
            </h2>
            <p className="mt-2 text-[13.5px] text-slate-600 dark:text-slate-400">
              Anduve te recomienda una ruta y presupuesto para esta región.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={confirmar}
                className="rounded-xl bg-marca-700 px-5 py-2.5 text-[14px] font-semibold text-white shadow-cta transition hover:bg-marca-800"
              >
                Ver mi ruta sorpresa →
              </button>
              <button
                onClick={girarOtraVez}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:border-marca-300 hover:text-marca-700 dark:border-slate-600 dark:text-slate-400"
              >
                Girar otra vez
              </button>
            </div>
          </>
        )}
      </div>

      {/* Keyframes globales para que el child TierraGlobe pueda usarlas via
          el style inline `animation`. Walker-cae queda scoped al modal. */}
      <style jsx global>{`
        @keyframes tierra-girar-bg {
          from { background-position-x: 0%; }
          to   { background-position-x: -1000%; }
        }
      `}</style>
      <style jsx>{`
        @keyframes walker-cae {
          0%   { top: 36px; }
          70%  { top: 100px; }
          85%  { top: 88px; }
          100% { top: 96px; }
        }
        .animate-walker-cae {
          animation: walker-cae 800ms cubic-bezier(.34, 1.56, .64, 1) forwards;
        }
      `}</style>
    </div>,
    document.body
  );
}

// ============== TIERRA — mapa mundial real wrappeado en esfera ==============
// Background-image con la textura del mapa mundial NASA (equirectangular,
// 2:1 aspect). background-size 200% width hace que se vea SOLO MITAD del
// mapa a la vez en el container circular — la otra mitad esta "del otro lado"
// del globo. background-repeat-x = la imagen se repite sin fin a los lados,
// para que la animacion de scroll sea sin saltos.
//
// El efecto: cuando el background-position-x va de 0% a -1000% (5 vueltas
// completas del mapa), el visitante ve los continentes pasar por el
// circulo como si la Tierra estuviera girando.
//
// Overlays: highlight arriba-izq (sol) + sombra abajo-der (terminador noche)
// dan profundidad 3D + halo de atmosfera exterior.
function TierraGlobe({ girando }) {
  return (
    <div className="relative h-full w-full">
      {/* Halo de atmosfera */}
      <div className="absolute -inset-1 rounded-full bg-cyan-300/15 blur-sm" />

      {/* Esfera con el mapa wrappeado. La animacion gira solo el background. */}
      <div
        className="absolute inset-0 overflow-hidden rounded-full ring-1 ring-black/30"
        style={{
          backgroundColor: "#0e3a4a",
          backgroundImage: `url('${MAPA_MUNDIAL_URL}')`,
          backgroundSize: "200% 100%",
          backgroundRepeat: "repeat-x",
          backgroundPosition: "0% center",
          animation: girando
            ? `tierra-girar-bg ${SPIN_MS}ms cubic-bezier(.05, .95, .3, 1) forwards`
            : "none",
        }}
      />

      {/* Highlight de atmosfera (luz del sol viene de arriba-izq) */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-white/25 via-white/5 to-transparent" />

      {/* Sombra del terminador (lado noche, abajo-der) */}
      <div className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-br from-transparent via-transparent to-black/55" />

      {/* Borde sutil para definir la silueta */}
      <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-black/30" />
    </div>
  );
}

// ============== MANO ==============
// Mano viene desde arriba del cuadro, dedos cerrados sosteniendo al walker
// por la correa de la mochila. Trazo simple, color teal de marca.
function ManoSVG() {
  return (
    <svg width="60" height="64" viewBox="0 0 60 64" xmlns="http://www.w3.org/2000/svg">
      {/* Brazo desde arriba */}
      <rect x="24" y="0" width="12" height="22" fill="#0c5f58" />
      <rect x="24" y="0" width="12" height="4" fill="rgba(0,0,0,0.18)" />
      {/* Muñeca (mas ancha) */}
      <path d="M 20 18 Q 18 24 22 30 L 38 30 Q 42 24 40 18 Z" fill="#0c5f58" />
      {/* Palma de la mano (ancha, cerrada en puño) */}
      <path d="M 17 28 Q 14 38 18 44 L 42 44 Q 46 38 43 28 Z" fill="#0c5f58" />
      {/* Pulgar visible al frente, doblado */}
      <path d="M 15 32 Q 11 38 13 44 L 18 44 L 20 36 Z" fill="#0a4a45" />
      <path d="M 13 38 Q 14 40 16 41" stroke="#063630" strokeWidth="0.8" fill="none" />
      {/* Dedos cerrados — 4 dedos visibles agarrando */}
      <path d="M 18 42 Q 15 50 19 52 L 23 52 Q 23 47 22 42 Z" fill="#0c5f58" />
      <path d="M 23 42 Q 22 52 27 54 L 30 54 Q 30 47 28 42 Z" fill="#0a4a45" />
      <path d="M 30 42 Q 30 52 35 54 L 38 54 Q 38 47 36 42 Z" fill="#0c5f58" />
      <path d="M 38 42 Q 38 50 42 52 L 45 52 Q 45 47 43 42 Z" fill="#0a4a45" />
      {/* Sombras de articulaciones */}
      <line x1="20" y1="46" x2="22" y2="46" stroke="#063630" strokeWidth="0.6" />
      <line x1="25" y1="46" x2="28" y2="46" stroke="#063630" strokeWidth="0.6" />
      <line x1="32" y1="46" x2="36" y2="46" stroke="#063630" strokeWidth="0.6" />
      <line x1="40" y1="46" x2="42" y2="46" stroke="#063630" strokeWidth="0.6" />
    </svg>
  );
}

// ============== WALKER (identico al logo) ==============
// Paths extraidos LITERALMENTE de AnduveIcon.js (lineas 36-55, el walker
// que vive en la cima del planeta del logo). Sin animaciones internas —
// queda quieto colgando o cayendo.
function WalkerLogo({ size = 56 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="92 24 18 36"
      fill="#0c5f58"
      stroke="#0c5f58"
      strokeWidth="0.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      xmlns="http://www.w3.org/2000/svg"
      style={{ overflow: "visible" }}
    >
      {/* Pierna atras */}
      <path d="M98.5 56 L101.5 56 L101.5 62 L98.5 62 Z" />
      <circle cx="100" cy="62" r="1.5" />
      <path d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z" />
      {/* Brazo atras */}
      <path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z" />
      <path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z" />
      {/* Mochila (coral) */}
      <rect x="89" y="43.5" width="8" height="11" rx="3" fill="#f4734d" stroke="#f4734d" />
      <rect x="94.4" y="42.5" width="1.9" height="10" rx="0.9" fill="#f4734d" stroke="#f4734d" />
      {/* Torso */}
      <path d="M97.7 40.5 C97.7 38.2 103.1 38.2 103.1 40.5 L104 54.5 Q104 59 100.4 59 Q96.8 59 96.8 54.5 Z" />
      {/* Brazo adelante */}
      <path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z" />
      <path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z" />
      {/* Cabeza + pelo */}
      <circle cx="100.4" cy="32.5" r="5.2" />
      <path d="M104.5 31.1 Q106.7 31.5 106.6 32.6 Q106.5 33.7 104.5 34.1 Z" />
      <path d="M95.3 33 Q94.9 26.4 100.4 26.4 Q105.9 26.4 105.5 33 Q104 30.1 101 30.5 Q97.6 30.9 95.3 33 Z" />
    </svg>
  );
}
