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
    activa: true,
    lang,
    // origen: IATA del hub desde el que el usuario quiere salir ("" = desde
    // cualquiera). Antes las alertas no tenian origen y el usuario de
    // Medellin recibia gangas saliendo de Bogota (feedback 2026-07-11).
    origen: String(origen || "").toUpperCase().slice(0, 3),
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

// Marca una alerta como disparada y guarda la fecha. Tambien la desactiva
// hasta que el usuario la reactive (evita spam — si baja a US$650, mandamos
// 1 email; si sigue bajando a US$640 no spameamos otro).
export async function marcarDisparada(id) {
  const a = await leerAlerta(id);
  if (!a) return false;
  a.ultimaDispara = Date.now();
  a.activa = false;
  await kv(["SET", `alerta:${id}`, JSON.stringify(a), "EX", String(TTL_ALERTA)]);
  return true;
}

export async function reactivarAlerta(id) {
  const a = await leerAlerta(id);
  if (!a) return false;
  a.activa = true;
  await kv(["SET", `alerta:${id}`, JSON.stringify(a), "EX", String(TTL_ALERTA)]);
  return true;
}
