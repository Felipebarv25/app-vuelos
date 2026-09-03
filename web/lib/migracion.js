// Lineas de presupuesto de PRE-VIAJE: visas y autorizaciones electronicas.
//
// Estas son las lineas que ningun planificador generico en ingles calcula bien
// para un pasaporte colombiano, y son la mitad de la razon de existir de
// Anduve. El dato ya estaba en el repositorio — public/requisitos/visas.json,
// de Passport Index, 199 pasaportes — pero solo se usaba para pintar una
// etiqueta informativa. Nunca entraba al presupuesto.
//
// TRES COSAS QUE EL DATASET NO SABE, y que son justo las que fallan:
//
//   1. Las autorizaciones electronicas no son visas. Un colombiano entra a
//      Espana sin visa, 90 dias — eso dice el dataset y es correcto —, pero
//      desde 2026 necesita ETIAS. El dataset dice "90" y se queda tan ancho.
//
//   2. Schengen es UNO. Veintinueve paises, una sola autorizacion. Cobrar
//      ETIAS por cada pais del viaje seria multiplicar por cinco un gasto de
//      veinte euros.
//
//   3. Irlanda perdona la visa a quien ya entro al Reino Unido con visa
//      britanica vigente (Short Stay Visa Waiver Programme). Eso NO se puede
//      leer en una tabla de pares pasaporte-destino: depende del ORDEN del
//      viaje. Sin esto, un viaje Londres -> Dublin cobra dos visas cuando se
//      paga una.
//
// TODO LO DE AQUI ES REFERENCIAL. Las tarifas consulares cambian sin avisar y
// los requisitos migratorios mas todavia. Cada linea lo dice en su nota, y la
// interfaz tiene que repetirlo: esto orienta un presupuesto, no sustituye a la
// embajada.

import { crearLinea } from "./presupuestoLineas";

// Los 29 del espacio Schengen (incluye los cuatro no-UE). Una autorizacion
// para todos: por eso se agrupan en una sola linea.
export const SCHENGEN = new Set([
  "AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO",
  "SK", "SI", "ES", "SE", "CH",
]);

// Tarifas oficiales publicadas, en su MONEDA NATURAL. Se guardan asi y no en
// dolares a proposito: una visa britanica cuesta libras, y convertirla dos
// veces (a USD para guardar, a COP para mostrar) acumula error sobre un dato
// que es exacto en origen.
//
// `desde` es la fecha de la ultima subida que conocemos. Va en la fuente para
// que se vea cuando el dato empieza a ser viejo, en vez de fingir que una
// tarifa consular es un valor permanente.
export const TARIFAS = {
  // Autorizaciones electronicas
  ETIAS: { monto: 20, moneda: "EUR", nombre: "ETIAS (Europa)", desde: "2026" },
  ETA_GB: { monto: 16, moneda: "GBP", nombre: "ETA (Reino Unido)", desde: "2025-04" },
  ESTA_US: { monto: 40, moneda: "USD", nombre: "ESTA (Estados Unidos)", desde: "2025-09" },
  ETA_CA: { monto: 7, moneda: "CAD", nombre: "eTA (Canadá)", desde: "2024" },
  ETA_AU: { monto: 20, moneda: "AUD", nombre: "ETA (Australia)", desde: "2024" },

  // Visas de estancia corta
  VISA_GB: { monto: 127, moneda: "GBP", nombre: "Visa de visitante (Reino Unido)", desde: "2025-04" },
  VISA_SCHENGEN: { monto: 90, moneda: "EUR", nombre: "Visa Schengen", desde: "2024-06" },
  VISA_IE: { monto: 60, moneda: "EUR", nombre: "Visa de visitante (Irlanda)", desde: "2024" },
  VISA_US: { monto: 185, moneda: "USD", nombre: "Visa B1/B2 (Estados Unidos)", desde: "2023-06" },
  VISA_CA: { monto: 100, moneda: "CAD", nombre: "Visa de visitante (Canadá)", desde: "2024" },
};

// Que autorizacion electronica pide cada pais a quien entra sin visa.
const ELECTRONICA_POR_PAIS = { GB: "ETA_GB", US: "ESTA_US", CA: "ETA_CA", AU: "ETA_AU" };

// Que visa aplica cuando SI hace falta.
const VISA_POR_PAIS = { GB: "VISA_GB", IE: "VISA_IE", US: "VISA_US", CA: "VISA_CA" };

const NOTA_REFERENCIAL = "Información referencial: verifica en fuentes oficiales antes de pagar.";

const pide = (req) => {
  const s = String(req ?? "").trim();
  if (!s || s === "-1") return "propio";
  if (s === "visa free" || /^\d+$/.test(s)) return "libre";
  if (s === "visa required") return "visa";
  if (s === "no admission") return "vetado";
  return "tramite"; // e-visa, eta, visa on arrival
};

/**
 * Paises del viaje en orden de entrada, sin repetir y sin el de casa.
 */
function paisesDelViaje(paradas, pasaporte) {
  const vistos = [];
  for (const p of paradas || []) {
    const cc = String(p?.pais || "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) continue;
    if (cc === pasaporte) continue;
    if (!vistos.includes(cc)) vistos.push(cc);
  }
  return vistos;
}

/**
 * Lineas de visa y autorizacion para un viaje.
 *
 * @param {object} p
 * @param {Array}  p.paradas    en orden; cada una con `pais` en ISO-2
 * @param {string} p.pasaporte  ISO-2 de la nacionalidad (no del aeropuerto)
 * @param {number} p.viajeros
 * @param {object} p.visas      visas.json ya cargado: visas[pasaporte][destino]
 */
export function lineasMigracion({ paradas = [], pasaporte = "CO", viajeros = 1, visas = null }) {
  const pas = String(pasaporte || "CO").toUpperCase();
  const tabla = visas?.[pas];
  const n = Math.max(1, Math.round(Number(viajeros) || 1));
  const paises = paisesDelViaje(paradas, pas);
  if (!paises.length) return [];

  const linea = (id, clave, extra = {}) => {
    const tf = TARIFAS[clave];
    return crearLinea({
      id,
      concepto: tf.nombre,
      categoria: "pre_viaje",
      monto: tf.monto * n,
      moneda: tf.moneda,
      porPersona: true,
      confianza: "verificado_manual",
      formula: `${tf.monto} ${tf.moneda} × ${n} ${n === 1 ? "persona" : "personas"}`,
      fuente: `Tarifa oficial publicada (${tf.desde})`,
      nota: NOTA_REFERENCIAL,
      ...extra,
    });
  };

  const out = [];

  // Si no hay tabla para este pasaporte, se dice — no se calla ni se inventa.
  if (!tabla) {
    out.push(
      crearLinea({
        id: "visa_sin_datos",
        concepto: "Visas y permisos",
        categoria: "pre_viaje",
        monto: 0,
        formula: "Sin datos para este pasaporte",
        fuente: "Passport Index",
        nota: `No tenemos la tabla de tu pasaporte. ${NOTA_REFERENCIAL}`,
      })
    );
    return out;
  }

  // ---- Schengen: una sola linea para todo el area -------------------------
  const schengenEnRuta = paises.filter((cc) => SCHENGEN.has(cc));
  if (schengenEnRuta.length) {
    // Basta consultar uno: el requisito es del area, no del pais.
    const req = pide(tabla[schengenEnRuta[0]]);
    const donde = schengenEnRuta.length === 1
      ? schengenEnRuta[0]
      : `${schengenEnRuta.length} países`;
    if (req === "libre") {
      out.push(
        linea("etias", "ETIAS", {
          concepto: `ETIAS · ${donde}`,
          nota: `Una sola autorización para todo el espacio Schengen, no una por país. Gratis para menores de 18 y mayores de 70. ${NOTA_REFERENCIAL}`,
        })
      );
    } else if (req === "visa") {
      out.push(
        linea("visa_schengen", "VISA_SCHENGEN", {
          concepto: `Visa Schengen · ${donde}`,
          nota: `Una sola visa para todo el espacio Schengen. ${NOTA_REFERENCIAL}`,
        })
      );
    }
  }

  // ---- Resto de paises, uno a uno ----------------------------------------
  // Reino Unido se resuelve antes que Irlanda para poder aplicarle la
  // exencion: el orden del array `paises` es el de entrada del viaje, y
  // Irlanda solo se perdona si el Reino Unido va ANTES.
  let visaBritanicaVigente = false;

  for (const cc of paises) {
    if (SCHENGEN.has(cc)) continue;
    const req = pide(tabla[cc]);
    if (req === "propio") continue;

    if (cc === "GB" && req === "visa") visaBritanicaVigente = true;

    // Irlanda con visa britanica ya pagada: Short Stay Visa Waiver Programme.
    if (cc === "IE" && req === "visa" && visaBritanicaVigente) {
      out.push(
        crearLinea({
          id: "visa_ie",
          concepto: "Visa de visitante (Irlanda)",
          categoria: "pre_viaje",
          monto: 0,
          moneda: "EUR",
          porPersona: true,
          confianza: "verificado_manual",
          formula: "Exenta: entras primero al Reino Unido",
          fuente: "Short Stay Visa Waiver Programme (Irlanda)",
          nota: `Con tu visa británica vigente y habiendo entrado antes al Reino Unido, Irlanda no cobra visa aparte. Si cambias el orden del viaje y llegas a Irlanda primero, sí la necesitas. ${NOTA_REFERENCIAL}`,
        })
      );
      continue;
    }

    if (req === "visa" && VISA_POR_PAIS[cc]) {
      out.push(linea(`visa_${cc.toLowerCase()}`, VISA_POR_PAIS[cc]));
      continue;
    }

    if (req === "libre" && ELECTRONICA_POR_PAIS[cc]) {
      out.push(linea(`auth_${cc.toLowerCase()}`, ELECTRONICA_POR_PAIS[cc]));
      continue;
    }

    // Visa requerida en un pais sin tarifa en la tabla, o tramite tipo e-visa
    // / visa a la llegada: se pone en 0 CON NOTA. Que no sepamos el precio no
    // es razon para que el gasto desaparezca del presupuesto.
    if (req === "visa" || req === "tramite") {
      out.push(
        crearLinea({
          id: `visa_${cc.toLowerCase()}`,
          concepto: `Visa o permiso · ${cc}`,
          categoria: "pre_viaje",
          monto: 0,
          porPersona: true,
          formula: req === "visa" ? "Visa requerida, tarifa sin confirmar" : "Trámite en línea o a la llegada",
          fuente: "Passport Index",
          nota: `No tenemos la tarifa de este país: consúltala y fíjala aquí. ${NOTA_REFERENCIAL}`,
        })
      );
    }
  }

  return out;
}
