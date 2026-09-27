// QUE ENTRA EN GRATIS Y QUE ENTRA EN PRO. UN SOLO SITIO.
//
// Esto no es una lista de funciones bonitas escondidas detras de un muro. Es
// un reparto hecho sobre dos preguntas concretas:
//
//   1. ¿el viajero entiende Anduve y se construye un viaje sin pagar?
//   2. ¿que capacidades le cuestan dinero a Anduve cada vez que se usan?
//
// La primera manda: si gratis no sirve para nada, no hay a quien cobrarle.
// La segunda decide donde estan los limites, porque un limite honesto se pone
// donde hay una factura, no donde hay ganas de cobrar.
//
// LO QUE CUESTA DINERO DE VERDAD (medido, no supuesto)
//
//   /api/asesor       Anthropic. ~1.500 tokens de entrada + ~300 de salida por
//                     mensaje = ~US$0,009. Diez mensajes, nueve centavos.
//   /api/vuelo-vivo   Travelpayouts. Cuota limitada por cuenta.
//   monitor de viajes Las anteriores, repetidas SOLAS cada 6 h por viaje.
//
//   /api/viaje-canonico y /api/descubrir NO cuestan dinero: son calculo en
//   nuestro servidor. Por eso no se limitan: cobrar por CPU que ya pagamos
//   seria cobrar por cobrar.
//
// POR QUE INTELLIGENCE ES GRATIS
//
// Es la identidad del producto. Un Anduve que no te dice que cambiarias no es
// un Anduve capado, es otra app. Ademas es puro calculo: no cuesta por uso.
// Lo que se cobra no es pensar, es MIRAR POR TI MIENTRAS NO ESTAS.
//
// POR QUE LOS AFILIADOS NO SE TOCAN
//
// Los enlaces a proveedores son el otro motor comercial de Anduve y no son un
// premio para quien paga. Un usuario gratis tiene que poder llegar al sitio
// donde reserva.

/**
 * El catalogo. `pro: true` significa "solo Pro"; un `limite` significa
 * "gratis tambien, pero hasta aqui".
 *
 * `limite` va por dia natural salvo que se diga otra cosa. `null` = sin tope.
 */
export const CAPACIDADES = {
  // --- Lo que hace que Anduve sea Anduve. Gratis, sin discusion. -----------
  descubrir: { pro: false, porque: "Es la puerta de entrada: sin esto nadie entiende el producto." },
  construir_viaje: { pro: false },
  analisis_viaje: { pro: false, porque: "Calculo propio, sin coste por uso." },
  inteligencia: { pro: false, porque: "Es la identidad del producto, no un extra." },
  ejecucion: { pro: false, porque: "Saber que te falta no puede ser de pago." },
  acciones: { pro: false, porque: "Los afiliados son el otro motor comercial; no son un premio." },
  requisitos: { pro: false },

  // --- Gratis, pero con tope, porque cada uso tiene factura ---------------
  asesor: {
    pro: false,
    limite: { free: 5, pro: 60 },
    ventana: "dia",
    porque: "Cada mensaje son ~US$0,009 de API. Cinco al dia dejan probarlo de verdad sin que una sola cuenta se coma el presupuesto.",
  },
  vuelo_vivo: {
    pro: false,
    limite: { free: 10, pro: 120 },
    ventana: "dia",
    porque: "Consulta de pago con cuota. Diez al dia cubren un viaje entero de nueve tramos y sobra.",
  },
  viajes_guardados: {
    pro: false,
    limite: { free: 1, pro: 25 },
    ventana: "total",
    porque: "Un viaje basta para entender Anduve. El tope de 25 en Pro ya existia en /api/rutas y no se toca.",
  },
  alertas_precio: {
    pro: false,
    limite: { free: 1, pro: null },
    ventana: "total",
    porque: "Limite que ya existia y estaba bien puesto: se mantiene tal cual.",
  },

  // --- Pro de verdad: Anduve trabajando cuando tu no estas ----------------
  monitor_viaje: {
    pro: true,
    porque: "Es la unica capacidad que consume sola, sin que nadie pulse nada: dos consultas de pago por viaje cada 6 h, para siempre. Y es lo unico que un viajero no puede hacerse solo.",
  },
  compartir_viaje: { pro: true, porque: "Limite que ya existia." },
  exportar_pdf: { pro: true, porque: "Limite que ya existia." },
};

/** Las capacidades que la pagina /pro debe saber explicar. */
export const CAPACIDADES_PRO = ["monitor_viaje", "viajes_guardados", "alertas_precio", "asesor", "vuelo_vivo", "compartir_viaje", "exportar_pdf"];

/**
 * ¿Puede este usuario usar esta capacidad?
 *
 * Funcion PURA: recibe si es Pro y cuanto lleva usado, y decide. No lee KV, no
 * mira cookies y no sabe nada del navegador. Quien la llama es el servidor
 * (lib/guardiaPro), que es el unico que puede responder a "¿es Pro?".
 *
 * @returns {{permitido:boolean, motivo:string|null, limite:number|null, usado:number, restante:number|null}}
 */
export function evaluar(nombre, { pro = false, usado = 0 } = {}) {
  const cap = CAPACIDADES[nombre];
  if (!cap) return { permitido: false, motivo: "desconocida", limite: null, usado, restante: null };

  if (cap.pro && !pro) {
    return { permitido: false, motivo: "solo-pro", limite: null, usado, restante: null };
  }

  const limite = cap.limite ? (pro ? cap.limite.pro : cap.limite.free) : null;
  if (limite == null) return { permitido: true, motivo: null, limite: null, usado, restante: null };

  const restante = Math.max(0, limite - usado);
  return {
    permitido: usado < limite,
    motivo: usado < limite ? null : "limite",
    limite,
    usado,
    restante,
  };
}

/** El limite que aplica a este usuario, para poder enseñarlo sin pedir permiso. */
export function limiteDe(nombre, pro = false) {
  const cap = CAPACIDADES[nombre];
  if (!cap?.limite) return null;
  return pro ? cap.limite.pro : cap.limite.free;
}

export function esSoloPro(nombre) {
  return Boolean(CAPACIDADES[nombre]?.pro);
}
