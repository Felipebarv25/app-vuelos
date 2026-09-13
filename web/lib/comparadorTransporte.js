import { distanciaKm, evaluarTramo, puertaAPuerta } from "@/lib/rutaViva";
import { puntuarTransporte } from "@/lib/puntuadorTransporte";

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }
function redondear(v, d = 1) { return v == null ? null : Math.round(v * 10 ** d) / 10 ** d; }

export function compararTransporte(desde, hasta, contexto = {}) {
  const km = distanciaKm(desde, hasta);
  const principal = evaluarTramo({ desde, hasta });
  const alternativas = [];
  if (principal?.medio) {
    alternativas.push({ medio: principal.medio, precio: num(principal.precio), duracion_h: num(principal.duracion_h), puertaAPuerta_h: num(principal.puertaAPuerta_h), fuente: principal.fuente, operador: principal.operador || "", disponible: true, nota: principal.fuente === "curado" ? "Referencia curada para este tramo." : principal.fuente === "detectado" ? "Precio detectado recientemente." : "Estimación por distancia." });
  }
  if (km == null || km < 40) return { km, alternativas: puntuarTransporte(alternativas, contexto) };
  const mismoPais = String(desde?.pais || "").toLowerCase() === String(hasta?.pais || "").toLowerCase();
  if (km <= 1200 && mismoPais && principal?.medio !== "tren") {
    const dur = Math.max(0.7, km / 125);
    alternativas.push({ medio: "tren", precio: Math.round(Math.max(25, km * 0.11)), duracion_h: redondear(dur), puertaAPuerta_h: puertaAPuerta("tren", dur), fuente: "estimado", operador: "", disponible: true, nota: "Estimación heurística; comprobar disponibilidad y tarifa real." });
  }
  if (km <= 1500 && principal?.medio !== "bus") {
    const dur = Math.max(0.8, km / 72);
    alternativas.push({ medio: "bus", precio: Math.round(Math.max(15, km * 0.075)), duracion_h: redondear(dur), puertaAPuerta_h: puertaAPuerta("bus", dur), fuente: "estimado", operador: "", disponible: true, nota: "Estimación heurística; no es una tarifa consultada." });
  }
  if (km >= 400 && principal?.medio !== "vuelo") {
    const dur = Math.max(1.1, 1.2 + km / 850);
    alternativas.push({ medio: "vuelo", precio: Math.round(Math.max(55, km * 0.105)), duracion_h: redondear(dur), puertaAPuerta_h: puertaAPuerta("vuelo", dur), fuente: "estimado", operador: "", disponible: true, nota: "Estimación heurística; depende de fecha, aeropuerto y equipaje." });
  }
  return { km, alternativas: puntuarTransporte(alternativas, contexto) };
}
