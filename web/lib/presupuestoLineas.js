// EL presupuesto. Una sola representacion, compartida por los dos modos.
//
// Hasta ahora habia dos: el asesor hablaba de "Hospedaje/Comida" en COP y el
// planificador manual de "Dormir/Comer" en USD, con numeros que no siempre
// cuadraban del mismo viaje. Y ninguno de los dos podia explicarse: el
// desglose era un objeto plano de cinco numeros, sin de donde salen, sin
// poder tocarlos y sin nada que decir sobre equipaje, visas, seguro, tasas o
// un colchon para imprevistos.
//
// Aqui cada gasto es una LINEA con todo lo que hace falta para creersela:
// de donde sale la cifra, con que formula, que confianza merece, si escala
// por persona o se comparte, y si el usuario la piso a mano.
//
// REGLA QUE NO SE ROMPE: ninguna cifra sale de la nada. Toda linea lleva
// `fuente`. Si no hay dato, va en 0 con nota — nunca se omite en silencio,
// porque un presupuesto al que le falta una linea miente mas que uno alto.

import { REPARTO_DIARIO } from "./presupuesto";
import { costoDiario } from "./rutaViva";

export const CATEGORIAS = [
  "pre_viaje",
  "transporte_internacional",
  "transporte_entre_ciudades",
  "transporte_local",
  "hospedaje",
  "alimentacion",
  "actividades",
  "varios",
  "colchon",
];

// --- Bases de costo ---------------------------------------------------------
//
// Valores tipicos documentados, NO precios de mercado. Cada uno se etiqueta
// como `estimado` y dice sobre que se estima, que es la unica forma honesta de
// poner un numero donde no hay una consulta real detras. Estan juntos y con
// nombre para que se puedan discutir y ajustar de un sitio.
export const BASES = {
  // Equipaje facturado en vuelo de largo radio, ida y vuelta, por persona.
  equipajeLargoRadio: 70,
  // Traslado aeropuerto <-> centro, por trayecto y por grupo (no por persona:
  // en taxi o bus lanzadera se va junto).
  trasladoAeropuerto: 18,
  // Seguro de viaje por persona y dia.
  seguroDia: 2.5,
  // eSIM o plan de datos regional, por persona y viaje.
  esim: 20,
  // Lavanderia: una carga cada siete dias, por grupo.
  lavanderiaPorCarga: 12,
  diasPorCarga: 7,
  // Comision tipica de cambio o retiro en cajero, sobre el gasto en destino.
  comisionCambioPct: 0.03,
  // Colchon para imprevistos, sobre el total antes de colchon.
  contingenciaPct: 0.10,
  // Margen por si la tasa de cambio se mueve entre hoy y el viaje.
  margenCambiarioPct: 0.03,
  // Cuantas personas caben en una habitacion.
  personasPorHabitacion: 2,
};

// Tasa turistica municipal por noche y persona (USD aprox). Solo ciudades que
// la cobran de verdad; el resto va a 0 CON NOTA, que no es lo mismo que no
// mencionarla. Fuente: tarifas municipales publicadas, 2026.
export const TASA_TURISTICA = {
  amsterdam: 6.5, paris: 5.0, roma: 6.0, florencia: 5.5, venecia: 5.0,
  milan: 5.0, barcelona: 4.0, madrid: 0, lisboa: 2.0, oporto: 2.0,
  berlin: 3.0, munich: 0, viena: 3.2, praga: 2.2, budapest: 4.0,
  bruselas: 4.2, dubrovnik: 2.5, atenas: 1.5, edimburgo: 0, londres: 0,
};

const norm = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

let _n = 0;
const uid = (pre) => `${pre}_${++_n}`;

/**
 * Una linea de gasto. Todos los campos de la especificacion, con valores por
 * defecto sensatos para no obligar a repetirlos en cada llamada.
 */
export function crearLinea({
  id,
  concepto,
  categoria,
  monto,
  moneda = "USD",
  formula = "",
  fuente = "",
  confianza = "estimado",
  editable = true,
  monetizable = false,
  proveedorAfiliado = null,
  urlAfiliado = null,
  porPersona = false,
  base = "viaje", // "noche" | "dia" | "viaje" | "tramo"
  nota = "",
  ciudad = null,
}) {
  return {
    id: id || uid(categoria),
    concepto,
    categoria,
    monto: Math.max(0, Math.round(Number(monto) || 0)),
    moneda,
    formula,
    fuente,
    confianza,
    editable,
    monetizable,
    proveedorAfiliado,
    urlAfiliado,
    porPersona,
    base,
    nota,
    ciudad,
  };
}

/** Cuantos dias dura el viaje: N noches son N+1 dias. */
export const diasDeNoches = (noches) => Math.max(1, Math.round(noches) + 1);

/**
 * Reparte los dias del viaje entre las ciudades donde se duerme.
 *
 * La distincion importa y era el bug silencioso mas caro del motor viejo:
 * cobraba comida, transporte local y actividades por NOCHE. Un viaje de tres
 * noches pagaba tres dias de comida cuando se comen cuatro. Con veinte
 * noches eso es un dia entero de gasto que no aparecia por ningun lado.
 *
 * El dia extra se le asigna a la ultima ciudad, que es donde de verdad se
 * pasa: se desayuna y se llega al aeropuerto.
 */
export function diasPorCiudad(paradas) {
  const conNoches = paradas.slice(1).map((p) => ({
    ciudad: p.ciudad,
    pais: p.paisNombre || p.pais,
    region: p.region,
    noches: Math.max(0, Number(p.noches) || 0),
  }));
  const vivas = conNoches.filter((c) => c.noches > 0);
  if (!vivas.length) return conNoches.map((c) => ({ ...c, dias: 0 }));
  const ultimaConNoches = vivas[vivas.length - 1];
  return conNoches.map((c) => ({
    ...c,
    dias: c.noches + (c === ultimaConNoches ? 1 : 0),
  }));
}

/** Clave estable para los ids de linea (sin acentos ni espacios). */
export const normalizarClave = (s) => norm(s).replace(/[^a-z0-9]+/g, "_");

/**
 * El monto que manda: el que fijo el usuario, si lo fijo.
 *
 * El override es lo que separa un presupuesto de una estimacion. El viajero
 * sabe cosas que nosotros no — que duerme en casa de un amigo en Londres, que
 * ya tiene el vuelo —, y hasta ahora no habia donde decirlo. Sobrevive a los
 * recalculos porque se guarda por id de linea, no por posicion.
 */
export function montoEfectivo(linea, overrides = {}) {
  const o = overrides?.[linea.id];
  return o != null && Number.isFinite(Number(o)) ? Math.max(0, Number(o)) : linea.monto;
}

export const estaEditada = (linea, overrides = {}) =>
  overrides?.[linea.id] != null && Number.isFinite(Number(overrides[linea.id]));

export function agruparPorCategoria(lineas, overrides = {}) {
  const m = new Map();
  for (const l of lineas) {
    const v = m.get(l.categoria) || { categoria: l.categoria, total: 0, lineas: [] };
    v.total += montoEfectivo(l, overrides);
    v.lineas.push(l);
    m.set(l.categoria, v);
  }
  return CATEGORIAS.map((c) => m.get(c)).filter(Boolean);
}
