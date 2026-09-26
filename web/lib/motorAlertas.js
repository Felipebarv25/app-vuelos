// ¿HA CAMBIADO ALGO IMPORTANTE EN MI VIAJE DESDE LA ULTIMA VEZ?
//
// POR QUE ESTO NO ES EL SISTEMA DE ALERTAS QUE YA TENIAMOS
//
// lib/alertas.js vigila un DESTINO para un usuario: "avisame si Madrid baja de
// US$700", y su salida es un correo. Esto vigila un VIAJE: sus tramos, su
// coste, sus tareas, sus requisitos, y su salida es un panel dentro de la app.
//
// Son dos entidades distintas con dos ciclos de vida distintos —una la
// configura el viajero y se borra cuando quiere; la otra la detecta Anduve y
// se resuelve sola cuando el dato vuelve a su sitio—, asi que tienen su propia
// clave en KV. Lo que SI se reutiliza es todo lo demas: el mismo KV, el mismo
// identificarUsuario, el mismo secreto compartido del cron, el mismo
// /api/vuelo-vivo y la misma leccion anti-spam que ya estaba aprendida ahi.
//
// LA REGLA QUE MANDA SOBRE TODAS
//
// UNA ALERTA SOLO EXISTE SI HAY CAMBIO. Consultar un precio no es un cambio.
// Que el precio siga igual no es un cambio. Ni siquiera que baje tres dolares
// lo es. Por eso todo se compara contra una FOTO anterior y contra el ultimo
// valor del que ya avisamos, no contra la ultima consulta.
//
// LOS UMBRALES VIVEN AQUI Y EN NINGUN OTRO SITIO
//
// Repartir numeros magicos por los componentes es como acaba un sistema de
// avisos siendo ruido: nadie sabe por que salto algo. Si hay que subir el
// listo del ruido, se sube en esta tabla.

// --- UMBRALES -----------------------------------------------------------
//
// Un cambio de precio tiene que ser relevante EN LOS DOS SENTIDOS: en
// porcentaje y en dinero. Solo porcentaje avisa de US$2 en un bus de US$20;
// solo dinero calla una bajada del 20% en un tramo barato.
// Los numeros NO salen de la intuicion: se calibraron contra los ejemplos del
// encargo, que marcan donde esta la frontera entre noticia y ruido.
//
//   700 → 680   (-2.9%, -20 USD)  avisa
//   680 → 650   (-4.4%, -30 USD)  avisa
//   700 → 910   (+30%, +210 USD)  avisa
//   820 → 815   (-0.6%,  -5 USD)  calla
//    20 → 18    (-10%,   -2 USD)  calla, porque en dinero no es nada
//
// Con 7%/25 USD —lo primero que puse— el caso 700 → 680 se quedaba mudo.
export const UMBRALES = {
  precioPct: 0.025,         // 2,5% del precio anterior
  precioAbsUsd: 15,         // y al menos 15 dolares de diferencia
  costePct: 0.05,           // el coste total se mueve mas despacio
  costeAbsUsd: 100,
  diasTareaAlta: 21,        // una tarea critica sin resolver a 3 semanas del viaje
  // 20 y no 10: el ejemplo del encargo es "tu viaje empieza en 18 dias y
  // todavia no has resuelto el alojamiento en Londres", que es una tarea de
  // prioridad media. Con 10 dias esa alerta —la que el propio encargo pone
  // como caso de uso— no llegaba a salir.
  diasTareaMedia: 20,
  diasRequisito: 30,        // un tramite lleva su tiempo
  // Piso entre consultas automaticas del MISMO viaje. El aprendizaje del
  // Proceso 4 en una linea: esto cuesta dinero y no se dispara solo.
  esperaMonitorMs: 12 * 60 * 60 * 1000,
  // Cuantos tramos de un viaje se vigilan automaticamente. Los caros primero:
  // vigilar nueve tramos por viaje multiplica la factura para detectar
  // cambios de dos dolares en un tren.
  tramosVigilados: 2,
  topeAlertas: 40,          // por viaje; las viejas resueltas se caen solas
  caducidadMs: 60 * 24 * 60 * 60 * 1000, // 60 dias
};

// La lista de viajes que el monitor vigila. Vive aqui y no en un fichero de
// ruta: un route.js solo debe exportar handlers, y compartir una constante
// desde ahi arrastra su configuracion (runtime, maxDuration) a quien la
// importe.
export const K_VIGILADOS = "alertasviaje:vigilados";

export const NIVELES = ["importante", "atencion", "info"];

const n = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);
const dias = (ms) => Math.round(ms / (24 * 60 * 60 * 1000));

/** Dias hasta la salida, solo si hay fecha exacta. Sin fecha no hay cuenta atras. */
export function diasParaSalir(viaje, ahora = Date.now()) {
  const f = String(viaje?.fechaIda || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return null;
  const salida = new Date(`${f}T00:00:00`).getTime();
  if (!Number.isFinite(salida)) return null;
  return dias(salida - ahora);
}

/**
 * ¿Este cambio de precio merece molestar a alguien?
 *
 * Se compara contra el ultimo valor DEL QUE YA AVISAMOS, no contra la ultima
 * consulta. Es lo que hace que 700 → 680 avise, que volver a consultar y
 * seguir en 680 NO avise, y que 680 → 650 vuelva a avisar.
 */
export function cambioRelevante(anterior, actual, { pct, abs }) {
  const a = n(anterior); const b = n(actual);
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  const dif = b - a;
  if (Math.abs(dif) < abs) return null;
  if (Math.abs(dif) / a < pct) return null;
  return { anterior: a, actual: b, diferencia: Math.round(dif), pct: Math.round((dif / a) * 1000) / 10 };
}

/**
 * LA FOTO. Lo minimo para poder comparar la proxima vez.
 *
 * No se guarda la respuesta del proveedor, ni el analisis, ni el plan: solo
 * los numeros que van a compararse. Todo lo demas se recalcula, porque
 * guardarlo seria guardar una verdad con fecha de caducidad.
 */
export function construirSnapshot({ viaje, analisis, plan, preciosVivos = {} } = {}) {
  const tramos = {};
  for (const t of analisis?.tramos || []) {
    const vivo = preciosVivos[t.id];
    tramos[t.id] = {
      desde: t.desde,
      hasta: t.hasta,
      medio: t.medioRecomendado || t.medio || null,
      // El precio ESTIMADO y el CONSULTADO no se mezclan nunca: son dos
      // magnitudes distintas y compararlas entre si inventaria un cambio que
      // no ocurrio (bajar de una estimacion a un precio real no es "bajar").
      precioEstimado: n(t.precioRecomendado ?? t.precio),
      precioVivo: vivo ? n(vivo.precio) : null,
      vivoDe: vivo ? (vivo.esDeTuFecha ? "fecha" : "mes") : null,
      fuente: t.fuenteRecomendada || t.fuente || null,
    };
  }
  return {
    v: 1,
    tomadoEn: Date.now(),
    costeTotalUsd: n(analisis?.presupuesto?.total),
    estadoViaje: plan?.estadoViaje || null,
    tramos,
    // Solo el identificador y el estado de cada tarea: con eso basta para ver
    // que sigue pendiente cuando se acerca la fecha.
    tareas: Object.fromEntries((plan?.tareas || []).map((t) => [t.id, { prioridad: t.prioridad, requiereAccion: Boolean(t.requiereAccion), tipo: t.tipo }])),
  };
}

function alerta({ tipo, nivel, clave, vars = {}, fuente, accion = null, datos = {} }) {
  return {
    // El id es determinista por (tipo, clave): dos detecciones del mismo hecho
    // son la misma alerta, no dos. Lo que las distingue es el valor.
    id: `${tipo}:${clave}`,
    tipo, nivel, clave, vars, fuente, accion, datos,
    detectadoEn: Date.now(),
    estado: "activa",
    leida: false,
  };
}

/**
 * EL DETECTOR.
 *
 * Entra la foto anterior, el estado de ahora y las alertas que ya existen;
 * salen SOLO las novedades. Nada de "se consulto el precio y sigue igual":
 * eso no es una alerta, es un log.
 *
 * @param {object} previo      snapshot anterior (null la primera vez)
 * @param {object} actual      snapshot de ahora
 * @param {object} viaje       para la cuenta atras
 * @param {array}  plan        tareas con su titulo, para poder redactar
 * @param {array}  existentes  alertas ya guardadas, para no repetirlas
 */
export function detectarCambios({ previo, actual, viaje, plan, existentes = [], ahora = Date.now() } = {}) {
  const out = [];
  const yaAvisado = new Map(existentes.filter((a) => a.estado === "activa").map((a) => [a.id, a]));

  // --- A y C. PRECIO DE VUELO CONSULTADO ---------------------------------
  //
  // Solo con precios VIVOS: un cambio en una estimacion no es un cambio en el
  // mundo, es un cambio en nuestra tabla. Avisar de eso seria inventar.
  for (const [id, t] of Object.entries(actual?.tramos || {})) {
    if (t.precioVivo == null) continue;
    const ant = previo?.tramos?.[id];
    // El valor de referencia es el ultimo AVISADO si existe; si no, el de la
    // foto anterior. Asi consultar diez veces el mismo precio no genera diez
    // alertas, y un nuevo movimiento sobre el ya avisado si genera una.
    const previaAlerta = yaAvisado.get(`precio:${id}`);
    const referencia = previaAlerta ? n(previaAlerta.datos?.actual) : ant?.precioVivo;
    if (referencia == null) continue;

    const c = cambioRelevante(referencia, t.precioVivo, { pct: UMBRALES.precioPct, abs: UMBRALES.precioAbsUsd });
    if (!c) continue;
    const baja = c.diferencia < 0;
    out.push(alerta({
      tipo: "precio",
      nivel: baja ? "importante" : "atencion",
      clave: id,
      vars: { desde: t.desde, hasta: t.hasta, pct: Math.abs(c.pct) },
      // Dice de donde sale, y ademas si el precio es de la fecha exacta o del
      // mes: son dos promesas distintas y mezclarlas engaña.
      fuente: "vivo",
      accion: { tipo: "ver-transporte", ancla: "#transporte" },
      datos: { anterior: c.anterior, actual: c.actual, diferencia: c.diferencia, pct: c.pct, de: t.vivoDe, baja },
    }));
  }

  // --- E. EL COSTE ESTIMADO DEL VIAJE ------------------------------------
  //
  // No hay presupuesto objetivo guardado en el viaje, asi que no se puede
  // decir "te pasas de tu presupuesto" sin inventarselo. Lo que si se puede
  // decir con verdad es que el coste se movio desde la ultima vez.
  if (previo?.costeTotalUsd != null && actual?.costeTotalUsd != null) {
    const previaAlerta = yaAvisado.get("coste:total");
    const referencia = previaAlerta ? n(previaAlerta.datos?.actual) : previo.costeTotalUsd;
    const c = cambioRelevante(referencia, actual.costeTotalUsd, { pct: UMBRALES.costePct, abs: UMBRALES.costeAbsUsd });
    if (c) {
      out.push(alerta({
        tipo: "coste",
        nivel: c.diferencia > 0 ? "atencion" : "info",
        clave: "total",
        vars: { pct: Math.abs(c.pct) },
        // El coste total se apoya en estimaciones: se dice, no se disfraza.
        fuente: "estimado",
        accion: { tipo: "ver-presupuesto", ancla: "#que-sigue" },
        datos: { anterior: c.anterior, actual: c.actual, diferencia: c.diferencia, pct: c.pct, sube: c.diferencia > 0 },
      }));
    }
  }

  // --- B. EL MEDIO RECOMENDADO CAMBIO ------------------------------------
  for (const [id, t] of Object.entries(actual?.tramos || {})) {
    const ant = previo?.tramos?.[id];
    if (!ant?.medio || !t.medio || ant.medio === t.medio) continue;
    out.push(alerta({
      tipo: "transporte",
      nivel: "info",
      clave: id,
      vars: { desde: t.desde, hasta: t.hasta },
      fuente: t.fuente || "estimado",
      accion: { tipo: "ver-transporte", ancla: "#transporte" },
      datos: { antes: ant.medio, ahora: t.medio },
    }));
  }

  // --- D. UNA TAREA IMPORTANTE SE ACERCA ---------------------------------
  //
  // Depende del estado REAL de la tarea (motor del Proceso 4) y de la cuenta
  // atras REAL. Sin fecha exacta no hay cuenta atras y no hay alerta: seria
  // inventarse una urgencia.
  const restantes = diasParaSalir(viaje, ahora);
  if (restantes != null && restantes >= 0) {
    const pendientes = (plan?.tareas || []).filter((t) => t.requiereAccion);
    for (const t of pendientes) {
      const limite = t.prioridad === "alta" ? UMBRALES.diasTareaAlta
        : t.tipo === "requisito" ? UMBRALES.diasRequisito
          : UMBRALES.diasTareaMedia;
      if (restantes > limite) continue;
      const id = `tarea:${t.id}`;
      if (yaAvisado.has(id)) continue;   // ya avisamos de esta; no se repite cada dia
      out.push(alerta({
        tipo: "tarea",
        nivel: t.prioridad === "alta" ? "importante" : "atencion",
        clave: t.id,
        vars: { dias: restantes, tarea: t.titulo },
        fuente: t.confianza || "estimado",
        accion: t.tipo === "requisito" && t.enlace
          ? { tipo: "ver-requisito", href: t.enlace }
          : { tipo: "resolver-tarea", ancla: "#que-sigue" },
        datos: { dias: restantes, tipoTarea: t.tipo, prioridad: t.prioridad, tareaClave: t.clave, tareaVars: t.vars },
      }));
    }
  }

  return out.slice(0, UMBRALES.topeAlertas);
}

/**
 * Funde lo nuevo con lo guardado.
 *
 * Una alerta cuyo hecho ya no se cumple se RESUELVE sola: la tarea que el
 * viajero completo deja de reclamar atencion sin que nadie la borre. Y lo
 * leido no vuelve a marcarse como sin leer solo porque el valor se refresque.
 */
export function fundirAlertas({ guardadas = [], nuevas = [], plan = null, ahora = Date.now() } = {}) {
  const pendientes = new Set((plan?.tareas || []).filter((t) => t.requiereAccion).map((t) => `tarea:${t.id}`));
  const porId = new Map();

  for (const a of guardadas) {
    if (ahora - Number(a.detectadoEn || 0) > UMBRALES.caducidadMs) continue;
    // Las alertas de tarea se apagan cuando la tarea deja de estar pendiente.
    const resuelta = a.tipo === "tarea" && !pendientes.has(a.id);
    porId.set(a.id, resuelta ? { ...a, estado: "resuelta", resueltaEn: a.resueltaEn || ahora } : a);
  }

  for (const nueva of nuevas) {
    const vieja = porId.get(nueva.id);
    // Un valor nuevo sobre una alerta ya existente la REEMPLAZA y vuelve a
    // pedir atencion: el precio se movio otra vez, y eso es noticia.
    porId.set(nueva.id, vieja && vieja.estado === "activa" && JSON.stringify(vieja.datos) === JSON.stringify(nueva.datos)
      ? vieja
      : { ...nueva, vistaAnterior: vieja?.datos || null });
  }

  return [...porId.values()]
    .sort((a, b) => (Number(a.estado === "resuelta") - Number(b.estado === "resuelta"))
      || (NIVELES.indexOf(a.nivel) - NIVELES.indexOf(b.nivel))
      || (Number(b.detectadoEn) - Number(a.detectadoEn)))
    .slice(0, UMBRALES.topeAlertas);
}

/** Lo que el panel necesita saber de un vistazo. */
export function resumenAlertas(alertas = []) {
  const activas = alertas.filter((a) => a.estado === "activa");
  return {
    total: activas.length,
    sinLeer: activas.filter((a) => !a.leida).length,
    importantes: activas.filter((a) => a.nivel === "importante").length,
    atencion: activas.filter((a) => a.nivel === "atencion").length,
    info: activas.filter((a) => a.nivel === "info").length,
    todoAlDia: activas.length === 0,
  };
}

/** ¿Toca volver a consultar precios de este viaje? El freno de mano del coste. */
export function tocaMonitorear(snapshot, ahora = Date.now()) {
  if (!snapshot?.tomadoEn) return true;
  return ahora - Number(snapshot.tomadoEn) >= UMBRALES.esperaMonitorMs;
}

/**
 * Que tramos merecen una consulta de pago.
 *
 * Los mas caros primero, y como mucho `tramosVigilados`. Un viaje de nueve
 * tramos no puede convertirse en nueve llamadas por ronda: el vuelo
 * internacional es donde esta el dinero y donde el precio se mueve de verdad.
 */
export function tramosAVigilar(analisis, paradas = [], tope = UMBRALES.tramosVigilados) {
  return (analisis?.tramos || [])
    .map((t, i) => ({ t, i }))
    .filter(({ t, i }) => {
      const medio = t.medioRecomendado || t.medio;
      if (medio !== "vuelo") return false;
      const a = paradas[i]; const b = paradas[i + 1];
      return /^[A-Z]{3}$/.test(String(a?.iata || "")) && /^[A-Z]{3}$/.test(String(b?.iata || ""));
    })
    .sort((x, y) => (n(y.t.precioRecomendado ?? y.t.precio) || 0) - (n(x.t.precioRecomendado ?? x.t.precio) || 0))
    .slice(0, tope)
    .map(({ t, i }) => ({ id: t.id, indice: i, desde: paradas[i]?.iata, hasta: paradas[i + 1]?.iata }));
}
