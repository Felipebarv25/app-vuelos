// Entitlements: que puede hacer cada usuario en la app.
//
// Modelo:
//  - "Pro" es un flag por usuario (identificado por email) almacenado en KV.
//  - Las claves se llaman `pro:<email>` y contienen { plan, until, productId }.
//  - Si until existe (suscripcion mensual/anual), expira automaticamente.
//  - Si until es null (lifetime u order one-time), no expira hasta que se borre.
//
// Como se llena: el webhook /api/lemonsqueezy/webhook recibe eventos de Lemon
// Squeezy (subscription_created, order_created, etc.) y escribe la clave.
//
// Como se lee: /api/me llama isPro(email) y devuelve {pro, plan} al frontend.

import { kv, kvActivo } from "./kv";

// Emails que tienen Pro automatico SIN pasar por checkout. Util para:
//   - Owner / admin (felipebarv@gmail.com).
//   - Cuentas demo que ensenan toda la app sin restricciones (demo@viajero360.app).
//   - Beta testers / influencers que reciben acceso de cortesia.
// Se configura via env var PRO_EMAILS (coma-separated). Si la env var no esta,
// la lista esta vacia y todos los usuarios se rigen por KV (pago real).
function emailsConProAutomatico() {
  const raw = process.env.PRO_EMAILS || "";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// Lee el registro Pro del usuario. Si no existe o expiro, devuelve null.
export async function leerPro(email) {
  if (!email) return null;
  // Override: si el email esta en la lista PRO_EMAILS, devolvemos un registro
  // sintetico "lifetime cortesia". Tiene precedencia sobre KV — no se puede
  // "rebajar" un email de la lista cancelandolo via webhook.
  const lower = String(email).toLowerCase();
  if (emailsConProAutomatico().includes(lower)) {
    return { plan: "lifetime", until: null, productId: "cortesia", activado: 0, cortesia: true };
  }
  if (!kvActivo()) return null;
  const k = `pro:${lower}`;
  try {
    const raw = await kv(["GET", k]);
    if (!raw) return null;
    const data = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (data?.until) {
      const expira = new Date(data.until).getTime();
      if (Number.isFinite(expira) && expira < Date.now()) {
        await kv(["DEL", k]);
        return null;
      }
    }
    return data;
  } catch {
    return null;
  }
}

// Helper: el usuario tiene Pro vigente?
export async function isPro(email) {
  const r = await leerPro(email);
  return !!r;
}

// Activa Pro con expiracion (suscripciones). plan: "mensual" | "anual".
export async function activarSuscripcion(email, plan, untilIso, productId) {
  if (!kvActivo() || !email) return false;
  const k = `pro:${String(email).toLowerCase()}`;
  const valor = JSON.stringify({ plan, until: untilIso, productId, activado: Date.now() });
  // EXAT en segundos. Si no podemos calcular, dejamos sin TTL y confiamos en
  // la verificacion en leerPro (que tambien chequea until manualmente).
  const tsExpira = Math.floor(new Date(untilIso).getTime() / 1000);
  if (Number.isFinite(tsExpira) && tsExpira > Math.floor(Date.now() / 1000)) {
    await kv(["SET", k, valor, "EXAT", String(tsExpira)]);
  } else {
    await kv(["SET", k, valor]);
  }
  return true;
}

// Activa Pro Lifetime (sin expiracion).
export async function activarLifetime(email, productId) {
  if (!kvActivo() || !email) return false;
  const k = `pro:${String(email).toLowerCase()}`;
  const valor = JSON.stringify({ plan: "lifetime", until: null, productId, activado: Date.now() });
  await kv(["SET", k, valor]);
  return true;
}

// Cancela Pro (lo borra). El usuario pierde acceso a las features gateadas.
export async function cancelarPro(email) {
  if (!kvActivo() || !email) return;
  const k = `pro:${String(email).toLowerCase()}`;
  await kv(["DEL", k]);
}

// Microcompras (one-time purchases que no son Lifetime): por ejemplo "PDF $1.99"
// o "Alerta suelta $0.99". Cada compra registra un credito que el usuario
// consume al usar la feature. Claves: credito:<feature>:<email> -> N.
export async function sumarCredito(email, feature, n = 1) {
  if (!kvActivo() || !email || !feature) return false;
  const k = `credito:${feature}:${String(email).toLowerCase()}`;
  await kv(["INCRBY", k, String(n)]);
  return true;
}

export async function consumirCredito(email, feature) {
  if (!kvActivo() || !email || !feature) return false;
  const k = `credito:${feature}:${String(email).toLowerCase()}`;
  try {
    const v = await kv(["GET", k]);
    const n = Number(v) || 0;
    if (n <= 0) return false;
    await kv(["DECR", k]);
    return true;
  } catch {
    return false;
  }
}

export async function leerCreditos(email, feature) {
  if (!kvActivo() || !email || !feature) return 0;
  const k = `credito:${feature}:${String(email).toLowerCase()}`;
  const v = await kv(["GET", k]);
  return Number(v) || 0;
}
