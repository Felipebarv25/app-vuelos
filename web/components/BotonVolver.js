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
//   <BotonVolver espaciar={false} /> (paginas con hero a sangre completa)
//
// Al ser `fixed` no ocupa sitio en el flujo, asi que tapaba el primer bloque de
// contenido: en /ofertas se comia el eyebrow "Vuelos" (solo se veia la "V"
// asomando por el borde). Cuentas: NavTop mide ~69px, el boton va de 90 a 126px,
// y `main` con py-8 arranca su contenido en 101px — justo debajo del boton. El
// spacer de abajo reserva ese hueco. Se desactiva con espaciar={false} donde el
// siguiente bloque es una imagen a sangre completa y el boton debe flotar encima.
//
// INVARIANTE, importante al montar este boton en una pagina nueva: el
// `top-[90px]` esta calculado suponiendo un NavTop pegajoso de ~69px encima
// (69 + 21 de margen). El spacer de 44px basta con esa premisa. En una pagina
// SIN NavTop el boton no cae sobre el primer bloque sino mas abajo, y el spacer
// no alcanza: hay que reservar el hueco a mano con padding-top en la pagina
// hasta pasar los 126px. Asi se hace hoy en /destino (pt-14 en su <header>) y en
// /comparar (pt-24). Si añades una pagina sin NavTop, comprueba con las cajas
// reales que nada quede detras del boton.

import { useRouter } from "next/navigation";
import { Logo } from "./Logo";

export default function BotonVolver({ href = null, etiqueta = "Volver", espaciar = true }) {
  const router = useRouter();

  function volver() {
    if (href) { router.push(href); return; }
    // Si no hay historial (link directo), ir a la home en vez de no hacer nada.
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <>
    <div className="fixed left-0 top-[90px] z-[60] px-4 sm:px-6">
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
          <Logo size={24} animado />
        </span>
        <span className="text-[13px] font-bold text-marca-900 dark:text-slate-100">{etiqueta}</span>
      </button>
    </div>
    {espaciar && <div aria-hidden="true" className="h-11" />}
    </>
  );
}
