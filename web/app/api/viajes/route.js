// Mis viajes en la nube. Persiste los itinerarios del usuario logueado con
// Google en Vercel KV (Upstash Redis) usando solo fetch al endpoint REST
// (sin SDK adicional para mantener el bundle delgado).
//
// Env vars del almacenamiento. Hay DOS juegos de nombres segun como se haya
// conectado: KV_REST_API_URL/TOKEN si se creo un KV desde el panel de Vercel,
// UPSTASH_REDIS_REST_URL/TOKEN si se conecto la integracion de Upstash. Se
// aceptan los dos — es lo que lib/kv.js hace desde siempre.
// Si no existe ninguno, el endpoint devuelve 503 y el cliente cae a localStorage.
//
// Una sola clave por usuario: viajes:<email> guarda un array JSON con los
// últimos 20 viajes. Atómico: leer → modificar → escribir. Para 1 usuario
// con uso normal (1 viaje cada tanto) no hay race conditions reales.
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

const TOPE = 20;

function envKv() {
  // Los DOS juegos de nombres. Vercel inyecta KV_* al crear un KV desde su
  // panel; una integracion de Upstash directa inyecta UPSTASH_*. lib/kv.js
  // acepta ambos desde siempre, pero estos endpoints se leian las variables
  // a mano y solo miraban los KV_*: con la integracion de Upstash puesta,
  // el almacenamiento funcionaba para todo menos para ellos.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function kvGet(key) {
  const e = envKv();
  if (!e) return null;
  const r = await fetch(`${e.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${e.token}` },
    cache: "no-store",
  });
  if (!r.ok) return null;
  const d = await r.json();
  // Upstash devuelve {result: "<string>"} con el JSON ya stringificado.
  if (d?.result == null) return null;
  try {
    return typeof d.result === "string" ? JSON.parse(d.result) : d.result;
  } catch {
    return null;
  }
}

async function kvSet(key, value) {
  const e = envKv();
  if (!e) return false;
  const r = await fetch(`${e.url}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${e.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  return r.ok;
}

async function obtenerSesion() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return null;
    return session.user.email.toLowerCase();
  } catch {
    return null;
  }
}

function llave(email) {
  return `viajes:${email}`;
}

function listaSegura(x) {
  return Array.isArray(x) ? x : [];
}

export async function GET() {
  if (!envKv()) {
    return Response.json({ error: "kv no configurado" }, { status: 503 });
  }
  const email = await obtenerSesion();
  if (!email) return Response.json({ error: "no autenticado" }, { status: 401 });

  const viajes = listaSegura(await kvGet(llave(email)));
  return Response.json({ viajes });
}

export async function POST(req) {
  if (!envKv()) return Response.json({ error: "kv no configurado" }, { status: 503 });
  const email = await obtenerSesion();
  if (!email) return Response.json({ error: "no autenticado" }, { status: 401 });

  let viaje;
  try {
    viaje = await req.json();
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }

  const arr = listaSegura(await kvGet(llave(email)));
  const v = {
    ...viaje,
    id: viaje.id || `${Date.now()}`,
    guardadoEn: new Date().toISOString(),
  };
  // Reemplazar si ya existe el mismo viaje (misma ciudad + fechas).
  const i = arr.findIndex(
    (x) =>
      x.ciudad?.nombre === v.ciudad?.nombre &&
      x.fechaInicio === v.fechaInicio &&
      x.fechaFin === v.fechaFin
  );
  if (i >= 0) arr[i] = { ...v, id: arr[i].id };
  else arr.unshift(v);

  const nuevos = arr.slice(0, TOPE);
  const ok = await kvSet(llave(email), nuevos);
  if (!ok) return Response.json({ error: "kv set falló" }, { status: 500 });
  return Response.json({ viajes: nuevos });
}

export async function DELETE(req) {
  if (!envKv()) return Response.json({ error: "kv no configurado" }, { status: 503 });
  const email = await obtenerSesion();
  if (!email) return Response.json({ error: "no autenticado" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "id requerido" }, { status: 400 });

  const arr = listaSegura(await kvGet(llave(email)));
  const nuevos = arr.filter((v) => v.id !== id);
  const ok = await kvSet(llave(email), nuevos);
  if (!ok) return Response.json({ error: "kv set falló" }, { status: 500 });
  return Response.json({ viajes: nuevos });
}
