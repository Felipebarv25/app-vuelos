// Modelo canonico de "Mi viaje".
//
// No duplica datos derivados (precios, transporte, itinerario): solo normaliza
// la identidad y las decisiones persistentes del viajero. Los motores existentes
// (rutaViva, presupuesto, vuelos, requisitos, etc.) siguen siendo la fuente de
// calculo.
//
// Durante la migracion conviviran dos almacenes:
//   - /api/rutas: modelo canonico multiparada (preferido para Mi viaje)
//   - /api/viajes: legacy de una sola ciudad (compatibilidad)
//
// Este adaptador permite que la UI trabaje con UN contrato sin obligarnos a
// migrar o borrar datos antiguos de golpe.

export const TRIP_SCHEMA_VERSION = 3;

const LIMITE_CIUDADES = 30;

function texto(v, max = 120) {
  return String(v ?? "").trim().slice(0, max);
}

function numero(v, defecto = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : defecto;
}

function noches(v) {
  return Math.max(0, Math.min(365, Math.round(numero(v, 0))));
}

function normalizarParada(p, index = 0) {
  return {
    id: texto(p?.id, 80) || `stop-${index + 1}`,
    ciudad: texto(p?.ciudad || p?.nombre, 80),
    pais: texto(p?.pais || p?.paisIso, 80),
    paisNombre: texto(p?.paisNombre, 80),
    iata: /^[A-Za-z]{3}$/.test(p?.iata || "") ? String(p.iata).toUpperCase() : "",
    lat: numero(p?.lat),
    lon: numero(p?.lon),
    noches: noches(p?.noches),
  };
}

function paradasDeLegacy(viaje) {
  if (!viaje?.ciudad?.nombre) return [];
  return [normalizarParada({
    ciudad: viaje.ciudad.nombre,
    pais: viaje.ciudad.pais || viaje.ciudad.iso || "",
    paisNombre: viaje.ciudad.paisNombre || viaje.ciudad.pais || "",
    iata: viaje.ciudad.iata || viaje.iata,
    lat: viaje.ciudad.lat,
    lon: viaje.ciudad.lon,
    noches: viaje.noches,
  })];
}

function presupuestoSeguro(p) {
  const overrides = {};
  if (p?.overrides && typeof p.overrides === "object") {
    for (const [k, v] of Object.entries(p.overrides).slice(0, 200)) {
      const n = numero(v);
      if (n != null && n >= 0) overrides[String(k).slice(0, 80)] = Math.round(n);
    }
  }
  return {
    overrides,
    ajustes: {
      contingenciaPct: numero(p?.ajustes?.contingenciaPct, 0.1),
      margenCambiarioPct: numero(p?.ajustes?.margenCambiarioPct, 0.03),
    },
  };
}

/**
 * Convierte una ruta v2/v3 o un viaje legacy en el contrato que consume
 * "Mi viaje". No hace llamadas de red y no calcula precios.
 */
export function normalizarViaje(viaje, origen = "ruta") {
  if (!viaje || typeof viaje !== "object") return null;

  const legacy = origen === "legacy" || (!Array.isArray(viaje.paradas) && viaje.ciudad);
  const rawParadas = legacy ? paradasDeLegacy(viaje) : viaje.paradas;
  const paradas = (Array.isArray(rawParadas) ? rawParadas : [])
    .slice(0, LIMITE_CIUDADES)
    .map(normalizarParada)
    .filter((p) => p.ciudad);

  const mesInicio = texto(viaje.mesInicio || viaje.fechaInicio, 7).slice(0, 7);
  const fechaIda = /^\d{4}-\d{2}-\d{2}$/.test(viaje.fechaIda || "") ? viaje.fechaIda : "";

  return {
    schemaVersion: TRIP_SCHEMA_VERSION,
    id: texto(viaje.id, 80),
    nombre: texto(viaje.nombre, 120) || (paradas.length ? `${paradas[0].ciudad} → ${paradas[paradas.length - 1].ciudad}` : "Mi viaje"),
    paradas,
    viajeros: Math.max(1, Math.min(20, Math.round(numero(viaje.viajeros, 1)))),
    mesInicio,
    fechaIda,
    moneda: texto(viaje.moneda, 3).toUpperCase() || "USD",
    monedaVista: texto(viaje.monedaVista, 3).toUpperCase() || "COP",
    pasaporte: /^[A-Za-z]{2}$/.test(viaje.pasaporte || "") ? viaje.pasaporte.toUpperCase() : "CO",
    nivel: ["mochilero", "medio", "comodo"].includes(viaje.nivel) ? viaje.nivel : "medio",
    presupuesto: presupuestoSeguro(viaje.presupuesto),
    creada: numero(viaje.creada || viaje.guardadoEn, null),
    actualizada: numero(viaje.actualizada || viaje.guardadoEn, null),
    origenModelo: legacy ? "legacy" : "ruta",
    esLegacy: legacy,
  };
}

/**
 * Devuelve un resumen barato para la UI. Todo lo que requiera datos externos
 * debe calcularse fuera de este adaptador para evitar que el modelo canonico
 * se convierta en una copia obsoleta de precios.
 */
export function resumenViaje(viaje) {
  const t = normalizarViaje(viaje, viaje?.esLegacy ? "legacy" : "ruta");
  if (!t) return null;
  return {
    id: t.id,
    nombre: t.nombre,
    ciudades: t.paradas.map((p) => p.ciudad),
    paises: [...new Set(t.paradas.map((p) => p.pais).filter(Boolean))],
    noches: t.paradas.reduce((s, p) => s + p.noches, 0),
    viajeros: t.viajeros,
    mesInicio: t.mesInicio,
    preparado: Boolean(t.mesInicio) && t.paradas.length >= 2,
  };
}
