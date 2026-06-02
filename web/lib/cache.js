// Caché en memoria + localStorage para que la app sea MUY rápida:
// no repetir llamadas de red para la misma ciudad/lugar/imagen/ruta.

const memoria = new Map();

// Lee de caché (memoria o localStorage) o ejecuta la función y guarda.
// debeGuardar(d): predicado opcional; si devuelve false NO se cachea el
// resultado (útil para no "envenenar" la caché con respuestas vacías/fallidas
// que deberían reintentarse, p. ej. una foto que no cargó por un timeout).
export async function cacheado(clave, ttlMs, fn, debeGuardar = () => true) {
  // 1) memoria (lo más rápido)
  if (memoria.has(clave)) {
    const v = memoria.get(clave);
    if (Date.now() - v.t < ttlMs) return v.d;
  }
  // 2) localStorage (sobrevive recargas)
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem("c:" + clave);
      if (raw) {
        const v = JSON.parse(raw);
        if (Date.now() - v.t < ttlMs) {
          memoria.set(clave, v);
          return v.d;
        }
      }
    } catch {}
  }
  // 3) calcular y guardar (solo si el resultado merece cachearse)
  const d = await fn();
  if (!debeGuardar(d)) return d;
  const v = { t: Date.now(), d };
  memoria.set(clave, v);
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("c:" + clave, JSON.stringify(v));
    } catch {}
  }
  return d;
}

// fetch con timeout para no quedarnos colgados (clave para la velocidad).
export async function fetchRapido(url, opciones = {}, timeoutMs = 9000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opciones, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}
