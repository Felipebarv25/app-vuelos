// Motor de RUTAS MULTIPARADA: el viajero dicta sus ciudades y su orden, y esto
// calcula qué cuesta y cómo moverse entre ellas.
//
// Es el inverso del planificador de presupuesto (lib/presupuesto.js), que parte
// de cuánta plata hay y PROPONE ciudades. Aquí las ciudades ya están decididas.
//
// Diseñado para funcionar con CUALQUIER ciudad del mundo, no solo con las 207
// del catálogo curado. Cada dato tiene una cadena de respaldo y siempre declara
// de dónde salió, para que la interfaz no presente una estimación geométrica
// como si fuera un precio de mercado:
//
//   coordenadas   catálogo curado -> geocodificador (Photon) -> sin dato
//   costo diario  ciudad curada -> mediana del país -> mediana de región -> global
//   tramo         vuelo real detectado -> tramo curado -> estimación por distancia
import { DESTINOS_PRESUPUESTO } from "./presupuesto";
import { costoTramoReal } from "./tramos";

// --- Geometría --------------------------------------------------------------
const R_TIERRA_KM = 6371;
const rad = (g) => (g * Math.PI) / 180;

export function distanciaKm(a, b) {
  if (a?.lat == null || a?.lon == null || b?.lat == null || b?.lon == null) return null;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R_TIERRA_KM * Math.asin(Math.sqrt(s)));
}

// --- Índices sobre el catálogo curado ---------------------------------------
const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

const PorCiudad = new Map();
const PorPais = new Map();
const PorRegion = new Map();
for (const d of DESTINOS_PRESUPUESTO) {
  PorCiudad.set(`${norm(d.ciudad)}|${norm(d.pais)}`, d);
  if (!PorPais.has(norm(d.pais))) PorPais.set(norm(d.pais), []);
  PorPais.get(norm(d.pais)).push(d);
  if (!PorRegion.has(d.region)) PorRegion.set(d.region, []);
  PorRegion.get(d.region).push(d);
}

function mediana(nums) {
  if (!nums.length) return null;
  const o = [...nums].sort((x, y) => x - y);
  const m = o.length;
  return m % 2 ? o[(m - 1) / 2] : Math.round((o[m / 2 - 1] + o[m / 2]) / 2);
}

const DIA_GLOBAL = mediana(DESTINOS_PRESUPUESTO.map((d) => d.dia)) || 80;

/**
 * Costo diario por persona (cama + comida + transporte local + algo de ocio) en
 * USD. Siempre devuelve una cifra usable y dice qué tan buena es.
 */
export function costoDiario(ciudad, pais, region = null) {
  const exacta = PorCiudad.get(`${norm(ciudad)}|${norm(pais)}`);
  if (exacta) return { usd: exacta.dia, fuente: "ciudad" };

  const delPais = PorPais.get(norm(pais));
  if (delPais?.length) {
    const m = mediana(delPais.map((d) => d.dia));
    // Las ciudades curadas de un país suelen ser la capital y las turísticas
    // caras; una secundaria sale típicamente por debajo de esa mediana.
    return { usd: Math.round(m * 0.85), fuente: "pais" };
  }

  const reg = region && PorRegion.get(region);
  if (reg?.length) return { usd: mediana(reg.map((d) => d.dia)), fuente: "region" };

  return { usd: DIA_GLOBAL, fuente: "global" };
}

/** Coordenadas desde el catálogo curado. null si toca geocodificar. */
export function coordsCuradas(ciudad, pais) {
  const d = PorCiudad.get(`${norm(ciudad)}|${norm(pais)}`);
  return d ? { lat: d.lat, lon: d.lon } : null;
}

// --- Tiempo puerta a puerta -------------------------------------------------
// Comparar 1,2 h de vuelo contra 4,5 h de tren es mentir: al vuelo hay que
// sumarle llegar al aeropuerto, control, embarque y salir del otro lado. Estas
// son las horas que se pierden fuera del vehículo, por trayecto.
const SOBRECARGA_H = { vuelo: 3.5, tren: 0.5, bus: 0.4, ferry: 0.8, carro: 0.2 };

export function puertaAPuerta(medio, duracionH) {
  const extra = SOBRECARGA_H[medio] ?? 0.5;
  return Math.round((Number(duracionH || 0) + extra) * 10) / 10;
}

// --- Evaluación de un tramo -------------------------------------------------
/**
 * @param {object} p
 * @param {object} p.desde  {ciudad, pais, lat, lon}
 * @param {object} p.hasta  {ciudad, pais, lat, lon}
 * @param {object} [p.vueloReal] {precio, duracion_h, aerolinea} si el detector
 *        ya tiene esa ruta escaneada
 * @returns {{medio, precio, duracion_h, puertaAPuerta_h, operador, fuente, km}}
 *          fuente: "detectado" | "curado" | "estimado" | "sin-datos"
 */
export function evaluarTramo({ desde, hasta, vueloReal = null }) {
  const km = distanciaKm(desde, hasta);

  // 1) Precio real del detector: el único dato de mercado que tenemos propio.
  if (vueloReal && Number(vueloReal.precio) > 0) {
    const dur = Number(vueloReal.duracion_h) || (km ? 2 + km / 800 : 3);
    return {
      medio: "vuelo",
      precio: Math.round(Number(vueloReal.precio)),
      duracion_h: Math.round(dur * 10) / 10,
      puertaAPuerta_h: puertaAPuerta("vuelo", dur),
      operador: vueloReal.aerolinea || "",
      fuente: "detectado",
      km,
    };
  }

  if (km == null) {
    return {
      medio: null, precio: null, duracion_h: null, puertaAPuerta_h: null,
      operador: "", fuente: "sin-datos", km: null,
    };
  }

  // 2) tabla curada de trenes/buses  3) estimación geométrica
  const r = costoTramoReal(desde, hasta, km);
  return {
    medio: r.medio,
    precio: Math.round(r.precio),
    duracion_h: Math.round(r.duracion_h * 10) / 10,
    puertaAPuerta_h: puertaAPuerta(r.medio, r.duracion_h),
    operador: r.operador || "",
    fuente: r.esCurado ? "curado" : "estimado",
    km,
  };
}

// --- Zigzag -----------------------------------------------------------------
/**
 * Detecta si el orden elegido da rodeos evitables. NO mueve la primera ni la
 * última parada: casi siempre son la salida y el regreso a casa, y cambiarlas
 * rompería el viaje. Solo permuta las intermedias, y solo propone el cambio si
 * el ahorro se nota.
 */
export function detectarZigzag(paradas, umbralPct = 15) {
  if (!Array.isArray(paradas) || paradas.length < 4) return { hayZigzag: false };
  if (paradas.some((p) => p.lat == null || p.lon == null)) return { hayZigzag: false };

  const largo = (orden) => {
    let t = 0;
    for (let i = 0; i < orden.length - 1; i++) t += distanciaKm(orden[i], orden[i + 1]) || 0;
    return t;
  };
  const actual = largo(paradas);

  // Vecino más cercano sobre las intermedias, con extremos fijos.
  const inicio = paradas[0];
  const fin = paradas[paradas.length - 1];
  const pendientes = paradas.slice(1, -1);
  const ruta = [inicio];
  let cursor = inicio;
  while (pendientes.length) {
    let mejor = 0;
    let mejorD = Infinity;
    for (let i = 0; i < pendientes.length; i++) {
      const d = distanciaKm(cursor, pendientes[i]) ?? Infinity;
      if (d < mejorD) { mejorD = d; mejor = i; }
    }
    cursor = pendientes.splice(mejor, 1)[0];
    ruta.push(cursor);
  }
  ruta.push(fin);
  const optimo = largo(ruta);

  const ahorroKm = actual - optimo;
  const pct = actual > 0 ? Math.round((ahorroKm / actual) * 100) : 0;
  if (pct < umbralPct) return { hayZigzag: false, kmActual: actual, kmOptimo: optimo };

  return {
    hayZigzag: true,
    kmActual: actual,
    kmOptimo: optimo,
    ahorroKm,
    ahorroPct: pct,
    ordenSugerido: ruta.map((p) => p.ciudad),
  };
}

// --- Resumen de la ruta completa --------------------------------------------
/**
 * @param {object} p
 * @param {Array}  p.paradas [{ciudad, pais, lat, lon, noches, region}]
 * @param {Array}  p.tramos  salida de evaluarTramo() para cada par consecutivo
 * @param {number} p.viajeros
 */
export function resumenRuta({ paradas = [], tramos = [], viajeros = 1 }) {
  const n = Math.max(1, Number(viajeros) || 1);

  const transporte = tramos.reduce((s, t) => s + (t.precio || 0), 0);
  const horas = tramos.reduce((s, t) => s + (t.puertaAPuerta_h || 0), 0);

  // En la primera parada no se duerme: es de donde sales.
  const porCiudad = [];
  let estadia = 0;
  for (const p of paradas.slice(1)) {
    const noches = Math.max(0, Number(p.noches) || 0);
    const cd = costoDiario(p.ciudad, p.pais, p.region);
    const sub = noches * cd.usd;
    estadia += sub;
    porCiudad.push({
      ciudad: p.ciudad, pais: p.pais, noches,
      diario: cd.usd, fuenteDiario: cd.fuente, subtotal: sub,
    });
  }

  const noches = porCiudad.reduce((s, c) => s + c.noches, 0);
  const porPersona = transporte + estadia;

  return {
    transporte,
    estadia,
    porCiudad,
    noches,
    dias: noches + 1,
    horasEnMovimiento: Math.round(horas * 10) / 10,
    porPersona,
    total: porPersona * n,
    viajeros: n,
    // Cuánto del total descansa en cifras de mercado y cuánto en estimaciones.
    confianza: {
      detectados: tramos.filter((t) => t.fuente === "detectado").length,
      curados: tramos.filter((t) => t.fuente === "curado").length,
      estimados: tramos.filter((t) => t.fuente === "estimado").length,
      total: tramos.length,
    },
  };
}
