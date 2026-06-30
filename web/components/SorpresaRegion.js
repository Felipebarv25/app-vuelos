"use client";
// "Sorpréndeme" — selector aleatorio de region con visual del globo girando y
// el walker de la marca cayendo sobre el continente elegido. Pensado como
// momento emotivo del producto: cuando el usuario no sabe a donde ir, deja
// que Anduve elija por el con un poco de magia visual.
//
// Flujo: click en el boton → modal con globo girando (2.8s de suspense) →
// el walker cae con bounce → revela la region elegida → confirma y cierra
// (la region se aplica al state del Presupuesto, que recomputa la ruta).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Regiones candidatas (excluyendo "todas" — el sentido de la sorpresa es UNA).
const REGIONES_KEYS = ["sudamerica", "norteamerica", "europa", "asia", "africa", "oceania"];

// Tiempo total de suspense antes del reveal (en ms). Suficiente para que el
// usuario se enganche con la animación sin aburrirse.
const SUSPENSE_MS = 2800;

export default function SorpresaRegion({ regionesLabel, onElegir, onCerrar }) {
  const [fase, setFase] = useState("girando"); // girando | revelando
  const [resultado, setResultado] = useState(null);
  const [montado, setMontado] = useState(false);
  const decididoRef = useRef(false);

  useEffect(() => { setMontado(true); }, []);

  useEffect(() => {
    // Elegimos al azar al montar (no en cada render). Almacenamos en ref para
    // que la fase de reveal use la MISMA elección que la animación.
    if (decididoRef.current) return;
    decididoRef.current = REGIONES_KEYS[Math.floor(Math.random() * REGIONES_KEYS.length)];
    const t = setTimeout(() => {
      setResultado(decididoRef.current);
      setFase("revelando");
    }, SUSPENSE_MS);
    return () => clearTimeout(t);
  }, []);

  // Cerrar con ESC.
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onCerrar?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCerrar]);

  function confirmar() {
    if (resultado) onElegir?.(resultado);
    onCerrar?.();
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

        {fase === "girando" && (
          <>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-marca-700 dark:text-marca-300">
              Anduve está eligiendo
            </div>
            <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Buscando tu destino sorpresa…
            </h2>

            <div className="relative mx-auto mt-6 h-48 w-48">
              {/* Walker arriba del globo, bota con bounce. Cae al final con
                  animar-caer (definida abajo en globals via Tailwind keyframes
                  inline). */}
              <div className="absolute left-1/2 top-0 -translate-x-1/2 animate-bounce-walker">
                <WalkerIcon />
              </div>

              {/* Globo girando: contenido SVG rota en Z. Los continentes pasan
                  como en una rueda. Capas concentricas para profundidad. */}
              <div className="absolute inset-x-0 bottom-0 mx-auto h-40 w-40">
                <div className="h-full w-full animate-spin-globe">
                  <GloboSVG />
                </div>
              </div>
            </div>

            <p className="mt-5 text-[12.5px] text-slate-500 dark:text-slate-400">
              Girando el mundo…
            </p>
          </>
        )}

        {fase === "revelando" && resultado && (
          <>
            <div className="animar-pop mx-auto h-32 w-32 rounded-full bg-gradient-to-br from-marca-500 to-marca-800 p-1.5 shadow-[0_10px_40px_rgba(12,95,88,.45)]">
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white dark:bg-slate-800">
                <WalkerIcon size={56} />
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
                onClick={onCerrar}
                className="rounded-xl border border-slate-300 px-5 py-2.5 text-[13px] font-semibold text-slate-600 transition hover:border-marca-300 hover:text-marca-700 dark:border-slate-600 dark:text-slate-400"
              >
                Otra vez
              </button>
            </div>
          </>
        )}
      </div>

      {/* Keyframes locales — no agregamos al globals.css para mantener este
          componente autocontenido. */}
      <style jsx>{`
        @keyframes spin-globe {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes bounce-walker {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-12px); }
        }
        .animate-spin-globe {
          animation: spin-globe 1.8s linear infinite;
        }
        .animate-bounce-walker {
          animation: bounce-walker 0.6s cubic-bezier(.45,.05,.55,.95) infinite;
        }
      `}</style>
    </div>,
    document.body
  );
}

// Globo estilizado: circulo teal + 2 elipses meridianas + 3 blobs como
// continentes. SVG plano, lightweight, sin imagenes.
function GloboSVG() {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className="h-full w-full drop-shadow-md">
      {/* Halo exterior sutil */}
      <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(12,95,88,0.15)" strokeWidth="2" />
      {/* Oceano */}
      <circle cx="50" cy="50" r="42" fill="#0c5f58" />
      {/* Meridianos */}
      <ellipse cx="50" cy="50" rx="42" ry="14" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
      <ellipse cx="50" cy="50" rx="42" ry="28" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
      <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      {/* Continentes — blobs simplificados */}
      <path d="M28 38 Q35 30 48 33 Q58 38 55 50 Q48 56 35 52 Q26 48 28 38 Z" fill="#0a4a45" />
      <path d="M55 58 Q67 55 72 66 Q70 78 58 76 Q50 72 55 58 Z" fill="#0a4a45" />
      <path d="M70 30 Q78 28 80 38 Q76 44 68 40 Q66 34 70 30 Z" fill="#0a4a45" />
      {/* Highlight izq (luz) */}
      <ellipse cx="34" cy="34" rx="10" ry="6" fill="rgba(255,255,255,0.18)" />
    </svg>
  );
}

// Walker simplificado — usa los mismos colores de marca que el logo del header
// para reforzar identidad. SVG plano sin animaciones internas (el wrap lo
// rebota o lo escala desde fuera).
function WalkerIcon({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg">
      {/* Cabeza */}
      <circle cx="25" cy="10" r="4.5" fill="#0c5f58" stroke="#ffffff" strokeWidth="1.5" />
      {/* Torso */}
      <rect x="21" y="14" width="8" height="12" rx="2" fill="#0c5f58" stroke="#ffffff" strokeWidth="1.2" />
      {/* Mochila */}
      <rect x="22" y="15" width="10" height="8" rx="1.5" fill="#f4734d" stroke="#ffffff" strokeWidth="1" />
      {/* Brazo */}
      <line x1="21" y1="17" x2="15" y2="23" stroke="#0c5f58" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="21" y1="17" x2="15" y2="23" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
      {/* Piernas */}
      <line x1="27" y1="26" x2="31" y2="38" stroke="#0c5f58" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="27" y1="26" x2="31" y2="38" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="23" y1="26" x2="19" y2="38" stroke="#0c5f58" strokeWidth="3.5" strokeLinecap="round" />
      <line x1="23" y1="26" x2="19" y2="38" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
