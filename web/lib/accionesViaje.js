// "YA DECIDI QUE QUIERO HACER. ¿DONDE LO HAGO?"
//
// Esta es la capa de ACCION: el puente entre lo que Anduve recomienda y el
// sitio donde el viajero puede hacerlo de verdad. Anduve sigue siendo el
// cerebro; el proveedor sigue siendo el proveedor.
//
// LA REGLA UNICA
//
// NINGUNA URL SE ESCRIBE AQUI. Todas salen de lib/afiliados.js —que es donde
// ya vivian los enlaces reales del proyecto— o del propio enlace que devuelve
// /api/vuelo-vivo con la oferta que consulto. Si para algo no hay proveedor
// real, esta capa devuelve la accion SIN url y la pantalla no pinta boton.
// Un boton que no lleva a ningun sitio miente igual que un precio inventado.
//
// LO QUE UNA ACCION NO HACE
//
// Abrir un proveedor no reserva nada. Pulsar "ver disponibilidad" no cambia la
// ruta, ni las noches, ni el presupuesto, ni el estado del viaje. El unico que
// puede decir "esto ya lo reserve" es el viajero, a mano, y eso vive en la
// capa de ejecucion del Proceso 4.
//
// CUATRO NIVELES DE VERDAD SOBRE UN PRECIO, QUE NO SE MEZCLAN
//
//   estimado    nuestra tabla dice que un tramo asi cuesta esto
//   curado      tarifa de referencia que alguien verifico
//   vivo        lo consultamos al proveedor para esta fecha
//   oferta      ademas tenemos el enlace exacto de ESA oferta
//
// Solo el ultimo justifica un "ver disponibilidad" que promete algo concreto.

import {
  AFILIADOS, linkHoteles, linkGoogleFlights, linkVuelos,
  linkTren, linkBus, linkTransporte, linkSeguro, linkESIM,
} from "./afiliados";

/**
 * ¿Este enlace lleva nuestro identificador de afiliado?
 *
 * Se mira la URL YA construida en vez de fiarse de la configuracion: los
 * enlaces de eSIM y seguro, por ejemplo, van sin comision mientras falte el
 * `trs` de Travelpayouts, y decir lo contrario seria declarar una relacion
 * comercial que en ese momento no existe.
 */
export function esAfiliado(url) {
  if (!url) return false;
  const u = String(url);
  return Boolean(
    (AFILIADOS.travelpayouts && u.includes(`marker=${AFILIADOS.travelpayouts}`)) ||
    (AFILIADOS.getYourGuide && u.includes(`partner_id=${AFILIADOS.getYourGuide}`)) ||
    (AFILIADOS.bookingAid && u.includes(`aid=${AFILIADOS.bookingAid}`)) ||
    (AFILIADOS.omioPartner && u.includes(`partner=${AFILIADOS.omioPartner}`)) ||
    (AFILIADOS.rome2rio && u.includes(`aid=${AFILIADOS.rome2rio}`)) ||
    (AFILIADOS.discoverCars && u.includes(`a_aid=${AFILIADOS.discoverCars}`)) ||
    (AFILIADOS.airaloPartner && u.includes(`partner_id=${AFILIADOS.airaloPartner}`)) ||
    (AFILIADOS.ektaPartner && u.includes(`partner=${AFILIADOS.ektaPartner}`)) ||
    u.includes("tp.media/r?")
  );
}

function accion({ id, tipo, clave, vars = {}, proveedor = null, url = null, fuente = "estimado", contexto = {}, cat = null }) {
  return {
    id, tipo, clave, vars,
    proveedor: url ? proveedor : null,
    url: url || null,
    fuente,
    // "disponible" solo cuando hay a donde ir. Sin url el estado es
    // "sin-proveedor", que la pantalla traduce por una frase y no por un boton.
    estado: url ? "disponible" : "sin-proveedor",
    afiliado: esAfiliado(url),
    // La categoria que espera /api/track: se reutiliza el evento afiliado_clic
    // que el proyecto ya cuenta, no se inventa un segundo analytics.
    cat: cat || `accion_${tipo}`,
    contexto,
  };
}

/**
 * La fecha en que se hace CADA tramo.
 *
 * No es la fecha de salida del viaje: el tramo Edimburgo → Londres ocurre
 * despues de todas las noches anteriores. Pasarle a todos la misma fecha
 * hacia que el buscador abriera el vuelo interno en el dia en que el viajero
 * sale de casa — un enlace que parece especifico y apunta al dia equivocado.
 *
 * Sale de sumar las noches, que es exactamente como esta definido el viaje.
 * Sin fecha de salida no hay nada que derivar y se devuelve vacio.
 */
function fechasDeTramo(viaje) {
  const ini = String(viaje?.fechaIda || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ini)) return [];
  const paradas = viaje?.paradas || [];
  const out = [];
  let acumuladas = 0;
  for (let i = 0; i < paradas.length - 1; i++) {
    const d = new Date(`${ini}T00:00:00`);
    d.setDate(d.getDate() + acumuladas);
    out.push(d.toISOString().slice(0, 10));
    acumuladas += Math.max(0, Number(paradas[i + 1]?.noches) || 0);
  }
  return out;
}

const iata = (p) => (/^[A-Z]{3}$/.test(String(p?.iata || "").toUpperCase()) ? String(p.iata).toUpperCase() : "");

/**
 * VUELOS.
 *
 * Tres casos, de mas a menos concreto, y la tarjeta dice en cual esta:
 *
 *   1. hay oferta consultada  -> su enlace exacto (Aviasales, con marker)
 *   2. hay fecha              -> busqueda de Google Vuelos con ruta y fecha
 *   3. no hay fecha           -> busqueda del destino en Aviasales
 *
 * El caso 3 es honesto pero flojo: sin fecha ningun buscador puede prometer
 * un precio, y por eso la pantalla lo acompaña de su fuente.
 */
function accionesVuelo({ viaje, tramos, vuelosVivos = {} }) {
  const out = [];
  const paradas = viaje?.paradas || [];
  const fechas = fechasDeTramo(viaje);
  tramos.forEach((t, i) => {
    const medio = t.medioRecomendado || t.medio;
    if (medio !== "vuelo") return;
    const desde = paradas[i]; const hasta = paradas[i + 1];
    const vivo = vuelosVivos[i] || vuelosVivos[t.id];

    // El enlace de la oferta lo devuelve /api/vuelo-vivo: es del proveedor,
    // no construido por nosotros.
    if (vivo?.link) {
      out.push(accion({
        id: `vuelo:${t.id}`, tipo: "vuelo", clave: "acVueloOferta",
        vars: { desde: t.desde, hasta: t.hasta },
        proveedor: "Aviasales", url: vivo.link, fuente: "oferta", cat: "accion_vuelo",
        contexto: { tramo: t.id, precioUsd: Number(vivo.precio) || null, aerolinea: vivo.aerolinea || null, deFecha: Boolean(vivo.esDeTuFecha) },
      }));
      return;
    }

    const fechaTramo = fechas[i] || "";
    const url = fechaTramo
      ? linkGoogleFlights({ ciudad: t.hasta, pais: hasta?.paisNombre || "", origen: t.desde, fechaIda: fechaTramo })
      : linkVuelos({ ciudad: t.hasta, pais: hasta?.paisNombre || "" });

    out.push(accion({
      id: `vuelo:${t.id}`, tipo: "vuelo", clave: "acVueloBuscar",
      vars: { desde: t.desde, hasta: t.hasta },
      proveedor: fechaTramo ? "Google Vuelos" : "Aviasales", url,
      fuente: t.fuenteRecomendada || t.fuente || "estimado", cat: "accion_vuelo",
      contexto: { tramo: t.id, iataDesde: iata(desde), iataHasta: iata(hasta), fecha: fechaTramo || null },
    }));
  });
  return out;
}

/**
 * ALOJAMIENTO, una accion por ciudad con noches.
 *
 * El buscador recibe ciudad, pais y coordenadas. NO recibe fechas: linkHoteles
 * no las admite y añadirle parametros que el proveedor no entiende es
 * inventarse una integracion.
 */
function accionesAlojamiento({ viaje, estadia = [] }) {
  const porCiudad = new Map((viaje?.paradas || []).map((p) => [p.ciudad, p]));
  return estadia.map((e) => {
    const p = porCiudad.get(e.ciudad);
    const url = linkHoteles({ ciudad: e.ciudad, pais: p?.paisNombre || "", lat: p?.lat, lon: p?.lon });
    return accion({
      id: `alojamiento:${e.ciudad}`, tipo: "alojamiento", clave: "acAlojamiento",
      vars: { ciudad: e.ciudad, noches: e.noches },
      proveedor: AFILIADOS.bookingAid ? "Booking" : "Hotellook", url,
      // El importe que se enseña al lado SIEMPRE es estimacion de coste de
      // vida, nunca una tarifa: el proveedor es quien tiene las tarifas.
      fuente: "estimado", cat: "accion_alojamiento",
      contexto: { ciudad: e.ciudad, noches: e.noches, estimadoUsd: e.totalUsd ?? null },
    });
  });
}

/** TRANSPORTE TERRESTRE. Rome2Rio cubre el mundo; Omio solo si hay afiliado. */
function accionesTransporte({ viaje, tramos, ejecucion }) {
  const out = [];
  const fechas = fechasDeTramo(viaje);
  for (let i = 0; i < tramos.length; i++) {
    const t = tramos[i];
    const elegido = ejecucion?.tramos?.[t.id]?.medioElegido;
    const medio = elegido || t.medioRecomendado || t.medio;
    if (!medio || medio === "vuelo") continue;
    // La fecha de ESTE tramo, no la de salida del viaje.
    const fecha = fechas[i] || "";
    const url = medio === "tren" ? linkTren({ desde: t.desde, hasta: t.hasta, fecha })
      : medio === "bus" ? linkBus({ desde: t.desde, hasta: t.hasta, fecha })
        : linkTransporte({ desde: t.desde, hasta: t.hasta });
    out.push(accion({
      id: `transporte:${t.id}`, tipo: "transporte", clave: "acTransporte",
      vars: { desde: t.desde, hasta: t.hasta, medio },
      proveedor: AFILIADOS.omioPartner && (medio === "tren" || medio === "bus") ? "Omio" : "Rome2Rio",
      url, fuente: t.fuenteRecomendada || t.fuente || "estimado", cat: "accion_transporte",
      contexto: { tramo: t.id, medio, elegido: Boolean(elegido) },
    }));
  }
  return out;
}

/**
 * SERVICIOS. Aqui SI hay proveedor real —Airalo y EKTA—, aunque hoy sin
 * comision porque falta el `trs` de Travelpayouts. Un enlace util sin comision
 * sigue siendo util; lo que no vale es un enlace roto o inventado.
 */
function accionesServicios({ viaje }) {
  const paradas = viaje?.paradas || [];
  const paisCasa = String(paradas[0]?.pais || "").toUpperCase();
  // El pais del viaje NO es el primero que aparece: en esta ruta Madrid es una
  // escala de dos noches y el viaje es britanico. Se elige donde se duermen
  // mas noches, que es donde de verdad hace falta el seguro y la eSIM.
  const porPais = new Map();
  for (const p of paradas) {
    const iso = String(p.pais || "").toUpperCase();
    if (!iso || iso === paisCasa) continue;
    const previo = porPais.get(iso) || { pais: iso, paisNombre: p.paisNombre || "", noches: 0 };
    previo.noches += Math.max(0, Number(p.noches) || 0);
    porPais.set(iso, previo);
  }
  const fuera = [...porPais.values()].sort((a, b) => b.noches - a.noches)[0];
  if (!fuera) return [];
  const noches = paradas.reduce((s, p) => s + Math.max(0, Number(p.noches) || 0), 0);
  return [
    accion({
      id: "servicio:seguro", tipo: "servicio", clave: "acSeguro", vars: {},
      proveedor: "EKTA", url: linkSeguro({ pais: fuera.paisNombre || "", dias: noches || 7 }),
      fuente: "sin_dato", cat: "accion_seguro", contexto: { dias: noches },
    }),
    accion({
      id: "servicio:esim", tipo: "servicio", clave: "acEsim", vars: {},
      proveedor: "Airalo", url: linkESIM({ pais: fuera.paisNombre || "", iso2: String(fuera.pais || "").toUpperCase() }),
      fuente: "sin_dato", cat: "accion_esim", contexto: { pais: fuera.pais },
    }),
  ];
}

/** REQUISITOS. El "proveedor" es nuestra propia ficha, que ya existe. */
function accionesRequisitos({ requisitos = [] }) {
  return requisitos.map((r) => accion({
    id: `requisito:${r.iso}`, tipo: "requisito", clave: "acRequisito", vars: { pais: r.pais },
    proveedor: "Anduve", url: `/requisitos/${String(r.iso).toLowerCase()}`,
    fuente: "curado", cat: "accion_requisito", contexto: { iso: r.iso },
  }));
}

/**
 * TODAS LAS ACCIONES DEL VIAJE.
 *
 * Se devuelven en el orden en que se hacen las cosas: primero el vuelo, que
 * fija las fechas; luego donde dormir; luego como moverse; despues los
 * tramites y por ultimo los servicios. Es el mismo orden que el motor de
 * ejecucion, porque es el mismo viaje.
 */
export function construirAcciones({ viaje, analisis, ejecucion = null, requisitos = [], vuelosVivos = {} } = {}) {
  if (!viaje?.paradas?.length || !analisis) return [];
  const tramos = analisis.tramos || [];
  return [
    ...accionesVuelo({ viaje, tramos, vuelosVivos }),
    ...accionesAlojamiento({ viaje, estadia: analisis.estadia || [] }),
    ...accionesTransporte({ viaje, tramos, ejecucion }),
    ...accionesRequisitos({ requisitos }),
    ...accionesServicios({ viaje }),
  ];
}

/** ¿Alguna de estas acciones lleva enlace afiliado? Para la nota de transparencia. */
export function hayAccionAfiliada(acciones = []) {
  return acciones.some((a) => a.afiliado);
}
