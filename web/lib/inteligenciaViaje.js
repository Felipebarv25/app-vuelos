// Anduve Intelligence: de "esto cuesta X" a "esto podrías cambiarlo".
//
// QUE NO ES ESTE FICHERO
//
// No es un motor de analisis nuevo. Los motores ya existen y llevan tiempo
// funcionando:
//
//   rutaViva / tramos          cuanto cuesta y cuanto tarda cada trayecto
//   comparadorTransporte       avion contra tren contra bus, con su fuente
//   puntuadorTransporte        que opcion encaja con el viaje
//   optimizadorViaje           hay un orden mejor para estas ciudades
//   analizadorDecisionesViaje  que pasa si quitas esta ciudad
//   presupuesto                cuanto sale todo, en la moneda del viajero
//
// Lo que faltaba no era analisis: era SINTESIS. Cada motor contesta a su
// pregunta y devuelve su respuesta en su formato, y el viajero se quedaba con
// seis respuestas sueltas y ninguna jerarquia. Aqui se juntan, se ordenan por
// impacto real y se explican.
//
// LA REGLA QUE LO GOBIERNA TODO
//
// Una oportunidad no es "algo que cambia un numero". Es algo que MEJORA el
// viaje para ESTE viajero. Ahorrar 10 dolares añadiendo tres horas de bus no
// es una oportunidad: es un mal negocio con buena pinta. Por eso el dinero y
// el tiempo se convierten a una unidad comun antes de comparar, y el cambio
// de esa unidad depende de lo que el viajero haya dicho que le importa.
//
// Y NUNCA SE RELLENAN HUECOS
//
// Si no hay dato para sostener una recomendacion, no se recomienda: se dice
// que falta. Un "no lo sé" honesto vale mas que un consejo inventado, y por
// eso `faltantes` es parte del resultado y no un caso de error.

import { CATEGORIAS_GUSTO } from "./destinosTags";

// Cuanto vale una hora de viaje, en dolares, para convertir tiempo en dinero
// y poder compararlos.
//
// No es el valor del tiempo de nadie: es un tipo de cambio interno para
// ordenar oportunidades. 8 USD/h sale de que ahorrar una hora de traslado
// rara vez justifica pagar mucho mas en un viaje de ocio, y ahorrar cuatro si.
// Quien viaja "tranquilo" valora mas su tiempo, asi que el cambio sube.
const USD_POR_HORA = { normal: 8, tranquilo: 14 };

// Umbrales de impacto, como fraccion del coste total del viaje. Un ahorro de
// 200 USD es enorme en un viaje de 1.500 y anecdotico en uno de 12.000, asi
// que el listón es relativo y no absoluto.
const UMBRAL_ALTA = 0.08;
const UMBRAL_MEDIA = 0.03;

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** La confianza de un dato, de su fuente. Las mismas etiquetas de siempre. */
export function confianzaDeFuente(fuente) {
  if (fuente === "detectado" || fuente === "vivo") return { nivel: "alta", etiqueta: "Consultado en vivo", clave: "opEtqVivo" };
  if (fuente === "curado") return { nivel: "media", etiqueta: "Referencia curada", clave: "iaFuenteCurado" };
  if (fuente === "historico") return { nivel: "media", etiqueta: "Histórico", clave: "opEtqHistorico" };
  if (fuente === "estimado") return { nivel: "baja", etiqueta: "Estimación", clave: "iaFuenteEstimado" };
  if (fuente === "incluido") return { nivel: "alta", etiqueta: "Incluido en el billete", clave: "mvFuenteIncluido" };
  return { nivel: "nula", etiqueta: "Sin dato", clave: "iaFuenteNinguno" };
}

/**
 * Clasifica una oportunidad segun lo que de verdad mueve.
 *
 * `dinero` positivo = ahorra. `horas` positivo = ahorra tiempo. Los dos pueden
 * ser negativos, y entonces la oportunidad se hunde sola: no hace falta una
 * regla aparte para descartar los malos negocios.
 */
function clasificar({ dinero, horas, totalViaje, ritmo, complejidad = 0 }) {
  const cambio = USD_POR_HORA[ritmo] || USD_POR_HORA.normal;
  // Valor equivalente: dinero + tiempo valorado - lo que complica el viaje.
  const valor = n(dinero) + n(horas) * cambio - n(complejidad) * cambio;
  const base = Math.max(1, n(totalViaje));
  const peso = valor / base;

  let prioridad = "baja";
  if (peso >= UMBRAL_ALTA) prioridad = "alta";
  else if (peso >= UMBRAL_MEDIA) prioridad = "media";

  return { valor: Math.round(valor), peso, prioridad };
}

/**
 * Oportunidad 1 — CAMBIAR EL MEDIO DE UN TRAMO.
 *
 * El comparador ya eligio la mejor opcion de cada tramo. Cuando esa opcion NO
 * es la que saldria por defecto, hay una decision que tomar, y es de las mas
 * accionables que existen: no cambia el viaje, solo como se hace un trayecto.
 */
function oportunidadesTransporte(tramos, totalViaje, ritmo) {
  const out = [];
  for (const t of tramos || []) {
    const medioRec = t.medioRecomendado || t.medio;
    const medioOrig = t.medioOriginal;
    if (!medioRec || !medioOrig || medioRec === medioOrig) continue;

    const dinero = n(t.precioOriginal) - n(t.precioRecomendado ?? t.precio);
    const horas = n(t.puertaAPuertaOriginal_h) - n(t.puertaAPuertaRecomendada_h ?? t.puertaAPuerta_h);
    // Sin ninguna ventaja medible no es una recomendacion, es ruido.
    if (dinero === 0 && horas === 0) continue;

    const fuente = t.fuenteRecomendada || t.fuente;
    const conf = confianzaDeFuente(fuente);
    const { prioridad, valor } = clasificar({ dinero, horas, totalViaje, ritmo });

    out.push({
      id: `transporte:${t.id}`,
      tipo: "transporte",
      prioridad,
      valor,
      titulo: `Para ${t.desde} → ${t.hasta} conviene ${nombreMedio(medioRec)}`,
      porque:
        t.recomendacionExplicacion ||
        `Frente a ${nombreMedio(medioOrig)}, ${describirVentaja(dinero, horas)} una vez contado el tiempo puerta a puerta.`,
      dinero,
      horas,
      confianza: conf.nivel,
      fuente,
      fuenteEtiqueta: conf.etiqueta,
      fuenteClave: conf.clave,
      // Lo que la tarjeta necesita para redactar la frase ella misma, en
      // el idioma del viajero y en SU moneda. Las cifras van en `dinero` y
      // `horas`, que ya estaban: aqui solo va el contexto.
      datos: { desde: t.desde, hasta: t.hasta, medioRec, medioOrig, explicacionCodigo: t.recomendacionExplicacionCodigo || null },
      ancla: "#transporte",
    });
  }
  return out;
}

/**
 * Oportunidad 2 — QUITAR UNA CIUDAD.
 *
 * Viene entera de analizadorDecisionesViaje, que ya separa lo que se ahorra en
 * transporte de lo que cuesta la estancia. Aqui solo se filtra y se clasifica.
 *
 * Se descartan las que salen a deber: el analizador las devuelve igual —hace
 * bien, es informacion— pero proponer "quita una ciudad y paga mas" no es una
 * oportunidad.
 */
function oportunidadesEliminar(decisiones, viaje, totalViaje, ritmo) {
  const paradas = viaje?.paradas || [];
  // La ciudad por la que se entra y se sale del pais: es donde aterriza el
  // vuelo internacional. Proponer quitarla no es una optimizacion, es romper
  // el viaje —en el viaje de referencia seria quitar Madrid y quedarse sin
  // forma de llegar—. Se identifica como la vecina del origen.
  const entrada = paradas.length > 2 ? paradas[1]?.ciudad : null;
  const salida = paradas.length > 2 ? paradas[paradas.length - 2]?.ciudad : null;

  const porCiudad = new Map();

  for (const d of decisiones?.eliminar || []) {
    if (d.ciudad === entrada || d.ciudad === salida) continue;

    // EL AHORRO ES EL DE TRANSPORTE, Y SOLO ESE.
    //
    // analizadorDecisionesViaje devuelve impactoNeto = transporte + estancia,
    // y esta bien que lo haga: es informacion. Pero ordenar por ese numero
    // convierte a CUALQUIER ciudad con tres noches en una gran oportunidad,
    // porque dejar de dormir en un sitio siempre 'ahorra'. Eso no es
    // optimizar un viaje: es hacer menos viaje.
    //
    // Lo que de verdad mejora el viaje es no pagar traslados que no aportan.
    // Las noches liberadas se enseñan como CONTEXTO —dinero que se puede
    // reinvertir en el resto— pero no mandan en la prioridad.
    const ahorroTransporte = n(d.ahorroTransporteEstimado);
    const horas = n(d.ahorroHoras);
    if (ahorroTransporte <= 0 && horas <= 0) continue;

    const { prioridad, valor } = clasificar({
      dinero: ahorroTransporte,
      horas,
      totalViaje,
      ritmo,
      complejidad: -0.5,
    });
    const conf = d.confianza === "alta" ? "alta" : d.confianza === "media" ? "media" : "baja";
    const estanciaLiberada = n(d.impactoNetoEstimado) - ahorroTransporte;

    const op = {
      id: `eliminar:${d.ciudad}`,
      tipo: "eliminar-ciudad",
      prioridad,
      valor,
      titulo: `Quitar ${d.ciudad} del itinerario`,
      porque: d.razon,
      dinero: ahorroTransporte,
      horas,
      detalle: {
        ahorroTransporte,
        costeEstanciaLiberado: estanciaLiberada,
        nochesLiberadas: n(d.nochesLiberadas),
        impactoNeto: n(d.impactoNetoEstimado),
      },
      confianza: conf,
      fuente: "estimado",
      fuenteEtiqueta: "Estimación",
      fuenteClave: "iaFuenteEstimado",
      datos: { ciudad: d.ciudad, razonCodigo: d.razonCodigo || null },
      ancla: "#decisiones",
    };

    // Una ciudad repetida genera una decision por aparicion. Al viajero le
    // sobra ver 'Quitar Londres' dos veces: se queda la de mas impacto.
    const previa = porCiudad.get(d.ciudad);
    if (!previa || op.valor > previa.valor) porCiudad.set(d.ciudad, op);
  }
  return [...porCiudad.values()];
}
/**
 * Oportunidad 3 — REORDENAR LA RUTA.
 *
 * optimizadorViaje ya dice si hay un orden mejor y cuanto mejor es. Nunca se
 * aplica solo: se propone y el viajero decide, que es lo que pide el proceso.
 */
function oportunidadReordenar(optimizacion, totalViaje, ritmo) {
  if (!optimizacion?.hayAlternativa) return null;
  const dinero = n(optimizacion.comparacion?.ahorroPrecio);
  const horas = n(optimizacion.comparacion?.ahorroHoras);
  if (dinero <= 0 && horas <= 0) return null;

  const { prioridad, valor } = clasificar({ dinero, horas, totalViaje, ritmo });
  const orden = (optimizacion.recomendado || []).map((p) => p.ciudad).join(" → ");

  return {
    id: "reordenar",
    tipo: "reordenar",
    prioridad,
    valor,
    titulo: "Hay un orden mejor para las mismas ciudades",
    porque: `Recorriendo ${orden} se reduce el zigzag sin quitar ninguna parada.`,
    dinero,
    horas,
    confianza: optimizacion.zigzag?.datosFaltantes ? "baja" : "media",
    fuente: "estimado",
    fuenteEtiqueta: "Estimación",
    fuenteClave: "iaFuenteEstimado",
    datos: { orden },
    ancla: "#ruta",
    rutaPropuesta: (optimizacion.recomendado || []).map((p) => p.ciudad),
    rutaActual: (optimizacion.original || []).map((p) => p.ciudad),
  };
}

/**
 * Oportunidad 4 — SALIR DE OTRO AEROPUERTO.
 *
 * Y aqui va la parte que casi nadie hace bien: NO basta con que el vuelo sea
 * mas barato. Hay que llegar a ese aeropuerto, y eso cuesta dinero y horas.
 * `alternativa` ya trae las dos cosas calculadas con el mismo motor de tramos
 * que usa el resto del viaje, asi que la comparacion es neta.
 */
function oportunidadOrigen(alternativa, totalViaje, ritmo) {
  if (!alternativa) return null;
  const dinero = n(alternativa.ahorroNetoUsd);
  const horas = -n(alternativa.horasExtra);
  if (dinero <= 0) return null;

  const { prioridad, valor } = clasificar({ dinero, horas, totalViaje, ritmo, complejidad: 0.5 });
  // Si despues de descontar el traslado y el tiempo ya no compensa, no se
  // propone: recomendarlo "porque el vuelo es mas barato" seria justo el error.
  if (valor <= 0) return null;

  return {
    id: `origen:${alternativa.iata}`,
    tipo: "aeropuerto-alternativo",
    prioridad,
    valor,
    titulo: `Salir desde ${alternativa.ciudad} en vez de ${alternativa.ciudadActual}`,
    // La frase la compone la tarjeta, que es quien sabe en que moneda esta
    // mirando el viajero. El motor calcula en dolares y si redacta aqui
    // acaba diciendo '217 USD' dentro de una tarjeta que habla en pesos.
    porque: null,
    detalleOrigen: {
      ciudad: alternativa.ciudad,
      ciudadActual: alternativa.ciudadActual,
      ahorroVuelo: n(alternativa.ahorroVueloUsd),
      costeLlegar: n(alternativa.costeLlegarUsd),
      horasExtra: n(alternativa.horasExtra),
    },
    dinero,
    horas,
    confianza: "media",
    fuente: alternativa.fuente || "detectado",
    fuenteEtiqueta: confianzaDeFuente(alternativa.fuente || "detectado").etiqueta,
    fuenteClave: confianzaDeFuente(alternativa.fuente || "detectado").clave,
    datos: { ciudad: alternativa.ciudad, ciudadActual: alternativa.ciudadActual },
    ancla: null,
  };
}

/**
 * Presupuesto: donde se concentra el gasto.
 *
 * Solo se calculan porcentajes sobre cifras que existen. Si no hay estancia
 * calculada, no se inventa un "42% en alojamiento".
 */
function analizarPresupuesto(presupuesto, tramos, paradas) {
  if (!presupuesto || !n(presupuesto.total)) return null;
  const total = n(presupuesto.total);
  const avisos = [];

  const pctTransporte = n(presupuesto.transporte) / total;
  const pctEstancia = n(presupuesto.alojamientoYVida) / total;

  if (pctTransporte >= 0.5) {
    avisos.push({
      clave: "transporte-alto",
      vars: { p: Math.round(pctTransporte * 100) },
      texto: `El ${Math.round(pctTransporte * 100)} % del coste estimado es transporte. En viajes de varias ciudades suele significar demasiados saltos.`,
    });
  }
  if (pctEstancia >= 0.55) {
    avisos.push({
      clave: "estancia-alta",
      vars: { p: Math.round(pctEstancia * 100) },
      texto: `El ${Math.round(pctEstancia * 100)} % del coste estimado es alojamiento y día a día.`,
    });
  }

  // El tramo mas caro, que casi siempre es el vuelo internacional y conviene
  // que el viajero lo sepa antes de recortar en otra parte.
  const caro = [...(tramos || [])].sort(
    (a, b) => n(b.precioRecomendado ?? b.precio) - n(a.precioRecomendado ?? a.precio)
  )[0];
  if (caro && n(caro.precioRecomendado ?? caro.precio) / total >= 0.25) {
    avisos.push({
      clave: "tramo-caro",
      vars: { desde: caro.desde, hasta: caro.hasta, p: Math.round((n(caro.precioRecomendado ?? caro.precio) / total) * 100) },
      texto: `${caro.desde} → ${caro.hasta} concentra el ${Math.round((n(caro.precioRecomendado ?? caro.precio) / total) * 100)} % del coste total.`,
    });
  }

  return {
    total,
    pctTransporte: Math.round(pctTransporte * 100),
    pctEstancia: Math.round(pctEstancia * 100),
    avisos,
  };
}

/**
 * Lo que NO sabemos, y por que importa.
 *
 * Esto es una funcionalidad, no un error: decir "no puedo comparar avion y
 * tren con confianza porque no tengo precio real del vuelo" es mas util que
 * inventar el precio.
 */
function detectarFaltantes(viaje, tramos) {
  const out = [];
  const sinDato = (tramos || []).filter((t) => !(t.fuenteRecomendada || t.fuente) || (t.fuenteRecomendada || t.fuente) === "sin_dato");
  const estimados = (tramos || []).filter((t) => (t.fuenteRecomendada || t.fuente) === "estimado");
  const conVueloReal = (tramos || []).filter((t) => (t.fuenteRecomendada || t.fuente) === "detectado");

  if (!viaje?.mesInicio && !viaje?.fechaIda) {
    out.push({
      clave: "sin-fecha",
      texto: "Sin mes de viaje no podemos consultar precios reales de vuelo: todo el transporte aéreo queda estimado.",
    });
  } else if (!viaje?.fechaIda) {
    out.push({
      clave: "sin-fecha-exacta",
      texto: "Con el mes podemos buscar el mejor precio del periodo; con la fecha exacta la comparación sería más firme.",
    });
  }
  if (!conVueloReal.length && estimados.length) {
    out.push({
      clave: "sin-vuelo-real",
      vars: { n: estimados.length },
      texto: `No tenemos ningún precio de vuelo consultado en vivo, así que ${estimados.length === 1 ? "el tramo aéreo" : `los ${estimados.length} tramos estimados`} no pueden compararse con alta confianza.`,
    });
  }
  if (sinDato.length) {
    out.push({
      clave: "tramos-sin-dato",
      vars: { n: sinDato.length },
      texto: `${sinDato.length} ${sinDato.length === 1 ? "tramo no tiene" : "tramos no tienen"} datos suficientes para recomendar un medio de transporte.`,
    });
  }
  const sinNoches = (viaje?.paradas || []).filter((p, i) => i > 0 && i < (viaje.paradas.length - 1) && !n(p.noches));
  if (sinNoches.length) {
    out.push({
      clave: "sin-noches",
      vars: { n: sinNoches.length },
      texto: `${sinNoches.length} ${sinNoches.length === 1 ? "parada intermedia no tiene noches asignadas" : "paradas intermedias no tienen noches asignadas"}, así que su coste de estancia no entra en el total.`,
    });
  }
  return out;
}

/** Confianza global del analisis: que parte del transporte se apoya en datos. */
function confianzaGlobal(tramos) {
  const lista = tramos || [];
  if (!lista.length) return { nivel: "nula", pct: 0, reales: 0, curados: 0, estimados: 0 };
  let puntos = 0;
  let reales = 0;
  let curados = 0;
  let estimados = 0;
  for (const t of lista) {
    const f = t.fuenteRecomendada || t.fuente;
    if (f === "detectado") { puntos += 1; reales++; }
    else if (f === "curado" || f === "incluido") { puntos += 0.7; curados++; }
    else if (f === "estimado") { puntos += 0.35; estimados++; }
  }
  const pct = Math.round((puntos / lista.length) * 100);
  return {
    pct,
    nivel: pct >= 70 ? "alta" : pct >= 45 ? "media" : "baja",
    reales, curados, estimados,
  };
}

function nombreMedio(m) {
  return m === "vuelo" ? "avión" : m === "tren" ? "tren" : m === "bus" ? "bus" : m === "ferry" ? "ferry" : m || "otro medio";
}
function describirVentaja(dinero, horas) {
  const partes = [];
  if (dinero > 0) partes.push(`ahorra unos ${Math.round(dinero)} USD`);
  else if (dinero < 0) partes.push(`cuesta ${Math.round(-dinero)} USD más`);
  if (horas > 0) partes.push(`gana ${horas.toFixed(1)} h`);
  else if (horas < 0) partes.push(`tarda ${(-horas).toFixed(1)} h más`);
  return partes.join(" y ") || "queda igual";
}

/**
 * El analisis completo.
 *
 * Consume lo que los motores ya calcularon. No llama a nadie, no pide red y no
 * guarda nada: entra informacion, sale una lectura.
 */
export function analizarViaje({
  viaje,
  tramos = [],
  presupuesto = null,
  decisiones = null,
  optimizacion = null,
  origenAlternativo = null,
  gustos = null,
  tope = 5,
} = {}) {
  // El ritmo del viajero decide cuanto vale una hora. Si no lo dijo, se mira
  // su perfil de gustos —el mismo que alimenta las recomendaciones— y si
  // tampoco hay, se asume normal.
  const ritmo = inferirRitmo(viaje, gustos);
  const totalViaje = n(presupuesto?.total) || tramos.reduce((s, t) => s + n(t.precioRecomendado ?? t.precio), 0);

  const candidatas = [
    ...oportunidadesTransporte(tramos, totalViaje, ritmo),
    ...oportunidadesEliminar(decisiones, viaje, totalViaje, ritmo),
    oportunidadReordenar(optimizacion, totalViaje, ritmo),
    oportunidadOrigen(origenAlternativo, totalViaje, ritmo),
  ].filter(Boolean);

  // Orden por valor real, no por tipo ni por cuanto dinero mueve a secas.
  const oportunidades = candidatas.sort((a, b) => b.valor - a.valor).slice(0, tope);

  const conf = confianzaGlobal(tramos);
  return {
    ritmo,
    confianza: conf,
    oportunidades,
    // Cuando no hay nada que proponer hay que DECIRLO, no dejar un hueco.
    sinOportunidades: oportunidades.length === 0,
    presupuestoInsight: analizarPresupuesto(presupuesto, tramos, viaje?.paradas),
    faltantes: detectarFaltantes(viaje, tramos),
  };
}

/**
 * Ritmo del viajero: explicito si lo eligio, y si no, deducido de su perfil.
 * "relajado", "cultura" y "gastronomia" apuntan a alguien que no quiere correr.
 */
function inferirRitmo(viaje, gustos) {
  if (viaje?.ritmo === "tranquilo" || viaje?.ritmo === "normal") return viaje.ritmo;
  if (gustos && typeof gustos === "object") {
    const tranquilos = ["gastronomia", "romantico", "historia"];
    const total = Object.entries(gustos)
      .filter(([k]) => CATEGORIAS_GUSTO.includes(k))
      .reduce((s, [, v]) => s + n(v), 0);
    const suave = tranquilos.reduce((s, k) => s + n(gustos[k]), 0);
    if (total > 0 && suave / total >= 0.5) return "tranquilo";
  }
  return "normal";
}
