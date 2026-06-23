// Endpoint para recibir feedback de usuarios. Guarda en Vercel KV una lista
// con LPUSH (más recientes primero) y trim a 200 para no crecer sin control.
// El panel admin (/api/panel + /panel) lo lista.
export const runtime = "nodejs";

import { pipeline, kvActivo } from "@/lib/kv";

const MAX_LEN = 1500; // por campo, suficiente para un comentario detallado
const HISTORIAL_MAX = 200;

function recortar(s) {
  if (typeof s !== "string") return "";
  // Quita HTML básico (sin dependencias) y recorta longitud.
  return s.replace(/<[^>]*>/g, "").trim().slice(0, MAX_LEN);
}

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const like = recortar(body?.like);
  const dislike = recortar(body?.dislike);
  const mejora = recortar(body?.mejora);

  // Al menos uno de los tres tiene que estar lleno.
  if (!like && !dislike && !mejora) {
    return Response.json({ error: "vacio" }, { status: 400 });
  }

  if (!kvActivo()) {
    // Sin KV no podemos persistir. Devolvemos OK pero advertimos al usuario.
    return Response.json({ ok: true, persistido: false });
  }

  const entrada = {
    ts: Date.now(),
    like,
    dislike,
    mejora,
    email: typeof body?.email === "string" ? body.email.trim().slice(0, 200) : "",
    nombre: typeof body?.nombre === "string" ? body.nombre.trim().slice(0, 80) : "",
    url: typeof body?.url === "string" ? body.url.slice(0, 300) : "",
    lang: typeof body?.lang === "string" ? body.lang.slice(0, 4) : "",
    ua: (req.headers.get("user-agent") || "").slice(0, 200),
    ip: (req.headers.get("x-forwarded-for") || "").split(",")[0].trim().slice(0, 64),
    pais: req.headers.get("x-vercel-ip-country") || "",
  };

  await pipeline([
    ["LPUSH", "feedback:lista", JSON.stringify(entrada)],
    ["LTRIM", "feedback:lista", "0", String(HISTORIAL_MAX - 1)],
    ["INCR", "m:feedback:total"],
  ]);

  return Response.json({ ok: true });
}
