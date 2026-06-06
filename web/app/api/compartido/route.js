// Compartir itinerario por enlace público. Guarda un snapshot del viaje en
// Vercel KV con un id corto y aleatorio (sin autenticación: el id ES la
// "llave"). Después lo lee /viaje/<id> en modo solo lectura.
//
// Llave en KV: compartido:<id>. TTL 90 días (configurable). Tope de payload
// 100 KB para evitar abuso.

const TTL_SEG = 60 * 60 * 24 * 90; // 90 días
const MAX_BYTES = 100 * 1024;

function envKv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

// Id corto y URL-safe (~12 chars, ~72 bits): suficiente para que no se
// adivine ni colisione.
function nuevoId() {
  const arr = new Uint8Array(9);
  crypto.getRandomValues(arr);
  return Buffer.from(arr).toString("base64url");
}

async function kvSetEx(key, value, ttl) {
  const e = envKv();
  if (!e) return false;
  const r = await fetch(`${e.url}/setex/${encodeURIComponent(key)}/${ttl}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${e.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  return r.ok;
}

export async function kvGet(key) {
  const e = envKv();
  if (!e) return null;
  const r = await fetch(`${e.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${e.token}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const d = await r.json();
  if (d?.result == null) return null;
  try {
    return typeof d.result === "string" ? JSON.parse(d.result) : d.result;
  } catch {
    return null;
  }
}

// POST /api/compartido { viaje } → devuelve { id, url }.
// Si no hay KV configurado, 503. El cliente puede entonces compartir
// por copia/pega manual sin nube (lo manejará en UI).
export async function POST(req) {
  if (!envKv()) return Response.json({ error: "kv no configurado" }, { status: 503 });

  let payload;
  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  if (!payload?.viaje?.ciudad) {
    return Response.json({ error: "falta viaje.ciudad" }, { status: 400 });
  }

  const bytes = Buffer.byteLength(JSON.stringify(payload.viaje));
  if (bytes > MAX_BYTES) {
    return Response.json({ error: "viaje demasiado grande" }, { status: 413 });
  }

  const id = nuevoId();
  const ok = await kvSetEx(`compartido:${id}`, payload.viaje, TTL_SEG);
  if (!ok) return Response.json({ error: "kv falló" }, { status: 500 });

  // Origen del request para devolver la URL completa.
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("host") || "app-vuelos-mfos.vercel.app";
  return Response.json({ id, url: `${proto}://${host}/viaje/${id}` });
}
