"use client";
// Boton "Volver" universal (feedback 2026-07-11: los links de migas eran
// pequenos y ocultos; el usuario quiere un boton llamativo y consistente en
// todas las ventanas, con el munequito de la marca).
//
// - Sticky arriba-izquierda: siempre visible aunque se haga scroll.
// - Walker del logo + flecha: se lee como "Anduve te lleva de vuelta".
// - router.back() con fallback a "/" si no hay historial (llegada directa
//   por link compartido o SEO).
//
//   <BotonVolver />            (en cualquier pagina)
//   <BotonVolver href="/destino" />  (destino fijo en vez de back)

import { useRouter } from "next/navigation";
import { Logo } from "./Logo";

export default function BotonVolver({ href = null, etiqueta = "Volver" }) {
  const router = useRouter();

  function volver() {
    if (href) { router.push(href); return; }
    // Si no hay historial (link directo), ir a la home en vez de no hacer nada.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <div className="sticky top-3 z-[60] px-4 pt-3 sm:px-6">
      <button
        type="button"
        onClick={volver}
        aria-label={etiqueta}
        className="group inline-flex items-center gap-2 rounded-full bg-white/95 py-1.5 pl-2 pr-4 shadow-[0_6px_20px_rgba(15,23,42,.16)] ring-1 ring-slate-200 backdrop-blur transition hover:-translate-x-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,.22)] dark:bg-slate-800/95 dark:ring-slate-600"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-marca-700 transition group-hover:-translate-x-0.5 dark:text-marca-300">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        {/* El walker mirando hacia atras (scaleX(-1)): vuelve sobre sus pasos */}
        <span className="inline-block" style={{ transform: "scaleX(-1)" }}>
          <Logo size={24} />
        </span>
        <span className="text-[13px] font-bold text-marca-900 dark:text-slate-100">{etiqueta}</span>
      </button>
    </div>
  );
}
