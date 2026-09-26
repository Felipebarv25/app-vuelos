// EL VIAJE COMO ALGO QUE HAY QUE EJECUTAR, no solo decidir.
//
// Anduve ya sabia decir como es tu viaje (rutaViva, comparadorTransporte),
// que cuesta (presupuesto) y que cambiarias (inteligenciaViaje). Lo que no
// sabia decir es lo que el viajero pregunta cuando ya lo tiene decidido:
//
//   "¿y ahora que tengo que hacer?"
//
// Esto lo contesta. Y nada mas: no reserva, no compra, no promete.
//
// TRES REGLAS QUE NO SE NEGOCIAN
//
// 1. NINGUNA TAREA SE INVENTA. Cada una nace de un dato real del viaje y
//    declara de cual en `origen`. Si no hay vuelos en la ruta no hay tarea de
//    vuelo; si ninguna parada intermedia tiene noches, no se pide reservar
//    hoteles que nadie ha dicho que quiera.
//
// 2. NUNCA SE FINGE UNA RESERVA. El estado de una tarea solo avanza porque el
//    viajero lo movio. Anduve puede decir "listo para reservar"; jamas
//    "reservado" por su cuenta. Por eso `estado` vive en la ejecucion guardada
//    y no se deduce de los precios.
//
// 3. NO SE GUARDA NADA DERIVADO. Este motor recibe datos y devuelve un plan;
//    no persiste. Lo unico que se guarda fuera es lo que el viajero decidio
//    (ver app/api/ejecucion), porque eso no se puede recalcular.
//
// IDIOMA
//
// Igual que el resto de motores del proyecto: cada tarea viaja con su CLAVE de
// traduccion y sus variables, y ademas con la frase en español por si quien la
// pinta no tiene traductor. El motor decide QUE decir; la pantalla, en que
// idioma.

const PRIORIDAD_ORDEN = { alta: 0, media: 1, baja: 2 };

// Dentro de la misma prioridad, el orden lo decide QUE DESBLOQUEA QUE.
//
// Sin fecha no hay precio real de vuelo; sin vuelo no tiene sentido cerrar
// hoteles; el transporte interno se puede decidir despues; los tramites y los
// servicios tienen su propio plazo y no bloquean a nadie.
//
// Sin esto el desempate era alfabetico por id, y "alojamiento" gana siempre:
// los cinco primeros pasos del viaje de referencia salian siendo cinco
// hoteles, con el vuelo internacional enterrado debajo.
const TIPO_ORDEN = { dato: 0, vuelo: 1, transporte: 2, requisito: 3, alojamiento: 4, servicio: 5 };

// El vocabulario de estados. Esta separado en dos grupos a proposito:
//
//   lo que Anduve puede saber     pendiente, elegido, listo_para_reservar
//   lo que solo el viajero sabe   reservado, confirmado, completado
//
// Anduve nunca escribe uno del segundo grupo por su cuenta.
export const ESTADOS = ["pendiente", "elegido", "listo_para_reservar", "reservado", "confirmado", "completado", "no_disponible", "no_aplica"];
export const ESTADOS_LISTOS = ["elegido", "reservado", "confirmado", "completado", "no_aplica"];

// Estado operativo del viaje entero. Se CALCULA, no se guarda.
export const ESTADOS_VIAJE = ["borrador", "planificado", "listo_para_reservar", "parcialmente_reservado", "listo_para_viajar", "en_viaje", "finalizado"];

const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);
const esListo = (e) => ESTADOS_LISTOS.includes(e);
// rutaViva devuelve "sin-datos" y el resto del proyecto escribe "sin_dato".
// Son lo mismo; normalizarlo aqui evita que un guion decida si una tarea
// existe o no.
const sinDatoDe = (f) => !f || f === "sin_dato" || f === "sin-datos";
const fuenteNorm = (f) => (sinDatoDe(f) ? "sin_dato" : f);

/** El dia que arranca el viaje, si se sabe de verdad. */
function fechaSalida(viaje) {
  const f = String(viaje?.fechaIda || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? f : null;
}

/** El ultimo dia, sumando las noches. Solo si hay fecha exacta de salida. */
function fechaRegreso(viaje) {
  const ini = fechaSalida(viaje);
  if (!ini) return null;
  const noches = (viaje?.paradas || []).reduce((s, p) => s + Math.max(0, n(p.noches)), 0);
  if (!noches) return null;
  const d = new Date(`${ini}T00:00:00`);
  d.setDate(d.getDate() + noches);
  return d.toISOString().slice(0, 10);
}

/**
 * Las tareas de VUELO.
 *
 * Solo para los tramos que de verdad se hacen en avion. El vuelo que sale del
 * pais del viajero y el que lo devuelve son los criticos: son los caros, los
 * que fijan las fechas y los que hay que comprar primero.
 */
function tareasVuelo(tramos, paradas, ejecucion) {
  const paisCasa = String(paradas?.[0]?.pais || "").toUpperCase();
  const out = [];
  tramos.forEach((t, i) => {
    const medio = ejecucion?.tramos?.[t.id]?.medioElegido || t.medioRecomendado || t.medio;
    if (medio !== "vuelo") return;
    const desde = paradas[i]; const hasta = paradas[i + 1];
    const paisDesde = String(desde?.pais || "").toUpperCase();
    const paisHasta = String(hasta?.pais || "").toUpperCase();
    // Internacional "de verdad": el que cruza la frontera de casa.
    const deCasa = paisCasa && (paisDesde === paisCasa || paisHasta === paisCasa) && paisDesde !== paisHasta;
    const fuente = t.fuenteRecomendada || t.fuente;
    out.push({
      id: `vuelo:${t.id}`,
      tipo: "vuelo",
      prioridad: deCasa ? "alta" : "media",
      clave: deCasa ? "ejVueloIntl" : "ejVueloTramo",
      vars: { desde: t.desde, hasta: t.hasta },
      titulo: deCasa ? `Confirmar vuelo ${t.desde} → ${t.hasta}` : `Revisar vuelo ${t.desde} → ${t.hasta}`,
      // La confianza del PRECIO no es el estado de la tarea. Se lleva aparte
      // para que la tarjeta pueda decir "esto se apoya en una estimacion".
      confianza: fuenteNorm(fuente),
      origen: { tipo: "tramo", id: t.id },
      datos: { precioUsd: n(t.precioRecomendado ?? t.precio) || null, iataDesde: desde?.iata || "", iataHasta: hasta?.iata || "" },
    });
  });
  return out;
}

/**
 * Las tareas de TRANSPORTE TERRESTRE.
 *
 * Solo cuando de verdad hay algo que decidir: si el tramo tiene una sola
 * alternativa, no es una decision, es un dato. Pedirle al viajero que "elija"
 * entre una opcion seria inventar trabajo.
 */
function tareasTransporte(tramos, ejecucion) {
  const out = [];
  for (const t of tramos) {
    const opciones = (t.alternativas || []).filter((a) => a && a.medio);
    const elegido = ejecucion?.tramos?.[t.id]?.medioElegido || null;
    const medio = elegido || t.medioRecomendado || t.medio;
    if (medio === "vuelo" && !elegido) continue;   // ese ya va como tarea de vuelo
    if (opciones.length < 2 && !elegido) continue;
    out.push({
      id: `transporte:${t.id}`,
      tipo: "transporte",
      prioridad: elegido ? "baja" : "media",
      clave: elegido ? "ejTransporteElegido" : "ejTransporteElegir",
      vars: { desde: t.desde, hasta: t.hasta },
      titulo: elegido ? `Transporte ${t.desde} → ${t.hasta} elegido` : `Elegir transporte ${t.desde} → ${t.hasta}`,
      confianza: fuenteNorm(t.fuenteRecomendada || t.fuente),
      origen: { tipo: "tramo", id: t.id },
      datos: { medioRecomendado: t.medioRecomendado || t.medio, medioElegido: elegido, opciones: opciones.length },
      // Elegir un transporte NO es una tarea que se "completa": se decide. El
      // estado lo pone haber elegido, y sigue siendo reversible.
      estadoImplicito: elegido ? "elegido" : null,
    });
  }
  return out;
}

/**
 * ALOJAMIENTO, una tarea por parada con noches.
 *
 * Una parada de paso (0 noches) no necesita cama. Y el importe que se enseña
 * es SIEMPRE una estimacion del coste de vida de la ciudad: nunca una tarifa.
 */
function tareasAlojamiento(paradas, estadia, ejecucion) {
  const porCiudad = new Map((estadia || []).map((e) => [e.ciudad, e]));
  const out = [];
  const vistas = new Set();
  paradas.forEach((p, i) => {
    const noches = Math.max(0, n(p.noches));
    if (!noches) return;
    const ciudad = String(p.ciudad || "").trim();
    if (!ciudad || vistas.has(ciudad)) return;   // una ciudad repetida es una sola gestion
    vistas.add(ciudad);
    const est = porCiudad.get(ciudad);
    out.push({
      id: `alojamiento:${ciudad}`,
      tipo: "alojamiento",
      prioridad: "media",
      clave: "ejAlojamiento",
      vars: { ciudad },
      titulo: `Definir alojamiento en ${ciudad}`,
      confianza: est?.fuente === "ciudad" ? "curado" : "estimado",
      origen: { tipo: "parada", id: String(i) },
      datos: { ciudad, noches: est?.noches ?? noches, estimadoUsd: est?.totalUsd ?? null, diarioUsd: est?.diarioUsd ?? null },
    });
  });
  return out;
}

/**
 * REQUISITOS DE ENTRADA.
 *
 * No se inventa ningun requisito: llegan ya interpretados por el motor de
 * visas (lib/requisitos), que es el mismo que pinta la ficha de cada pais.
 * Aqui solo se convierten en algo que hacer, y se separa lo que hay que
 * TRAMITAR (una autorizacion electronica tiene tramite y plazo) de lo que
 * basta con REVISAR.
 */
function tareasRequisitos(requisitos, viaje) {
  const limite = fechaSalida(viaje);
  return (requisitos || []).map((r) => {
    const tramite = Boolean(r.autorizacion);
    const visado = r.tipo === "visa" || r.tipo === "visaPrevia";
    const prioridad = visado ? "alta" : tramite ? "alta" : "media";
    return {
      id: `requisito:${r.iso}`,
      tipo: "requisito",
      prioridad,
      clave: visado ? "ejRequisitoVisa" : tramite ? "ejRequisitoTramite" : "ejRequisitoRevisar",
      vars: { pais: r.pais, tramite: r.autorizacion || "" },
      titulo: visado ? `Tramitar visado para ${r.pais}` : tramite ? `Tramitar ${r.autorizacion} para ${r.pais}` : `Revisar requisitos de ${r.pais}`,
      confianza: "curado",
      // El plazo real es el viaje: antes de volar tiene que estar. No se
      // inventa un "30 dias antes" que no sale de ningun dato.
      fechaLimite: limite,
      origen: { tipo: "requisito", id: r.iso },
      enlace: `/requisitos/${String(r.iso).toLowerCase()}`,
      datos: { iso: r.iso, fiebreAmarilla: Boolean(r.fiebreAmarilla) },
    };
  });
}

/**
 * Lo que FALTA POR DECIDIR en el propio viaje.
 *
 * Son tareas de datos, no de compras, y son las que desbloquean a las demas:
 * sin fecha exacta no hay precio real de vuelo que consultar, y una parada sin
 * noches no entra en el presupuesto.
 */
function tareasDatos(viaje, tramos) {
  const out = [];
  const paradas = viaje?.paradas || [];

  if (!fechaSalida(viaje)) {
    out.push({
      id: "dato:fecha",
      tipo: "dato",
      prioridad: viaje?.mesInicio ? "media" : "alta",
      clave: viaje?.mesInicio ? "ejFechaExacta" : "ejFechaNinguna",
      vars: {},
      titulo: viaje?.mesInicio ? "Fijar el día exacto de salida" : "Definir cuándo viajas",
      confianza: "sin_dato",
      origen: { tipo: "viaje", id: "fechaIda" },
      enlace: viaje?.id ? `/ruta?id=${encodeURIComponent(viaje.id)}` : "/ruta",
    });
  }

  const sinNoches = paradas.filter((p, i) => i > 0 && i < paradas.length - 1 && !n(p.noches));
  if (sinNoches.length) {
    out.push({
      id: "dato:noches",
      tipo: "dato",
      prioridad: "media",
      clave: sinNoches.length === 1 ? "ejNochesUna" : "ejNochesVarias",
      vars: { n: sinNoches.length, ciudad: sinNoches[0].ciudad },
      titulo: `Asignar noches a ${sinNoches.length === 1 ? sinNoches[0].ciudad : `${sinNoches.length} paradas`}`,
      confianza: "sin_dato",
      origen: { tipo: "viaje", id: "noches" },
      enlace: viaje?.id ? `/ruta?id=${encodeURIComponent(viaje.id)}` : "/ruta",
    });
  }

  const sinDato = (tramos || []).filter((t) => sinDatoDe(t.fuenteRecomendada || t.fuente));
  if (sinDato.length) {
    out.push({
      id: "dato:tramos",
      tipo: "dato",
      prioridad: "media",
      clave: sinDato.length === 1 ? "ejTramoSinDatoUno" : "ejTramoSinDatoVarios",
      vars: { n: sinDato.length },
      titulo: `Revisar ${sinDato.length} tramo(s) sin datos de transporte`,
      confianza: "sin_dato",
      origen: { tipo: "tramos", id: "sin_dato" },
    });
  }
  return out;
}

/**
 * SERVICIOS: seguro, eSIM.
 *
 * Aparecen porque el viaje es internacional, no porque haya nada que vender.
 * Sin integracion real no llevan enlace, y sin enlace la tarjeta no pinta un
 * boton: un boton que no hace nada es peor que no tener boton.
 */
function tareasServicios(viaje, paradas) {
  const paisCasa = String(paradas?.[0]?.pais || "").toUpperCase();
  const extranjero = paradas.some((p) => String(p.pais || "").toUpperCase() && String(p.pais).toUpperCase() !== paisCasa);
  if (!extranjero) return [];
  const limite = fechaSalida(viaje);
  return [
    { id: "servicio:seguro", tipo: "servicio", prioridad: "media", clave: "ejSeguro", vars: {},
      titulo: "Contratar seguro de viaje", confianza: "sin_dato", fechaLimite: limite,
      origen: { tipo: "viaje", id: "internacional" } },
    { id: "servicio:esim", tipo: "servicio", prioridad: "baja", clave: "ejEsim", vars: {},
      titulo: "Configurar eSIM o roaming", confianza: "sin_dato", fechaLimite: limite,
      origen: { tipo: "viaje", id: "internacional" } },
  ];
}

/**
 * El ESTADO OPERATIVO del viaje. Se deduce de lo que hay, no se declara.
 *
 * La escalera es deliberadamente estricta hacia arriba: para subir un peldaño
 * tiene que estar resuelto todo lo del anterior. Un viaje no puede decir
 * "listo para viajar" con un visado sin tramitar.
 */
function estadoDeViaje({ viaje, tareas, ahora }) {
  const paradas = viaje?.paradas || [];
  if (paradas.length < 2) return "borrador";

  const hoy = (ahora ? new Date(ahora) : new Date()).toISOString().slice(0, 10);
  const salida = fechaSalida(viaje);
  const regreso = fechaRegreso(viaje);
  if (regreso && hoy > regreso) return "finalizado";
  if (salida && hoy >= salida && (!regreso || hoy <= regreso)) return "en_viaje";

  if (!viaje?.mesInicio && !salida) return "borrador";

  const criticas = tareas.filter((t) => t.prioridad === "alta" && !esListo(t.estado));
  const reservadas = tareas.filter((t) => ["reservado", "confirmado", "completado"].includes(t.estado));
  const pendientes = tareas.filter((t) => !esListo(t.estado));

  if (!pendientes.length) return "listo_para_viajar";
  if (reservadas.length) return "parcialmente_reservado";
  if (!criticas.length) return "listo_para_reservar";
  return "planificado";
}

/**
 * El CRONOGRAMA: en que momento toca cada cosa.
 *
 * Las fases no son fechas inventadas. Son el orden real de dependencias: sin
 * fechas no hay precio de vuelo, sin vuelo no tiene sentido cerrar hoteles, y
 * los tramites llevan plazo propio. Solo el final lleva fecha, y solo si el
 * viajero la puso.
 */
const FASE_DE_TIPO = { dato: "ahora", vuelo: "reservar", alojamiento: "reservar", transporte: "reservar", requisito: "tramitar", servicio: "antes" };

function construirCronograma(tareas, viaje) {
  const fases = [
    { id: "ahora", clave: "ejFaseAhora" },
    { id: "reservar", clave: "ejFaseReservar" },
    { id: "tramitar", clave: "ejFaseTramitar" },
    { id: "antes", clave: "ejFaseAntes" },
  ].map((f) => {
    const suyas = tareas.filter((t) => (FASE_DE_TIPO[t.tipo] || "antes") === f.id);
    return { ...f, total: suyas.length, listas: suyas.filter((t) => esListo(t.estado)).length };
  }).filter((f) => f.total > 0);

  return { fases, fechaViaje: fechaSalida(viaje), fechaRegreso: fechaRegreso(viaje) };
}

/**
 * EL PLAN.
 *
 * Entra el viaje con su analisis y lo que el viajero ya decidio; sale que le
 * falta y que deberia hacer ahora. Nada de lo que sale de aqui se guarda.
 *
 * @param {object}   viaje       la ruta guardada (paradas, fechas, nivel…)
 * @param {array}    tramos      los de /api/viaje-canonico, con alternativas
 * @param {array}    estadia     coste por parada, si el canonico lo trae
 * @param {array}    requisitos  ya interpretados por lib/requisitos
 * @param {object}   ejecucion   lo que el viajero decidio (estados, medios)
 * @param {number}   tope        cuantos "proximos pasos" enseñar
 */
export function construirPlan({ viaje, tramos = [], estadia = [], requisitos = [], ejecucion = null, tope = 5, ahora = null }) {
  const paradas = viaje?.paradas || [];
  if (paradas.length < 2) {
    return { estadoViaje: "borrador", tareas: [], proximos: [], resumen: { criticas: 0, pendientes: 0, listas: 0, total: 0 }, cronograma: { fases: [], fechaViaje: null, fechaRegreso: null }, todoListo: false };
  }

  const crudas = [
    ...tareasDatos(viaje, tramos),
    ...tareasVuelo(tramos, paradas, ejecucion),
    ...tareasTransporte(tramos, ejecucion),
    ...tareasAlojamiento(paradas, estadia, ejecucion),
    ...tareasRequisitos(requisitos, viaje),
    ...tareasServicios(viaje, paradas),
  ];

  // El estado guardado manda sobre el implicito, y el implicito sobre el
  // defecto. Asi "elegi el tren" se ve elegido sin que nadie lo marque, pero
  // si el viajero lo marco como reservado, reservado se queda.
  const tareas = crudas.map((t) => {
    const guardado = ejecucion?.tareas?.[t.id];
    const estado = ESTADOS.includes(guardado?.estado) ? guardado.estado : (t.estadoImplicito || "pendiente");
    return {
      descripcion: "",
      fechaLimite: null,
      enlace: null,
      ...t,
      estado,
      requiereAccion: !esListo(estado),
      actualizada: guardado?.actualizada || null,
    };
  });

  const pendientes = tareas.filter((t) => t.requiereAccion);
  const proximos = [...pendientes]
    .sort((a, b) =>
      (PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad]) ||
      ((TIPO_ORDEN[a.tipo] ?? 9) - (TIPO_ORDEN[b.tipo] ?? 9)) ||
      String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.max(1, tope));

  const resumen = {
    criticas: pendientes.filter((t) => t.prioridad === "alta").length,
    pendientes: pendientes.filter((t) => t.prioridad !== "alta").length,
    listas: tareas.length - pendientes.length,
    total: tareas.length,
  };

  // La lista completa se enseña en el mismo orden que los proximos pasos: si
  // el viajero despliega "ver todas", lo primero sigue siendo lo primero.
  const ordenadas = [...tareas].sort((a, b) =>
    (Number(esListo(a.estado)) - Number(esListo(b.estado))) ||
    (PRIORIDAD_ORDEN[a.prioridad] - PRIORIDAD_ORDEN[b.prioridad]) ||
    ((TIPO_ORDEN[a.tipo] ?? 9) - (TIPO_ORDEN[b.tipo] ?? 9)) ||
    String(a.id).localeCompare(String(b.id)));

  const estadoViaje = estadoDeViaje({ viaje, tareas, ahora });

  return {
    estadoViaje,
    tareas: ordenadas,
    proximos,
    resumen,
    cronograma: construirCronograma(tareas, viaje),
    // "Todo listo" solo cuando de verdad no queda nada, no cuando no queda
    // nada IMPORTANTE. Decirlo antes de tiempo es la forma mas facil de que
    // un panel como este deje de merecer confianza.
    todoListo: pendientes.length === 0 && tareas.length > 0,
  };
}

/** Las categorias que se enseñan en "todo listo", con su cuenta real. */
export function resumenPorTipo(tareas = []) {
  const tipos = ["vuelo", "transporte", "alojamiento", "requisito", "servicio", "dato"];
  return tipos.map((tipo) => {
    const suyas = tareas.filter((t) => t.tipo === tipo);
    return { tipo, total: suyas.length, listas: suyas.filter((t) => esListo(t.estado)).length };
  }).filter((x) => x.total > 0);
}
