"use client";
// "Sorpréndeme" — ruleta de regiones.
//
// Sin dependencias externas: planeta dibujado en SVG inline con continentes
// detallados (paths simplificados pero recognocibles), walker del logo,
// mano que lo sostiene y lo suelta.
//
// Flujo:
// 1. Esperando: planeta estatico + walker colgando de la mano + boton.
// 2. Girando: planeta empieza a rotar. La mano sigue sosteniendo 2.5s.
// 3. A 2.5s: la mano sube y se desvanece. Walker cae al planeta con rebote.
// 4. A 5s: planeta termina de girar (desacelerando). Reveal.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const REGIONES_KEYS = ["sudamerica", "norteamerica", "europa", "asia", "africa", "oceania"];
const SPIN_MS = 5000;
const RELEASE_MS = 2500;

export default function SorpresaRegion({ regionesLabel, onElegir, onCerrar }) {
  const [fase, setFase] = useState("esperando");
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

            <div className="relative mx-auto mt-6 h-64 w-64">
              <div
                className={`absolute left-1/2 top-0 z-20 -translate-x-1/2 transition-all duration-500 ease-in ${
                  walkerSuelto ? "-translate-y-10 opacity-0" : "translate-y-0 opacity-100"
                }`}
              >
                <ManoSVG />
              </div>

              <div
                className={`absolute left-1/2 z-10 -translate-x-1/2 ${
                  walkerSuelto ? "animate-walker-cae" : "top-[36px]"
                }`}
              >
                <WalkerLogo size={70} />
              </div>

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

// ============== TIERRA — inline SVG con continentes detallados ==============
// Vista orthographica Atlantico-centrada. Continentes dibujados con paths que
// REPRESENTAN sus formas reales (no blobs abstractos):
// - Norte America con Greenland + Canada + USA + Mexico + Centroamerica
// - Sudamerica con Brazil bulge + Patagonia cono
// - Africa con Sahara + cuerno + Cape
// - Europa con Iberia + Italia bota + UK + Scandinavia
// - Asia con India peninsula + China + Sudeste asiatico
// - Australia + Madagascar + Antartida
//
// La rotacion se hace transformando el grupo de continentes (no la esfera
// entera) — la esfera queda fija (mas natural visualmente como un globo
// real donde el ocean color y las luces son constantes).
function TierraGlobe({ girando }) {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full drop-shadow-xl">
      <defs>
        <radialGradient id="oceano" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#2b8aa5" />
          <stop offset="50%" stopColor="#0e5f7b" />
          <stop offset="100%" stopColor="#04304a" />
        </radialGradient>
        <radialGradient id="sombra" cx="78%" cy="72%" r="68%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
        <clipPath id="planeta">
          <circle cx="100" cy="100" r="92" />
        </clipPath>
      </defs>

      <circle cx="100" cy="100" r="96" fill="rgba(120,200,220,0.15)" />
      <circle cx="100" cy="100" r="92" fill="url(#oceano)" />

      {/* Continentes con rotacion en el centro del planeta. */}
      <g clipPath="url(#planeta)">
        <g
          style={{
            transformBox: "view-box",
            transformOrigin: "100px 100px",
            animation: girando ? `tierra-rotar ${SPIN_MS}ms cubic-bezier(.05,.95,.3,1) forwards` : "none",
          }}
        >
          <Continentes />
        </g>
      </g>

      <circle cx="100" cy="100" r="92" fill="url(#sombra)" />
      <ellipse cx="65" cy="58" rx="22" ry="14" fill="rgba(255,255,255,0.12)" />
      <ellipse cx="58" cy="48" rx="10" ry="6" fill="rgba(255,255,255,0.18)" />
      <circle cx="100" cy="100" r="92" fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth="0.8" />

      <style jsx>{`
        @keyframes tierra-rotar {
          from { transform: rotate(0deg); }
          to   { transform: rotate(1080deg); }
        }
      `}</style>
    </svg>
  );
}

// Paths separados para legibilidad. Tonos: tierra olive #94b659, bordes
// definidos con #5a7a2e para que recorten contra el oceano azul.
function Continentes() {
  return (
    <g fill="#94b659" stroke="#5a7a2e" strokeWidth="0.5" strokeLinejoin="round">
      {/* GROENLANDIA */}
      <path d="M 86 22 Q 96 18 104 22 Q 110 28 110 36 Q 106 44 96 46 Q 86 44 82 36 Q 80 28 86 22 Z" />

      {/* NORTE AMERICA — Canada/USA/Mexico/Centroamerica (visible portion) */}
      <path d="M 38 32
               C 46 28, 56 28, 66 30
               L 76 32
               C 80 36, 82 42, 80 48
               L 76 56
               C 74 64, 78 70, 80 76
               C 80 82, 76 84, 72 84
               L 64 82
               C 58 86, 54 92, 52 96
               L 48 102
               C 46 106, 44 106, 42 104
               L 40 96
               C 40 88, 36 80, 32 72
               L 28 60
               C 28 50, 30 42, 34 36
               L 38 32 Z" />

      {/* CARIBE (Cuba) */}
      <ellipse cx="56" cy="92" rx="6" ry="2" transform="rotate(-15 56 92)" />

      {/* CENTROAMERICA conectando con Sudamerica */}
      <path d="M 50 100 L 56 106 L 60 110 L 64 114 L 64 116 L 60 114 L 54 108 L 50 102 Z" />

      {/* SUDAMERICA — Brazil bulge + Patagonia cono */}
      <path d="M 60 112
               C 68 110, 76 112, 82 116
               L 88 122
               C 92 128, 94 134, 94 140
               L 92 148
               C 90 156, 84 164, 78 170
               L 72 176
               C 68 180, 64 180, 62 176
               L 58 168
               C 56 158, 56 148, 58 138
               L 58 130
               C 54 122, 54 116, 56 112
               L 60 112 Z" />

      {/* EUROPA — Iberia + Francia + UK + Scandinavia */}
      <path d="M 102 42
               L 108 40
               L 116 38
               L 124 36
               L 132 36
               L 138 38
               L 140 42
               L 138 48
               L 134 50
               L 126 50
               L 118 48
               L 110 46
               L 104 44
               L 102 42 Z" />
      {/* Italia bota */}
      <path d="M 124 50 L 128 56 L 130 62 L 128 66 L 125 62 L 122 56 Z" />
      {/* UK e Irlanda */}
      <ellipse cx="105" cy="38" rx="3" ry="2.2" />
      <ellipse cx="99" cy="40" rx="2" ry="1.5" />
      {/* Scandinavia */}
      <path d="M 124 26 L 132 24 L 138 28 L 140 34 L 136 38 L 130 36 L 124 30 Z" />

      {/* AFRICA — con costa norte + cuerno + cabo */}
      <path d="M 100 54
               L 108 52
               L 118 52
               L 128 54
               L 136 58
               L 140 64
               L 142 70
               C 146 70, 150 72, 152 76
               L 150 82
               C 146 84, 142 84, 140 86
               L 138 92
               C 136 100, 134 110, 132 120
               L 128 130
               C 124 140, 120 148, 114 156
               L 108 160
               C 102 160, 98 156, 96 150
               L 94 142
               C 94 132, 96 122, 98 112
               L 100 100
               C 98 90, 96 80, 96 70
               L 98 62
               C 98 58, 100 54, 100 54 Z" />

      {/* MADAGASCAR */}
      <path d="M 140 132 Q 144 134 144 140 L 142 150 Q 140 154 136 152 L 134 142 Q 136 134 140 132 Z" />

      {/* MEDIO ORIENTE / ARABIA */}
      <path d="M 140 60 Q 152 58 162 64 L 168 72 Q 168 80 162 84 L 154 86 Q 146 84 142 78 L 138 70 Z" />

      {/* ASIA — partial visible at right edge */}
      <path d="M 140 32 L 156 28 L 172 30 L 184 34 L 188 42 L 184 50 L 176 54 L 164 54 L 152 50 L 142 44 Z" />

      {/* INDIA peninsula */}
      <path d="M 156 78 L 162 80 L 166 86 L 168 94 L 164 100 L 158 94 L 154 86 L 156 78 Z" />

      {/* INDONESIA / archipielago */}
      <ellipse cx="184" cy="98" rx="5" ry="2.5" />
      <ellipse cx="178" cy="104" rx="3" ry="1.5" />

      {/* AUSTRALIA */}
      <path d="M 168 134 L 184 132 L 192 138 L 192 146 L 184 150 L 174 150 L 168 144 L 166 138 Z" />

      {/* JAPON islas */}
      <ellipse cx="184" cy="60" rx="2" ry="4" transform="rotate(-15 184 60)" />
      <ellipse cx="180" cy="68" rx="1.5" ry="2.5" />

      {/* ANTARTIDA — borde inferior */}
      <path d="M 16 180 Q 60 188 100 188 Q 140 188 184 180 L 184 196 L 16 196 Z" />
    </g>
  );
}

// ============== MANO ==============
// Mano cerrada en puño sosteniendo. Color teal de marca.
function ManoSVG() {
  return (
    <svg width="60" height="64" viewBox="0 0 60 64" xmlns="http://www.w3.org/2000/svg">
      {/* Brazo (con sombra arriba para profundidad) */}
      <rect x="24" y="0" width="12" height="22" fill="#0c5f58" />
      <rect x="24" y="0" width="12" height="4" fill="rgba(0,0,0,0.18)" />
      {/* Muñeca */}
      <path d="M 20 18 Q 18 24 22 30 L 38 30 Q 42 24 40 18 Z" fill="#0c5f58" />
      {/* Palma cerrada */}
      <path d="M 17 28 Q 14 38 18 44 L 42 44 Q 46 38 43 28 Z" fill="#0c5f58" />
      {/* Pulgar */}
      <path d="M 15 32 Q 11 38 13 44 L 18 44 L 20 36 Z" fill="#0a4a45" />
      {/* Dedos cerrados */}
      <path d="M 18 42 Q 15 50 19 52 L 23 52 Q 23 47 22 42 Z" fill="#0c5f58" />
      <path d="M 23 42 Q 22 52 27 54 L 30 54 Q 30 47 28 42 Z" fill="#0a4a45" />
      <path d="M 30 42 Q 30 52 35 54 L 38 54 Q 38 47 36 42 Z" fill="#0c5f58" />
      <path d="M 38 42 Q 38 50 42 52 L 45 52 Q 45 47 43 42 Z" fill="#0a4a45" />
      {/* Líneas de articulación */}
      <line x1="20" y1="46" x2="22" y2="46" stroke="#063630" strokeWidth="0.6" />
      <line x1="25" y1="46" x2="28" y2="46" stroke="#063630" strokeWidth="0.6" />
      <line x1="32" y1="46" x2="36" y2="46" stroke="#063630" strokeWidth="0.6" />
      <line x1="40" y1="46" x2="42" y2="46" stroke="#063630" strokeWidth="0.6" />
    </svg>
  );
}

// ============== WALKER (idéntico al logo) ==============
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
      <path d="M98.5 56 L101.5 56 L101.5 62 L98.5 62 Z" />
      <circle cx="100" cy="62" r="1.5" />
      <path d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z" />
      <path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z" />
      <path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z" />
      <rect x="89" y="43.5" width="8" height="11" rx="3" fill="#f4734d" stroke="#f4734d" />
      <rect x="94.4" y="42.5" width="1.9" height="10" rx="0.9" fill="#f4734d" stroke="#f4734d" />
      <path d="M97.7 40.5 C97.7 38.2 103.1 38.2 103.1 40.5 L104 54.5 Q104 59 100.4 59 Q96.8 59 96.8 54.5 Z" />
      <path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z" />
      <path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z" />
      <circle cx="100.4" cy="32.5" r="5.2" />
      <path d="M104.5 31.1 Q106.7 31.5 106.6 32.6 Q106.5 33.7 104.5 34.1 Z" />
      <path d="M95.3 33 Q94.9 26.4 100.4 26.4 Q105.9 26.4 105.5 33 Q104 30.1 101 30.5 Q97.6 30.9 95.3 33 Z" />
    </svg>
  );
}
