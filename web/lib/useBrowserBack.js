"use client";
import { useEffect, useRef } from "react";

// Hook para que la flecha "atrás" del navegador CIERRE un modal/panel en lugar
// de sacar al usuario del sitio (o del estado post-login al pre-login).
//
// Problema que resuelve: la app es SPA. Cuando se abre un modal o se cambia a
// una "sub-vista" (ej. seleccionar ciudad), eso es solo state de React — el
// browser no ve cambio de URL. Si el usuario aprieta ←, el navegador navega
// al URL anterior real (que puede ser pre-login, una landing externa, o el
// sitio anterior si llegó vía link).
//
// Solución: cuando el modal se abre, hacemos pushState con un marker propio.
// Si el usuario aprieta ←, popstate dispara y cerramos el modal en vez de
// navegar fuera. Si el usuario cierra manualmente (X / clic en backdrop), el
// efecto se limpia haciendo history.back() para no dejar una entrada extra.
//
// Limitación conocida: si se apilan 2 modales simultáneos y el usuario cierra
// el de ABAJO primero (sin cerrar el de arriba), el history.back() podría
// cerrar el de arriba también. En la app actual los modales no se apilan
// (Paywall sobre Presupuesto es la única combinación, y Paywall siempre se
// cierra antes de volver a Presupuesto). Si esto crece, migrar a un Context
// con stack global de closers.
export function useBrowserBackClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined") return;

    let cerradoPorBack = false;

    try {
      // Token único para reconocer "esta entrada de history es nuestra" y no
      // mezclarla con SSG nav previa del usuario.
      window.history.pushState({ anduveModal: Date.now() }, "");
    } catch {
      return;
    }

    function handlePopstate() {
      cerradoPorBack = true;
      onCloseRef.current?.();
    }

    window.addEventListener("popstate", handlePopstate);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
      // Si el cierre fue voluntario (X / backdrop), limpiamos la entrada
      // artificial que metimos para que el ← natural siga al sitio correcto.
      if (!cerradoPorBack && typeof window !== "undefined" && window.history.state?.anduveModal) {
        try { window.history.back(); } catch {}
      }
    };
  }, [isOpen]);
}
