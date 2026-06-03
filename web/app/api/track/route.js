// Registra eventos de uso para el panel privado de métricas. Anónimo y agregado
// (solo contadores). Usa la geolocalización aproximada que añade Vercel a cada
// petición (país/ciudad por IP). Si no hay KV configurado, no hace nada.
export const runtime = "nodejs";

import { pipeline, kvActivo } from "@/lib/kv";

const hoy = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// Rango de presupuesto (en USD) para agrupar.
function rangoPresupuesto(usd) {
  const n = Number(usd) || 0;
  if (n <= 0) return null;
  if (n < 1000) return "< US$1.000";
  if (n < 2500) return "US$1.000–2.500";
  if (n < 5000) return "US$2.500–5.000";
  if (n < 10000) return "US$5.000–10.000";
  return "US$10.000+";
}

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false });
  let b = {};
  try {
    b = await req.json();
  } catch {}

  const h = req.headers;
  const pais = h.get("x-vercel-ip-country") || null; // código ISO (CO, US…)
  let ciudad = h.get("x-vercel-ip-city") || null;
  try {
    ciudad = ciudad ? decodeURIComponent(ciudad) : null;
  } catch {}

  const d = hoy();
  const cmds = [];

  if (b.tipo === "visita") {
    cmds.push(["INCR", `m:vis:${d}`]);
    cmds.push(["INCR", "m:vis:total"]);
    if (pais) cmds.push(["ZINCRBY", "m:geo:pais", "1", pais]);
    if (ciudad) cmds.push(["ZINCRBY", "m:geo:ciudad", "1", pais ? `${ciudad} (${pais})` : ciudad]);
    // Idioma del visitante (es/en/pt/fr).
    if (b.lang) cmds.push(["ZINCRBY", "m:lang", "1", String(b.lang)]);
    // Dispositivo (por user-agent).
    const ua = h.get("user-agent") || "";
    const movil = /Mobi|Android|iPhone|iPad|iPod|Windows Phone/i.test(ua);
    cmds.push(["ZINCRBY", "m:disp", "1", movil ? "Móvil" : "Escritorio"]);
    // Hora local del visitante (0–23) para ver el pico de actividad.
    const hora = Number.isInteger(b.hora) && b.hora >= 0 && b.hora <= 23 ? b.hora : null;
    if (hora != null) cmds.push(["INCR", `m:hora:${hora}`]);
  } else if (b.tipo === "busqueda" && b.ciudad) {
    cmds.push(["INCR", "m:busq:total"]);
    cmds.push(["INCR", `m:busq:${d}`]);
    cmds.push(["ZINCRBY", "m:busc:ciudad", "1", b.pais ? `${b.ciudad}, ${b.pais}` : b.ciudad]);
    if (b.pais) cmds.push(["ZINCRBY", "m:busc:pais", "1", b.pais]);
  } else if (b.tipo === "busqueda_fallida" && b.q) {
    cmds.push(["INCR", "m:busqfail:total"]);
    cmds.push(["ZINCRBY", "m:busc:fallida", "1", String(b.q).slice(0, 60)]);
  } else if (b.tipo === "afiliado_clic") {
    cmds.push(["INCR", "m:afil:total"]);
    cmds.push(["INCR", `m:afil:${d}`]);
    if (b.cat) cmds.push(["ZINCRBY", "m:afil:tipo", "1", String(b.cat)]);
  } else if (b.tipo === "presupuesto") {
    cmds.push(["INCR", "m:pres:total"]);
    const r = rangoPresupuesto(b.usd);
    if (r) cmds.push(["ZINCRBY", "m:pres:rango", "1", r]);
    if (b.region) cmds.push(["ZINCRBY", "m:pres:region", "1", b.region]);
  } else {
    return Response.json({ ok: false });
  }

  // Mantener una lista de los días con datos (para el panel).
  if (b.tipo === "visita") cmds.push(["SADD", "m:dias", d]);

  await pipeline(cmds);
  return Response.json({ ok: true });
}
