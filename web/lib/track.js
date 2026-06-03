// Envía un evento de uso al panel de métricas, sin bloquear ni romper nada si
// falla (best-effort). No recoge datos personales: solo agregados de uso.
export function track(tipo, datos = {}) {
  try {
    const cuerpo = JSON.stringify({ tipo, ...datos });
    // sendBeacon es ideal (no retrasa la navegación); fetch como respaldo.
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", new Blob([cuerpo], { type: "application/json" }));
    } else {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: cuerpo, keepalive: true }).catch(() => {});
    }
  } catch {}
}

// Cuenta UNA visita por sesión de navegador (no por recarga). Envía además el
// idioma y la hora local del visitante (para métricas de mercado y hora pico).
export function trackVisita(lang) {
  const extra = { lang: lang || null, hora: new Date().getHours() };
  try {
    if (typeof sessionStorage === "undefined") return track("visita", extra);
    if (sessionStorage.getItem("v360_visita")) return;
    sessionStorage.setItem("v360_visita", "1");
    track("visita", extra);
  } catch {
    track("visita", extra);
  }
}
