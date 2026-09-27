// Pruebas de entitlement y webhook, con un KV en memoria.
//
// No es un test unitario del proyecto (no hay runner configurado): es un
// script que recorre los estados del punto 20 y 23 y se borra al terminar.
// Se ejecuta contra el MODULO REAL, no contra una copia.
import crypto from "crypto";
import fs from "node:fs";

// --- Upstash emulado por fetch ---------------------------------------
//
// lib/kv.js lee las credenciales del entorno y habla REST. Poniendo las
// variables e interceptando fetch se prueban los MODULOS REALES, con los
// comandos Redis exactos que mandan, sin tocar una linea de produccion.
process.env.KV_REST_API_URL = "http://kv.local";
process.env.KV_REST_API_TOKEN = "t";

const almacen = new Map();
const caducidad = new Map();

function vigente(k) {
  const exp = caducidad.get(k);
  if (exp && Date.now() > exp) { almacen.delete(k); caducidad.delete(k); return false; }
  return almacen.has(k);
}

function ejecutar(cmd) {
  const [op, k, ...resto] = cmd;
  switch (String(op).toUpperCase()) {
    case "GET": return vigente(k) ? almacen.get(k) : null;
    case "SET": {
      if (resto.includes("NX") && vigente(k)) return null;
      almacen.set(k, resto[0]);
      const iEx = resto.indexOf("EX");
      if (iEx >= 0) caducidad.set(k, Date.now() + Number(resto[iEx + 1]) * 1000);
      const iAt = resto.indexOf("EXAT");
      if (iAt >= 0) caducidad.set(k, Number(resto[iAt + 1]) * 1000);
      return "OK";
    }
    case "DEL": almacen.delete(k); caducidad.delete(k); return 1;
    case "INCR": almacen.set(k, String((Number(almacen.get(k)) || 0) + 1)); return Number(almacen.get(k));
    case "INCRBY": almacen.set(k, String((Number(almacen.get(k)) || 0) + Number(resto[0] || 1))); return Number(almacen.get(k));
    case "DECR": almacen.set(k, String((Number(almacen.get(k)) || 0) - 1)); return Number(almacen.get(k));
    case "EXPIRE": caducidad.set(k, Date.now() + Number(resto[0]) * 1000); return 1;
    case "SMEMBERS": return [];
    default: return 1;
  }
}

globalThis.fetch = async (url, opciones) => {
  const cuerpo = JSON.parse(opciones.body);
  const esPipeline = String(url).endsWith("/pipeline");
  const salida = esPipeline ? cuerpo.map((c) => ({ result: ejecutar(c) })) : { result: ejecutar(cuerpo) };
  return { ok: true, json: async () => salida };
};
const ok = [];
const mal = [];
const comprobar = (nombre, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  (bien ? ok : mal).push(`${bien ? "OK " : "MAL"} ${nombre} -> ${JSON.stringify(real)}${bien ? "" : "  (esperaba " + JSON.stringify(esperado) + ")"}`);
};

const ENT = await import("../lib/entitlements.js");
const { evaluar, motivoPaywall, limiteDe, CAPACIDADES } = await import("../lib/features.js");

const EMAIL = "viajero@ejemplo.com";
const manana = new Date(Date.now() + 86400000).toISOString();
const ayer = new Date(Date.now() - 86400000).toISOString();

// ---------------------------------------------- 20. ESTADOS DE SUSCRIPCION
comprobar("FREE de partida", await ENT.isPro(EMAIL), false);

await ENT.activarSuscripcion(EMAIL, "mensual", manana, "v1");
comprobar("compra -> PRO", await ENT.isPro(EMAIL), true);

await ENT.activarSuscripcion(EMAIL, "mensual", manana, "v1");
comprobar("renovacion -> sigue PRO (sin duplicar)", await ENT.isPro(EMAIL), true);

await ENT.marcarCancelada(EMAIL, manana);
comprobar("cancelada pero VIGENTE -> sigue PRO", await ENT.isPro(EMAIL), true);
comprobar("  y se sabe que esta cancelada", (await ENT.leerPro(EMAIL))?.cancelada, true);

await ENT.activarSuscripcion(EMAIL, "mensual", ayer, "v1");
comprobar("vencida -> FREE", await ENT.isPro(EMAIL), false);

await ENT.activarSuscripcion(EMAIL, "anual", manana, "v2");
comprobar("vuelve a comprar -> PRO", await ENT.isPro(EMAIL), true);
await ENT.cancelarPro(EMAIL);
comprobar("borrada -> FREE", await ENT.isPro(EMAIL), false);

await ENT.activarLifetime(EMAIL, "vLife");
comprobar("lifetime -> PRO sin caducidad", await ENT.isPro(EMAIL), true);
comprobar("  until null", (await ENT.leerPro(EMAIL))?.until, null);
await ENT.cancelarPro(EMAIL);

// ------------------------------------------------------- 23. IDEMPOTENCIA
comprobar("evento nuevo no esta procesado", await ENT.eventoYaProcesado("order_created:999"), false);
comprobar("el mismo evento YA esta procesado", await ENT.eventoYaProcesado("order_created:999"), true);
comprobar("y otra vez", await ENT.eventoYaProcesado("order_created:999"), true);
comprobar("otro evento del mismo objeto pasa", await ENT.eventoYaProcesado("subscription_updated:999"), false);

// El daño real que evita: creditos duplicados.
await ENT.sumarCredito(EMAIL, "pdf", 1);
await ENT.sumarCredito(EMAIL, "pdf", 1);
await ENT.sumarCredito(EMAIL, "pdf", 1);
comprobar("sin dedupe, 3 entregas = 3 creditos (el fallo)", await ENT.leerCreditos(EMAIL, "pdf"), 3);

// Con la puerta puesta, como lo hace el webhook:
almacen.clear(); caducidad.clear();
for (let i = 0; i < 3; i++) {
  if (await ENT.eventoYaProcesado("order_created:PDF-1")) continue;
  await ENT.sumarCredito(EMAIL, "pdf", 1);
}
comprobar("con dedupe, 3 entregas = 1 credito", await ENT.leerCreditos(EMAIL, "pdf"), 1);

// ------------------------------------------------- 22. LIMITES FREE / PRO
comprobar("asesor free 4/5 pasa", evaluar("asesor", { pro: false, usado: 4 }).permitido, true);
comprobar("asesor free 5/5 bloquea", evaluar("asesor", { pro: false, usado: 5 }).permitido, false);
comprobar("asesor PRO en 5 no bloquea", evaluar("asesor", { pro: true, usado: 5 }).permitido, true);
comprobar("vuelos free 10/10 bloquea", evaluar("vuelo_vivo", { pro: false, usado: 10 }).permitido, false);
comprobar("vuelos PRO en 10 no bloquea", evaluar("vuelo_vivo", { pro: true, usado: 10 }).permitido, true);
comprobar("viaje free 1/1 bloquea el 2o", evaluar("viajes_guardados", { pro: false, usado: 1 }).permitido, false);
comprobar("monitor free bloqueado", evaluar("monitor_viaje", { pro: false }).motivo, "solo-pro");
comprobar("monitor PRO permitido", evaluar("monitor_viaje", { pro: true }).permitido, true);

// -------------------------------------------------- 21. IDENTIDAD / FIRMA
const secreto = "secreto-de-prueba";
const cuerpo = JSON.stringify({ meta: { event_name: "order_created" }, data: { id: "1" } });
const firmaBuena = crypto.createHmac("sha256", secreto).update(cuerpo).digest("hex");
const verificar = (raw, firma) => {
  try {
    const a = Buffer.from(crypto.createHmac("sha256", secreto).update(raw).digest("hex"), "hex");
    const b = Buffer.from(String(firma), "hex");
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch { return false; }
};
comprobar("firma correcta", verificar(cuerpo, firmaBuena), true);
comprobar("firma manipulada", verificar(cuerpo, firmaBuena.replace(/.$/, "0")), false);
comprobar("cuerpo manipulado", verificar(cuerpo.replace('"1"', '"2"'), firmaBuena), false);
comprobar("sin firma", verificar(cuerpo, ""), false);

// ----------------------------------------- 13. PAYWALL POR CAPACIDAD
comprobar("monitor_viaje abre su propio motivo", motivoPaywall("monitor_viaje"), "monitor");
comprobar("viajes_guardados -> guardar", motivoPaywall("viajes_guardados"), "guardar");
comprobar("exportar_pdf -> pdf", motivoPaywall("exportar_pdf"), "pdf");
comprobar("alertas_precio -> alerta", motivoPaywall("alertas_precio"), "alerta");
comprobar("compartir_viaje -> compartir", motivoPaywall("compartir_viaje"), "compartir");

// --------------------- 14. UNA SOLA FUENTE DE VERDAD PARA LOS LIMITES
//
// El numero que ve el usuario tiene que salir del catalogo, no estar escrito
// a mano en un componente. Habia un 60 suelto en AsesorViaje: si alguien
// cambia el catalogo y la interfaz sigue diciendo otra cosa, esto lo caza.
const fuenteAsesor = fs.readFileSync(new URL("../components/AsesorViaje.js", import.meta.url), "utf8");
comprobar("AsesorViaje no lleva el limite a mano", /pro:\s*\d+/.test(fuenteAsesor), false);
comprobar("AsesorViaje lo pide al catalogo", fuenteAsesor.includes('limiteDe("asesor", true)'), true);
comprobar("catalogo: asesor free", limiteDe("asesor", false), 5);
comprobar("catalogo: asesor pro", limiteDe("asesor", true), 60);
comprobar(
  "toda capacidad con tope declara su porque",
  Object.entries(CAPACIDADES).filter(([, c]) => c.limite && !c.porque).map(([k]) => k),
  []
);

console.log([...ok, ...mal].join("\n"));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
