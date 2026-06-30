"use client";
// "Sorpréndeme" — selector aleatorio de región tipo ruleta.
//
// UX (rediseño 2026-06-29):
// 1. Modal abre en estado "esperando" — globo estático + walker arriba + boton "GIRAR".
// 2. Click → fase "girando" — el globo rota 5 segundos con desaceleracion final.
// 3. Reveal → walker grande + nombre de región + botones.
//
// Detalles importantes:
// - El WALKER es exactamente el del logo (mismos paths, mismas proporciones).
// - El PLANETA es una tierra estilizada con continentes recognizable (Americas,
//   Africa, Eurasia, Australia) — no la version "blobs" anterior.
// - La rotación incluye desaceleracion (cubic-bezier easeOut) al final para
//   que se sienta como una ruleta deteniendose, no un giro mecanico.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const REGIONES_KEYS = ["sudamerica", "norteamerica", "europa", "asia", "africa", "oceania"];
const SPIN_MS = 5000; // 5 segundos para que la persona sienta suspense pero no se aburra

export default function SorpresaRegion({ regionesLabel, onElegir, onCerrar }) {
  const [fase, setFase] = useState("esperando"); // esperando | girando | revelando
  const [resultado, setResultado] = useState(null);
  const [montado, setMontado] = useState(false);
  const decididoRef = useRef(null);

  useEffect(() => { setMontado(true); }, []);

  // Cerrar con ESC.
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCerrar?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  function girar() {
    // Eligimos la región al click (no antes). Asi cada giro es genuinamente
    // nuevo aunque el usuario reabra el modal.
    decididoRef.current = REGIONES_KEYS[Math.floor(Math.random() * REGIONES_KEYS.length)];
    setFase("girando");
    const t = setTimeout(() => {
      setResultado(decididoRef.current);
      setFase("revelando");
    }, SPIN_MS);
    return () => clearTimeout(t);
  }

  function confirmar() {
    if (resultado) onElegir?.(resultado);
    onCerrar?.();
  }

  function girarOtraVez() {
    setResultado(null);
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
          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
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

            <div className="relative mx-auto mt-6 h-56 w-56">
              {/* Walker ENCIMA del planeta. Usa el walker exacto del logo */}
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-2">
                <WalkerLogo size={64} />
              </div>

              {/* Planeta: spin acelerado al inicio y desacelerado al final
                  para que se sienta como una ruleta de fortuna. */}
              <div className="absolute inset-x-0 bottom-0 mx-auto h-48 w-48">
                <div className={fase === "girando" ? "animate-tierra-girar" : ""}>
                  <TierraSVG />
                </div>
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
                El walker está eligiendo…
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

      {/* Keyframes locales. La curva cubic-bezier(.05,.95,.3,1) da
          aceleración rápida + desaceleración suave al final (efecto ruleta).
          5 vueltas completas (1800deg) en los 5 segundos. */}
      <style jsx>{`
        @keyframes tierra-girar {
          from { transform: rotate(0deg); }
          to   { transform: rotate(1800deg); }
        }
        .animate-tierra-girar {
          animation: tierra-girar ${SPIN_MS}ms cubic-bezier(.05, .95, .3, 1) forwards;
          transform-origin: center;
        }
      `}</style>
    </div>,
    document.body
  );
}

// ============== TIERRA ==============
// Esfera con paths simplificados que evocan continentes reales — no blobs
// abstractos. Recognocible como tierra desde el espacio. Colores: oceano teal
// profundo, continentes verde tierra para contraste suave.
function TierraSVG() {
  return (
    <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="h-full w-full drop-shadow-lg">
      <defs>
        {/* Gradiente radial: la cara izq mas iluminada (luz del sol) */}
        <radialGradient id="oceano" cx="35%" cy="35%" r="75%">
          <stop offset="0%" stopColor="#1a8074" />
          <stop offset="55%" stopColor="#0c5f58" />
          <stop offset="100%" stopColor="#043730" />
        </radialGradient>
        <clipPath id="planeta">
          <circle cx="100" cy="100" r="90" />
        </clipPath>
      </defs>

      {/* Halo exterior */}
      <circle cx="100" cy="100" r="96" fill="none" stroke="rgba(12,95,88,0.18)" strokeWidth="3" />

      {/* Oceano con gradiente para efecto 3D */}
      <circle cx="100" cy="100" r="90" fill="url(#oceano)" />

      {/* Todo el contenido geografico clipeado dentro del planeta */}
      <g clipPath="url(#planeta)" fill="#a8c668" stroke="#7fa850" strokeWidth="0.5">
        {/* AMERICAS — Norteamerica + bridge + Sudamerica */}
        <path d="M 38 55
                 L 50 50 L 62 52 L 68 62 L 64 72
                 L 58 78 L 60 88 L 56 94 L 48 92 L 44 86
                 L 42 78 L 38 72 L 36 64 Z" />
        <path d="M 55 105
                 L 64 100 L 70 108 L 72 120
                 L 70 135 L 66 150 L 60 160 L 56 168
                 L 52 160 L 50 145 L 52 130 L 54 115 Z" />

        {/* AFRICA — forma característica con cuerno */}
        <path d="M 95 70
                 L 108 68 L 118 76 L 122 90
                 L 124 105 L 122 120 L 118 135
                 L 110 148 L 102 155 L 96 150
                 L 92 138 L 94 125 L 96 110 L 95 95 L 93 82 Z" />

        {/* EUROPA — pequeña arriba a la izq de Asia */}
        <path d="M 95 50
                 L 110 46 L 122 50 L 125 58 L 118 65
                 L 108 64 L 100 60 Z" />

        {/* ASIA — la masa grande al noreste */}
        <path d="M 125 50
                 L 140 45 L 160 48 L 170 56 L 168 70
                 L 162 82 L 152 88 L 140 84 L 130 78
                 L 124 70 L 122 60 Z" />

        {/* INDIA — peninsula colgando */}
        <path d="M 138 88 L 142 96 L 144 105 L 140 110 L 134 102 L 134 92 Z" />

        {/* AUSTRALIA */}
        <path d="M 148 130
                 L 162 128 L 172 134 L 170 144
                 L 160 148 L 150 145 L 146 138 Z" />

        {/* JAPON (islas) — pequeño detalle ojo de pez */}
        <ellipse cx="172" cy="78" rx="3" ry="6" transform="rotate(-15 172 78)" />
        <ellipse cx="168" cy="88" rx="2" ry="3" />

        {/* MADAGASCAR */}
        <ellipse cx="126" cy="140" rx="3" ry="8" />

        {/* CARIBE — Cuba */}
        <ellipse cx="60" cy="92" rx="5" ry="2" />

        {/* INDONESIA archipielago */}
        <ellipse cx="155" cy="115" rx="4" ry="2" />
        <ellipse cx="162" cy="118" rx="3" ry="1.5" />
      </g>

      {/* Highlights / brillo de la atmosfera arriba a la izq */}
      <ellipse cx="68" cy="55" rx="22" ry="14" fill="rgba(255,255,255,0.12)" />
      <ellipse cx="60" cy="48" rx="10" ry="6" fill="rgba(255,255,255,0.18)" />

      {/* Sombra del lado opuesto (terminador) para profundidad 3D */}
      <circle cx="100" cy="100" r="90" fill="url(#noche)" opacity="0.35" />
      <defs>
        <radialGradient id="noche" cx="80%" cy="65%" r="60%">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.55)" />
        </radialGradient>
      </defs>

      {/* Borde sutil para definir el planeta */}
      <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth="0.8" />
    </svg>
  );
}

// ============== WALKER (idéntico al logo) ==============
// Paths extraídos directamente de components/AnduveIcon.js (el walker que
// vive en la cima del planeta del logo, lineas 36-55). Re-encuadrado a un
// viewBox tight alrededor del personaje, sin las animaciones internas
// (sway/bob/legs) porque aquí queremos al walker estático arriba del globo.
// Colores: ink = teal de marca, accent = coral de la mochila.
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
      {/* Piernas */}
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
