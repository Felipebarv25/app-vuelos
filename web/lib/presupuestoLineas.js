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

// ISO-2 -> nombre en espanol. Si ya es un nombre, se devuelve tal cual.
const nombreDePaisISO = (cc) => {
  const x = String(cc || "");
  if (!/^[A-Za-z]{2}$/.test(x)) return x;
  try {
    const n = new Intl.DisplayNames(["es"], { type: "region" }).of(x.toUpperCase());
    return n && n !== x.toUpperCase() ? n : x;
  } catch {
    return x;
  }
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
    // El NOMBRE del pais, traduciendo el ISO si es lo unico que hay. El
    // catalogo de costo de vida se indexa por nombre ("Espana", no "ES"), asi
    // que sin esto Madrid caia a la media mundial. Arregle nombreDePais() en
    // rutaViva.js por el mismo motivo, pero ESTA es la ruta que usa el
    // constructor del presupuesto: llama a costoDiario() con la cadena
    // directa, sin pasar por alli.
    pais: p.paisNombre || nombreDePaisISO(p.pais),
    // El ISO y las coordenadas viajan tambien: de ellos salen los enlaces de
    // reserva, y con el nombre a secas el buscador del afiliado resolvia
    // "York" como Nueva York.
    iso: p.pais,
    lat: p.lat,
    lon: p.lon,
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

export function agruparPorCategoria(lineas, overrides = {}, porUsd = {}) {
  const m = new Map();
  for (const l of lineas) {
    const v = m.get(l.categoria) || { categoria: l.categoria, total: 0, lineas: [] };
    // Los totales se suman SIEMPRE en dolares: en una misma categoria puede
    // haber libras (visa britanica) y euros (ETIAS), y sumarlos a pelo daria
    // un numero sin significado.
    v.total += convertir(montoEfectivo(l, overrides), l.moneda || "USD", "USD", porUsd);
    v.lineas.push(l);
    m.set(l.categoria, v);
  }
  return CATEGORIAS.map((c) => m.get(c)).filter(Boolean);
}

// --- Multimoneda -------------------------------------------------------------
//
// Cada linea guarda su monto en su MONEDA NATURAL: la visa britanica en libras,
// el ETIAS en euros, el hotel en dolares. Convertir al guardar acumularia error
// sobre datos que son exactos en origen — una tarifa consular no es una
// estimacion — y ademas ataria el dato guardado a la tasa del dia en que se
// escribio.
//
// La conversion se hace solo para MOSTRAR, y siempre con la tasa y su fecha a
// la vista.

/** Pasa un monto de una moneda a otra. `porUsd`: cuantas unidades = 1 USD. */
export function convertir(monto, de = "USD", a = "USD", porUsd = {}) {
  const n = Number(monto) || 0;
  if (!n || de === a) return n;
  const tasaDe = de === "USD" ? 1 : porUsd?.[de];
  const tasaA = a === "USD" ? 1 : porUsd?.[a];
  // Sin tasa no se inventa una: se devuelve el monto tal cual, y la interfaz
  // ya avisa de que las tasas son de respaldo.
  if (!tasaDe || !tasaA) return n;
  return (n / tasaDe) * tasaA;
}

/** El monto que manda, en dolares. Es la unidad en la que se suma todo. */
export function montoUSD(linea, overrides = {}, porUsd = {}) {
  return convertir(montoEfectivo(linea, overrides), linea.moneda || "USD", "USD", porUsd);
}

// --- NIVELES DE GASTO --------------------------------------------------------
//
// Tres formas de hacer el mismo viaje. NO es un factor sobre el total: cada
// rubro se mueve lo que se mueve de verdad, y eso cambia mucho de uno a otro.
//
// Un dormitorio compartido cuesta como un 40% de un hotel de 3 estrellas, pero
// comer en mercado no baja al 40% de comer en restaurante: baja a la mitad,
// porque el pan y la fruta cuestan lo que cuestan en cualquier parte. Y el
// transporte publico apenas se mueve — el metro vale igual para todos —, asi
// que el que menos varia es justo el que un factor global castigaria mas.
//
// El nivel MEDIO es 1.00 por definicion: el catalogo de costo de vida
// (DESTINOS_PRESUPUESTO) esta calibrado para "turista de gama media", asi que
// el balanceado no multiplica nada. Los otros dos se apartan de esa referencia.
//
// Las proporciones salen de rangos publicados de alojamiento y comida por
// categoria, no de una corazonada; van redondeadas y son discutibles de un
// solo sitio.
export const NIVELES = {
  mochilero: {
    clave: "mochilero",
    // Hospedaje: dormitorio o hostal privado barato frente a un 3 estrellas.
    hospedaje: 0.4,
    // Comida: mercado, comida de calle y cocinar. No baja tanto como el
    // hospedaje porque el ingrediente cuesta lo que cuesta.
    comida: 0.55,
    // Transporte local: metro y bus, igual que el medio pero sin taxis.
    transporte: 0.75,
    // Actividades: lo gratis primero, alguna entrada suelta.
    actividades: 0.5,
    // Tramos ESTIMADOS (los que no tienen precio real): bus y tren nocturno.
    tramoEstimado: 0.85,
    // Tasa turistica municipal: casi siempre escala con la categoria del hotel.
    tasaTuristica: 0.6,
    seguroDia: 1.5,
    esim: 12,
    trasladoAeropuerto: 8,
    lavanderiaPorCarga: 8,
    // Equipaje: viajar con lo de mano es la norma, no un sacrificio.
    equipaje: 0,
    // Sin mejora de clase.
    mejoraClase: 0,
    // Para filtrar el buscador de hoteles del enlace de reserva.
    estrellas: 1,
  },
  medio: {
    clave: "medio",
    hospedaje: 1,
    comida: 1,
    transporte: 1,
    actividades: 1,
    tramoEstimado: 1,
    tasaTuristica: 1,
    seguroDia: 2.5,
    esim: 20,
    trasladoAeropuerto: 18,
    lavanderiaPorCarga: 12,
    equipaje: 70,
    mejoraClase: 0,
    estrellas: 3,
  },
  comodo: {
    clave: "comodo",
    // Hospedaje: 4-5 estrellas frente a 3. Es el rubro que mas se dispara.
    hospedaje: 2.4,
    // Comida: restaurante a diario, alguna cena buena.
    comida: 1.9,
    // Transporte local: taxi y traslados privados en vez de metro.
    transporte: 2.2,
    // Actividades: tours guiados, entradas sin cola, experiencias.
    actividades: 2,
    tramoEstimado: 1.45,
    tasaTuristica: 1.8,
    seguroDia: 5,
    esim: 35,
    trasladoAeropuerto: 45,
    lavanderiaPorCarga: 25,
    // Dos maletas facturadas y seleccion de asiento.
    equipaje: 160,
    // Mejora a premium economy sobre el tramo largo. En largo radio la premium
    // economy cuesta del orden de 2,2 veces la economica; el salto sobre la
    // tarifa detectada es lo que se cobra aparte, no el billete entero.
    mejoraClase: 1.2,
    estrellas: 5,
  },
};

export const NIVEL_POR_DEFECTO = "medio";

export const nivelDe = (clave) => NIVELES[clave] || NIVELES[NIVEL_POR_DEFECTO];
