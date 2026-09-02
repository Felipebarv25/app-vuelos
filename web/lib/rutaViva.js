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
import { DESTINOS_PRESUPUESTO, REPARTO_DIARIO } from "./presupuesto";
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

/**
 * Nombre del país en español, que es como se indexan el catálogo curado y la
 * tabla de tramos ("Reino Unido", no "GB").
 *
 * Hace falta porque las paradas del planificador vienen del catálogo de
 * aeropuertos, que trae el país en ISO. Sin esto, "Londres|GB" no casaba con
 * "Londres|Reino Unido" y el efecto era doble y silencioso: NINGÚN tramo curado
 * se aplicaba (Madrid-Barcelona perdía el AVE y caía a estimación), y el costo
 * diario de TODAS las ciudades caía al global — Londres se cobraba a US$85 en
 * vez de a US$170.
 */
function nombreDePais(p) {
  return p?.paisNombre || p?.pais || "";
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
  //    OJO: viene de Travelpayouts con one_way=false, o sea que es un precio
  //    de IDA Y VUELTA. Se marca para que quien sume sepa que ese billete ya
  //    cubre el regreso; ver ajustarIdaYVuelta().
  if (vueloReal && Number(vueloReal.precio) > 0) {
    const dur = Number(vueloReal.duracion_h) || (km ? 2 + km / 800 : 3);
    return {
      medio: "vuelo",
      precio: Math.round(Number(vueloReal.precio)),
      duracion_h: Math.round(dur * 10) / 10,
      puertaAPuerta_h: puertaAPuerta("vuelo", dur),
      operador: vueloReal.aerolinea || "",
      fuente: "detectado",
      idaYVuelta: true,
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
  // La tabla se indexa por nombre de país, no por ISO.
  const r = costoTramoReal(
    { ...desde, pais: nombreDePais(desde) },
    { ...hasta, pais: nombreDePais(hasta) },
    km
  );
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

// --- Ida y vuelta ------------------------------------------------------------
const mismaCiudad = (a, b) => {
  if (!a || !b) return false;
  if (a.iata && b.iata) return a.iata === b.iata;
  const n = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
  return !!n(a.ciudad) && n(a.ciudad) === n(b.ciudad);
};

/**
 * Corrige el doble cobro del vuelo de regreso.
 *
 * TODOS los precios reales de la app se piden con one_way=false (detector,
 * /api/vuelo-vivo y /api/entrada-region): son precios de IDA Y VUELTA. Un
 * viaje que sale de casa, da una vuelta y vuelve a casa pagaba dos veces el
 * mismo billete: una en el tramo de ida, que ya lo incluye, y otra en el
 * tramo de regreso, estimado aparte. En el viaje que lo destapo eso inflaba
 * el total en 521 dolares sobre 886 de billete.
 *
 * Solo se descuenta cuando el ultimo tramo es EXACTAMENTE ese regreso
 * (mismo par de ciudades, al reves). Si vuelves a casa desde otra ciudad el
 * billete de ida y vuelta no te sirve para ese vuelo, y si no vuelves, el
 * precio de ida incluye una vuelta que no vas a usar: en los dos casos no se
 * toca la cifra y se avisa, que es lo unico honesto que se puede hacer con
 * los datos que tenemos.
 *
 * @returns {{tramos: Array, regresoIncluido: object|null, aviso: string|null}}
 */
export function ajustarIdaYVuelta(tramos = []) {
  const sinCambios = { tramos, regresoIncluido: null, aviso: null };
  if (!Array.isArray(tramos) || tramos.length < 2) return sinCambios;

  const primero = tramos[0];
  const ultimo = tramos[tramos.length - 1];
  if (!primero?.idaYVuelta || !(primero.precio > 0)) return sinCambios;

  const vuelveACasa = mismaCiudad(ultimo.hasta, primero.desde);
  const mismoPar = vuelveACasa && mismaCiudad(ultimo.desde, primero.hasta);

  if (!vuelveACasa) return { tramos, regresoIncluido: null, aviso: "sin-regreso" };
  if (!mismoPar) return { tramos, regresoIncluido: null, aviso: "otra-ciudad" };

  const copia = tramos.slice();
  copia[copia.length - 1] = {
    ...ultimo,
    // Se conserva lo que habria costado suelto: sin eso, un cero sin
    // explicacion parece un fallo de la app.
    precioSuelto: ultimo.precio,
    precio: 0,
    fuente: "incluido",
  };
  return {
    tramos: copia,
    regresoIncluido: {
      ahorro: ultimo.precio || 0,
      ciudad: primero.hasta?.ciudad || "",
      casa: primero.desde?.ciudad || "",
    },
    aviso: null,
  };
}

// --- Zigzag -----------------------------------------------------------------
/**
 * Detecta si el orden elegido da rodeos evitables. NO mueve la primera ni la
 * última parada: casi siempre son la salida y el regreso a casa, y cambiarlas
 * rompería el viaje. Solo permuta las intermedias, y solo propone el cambio si
 * el ahorro se nota.
 */
export function detectarZigzag(paradas, umbralPct = 12) {
  if (!Array.isArray(paradas) || paradas.length < 4) return { hayZigzag: false };
  if (paradas.some((p) => p.lat == null || p.lon == null)) return { hayZigzag: false };

  const largo = (orden) => {
    let t = 0;
    for (let i = 0; i < orden.length - 1; i++) t += distanciaKm(orden[i], orden[i + 1]) || 0;
    return t;
  };
  const actual = largo(paradas);

  // Paso 1: vecino mas cercano. Rapido y casi siempre razonable, pero deja
  // cruces: se come las ciudades cercanas primero y al final tiene que cruzar
  // el mapa entero para recoger la que dejo suelta.
  const inicio = paradas[0];
  const fin = paradas[paradas.length - 1];
  const pendientes = paradas.slice(1, -1);
  let ruta = [inicio];
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

  // Paso 2: 2-opt. Deshace justamente esos cruces dando la vuelta a un tramo
  // entero del recorrido, y es lo que separa "un orden decente" de "el orden
  // que de verdad no da rodeos". Con el tope de 25 paradas del planificador
  // esto son unos pocos miles de comparaciones: ni se nota.
  //
  // Los extremos NO se mueven nunca: casi siempre son de donde sales y a
  // donde vuelves, y cambiarlos no seria optimizar el viaje sino otro viaje.
  let mejoro = true;
  let vueltas = 0;
  while (mejoro && vueltas < 40) {
    mejoro = false;
    vueltas++;
    for (let a = 1; a < ruta.length - 2; a++) {
      for (let b = a + 1; b < ruta.length - 1; b++) {
        const antes =
          (distanciaKm(ruta[a - 1], ruta[a]) || 0) + (distanciaKm(ruta[b], ruta[b + 1]) || 0);
        const despues =
          (distanciaKm(ruta[a - 1], ruta[b]) || 0) + (distanciaKm(ruta[a], ruta[b + 1]) || 0);
        if (despues < antes - 1) {
          const medio = ruta.slice(a, b + 1).reverse();
          ruta = [...ruta.slice(0, a), ...medio, ...ruta.slice(b + 1)];
          mejoro = true;
        }
      }
    }
  }

  const optimo = largo(ruta);
  const ahorroKm = actual - optimo;
  const pct = actual > 0 ? Math.round((ahorroKm / actual) * 100) : 0;
  if (pct < umbralPct) return { hayZigzag: false, kmActual: actual, kmOptimo: optimo };

  // Los indices del orden nuevo sobre el array original: sin esto la sugerencia
  // solo se puede leer, y habia que reordenar a mano con las flechitas.
  const usados = new Set();
  const indices = ruta.map((p) => {
    const k = paradas.findIndex((x, n) => !usados.has(n) && x === p);
    usados.add(k);
    return k;
  });

  return {
    hayZigzag: true,
    kmActual: Math.round(actual),
    kmOptimo: Math.round(optimo),
    ahorroKm: Math.round(ahorroKm),
    ahorroPct: pct,
    indices,
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
    const cd = costoDiario(p.ciudad, nombreDePais(p), p.region);
    const sub = noches * cd.usd;
    estadia += sub;
    porCiudad.push({
      ciudad: p.ciudad, pais: p.pais, noches,
      diario: cd.usd, fuenteDiario: cd.fuente, subtotal: sub,
    });
  }

  const noches = porCiudad.reduce((s, c) => s + c.noches, 0);
  const porPersona = transporte + estadia;

  // Presupuesto por TIPOLOGIA DE GASTO, que es como la gente lo piensa
  // ("cuanto me voy a gastar en hoteles") y no como lo teniamos ("estadia").
  // La estadia es un agregado del costo diario de cada ciudad; se reparte con
  // las mismas proporciones que usa el planificador recomendado, para que los
  // dos caminos al presupuesto no den cifras distintas del mismo viaje.
  const enDestino = estadia * n;
  const desglose = {
    transporte: Math.round(transporte * n),
    hospedaje: Math.round(enDestino * REPARTO_DIARIO.hospedaje),
    comida: Math.round(enDestino * REPARTO_DIARIO.comida),
    local: Math.round(enDestino * REPARTO_DIARIO.transporte),
    extras: Math.round(enDestino * REPARTO_DIARIO.extras),
  };

  return {
    transporte,
    estadia,
    porCiudad,
    noches,
    dias: noches + 1,
    horasEnMovimiento: Math.round(horas * 10) / 10,
    porPersona,
    total: porPersona * n,
    desglose,
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
