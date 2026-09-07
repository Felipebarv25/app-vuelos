import { distanciaKm, evaluarTramo, puertaAPuerta } from "@/lib/rutaViva";

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function redondear(v, d = 1) { return v == null ? null : Math.round(v * 10 ** d) / 10 ** d; }

/**
 * Genera una comparación PRELIMINAR de medios.
 *
 * Importante: solo el resultado de evaluarTramo() puede venir de un dato curado
 * o detectado. Las alternativas generadas aquí son heurísticas y se etiquetan
 * explícitamente como estimadas; no deben presentarse como una tarifa real.
 */
export function compararTransporte(desde, hasta) {
  const km = distanciaKm(desde, hasta);
  const principal = evaluarTramo({ desde, hasta });
  const alternativas = [];

  if (principal?.medio) {
    alternativas.push({
      medio: principal.medio,
      precio: num(principal.precio),
      duracion_h: num(principal.duracion_h),
      puertaAPuerta_h: num(principal.puertaAPuerta_h),
      fuente: principal.fuente,
      operador: principal.operador || "",
      disponible: true,
      recomendado: true,
      nota: principal.fuente === "curado" ? "Referencia curada para este tramo." : principal.fuente === "detectado" ? "Precio detectado recientemente." : "Estimación por distancia.",
    });
  }

  if (km == null || km < 40) return { km, alternativas };

  const mismoPais = String(desde?.pais || "").toLowerCase() === String(hasta?.pais || "").toLowerCase();

  // El tren heurístico solo aparece como alternativa cuando el salto es
  // razonable. No sustituye la tabla curada: se muestra como "estimado".
  if (km <= 1200 && mismoPais && principal?.medio !== "tren") {
    const dur = Math.max(0.7, km / 125);
    alternativas.push({
      medio: "tren",
      precio: Math.round(Math.max(25, km * 0.11)),
      duracion_h: redondear(dur),
      puertaAPuerta_h: puertaAPuerta("tren", dur),
      fuente: "estimado",
      operador: "",
      disponible: true,
      recomendado: false,
      nota: "Estimación heurística; comprobar disponibilidad y tarifa real antes de comprar.",
    });
  }

  if (km <= 1500 && principal?.medio !== "bus") {
    const dur = Math.max(0.8, km / 72);
    alternativas.push({
      medio: "bus",
      precio: Math.round(Math.max(15, km * 0.075)),
      duracion_h: redondear(dur),
      puertaAPuerta_h: puertaAPuerta("bus", dur),
      fuente: "estimado",
      operador: "",
      disponible: true,
      recomendado: false,
      nota: "Estimación heurística; no representa una tarifa consultada en tiempo real.",
    });
  }

  if (km >= 400 && principal?.medio !== "vuelo") {
    const dur = Math.max(1.1, 1.2 + km / 850);
    alternativas.push({
      medio: "vuelo",
      precio: Math.round(Math.max(55, km * 0.105)),
      duracion_h: redondear(dur),
      puertaAPuerta_h: puertaAPuerta("vuelo", dur),
      fuente: "estimado",
      operador: "",
      disponible: true,
      recomendado: false,
      nota: "Estimación heurística; el precio real depende de fecha, aeropuerto y equipaje.",
    });
  }

  const validas = alternativas.filter((x) => x.precio != null && x.puertaAPuerta_h != null);
  if (validas.length) {
    const mejor = validas.reduce((best, x) => {
      const score = x.puertaAPuerta_h + x.precio * 0.025;
      const bestScore = best.puertaAPuerta_h + best.precio * 0.025;
      return score < bestScore ? x : best;
    }, validas[0]);
    for (const x of alternativas) x.recomendado = x === mejor;
  }

  return { km, alternativas };
}
