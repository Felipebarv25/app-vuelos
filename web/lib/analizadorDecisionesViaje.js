import { evaluarTramo } from "@/lib/rutaViva";
import { costoDiario } from "@/lib/rutaViva";

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function key(p) { return `${String(p?.ciudad || "").trim().toLowerCase()}|${String(p?.pais || "").trim().toLowerCase()}`; }
function tramo(a, b) {
  const t = evaluarTramo({ desde: a, hasta: b }) || {};
  return { precio: n(t.precio), horas: n(t.puertaAPuerta_h ?? t.duracion_h), fuente: t.fuente || "sin_dato" };
}
function evaluarRuta(paradas) {
  let precio = 0; let horas = 0; let datos = 0;
  for (let i = 0; i < paradas.length - 1; i++) {
    const t = tramo(paradas[i], paradas[i + 1]);
    precio += t.precio; horas += t.horas;
    if (t.fuente === "detectado" || t.fuente === "curado") datos++;
  }
  return { precio: Math.round(precio), horas: Math.round(horas * 10) / 10, tramosConDatoFiable: datos };
}
function costeEstancia(p) {
  const noches = n(p?.noches);
  if (!noches) return 0;
  return n(costoDiario(p?.ciudad, p?.paisNombre || p?.pais)?.usd) * noches;
}

/**
 * Analiza decisiones que cambian el viaje, no solo el orden de las ciudades.
 * La eliminación de una parada siempre se marca como una propuesta: no muta
 * el viaje y deja claro qué noches y coste orientativo desaparecerían.
 */
export function analizarDecisionesViaje(paradas = []) {
  const original = Array.isArray(paradas) ? paradas.filter(Boolean) : [];
  if (original.length < 2) return { eliminar: [], resumen: "Necesitamos al menos dos ciudades." };
  const base = evaluarRuta(original);
  const eliminar = [];
  for (let i = 1; i < original.length - 1; i++) {
    const stop = original[i];
    const nueva = original.filter((_, idx) => idx !== i);
    const nuevaRuta = evaluarRuta(nueva);
    const noches = n(stop?.noches);
    const estancia = costeEstancia(stop);
    const ahorroTotal = Math.max(0, base.precio - nuevaRuta.precio) + estancia;
    const ahorroHoras = base.horas - nuevaRuta.horas;
    const costeTransporteCambio = nuevaRuta.precio - base.precio;
    const impacto = Math.max(0, Math.round(ahorroHoras * 10)) + Math.max(0, Math.round(ahorroTotal / 10));
    if (impacto < 5) continue;
    let razon;
    if (ahorroHoras >= 2 && ahorroTotal >= 50) razon = `Quitar ${stop.ciudad} simplifica la ruta y puede ahorrar tiempo y dinero.`;
    else if (ahorroHoras >= 2) razon = `Quitar ${stop.ciudad} reduce bastante el tiempo de desplazamiento.`;
    else if (ahorroTotal >= 50) razon = `Quitar ${stop.ciudad} puede liberar presupuesto para el resto del viaje.`;
    else razon = `Quitar ${stop.ciudad} simplifica ligeramente el viaje.`;
    eliminar.push({
      ciudad: stop.ciudad,
      indice: i,
      rutaResultante: nueva,
      nochesLiberadas: noches,
      ahorroAlojamientoEstimado: Math.round(estancia),
      cambioTransporte: Math.round(costeTransporteCambio),
      ahorroTotalEstimado: Math.round(ahorroTotal),
      ahorroHoras: Math.round(ahorroHoras * 10) / 10,
      razon,
      confianza: base.tramosConDatoFiable >= Math.max(1, original.length - 2) ? "media" : "baja",
    });
  }
  eliminar.sort((a, b) => (b.ahorroTotalEstimado + b.ahorroHoras * 10) - (a.ahorroTotalEstimado + a.ahorroHoras * 10));
  return { base, eliminar, mejorEliminacion: eliminar[0] || null, resumen: eliminar[0] ? `La decisión con mayor impacto potencial es revisar ${eliminar[0].ciudad}.` : "No encontramos una eliminación claramente beneficiosa con los datos disponibles." };
}
