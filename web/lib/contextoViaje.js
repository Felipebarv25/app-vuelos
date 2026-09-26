// EL VIAJE, CONTADO EN TEXTO PARA QUE EL ASESOR PUEDA HABLAR DE EL.
//
// El asesor general (Brujula) recomienda destinos a quien no sabe a donde ir.
// Este contexto es para la otra conversacion, la que empieza cuando el viaje
// YA existe: "¿me alcanza?", "¿por que tren y no avion?", "¿que me falta?".
//
// POR QUE ES UN FICHERO APARTE Y NO UNA PLANTILLA DENTRO DE LA RUTA
//
// Porque esto es lo unico que el modelo va a saber del viaje. Si se redacta
// suelto dentro del endpoint acaba siendo imposible de revisar, y lo que se
// filtra a un tercero merece estar en un sitio donde se lea de un vistazo.
//
// LO QUE ENTRA Y LO QUE NO
//
// Entra lo que el viajero ya ve en su tablero: ciudades, noches, fechas,
// coste orientativo, tramos con SU FUENTE, tareas pendientes y requisitos.
//
// No entra nada de identidad: ni correo, ni nombre de usuario, ni id de la
// ruta, ni tokens. El asesor no los necesita para contestar y no hay razon
// para mandarlos fuera.
//
// CADA CIFRA VIAJA CON SU PROCEDENCIA
//
// Un precio "detectado" y uno "estimado" no se pueden defender igual, y el
// modelo no puede distinguirlos si se los damos como una lista de numeros. Por
// eso cada tramo lleva su fuente escrita al lado: asi el asesor puede decir
// "ese dato es una estimacion" en vez de afirmarlo como si fuera una tarifa.

const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

const FUENTE = {
  detectado: "precio real detectado",
  vivo: "precio consultado en vivo",
  curado: "tarifa de referencia curada",
  estimado: "ESTIMACION, no es una tarifa real",
  incluido: "incluido en el billete",
};
function fuenteTexto(f) {
  return FUENTE[f] || "sin dato suficiente";
}

function dinero(v, moneda, tasa) {
  const num = n(v);
  if (num == null) return "sin dato";
  if (moneda && moneda !== "USD" && n(tasa)) return `${Math.round(num * tasa).toLocaleString("en-US")} ${moneda} (US$${Math.round(num)})`;
  return `US$${Math.round(num)}`;
}

/**
 * Construye el bloque de contexto. Devuelve texto plano: es lo que mejor lee
 * un modelo y lo que mas facil resulta de inspeccionar en un log.
 *
 * @param {object} viaje    la ruta guardada
 * @param {object} analisis lo que devuelve /api/viaje-canonico
 * @param {object} plan     lo que devuelve lib/ejecutorViaje
 * @param {string} idioma   para pedir la respuesta en el idioma del viajero
 */
export function contextoDeViaje({ viaje, analisis, plan, idioma = "es" } = {}) {
  if (!viaje?.paradas?.length) return null;

  const moneda = analisis?.presupuesto?.monedaVista || viaje?.monedaVista || "USD";
  const tasa = analisis?.presupuesto?.tasaVistaPorUsd || 1;
  const L = [];

  L.push("=== EL VIAJE DE ESTE VIAJERO ===");
  L.push(`Idioma del viajero: ${idioma}`);

  // La ruta, con sus noches.
  const ruta = viaje.paradas.map((p) => {
    const noches = Math.max(0, n(p.noches) || 0);
    return noches ? `${p.ciudad} (${noches} ${noches === 1 ? "noche" : "noches"})` : `${p.ciudad} (de paso)`;
  }).join(" → ");
  L.push(`Ruta: ${ruta}`);

  const noches = viaje.paradas.reduce((s, p) => s + Math.max(0, n(p.noches) || 0), 0);
  L.push(`Duracion: ${noches} noches en total.`);

  if (viaje.fechaIda) L.push(`Sale el ${viaje.fechaIda} (dia exacto confirmado).`);
  else if (viaje.mesInicio) L.push(`Sale en ${viaje.mesInicio}. NO hay dia exacto todavia: por eso los precios de vuelo son estimaciones y no consultas reales.`);
  else L.push("NO hay fecha de viaje. Sin ella no se pueden consultar precios reales de vuelo.");

  L.push(`Nivel de gasto elegido: ${viaje.nivel || "medio"}. Pasaporte: ${viaje.pasaporte || "CO"}. Ve los importes en ${moneda}.`);

  // El presupuesto, con su naturaleza declarada.
  const p = analisis?.presupuesto;
  if (p) {
    L.push("");
    L.push("--- COSTE ORIENTATIVO (no es un precio de venta) ---");
    L.push(`Total: ${dinero(p.total, moneda, tasa)}`);
    L.push(`  · transporte entre ciudades: ${dinero(p.transporte, moneda, tasa)}`);
    L.push(`  · alojamiento y vida diaria: ${dinero(p.alojamientoYVida, moneda, tasa)}`);
    L.push(`  · contingencia: ${dinero(p.contingencia, moneda, tasa)}`);
    if (p.conversionEsRespaldo) L.push("  (la conversion de moneda usa una tasa de respaldo, no la del dia)");
  }

  // Los tramos, cada uno con su fuente.
  const tramos = analisis?.tramos || [];
  if (tramos.length) {
    L.push("");
    L.push("--- COMO SE MUEVE, TRAMO A TRAMO ---");
    for (const t of tramos) {
      const medio = t.medioRecomendado || t.medio || "sin opcion";
      const horas = n(t.puertaAPuertaRecomendada_h ?? t.puertaAPuerta_h);
      const precio = n(t.precioRecomendado ?? t.precio);
      const alternativas = (t.alternativas || []).filter((a) => a?.medio).map((a) => `${a.medio} ${dinero(a.precio, moneda, tasa)}`).join(", ");
      L.push(`${t.desde} → ${t.hasta}: ${medio}, ${precio != null ? dinero(precio, moneda, tasa) : "sin precio"}${horas != null ? `, ${horas} h puerta a puerta` : ""} [${fuenteTexto(t.fuenteRecomendada || t.fuente)}]${alternativas ? ` · alternativas: ${alternativas}` : ""}`);
    }
  }

  // El alojamiento, siempre como estimacion.
  const estadia = analisis?.estadia || [];
  if (estadia.length) {
    L.push("");
    L.push("--- ALOJAMIENTO Y VIDA DIARIA (todo ESTIMADO por coste de vida, Anduve no reserva alojamiento) ---");
    for (const e of estadia) {
      L.push(`${e.ciudad}: ${e.noches} ${e.noches === 1 ? "noche" : "noches"}, ~${dinero(e.diarioUsd, moneda, tasa)}/dia, ~${dinero(e.totalUsd, moneda, tasa)} en total [${e.fuente === "ciudad" ? "dato de esa ciudad" : "mediana del pais, menos preciso"}]`);
    }
  }

  // Lo que ya le dijimos que cambiaria.
  const oportunidades = analisis?.inteligencia?.oportunidades || [];
  if (oportunidades.length) {
    L.push("");
    L.push("--- LO QUE ANDUVE YA LE HA RECOMENDADO CAMBIAR ---");
    for (const o of oportunidades.slice(0, 5)) {
      L.push(`${o.titulo} (prioridad ${o.prioridad}, confianza ${o.confianza}; ahorro estimado ${dinero(o.dinero, moneda, tasa)})`);
    }
  }

  // Lo que le falta por hacer.
  if (plan?.tareas?.length) {
    const pendientes = plan.tareas.filter((t) => t.requiereAccion);
    L.push("");
    L.push(`--- PREPARACION: estado "${plan.estadoViaje}", ${pendientes.length} tareas pendientes de ${plan.tareas.length} ---`);
    for (const t of pendientes.slice(0, 12)) L.push(`[${t.prioridad}] ${t.titulo}`);
    const listas = plan.tareas.filter((t) => !t.requiereAccion);
    if (listas.length) L.push(`Ya resueltas: ${listas.map((t) => t.titulo).join("; ")}`);
  }

  // Lo que NO sabemos. Es la parte mas importante del contexto: sin esto el
  // modelo rellena los huecos, que es exactamente lo que no queremos.
  const faltantes = analisis?.inteligencia?.faltantes || [];
  if (faltantes.length) {
    L.push("");
    L.push("--- LO QUE ANDUVE NO SABE DE ESTE VIAJE ---");
    for (const f of faltantes) L.push(`· ${f.texto}`);
  }

  return L.join("\n");
}

/**
 * Las instrucciones que acompañan al contexto.
 *
 * Van SEPARADAS del prompt estable del asesor general porque cambian de
 * naturaleza: aqui el modelo no recomienda destinos, responde sobre un viaje
 * que ya existe y que el viajero conoce mejor que el.
 */
export const REGLAS_ASESOR_VIAJE = `Estas hablando con un viajero que YA tiene su viaje construido en Anduve. Arriba tienes sus datos reales.

Como responder:
- Contesta SOLO con las cifras que te he dado. Si te preguntan algo que no esta en el contexto, di que no lo tienes y di que dato haria falta para saberlo.
- NUNCA inventes un precio, un horario, una aerolinea, un hotel ni una disponibilidad. Ni siquiera "aproximadamente".
- Cuando uses una cifra marcada como ESTIMACION, dilo en la respuesta. El viajero tiene derecho a saber en que se apoya tu consejo.
- Anduve NO reserva nada. No digas que algo esta reservado ni ofrezcas reservarlo; puedes decir que lo marque como hecho en su tablero cuando lo haya gestionado por su cuenta.
- Si preguntan "¿que hago ahora?", apoyate en las tareas pendientes y en su prioridad.
- Si preguntan por visados, responde con lo que hay en el contexto y recuerda que la fuente oficial manda.
- Se breve y concreto: dos o tres frases, o una lista corta con "·". Nada de relleno ni de repetir el viaje entero.
- Texto plano: sin Markdown, sin tablas, sin ** ni ##.
- Responde SIEMPRE en el idioma del viajero.`;
