// LOS CAMBIOS DETECTADOS EN UN VIAJE.
//
// Convive con /api/alertas, no lo reemplaza: aquello vigila un DESTINO para
// un usuario y manda correo; esto vigila UN VIAJE y se lee dentro de la app.
// Dos entidades, dos ciclos de vida, dos claves de KV. Lo compartido —el KV,
// identificarUsuario, el secreto del cron, /api/vuelo-vivo— se reutiliza tal
// cual.
//
// QUE SE GUARDA
//
//   alertasviaje:<rutaId> -> { snapshot, alertas[], actualizada }
//
// El snapshot es la FOTO minima para poder comparar: precios, coste total y
// que tareas siguen pendientes. No se guarda la respuesta del proveedor, ni el
// analisis, ni el plan. Todo eso se recalcula, porque cambia.
//
// SEGURIDAD
//
// Las alertas de un viaje son de su dueño. Cada operacion comprueba, contra
// KV, que la ruta existe y que el correo del dueño coincide con el de quien
// llama. El id que manda el cliente no se cree: se usa para ir a buscar la
// ruta y preguntarle de quien es.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv, kvActivo } from "@/lib/kv";
import { identificarUsuario } from "@/lib/identidad";
import { construirSnapshot, detectarCambios, fundirAlertas, resumenAlertas, K_VIGILADOS, UMBRALES } from "@/lib/motorAlertas";

const TTL = 60 * 60 * 24 * 120;
const kAlertas = (rutaId) => `alertasviaje:${rutaId}`;
const kRuta = (rutaId) => `ruta:${rutaId}`;

const idValido = (x) => /^[a-f0-9]{16}$/.test(String(x || ""));

/** La ruta existe y es de quien llama. No se confia en el id del cliente. */
async function rutaDelUsuario(rutaId, email) {
  const raw = await kv(["GET", kRuta(rutaId)]);
  if (!raw) return null;
  try {
    const r = JSON.parse(raw);
    return r.email === email ? r : null;
  } catch { return null; }
}

async function leer(rutaId) {
  const raw = await kv(["GET", kAlertas(rutaId)]);
  if (!raw) return { snapshot: null, alertas: [] };
  try {
    const d = JSON.parse(raw);
    return { snapshot: d.snapshot || null, alertas: Array.isArray(d.alertas) ? d.alertas : [] };
  } catch { return { snapshot: null, alertas: [] }; }
}

async function guardar(rutaId, datos) {
  await kv(["SET", kAlertas(rutaId), JSON.stringify({ ...datos, actualizada: Date.now() }), "EX", String(TTL)]);
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  const id = (new URL(req.url).searchParams.get("id") || "").trim();

  // Sin id: TODOS los viajes del usuario. Es lo que necesita el centro de
  // alertas, y se resuelve con lecturas de KV —ninguna consulta externa— asi
  // que abrirlo no cuesta dinero.
  if (!id) {
    const ids = (await kv(["SMEMBERS", `rutas:user:${u.email}`])) || [];
    const todas = [];
    for (const rid of ids.slice(0, 25)) {
      const [{ alertas: sus }, rawRuta] = await Promise.all([leer(rid), kv(["GET", kRuta(rid)])]);
      if (!sus.length || !rawRuta) continue;
      let nombre = "";
      try { nombre = JSON.parse(rawRuta).nombre || ""; } catch {}
      for (const a of sus) todas.push({ ...a, viajeId: rid, viajeNombre: nombre });
    }
    return Response.json(
      { ok: true, alertas: todas, resumen: resumenAlertas(todas) },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!idValido(id)) return Response.json({ ok: false, motivo: "id" }, { status: 400 });
  if (!(await rutaDelUsuario(id, u.email))) return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });

  const { snapshot, alertas } = await leer(id);
  return Response.json(
    { ok: true, alertas, resumen: resumenAlertas(alertas), ultimoAnalisis: snapshot?.tomadoEn || null, umbrales: UMBRALES },
    { headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Detectar cambios AHORA, con el estado que el tablero ya tiene en pantalla.
 *
 * No consulta precios: el tablero manda lo que ya calculo, y aqui solo se
 * compara contra la foto anterior. Las consultas de pago viven en el monitor
 * (ver /api/viaje-alertas/monitor), que tiene su propio freno de frecuencia.
 */
export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = String(body?.id || "").trim();
  if (!idValido(id)) return Response.json({ ok: false, motivo: "id" }, { status: 400 });

  const ruta = await rutaDelUsuario(id, u.email);
  if (!ruta) return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });

  const { snapshot: previo, alertas: guardadas } = await leer(id);
  const actual = construirSnapshot({
    viaje: ruta,
    analisis: body?.analisis || null,
    plan: body?.plan || null,
    preciosVivos: body?.preciosVivos || {},
  });

  const nuevas = detectarCambios({ previo, actual, viaje: ruta, plan: body?.plan || null, existentes: guardadas });
  const alertas = fundirAlertas({ guardadas, nuevas, plan: body?.plan || null });

  await guardar(id, { snapshot: actual, alertas });

  // El viaje entra en la lista del monitor SOLO al abrirlo.
  //
  // Asi lo que se vigila con consultas de pago no es "todos los viajes
  // guardados del mundo" sino los que alguien usa de verdad. Un viaje que
  // nadie abre nunca no cuesta nada, y el monitor se encarga de sacar de la
  // lista los que ya pasaron o se borraron.
  if (/^d{4}-d{2}(-d{2})?$/.test(ruta.fechaIda || ruta.mesInicio || "")) {
    await kv(["SADD", K_VIGILADOS, id]);
  }

  return Response.json({ ok: true, alertas, nuevas: nuevas.length, resumen: resumenAlertas(alertas) });
}

/** Marcar leida o resolver a mano. Lo unico que el viajero puede cambiar. */
export async function PATCH(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = String(body?.id || "").trim();
  if (!idValido(id)) return Response.json({ ok: false, motivo: "id" }, { status: 400 });
  if (!(await rutaDelUsuario(id, u.email))) return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });

  const accion = body?.accion;
  if (!["leer", "leer-todas", "resolver"].includes(accion)) {
    return Response.json({ ok: false, motivo: "accion" }, { status: 400 });
  }
  const alertaId = String(body?.alertaId || "").slice(0, 200);

  const { snapshot, alertas } = await leer(id);
  const siguientes = alertas.map((a) => {
    if (accion === "leer-todas") return { ...a, leida: true };
    if (a.id !== alertaId) return a;
    if (accion === "leer") return { ...a, leida: true };
    return { ...a, estado: "resuelta", resueltaEn: Date.now(), leida: true };
  });

  await guardar(id, { snapshot, alertas: siguientes });
  return Response.json({ ok: true, alertas: siguientes, resumen: resumenAlertas(siguientes) });
}
