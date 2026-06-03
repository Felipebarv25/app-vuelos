// Devuelve las métricas agregadas para el panel privado. Protegido por
// contraseña (variable de entorno PANEL_CLAVE).
export const runtime = "nodejs";

import { pipeline, kvActivo } from "@/lib/kv";

// Últimos n días en formato YYYY-MM-DD (incluye hoy), del más antiguo al más nuevo.
function ultimosDias(n) {
  const out = [];
  const base = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(base.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

// Convierte el resultado plano de ZREVRANGE WITHSCORES [m,score,m,score] a
// [{nombre, valor}].
function pares(arr) {
  const out = [];
  if (!Array.isArray(arr)) return out;
  for (let i = 0; i < arr.length; i += 2) {
    out.push({ nombre: arr[i], valor: Number(arr[i + 1]) || 0 });
  }
  return out;
}

export async function GET(req) {
  const clave = new URL(req.url).searchParams.get("clave") || "";
  if (!process.env.PANEL_CLAVE) {
    return Response.json({ error: "Falta configurar PANEL_CLAVE en Vercel." }, { status: 503 });
  }
  if (clave !== process.env.PANEL_CLAVE) {
    return Response.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  if (!kvActivo()) {
    return Response.json({ error: "Falta conectar el almacenamiento (Vercel KV)." }, { status: 503 });
  }

  const dias = ultimosDias(30);
  const res = await pipeline([
    ["MGET", ...dias.map((d) => `m:vis:${d}`)],
    ["GET", "m:vis:total"],
    ["ZREVRANGE", "m:geo:pais", "0", "9", "WITHSCORES"],
    ["ZREVRANGE", "m:geo:ciudad", "0", "9", "WITHSCORES"],
    ["ZREVRANGE", "m:busc:ciudad", "0", "14", "WITHSCORES"],
    ["ZREVRANGE", "m:busc:pais", "0", "9", "WITHSCORES"],
    ["GET", "m:busq:total"],
    ["ZREVRANGE", "m:pres:rango", "0", "9", "WITHSCORES"],
    ["ZREVRANGE", "m:pres:region", "0", "9", "WITHSCORES"],
    ["GET", "m:pres:total"],
  ]);

  const visArr = (res[0] || []).map((x) => Number(x) || 0);
  const serie = dias.map((d, i) => ({ dia: d, visitas: visArr[i] || 0 }));

  return Response.json({
    serie,
    visitasTotal: Number(res[1]) || 0,
    geoPais: pares(res[2]),
    geoCiudad: pares(res[3]),
    buscCiudad: pares(res[4]),
    buscPais: pares(res[5]),
    busquedasTotal: Number(res[6]) || 0,
    presRango: pares(res[7]),
    presRegion: pares(res[8]),
    presTotal: Number(res[9]) || 0,
  });
}
