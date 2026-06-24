"use client";
// Reporter de Web Vitals (LCP + CLS) usando APIs nativas del browser,
// sin dependencias. Captura las métricas durante la vida de la página y
// las envía a /api/vitals via sendBeacon cuando el usuario sale (más
// confiable que fetch — funciona aunque el browser esté navegando).
//
// LCP (Largest Contentful Paint): tiempo en ms hasta que el elemento
// más grande visible terminó de pintarse. Bueno: <2500ms.
// CLS (Cumulative Layout Shift): suma de saltos visuales (0 a ~5).
// Bueno: <0.1.

import { useEffect } from "react";

export default function VitalsReporter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("PerformanceObserver" in window)) return;

    // Solo reportamos en producción para no contaminar las métricas
    // con builds de desarrollo.
    if (window.location.hostname === "localhost") return;

    let lcp = 0;
    let cls = 0;
    const ruta = window.location.pathname;

    // LCP: el último entry observado es el valor final.
    try {
      const obsLcp = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const ultimo = entries[entries.length - 1];
        if (ultimo) lcp = Math.round(ultimo.startTime);
      });
      obsLcp.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    // CLS: se va acumulando durante la vida de la página.
    try {
      const obsCls = new PerformanceObserver((list) => {
        for (const e of list.getEntries()) {
          if (!e.hadRecentInput) cls += e.value;
        }
      });
      obsCls.observe({ type: "layout-shift", buffered: true });
    } catch {}

    // Reportar al salir de la página o cuando va a background (mobile).
    // sendBeacon es preferido — el browser lo manda aunque la página
    // ya esté navegando.
    let reportado = false;
    const enviar = () => {
      if (reportado) return;
      if (lcp === 0 && cls === 0) return; // nada que reportar
      reportado = true;
      const payload = JSON.stringify({
        lcp,
        cls: Math.round(cls * 10000) / 10000, // 4 decimales
        ruta: ruta.slice(0, 100),
        ts: Date.now(),
      });
      try {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon?.("/api/vitals", blob);
      } catch {}
    };

    // Múltiples triggers: pagehide es el más confiable; visibilitychange
    // también dispara cuando el user mete la app al background sin cerrar.
    addEventListener("pagehide", enviar, { once: true });
    addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") enviar();
    });

    return () => {
      // No removemos los listeners — sendBeacon es one-shot. Si el
      // usuario navega internamente dentro del SPA, el reporte ya se
      // mandó y el flag `reportado` evita duplicados.
    };
  }, []);

  return null;
}
