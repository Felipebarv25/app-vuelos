// Helpers de autenticacion con codigo por email + sesion en Vercel KV.
//
// Como funciona:
//  - El usuario tipea su email -> /api/auth/codigo/enviar genera un codigo
//    de 6 digitos y lo guarda en KV (clave: auth:codigo:<email>) con TTL 10min.
//  - Resend envia el codigo al email del usuario.
//  - El usuario tipea el codigo -> /api/auth/codigo/verificar valida, crea
//    una sesion con un token aleatorio y guarda el usuario en KV
//    (clave: auth:sesion:<token>) con TTL 30 dias.
//  - El cliente guarda el token en localStorage y lo envia en el header
//    Authorization en peticiones que necesiten saber quien es.
//
// Si no hay KV configurado (kvActivo == false), todo cae silenciosamente y la
// app sigue funcionando con el login ligero (nombre en localStorage).

import { kv, kvActivo } from "./kv";

const TTL_CODIGO = 60 * 10; // 10 min
const TTL_SESION = 60 * 60 * 24 * 30; // 30 dias
const TTL_INTENTOS_CODIGO = 60 * 15; // 15 min

function randomUint32() {
  const bytes = new Uint8Array(4);
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("CSPRNG no disponible");
  }
  crypto.getRandomValues(bytes);
  return ((bytes[0] * 0x1000000) + (bytes[1] * 0x10000) + (bytes[2] * 0x100) + bytes[3]) >>> 0;
}

// Codigo de 6 digitos como string para no perder ceros a la izquierda.
// Usa rechazo para evitar el sesgo del modulo al mapear 2^32 estados a 900000.
export function generarCodigo() {
  const rango = 900000;
  const limite = Math.floor(0x100000000 / rango) * rango;
  let n;
  do { n = randomUint32(); } while (n >= limite);
  return String(100000 + (n % rango));
}

// Token de sesion: 32 chars hex (16 bytes) generados con CSPRNG.
export function generarToken() {
  const bytes = new Uint8Array(16);
  if (typeof crypto === "undefined" || !crypto.getRandomValues) {
    throw new Error("CSPRNG no disponible");
  }
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Normaliza un email (trim + lowercase) para evitar duplicados por casing.
export function normalizarEmail(e) {
  return String(e || "").trim().toLowerCase();
}

// Valida el formato basico de un email antes de hacer la llamada de envio.
export function emailValido(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(e));
}

// Guarda el codigo asociado a un email con TTL.
export async function guardarCodigo(email, codigo) {
  if (!kvActivo()) return false;
  const k = `auth:codigo:${normalizarEmail(email)}`;
  const r = await kv(["SET", k, codigo, "EX", String(TTL_CODIGO)]);
  return r !== null;
}

// Valida un codigo: si coincide, lo borra (un solo uso) y devuelve true.
export async function consumirCodigo(email, codigo) {
  if (!kvActivo()) return false;
  const k = `auth:codigo:${normalizarEmail(email)}`;
  const guardado = await kv(["GET", k]);
  if (!guardado || String(guardado) !== String(codigo)) return false;
  await kv(["DEL", k]);
  return true;
}

// Limita intentos de verificacion para que un codigo de 6 digitos no pueda
// probarse indefinidamente. El contador es independiente del envio de codigo.
export async function registrarIntentoCodigo(email, max = 8) {
  if (!kvActivo()) return true;
  const k = `auth:codigo:intentos:${normalizarEmail(email)}`;
  const n = await kv(["INCR", k]);
  if (n === 1) await kv(["EXPIRE", k, String(TTL_INTENTOS_CODIGO)]);
  return Number(n) <= max;
}

export async function limpiarIntentosCodigo(email) {
  if (!kvActivo()) return;
  await kv(["DEL", `auth:codigo:intentos:${normalizarEmail(email)}`]);
}

// Crea una sesion para un usuario. usuario = { email, nombre } u objeto
// equivalente. Devuelve el token (lo que el cliente guarda en localStorage).
export async function crearSesion(usuario) {
  if (!kvActivo()) return null;
  const token = generarToken();
  const k = `auth:sesion:${token}`;
  const payload = JSON.stringify({ ...usuario, creado: Date.now() });
  const r = await kv(["SET", k, payload, "EX", String(TTL_SESION)]);
  return r !== null ? token : null;
}

// Lee la sesion de un token. Devuelve el usuario o null si no existe / expiro.
export async function leerSesion(token) {
  if (!kvActivo() || !token) return null;
  const k = `auth:sesion:${String(token).slice(0, 64)}`;
  const raw = await kv(["GET", k]);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Borra la sesion (logout).
export async function borrarSesion(token) {
  if (!kvActivo() || !token) return;
  const k = `auth:sesion:${String(token).slice(0, 64)}`;
  await kv(["DEL", k]);
}

// Rate limit basico por email: maximo 5 codigos en 15 minutos para evitar
// spam y proteger la cuota de Resend. Usa un INCR con EX en KV.
export async function rateLimit(email, max = 5, ventanaSeg = 60 * 15) {
  if (!kvActivo()) return true; // sin KV, no podemos limitar (mejor que bloquear)
  const k = `auth:rl:${normalizarEmail(email)}`;
  const n = await kv(["INCR", k]);
  if (n === 1) await kv(["EXPIRE", k, String(ventanaSeg)]);
  return Number(n) <= max;
}