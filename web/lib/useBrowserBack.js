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
// BUG CORREGIDO (2026-07-11, reportado por el usuario: "clic en una ruta me
// devuelve al menú principal"): el history.back() de limpieza es ASINCRONO.
// Si el usuario cerraba un modal (Presupuesto/Eventos) y de inmediato abría
// la vista de ciudad, la ciudad alcanzaba a empujar SU entrada de protección
// y el back() pendiente se la comía → popstate → la ciudad interpretaba un
// "atrás" del usuario → irAlInicio() → menú principal. FIX: contador global
// `popsDeLimpieza`. El handler que recibe un pop de limpieza ajeno NO cierra:
// repone su marker y sigue abierto. Un timeout de seguridad descuenta pops
// que nadie consumió (cuando ningún otro modal estaba abierto).
let popsDeLimpieza = 0;
let tokenSeq = 0;

export function useBrowserBackClose(isOpen, onClose) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    if (typeof window === "undefined") return;

    let cerradoPorBack = false;
    const token = ++tokenSeq;

    try {
      // Token único para reconocer "esta entrada de history es nuestra" y no
      // mezclarla con navegación previa real del usuario.
      window.history.pushState({ anduveModal: token }, "");
    } catch {
      return;
    }

    function handlePopstate() {
      if (popsDeLimpieza > 0) {
        // Este pop NO es el usuario apretando ←: es la limpieza asíncrona de
        // otro modal que se cerró justo antes de que este se abriera y nos
        // tumbó la entrada. Consumimos el pop, reponemos nuestro marker y
        // seguimos abiertos como si nada.
        popsDeLimpieza--;
        try { window.history.pushState({ anduveModal: token }, ""); } catch {}
        return;
      }
      cerradoPorBack = true;
      onCloseRef.current?.();
    }

    window.addEventListener("popstate", handlePopstate);

    return () => {
      window.removeEventListener("popstate", handlePopstate);
      // Si el cierre fue voluntario (X / backdrop), limpiamos la entrada
      // artificial que metimos para que el ← natural siga al sitio correcto.
      if (!cerradoPorBack && typeof window !== "undefined" && window.history.state?.anduveModal) {
        popsDeLimpieza++;
        try {
          window.history.back();
        } catch {
          popsDeLimpieza = Math.max(0, popsDeLimpieza - 1);
        }
        // Red de seguridad: si ningún handler consumió este pop (no había
        // otro modal/vista abierta), descontarlo para que el PRÓXIMO modal
        // no se trague un ← real del usuario.
        setTimeout(() => {
          popsDeLimpieza = Math.max(0, popsDeLimpieza - 1);
        }, 400);
      }
    };
  }, [isOpen]);
}
