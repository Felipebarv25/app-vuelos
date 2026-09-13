// Lo que el viajero pide cuando NO sabe a donde ir.
//
// QUE ES Y QUE NO ES
//
// Es el gemelo de viajeCanonico para el otro lado del producto. viajeCanonico
// modela un viaje YA decidido; esto modela la PREGUNTA: de donde salgo, cuando,
// cuantos dias, cuanto tengo, que me gusta. Nada mas.
//
// No guarda resultados, ni precios, ni propuestas. Igual que alli: lo que se
// puede recalcular se recalcula, porque cambia.
//
// POR QUE UN MODELO Y NO UN PUÑADO DE PARAMETROS SUELTOS
//
// Este objeto viaja del formulario a la API, de la API al generador de
// propuestas y —cuando el viajero elige una— de la propuesta al viaje que se
// crea. Sin un contrato unico, cada salto reinventa los nombres y el
// presupuesto se convierte en `presu`, `budget` o `presupuestoUsd` segun quien
// lo escriba.
//
// TODO ES OPCIONAL MENOS LO IMPRESCINDIBLE
//
// El prompt del producto es claro: nada de formularios interminables. Solo
// hacen falta presupuesto y dias; el resto tiene un valor por defecto sensato
// y se puede afinar DESPUES de ver resultados.

import { PAIS_DEFAULT, hubsDe, paisValido } from "./paisesOrigen";
import { CATEGORIAS_GUSTO } from "./destinosTags";
import { REGIONES } from "./presupuesto";
import { aUsdDe } from "./fx";

export const RITMOS = ["tranquilo", "normal"];
export const NIVELES = ["mochilero", "medio", "comodo"];

// Cuantos aeropuertos alternativos se consideran. Los hubs vienen ordenados
// por relevancia en paisesOrigen, asi que los cuatro primeros de Colombia son
// MDE, BOG, CLO, CTG — justo los del ejemplo del producto.
const TOPE_ORIGENES = 4;

const num = (v, d = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const texto = (v, max = 60) => String(v ?? "").trim().slice(0, max);

/**
 * Normaliza lo que llegue del formulario (o de una URL compartida) al
 * contrato unico. Nunca lanza: lo que no entiende, lo sustituye por el valor
 * por defecto, porque una busqueda a medias sigue siendo una busqueda util.
 */
export function normalizarBusqueda(entrada = {}) {
  const pais = paisValido(texto(entrada.pais, 2).toUpperCase())
    ? texto(entrada.pais, 2).toUpperCase()
    : PAIS_DEFAULT;

  // ORIGENES ALTERNATIVOS.
  //
  // No se asume que haya que usarlos todos siempre: el viajero marca si acepta
  // salir de otra ciudad. Si no, se busca solo desde su aeropuerto. Cuando si,
  // el primero es el suyo y los demas se ofrecen como "podrias ahorrar X".
  const hubs = hubsDe(pais).slice(0, TOPE_ORIGENES).map((h) => h.iata);
  const origen = /^[A-Z]{3}$/.test(texto(entrada.origen, 3).toUpperCase())
    ? texto(entrada.origen, 3).toUpperCase()
    : hubs[0] || null;
  const flexibleOrigen = entrada.flexibleOrigen !== false;
  const origenes = flexibleOrigen
    ? [origen, ...hubs.filter((h) => h !== origen)].filter(Boolean)
    : [origen].filter(Boolean);

  const dias = Math.max(2, Math.min(60, Math.round(num(entrada.dias, 10))));

  return {
    // --- lo imprescindible ---
    presupuesto: Math.max(0, Math.round(num(entrada.presupuesto, 0))),
    moneda: texto(entrada.moneda, 3).toUpperCase() || "COP",
    dias,
    // Margen de dias que el viajero acepta. El generador lo usa para no
    // descartar una ruta de 13 dias cuando se pidieron 15.
    diasFlex: Math.max(0, Math.min(10, Math.round(num(entrada.diasFlex, 3)))),

    // --- origen ---
    pais,
    origen,
    origenes,
    flexibleOrigen,

    // --- cuando ---
    // Mes en formato YYYY-MM, o vacio. La fecha exacta es opcional y solo
    // afina el precio del vuelo: el mes es lo que manda para el calculo.
    mes: /^\d{4}-\d{2}$/.test(entrada.mes || "") ? entrada.mes : "",
    fechaIda: /^\d{4}-\d{2}-\d{2}$/.test(entrada.fechaIda || "") ? entrada.fechaIda : "",
    fechasFlexibles: entrada.fechasFlexibles !== false,

    // --- quienes ---
    viajeros: Math.max(1, Math.min(9, Math.round(num(entrada.viajeros, 1)))),

    // --- que clase de viaje ---
    region: Object.keys(REGIONES).includes(entrada.region) ? entrada.region : "todas",
    nivel: NIVELES.includes(entrada.nivel) ? entrada.nivel : "medio",
    ritmo: RITMOS.includes(entrada.ritmo) ? entrada.ritmo : "normal",
    // Cuantas ciudades quiere ver. null = que lo decida el presupuesto.
    ciudadesMin: num(entrada.ciudadesMin, null),
    ciudadesMax: num(entrada.ciudadesMax, null),

    // --- que le gusta ---
    // Se validan contra el catalogo de gustos que ya usa el perfil, para que
    // un interes escrito aqui sea el MISMO que aprende /api/profile/evento.
    intereses: Array.isArray(entrada.intereses)
      ? entrada.intereses.map((x) => texto(x, 20).toLowerCase()).filter((x) => CATEGORIAS_GUSTO.includes(x)).slice(0, 6)
      : [],
    // Paises que el viajero QUIERE ver. Cuando hay alguno, el generador
    // arranca las rutas desde sus ciudades en vez de desde la entrada mas
    // barata: es la unica forma de pedir "quiero conocer Reino Unido" y que
    // no te propongan Lisboa porque el vuelo sale mejor.
    paisesPreferidos: Array.isArray(entrada.paisesPreferidos)
      ? entrada.paisesPreferidos.map((x) => texto(x, 2).toLowerCase()).filter((x) => /^[a-z]{2}$/.test(x)).slice(0, 6)
      : [],
    paisesExcluidos: Array.isArray(entrada.paisesExcluidos)
      ? entrada.paisesExcluidos.map((x) => texto(x, 2).toLowerCase()).filter((x) => /^[a-z]{2}$/.test(x)).slice(0, 20)
      : [],
  };
}

/**
 * Convierte el presupuesto a USD, que es la moneda en la que calcula todo el
 * motor de presupuesto. `tasas` viene de lib/fx (POR_USD): cuantas unidades
 * de esa moneda vale un dolar.
 */
export function presupuestoEnUsd(busqueda, tasas = null) {
  const cod = busqueda.moneda || "USD";
  if (cod === "USD") return busqueda.presupuesto;
  // aUsdDe vive en lib/fx y es la MISMA conversion que usa el presupuesto
  // del viaje. Repetir aqui la division seria tener dos sitios donde
  // equivocarse de lado.
  const factor = aUsdDe(tasas, cod);
  if (!factor) return null; // sin tasa no se inventa un numero
  return Math.round(busqueda.presupuesto * factor);
}
/** Resumen corto para tracking y para explicar la busqueda en la UI. */
export function resumenBusqueda(b) {
  return {
    origen: b.origen,
    dias: b.dias,
    region: b.region,
    viajeros: b.viajeros,
    nivel: b.nivel,
    ritmo: b.ritmo,
    intereses: b.intereses,
    conPresupuesto: b.presupuesto > 0,
  };
}
