// Favoritos de destinos. Cada usuario logueado puede marcar/desmarcar
// destinos del catálogo (los slugs). Persiste en Vercel KV.
//
// Llave: favoritos:<email>. Valor: array de slugs.
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/route";

function envKv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
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

async function obtenerEmail() {
  try {
    const s = await getServerSession(authOptions);
    return s?.user?.email?.toLowerCase() || null;
  } catch {
    return null;
  }
}

function listaSegura(x) {
  return Array.isArray(x) ? x : [];
}

export async function GET() {
  if (!envKv()) return Response.json({ error: "kv no configurado" }, { status: 503 });
  const email = await obtenerEmail();
  if (!email) return Response.json({ error: "no autenticado" }, { status: 401 });
  const slugs = listaSegura(await kvGet(`favoritos:${email}`));
  return Response.json({ slugs });
}

// POST { slug, fav: true|false } → toggle por slug.
export async function POST(req) {
  if (!envKv()) return Response.json({ error: "kv no configurado" }, { status: 503 });
  const email = await obtenerEmail();
  if (!email) return Response.json({ error: "no autenticado" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "json inválido" }, { status: 400 });
  }
  const slug = String(body?.slug || "");
  const fav = !!body?.fav;
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
    return Response.json({ error: "slug inválido" }, { status: 400 });
  }

  const actuales = listaSegura(await kvGet(`favoritos:${email}`));
  const set = new Set(actuales);
  if (fav) set.add(slug);
  else set.delete(slug);
  const nuevos = Array.from(set).slice(0, 200); // tope sensato

  const ok = await kvSet(`favoritos:${email}`, nuevos);
  if (!ok) return Response.json({ error: "kv falló" }, { status: 500 });
  return Response.json({ slugs: nuevos });
}
