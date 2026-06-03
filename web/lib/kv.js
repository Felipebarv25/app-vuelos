// Acceso mínimo a Vercel KV / Upstash Redis vía su API REST (sin librerías).
// Si no hay credenciales, todo queda inactivo y la app sigue igual.
// Variables (las inyecta Vercel al crear el KV): KV_REST_API_URL, KV_REST_API_TOKEN.

const URL_KV = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export function kvActivo() {
  return !!(URL_KV && TOKEN);
}

// Ejecuta UN comando Redis: kv(["INCR","clave"]). Devuelve el resultado o null.
export async function kv(cmd) {
  if (!kvActivo()) return null;
  try {
    const r = await fetch(URL_KV, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmd),
    });
    if (!r.ok) return null;
    return (await r.json()).result;
  } catch {
    return null;
  }
}

// Ejecuta VARIOS comandos de una (pipeline). Devuelve un array de resultados.
export async function pipeline(cmds) {
  if (!kvActivo() || !cmds.length) return [];
  try {
    const r = await fetch(`${URL_KV}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
    });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d) ? d.map((x) => x.result) : [];
  } catch {
    return [];
  }
}
