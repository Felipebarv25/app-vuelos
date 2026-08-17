// Alertas de precio — el usuario fija "avisame si Madrid baja de US$700".
// Cuando el detector (Python cron 3h) encuentra un precio que cumple, llama
// /api/alertas/disparar y nosotros mandamos email via Resend.
//
// Modelo KV:
//   alerta:<id>                -> { id, email, ciudad, pais, iata, umbral, creada, ultimaDispara, activa, lang }
//   alertas:user:<email>       -> SET de IDs (para listar las alertas del usuario)
//   alertas:iata:<IATA>        -> SET de IDs (para que el disparador busque rapido por destino)
//
// El gate Free/Pro vive en /api/alertas/crear: si el usuario no es Pro y ya
// tiene 1 alerta activa, devuelve 402 (paywall).

import { kv, kvActivo, pipeline } from "./kv";

const TTL_ALERTA = 60 * 60 * 24 * 180; // 6 meses por defecto

// --- Re-armado por nuevo minimo (2026-08-17) ---------------------------------
// Antes, enviar un email apagaba la alerta para siempre (activa:false) y solo
// el usuario podia reactivarla a mano. Resultado: UN correo por alerta en toda
// su vida, y el usuario esperando un segundo aviso que nunca iba a llegar.
//
// Ahora la alerta queda SIEMPRE armada y vuelve a avisar cuando el precio hace
// un NUEVO MINIMO frente al ultimo que ya te avisamos. Eso responde a "avisame
// cada vez que identifique precios mas bajos" sin volverse un correo diario:
// para escribir de nuevo el precio tiene que romper su propio record, no basta
// con que siga bajo el umbral.
//
// `activa:false` recupera su significado literal: el usuario la pauso.

// El nuevo precio debe ser al menos 5% mejor que el ya avisado. Sin este
// margen, US$519 tras un aviso de US$520 disparaba otro correo.
const MEJORA_MINIMA = 0.95;

// Piso duro entre correos de una misma alerta. Una corrida del detector dura
// ~20-40 min y toca la misma ciudad desde varios origenes y meses; sin esto una
// sola corrida podia mandar varios correos en cascada.
const ESPERA_ENTRE_AVISOS_MS = 2 * 60 * 60 * 1000; // 2 horas

// El record caduca al mes. Si no, un minimo historico muy bueno silencia la
// alerta para siempre: bajo a US$400 una vez, y a los seis meses US$430 —
// buenisimo frente al mercado de hoy — ya no avisaria nunca.
const RECORD_CADUCA_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Decide si una alerta debe volver a mandar correo por este precio.
 * NO valida el umbral del usuario ni el filtro anti-spam de ganga: eso lo hace
 * /api/alertas/disparar antes de llamar aqui.
 *
 * @returns {{avisar: boolean, motivo: string}} motivo sirve para el log del
 *   detector: primer-aviso | nuevo-minimo | record-caducado | sin-mejora | espera
 */
export function debeAvisar(alerta, precio, ahora = Date.now()) {
  const previo = Number(alerta?.ultimoPrecioAvisado);
  const cuando = Number(alerta?.ultimaDispara);

  // Nunca ha avisado (o es una alerta vieja sin el campo): avisa.
  if (!Number.isFinite(previo) || previo <= 0 || !Number.isFinite(cuando)) {
    return { avisar: true, motivo: "primer-aviso" };
  }

  const transcurrido = ahora - cuando;
  if (transcurrido < ESPERA_ENTRE_AVISOS_MS) {
    return { avisar: false, motivo: "espera" };
  }
  if (transcurrido > RECORD_CADUCA_MS) {
    return { avisar: true, motivo: "record-caducado" };
  }
  if (precio <= previo * MEJORA_MINIMA) {
    return { avisar: true, motivo: "nuevo-minimo" };
  }
  return { avisar: false, motivo: "sin-mejora" };
}

// Normaliza la lista de hubs de origen a "BOG,MDE".
//
// BUG que esto arregla (2026-08-17): antes era `.toUpperCase().slice(0, 3)`, que
// recortaba "BOG,MDE" a "BOG" y tiraba el resto. El disparador SI hace
// `a.origen.split(",")` esperando varios, y /api/alertas/crear tambien valida y
// une varios — pero la truncada de aqui pasaba despues, asi que toda alerta
// multi-hub quedaba silenciosamente reducida al primer hub del arreglo. Un
// usuario que marcaba Bogota + Medellin solo recibia gangas de uno de los dos.
// Tope de 5 hubs para no dejar crecer la clave sin limite.
function normalizarOrigenes(origen) {
  return String(origen || "")
    .toUpperCase()
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^[A-Z]{3}$/.test(c))
    .filter((c, i, arr) => arr.indexOf(c) === i)
    .slice(0, 5)
    .join(",");
}

export function generarIdAlerta() {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function crearAlerta({ email, ciudad, pais, iata, umbral, lang = "es", origen = "", escalasMax = 0, moneda = "" }) {
  if (!kvActivo()) return null;
  const id = generarIdAlerta();
  const alerta = {
    id,
    email: String(email).toLowerCase(),
    ciudad,
    pais,
    iata: String(iata).toUpperCase(),
    umbral: Number(umbral),
    creada: Date.now(),
    ultimaDispara: null,
    // Precio del ultimo correo enviado. Es el "record" que hay que romper para
    // que la alerta vuelva a escribir (ver debeAvisar).
    ultimoPrecioAvisado: null,
    vecesAvisada: 0,
    // activa:false = el USUARIO la pauso. Ya no lo pone marcarDisparada().
    activa: true,
    pausadaPorUsuario: false,
    lang,
    // origen: uno o VARIOS hubs IATA separados por coma ("BOG,MDE"). "" =
    // cualquiera. Antes las alertas no tenian origen y el usuario de Medellin
    // recibia gangas saliendo de Bogota (feedback 2026-07-11).
    origen: normalizarOrigenes(origen),
    // escalasMax: 0 = solo vuelos directos (default), 1 = hasta 1 escala,
    // 99 = cualquier cantidad. El usuario acepta explicitamente las escalas.
    escalasMax: Number.isFinite(Number(escalasMax)) ? Number(escalasMax) : 0,
    // moneda del usuario al crear la alerta, para que el email muestre el
    // precio tambien en su moneda local ademas de USD.
    moneda: String(moneda || "").toUpperCase().slice(0, 3),
  };
  const k = `alerta:${id}`;
  const kUser = `alertas:user:${alerta.email}`;
  const kIata = `alertas:iata:${alerta.iata}`;
  await pipeline([
    ["SET", k, JSON.stringify(alerta), "EX", String(TTL_ALERTA)],
    ["SADD", kUser, id],
    ["SADD", kIata, id],
    ["EXPIRE", kUser, String(TTL_ALERTA)],
    ["EXPIRE", kIata, String(TTL_ALERTA)],
  ]);
  return alerta;
}

export async function leerAlerta(id) {
  if (!kvActivo() || !id) return null;
  const raw = await kv(["GET", `alerta:${id}`]);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function listarAlertasUsuario(email) {
  if (!kvActivo() || !email) return [];
  const ids = (await kv(["SMEMBERS", `alertas:user:${String(email).toLowerCase()}`])) || [];
  if (!ids.length) return [];
  const out = [];
  for (const id of ids) {
    const a = await leerAlerta(id);
    if (a) out.push(a);
  }
  return out.sort((a, b) => b.creada - a.creada);
}

export async function contarAlertasUsuario(email) {
  if (!kvActivo() || !email) return 0;
  const n = await kv(["SCARD", `alertas:user:${String(email).toLowerCase()}`]);
  return Number(n) || 0;
}

export async function borrarAlerta(id) {
  if (!kvActivo() || !id) return false;
  const a = await leerAlerta(id);
  if (!a) return false;
  await pipeline([
    ["DEL", `alerta:${id}`],
    ["SREM", `alertas:user:${a.email}`, id],
    ["SREM", `alertas:iata:${a.iata}`, id],
  ]);
  return true;
}

// Listar IDs de alertas asociadas a un destino (para que el disparador
// recorra solo las alertas relevantes, no todas).
export async function idsAlertasPorIATA(iata) {
  if (!kvActivo() || !iata) return [];
  return (await kv(["SMEMBERS", `alertas:iata:${String(iata).toUpperCase()}`])) || [];
}

// Registra que se envio un correo y guarda el precio avisado como nuevo record.
// La alerta QUEDA ARMADA: antes esto ponia activa:false y la mataba hasta que el
// usuario la reactivara a mano, asi que cada alerta mandaba un unico correo en
// toda su vida. El control anti-spam ahora vive en debeAvisar(): hay que romper
// el record por al menos 5% para volver a escribir.
export async function marcarDisparada(id, precio) {
  const a = await leerAlerta(id);
  if (!a) return false;
  a.ultimaDispara = Date.now();
  const p = Number(precio);
  if (Number.isFinite(p) && p > 0) a.ultimoPrecioAvisado = Math.round(p);
  a.vecesAvisada = (Number(a.vecesAvisada) || 0) + 1;
  a.activa = true;
  await kv(["SET", `alerta:${id}`, JSON.stringify(a), "EX", String(TTL_ALERTA)]);
  return true;
}

// Vuelve a armar una alerta y olvida el record, para que el proximo precio que
// cumpla el umbral avise sin tener que romper un minimo viejo.
export async function reactivarAlerta(id) {
  const a = await leerAlerta(id);
  if (!a) return false;
  a.activa = true;
  a.pausadaPorUsuario = false;
  a.ultimoPrecioAvisado = null;
  await kv(["SET", `alerta:${id}`, JSON.stringify(a), "EX", String(TTL_ALERTA)]);
  return true;
}

export async function actualizarAlerta(id, campos) {
  if (!kvActivo() || !id) return null;
  const a = await leerAlerta(id);
  if (!a) return null;
  if (campos.umbral !== undefined) {
    const u = Number(campos.umbral);
    if (!Number.isFinite(u) || u <= 0) return null;
    a.umbral = Math.round(u);
  }
  if (campos.origen !== undefined) a.origen = normalizarOrigenes(campos.origen);
  if (campos.escalasMax !== undefined)
    a.escalasMax = Number.isFinite(Number(campos.escalasMax)) ? Number(campos.escalasMax) : 0;
  if (campos.activa !== undefined) {
    a.activa = !!campos.activa;
    // Marca explicita de intencion del usuario. Sirve para distinguir "yo la
    // pause" de "la apago el codigo viejo al enviar el correo", que es lo que
    // permite re-armar las alertas heredadas sin resucitar las que el usuario
    // silencio a proposito.
    a.pausadaPorUsuario = !campos.activa;
    // Al reactivar, olvidamos el record: si no, seguiria callada esperando
    // romper un minimo viejo.
    if (campos.activa) a.ultimoPrecioAvisado = null;
  }
  await kv(["SET", `alerta:${id}`, JSON.stringify(a), "EX", String(TTL_ALERTA)]);
  return a;
}
