// Lo que el viajero YA DECIDIO al preparar su viaje.
//
// POR QUE UNA CLAVE APARTE Y NO UN CAMPO DENTRO DE LA RUTA
//
// Hay precedente en este mismo repo: el orden de las tarjetas vive en
// `rutas:orden:<email>` y no dentro de cada ruta, porque reordenar es UNA
// escritura corta en vez de reescribir 25 rutas enteras. Aqui pasa igual y
// peor: marcar una casilla reescribiria el viaje completo —paradas, noches,
// presupuesto, overrides— cada vez, y una escritura fallida a medias se
// llevaria por delante el viaje, no solo la casilla.
//
// Ademas son dos ciclos de vida distintos. La ruta es lo que el viaje ES; esto
// es en que punto de su preparacion esta. Se puede borrar esto entero y el
// viaje sigue intacto.
//
// El esquema de las rutas guardadas NO se toca.
//
// QUE SE GUARDA Y QUE NO
//
// Solo lo que no se puede recalcular:
//
//   tareas[id].estado      lo marco el viajero
//   tramos[id].medioElegido   eligio tren donde recomendabamos avion
//
// NO se guardan precios, ni recomendaciones, ni totales, ni el plan. Todo eso
// sale del motor cada vez, porque cambia. Guardar un precio seria guardar una
// mentira con fecha de caducidad —la misma regla que ya rige en el tablero.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv, kvActivo } from "@/lib/kv";
import { identificarUsuario } from "@/lib/identidad";
import { ESTADOS } from "@/lib/ejecutorViaje";

const TTL = 60 * 60 * 24 * 365;
const TOPE_TAREAS = 200;
const TOPE_TRAMOS = 40;
const MEDIOS = ["vuelo", "tren", "bus", "ferry", "auto"];

const kEjec = (rutaId) => `ejec:${rutaId}`;
const kRuta = (rutaId) => `ruta:${rutaId}`;

const idValido = (x) => /^[a-f0-9]{16}$/.test(String(x || ""));

/** Nada que venga del navegador se guarda sin pasar por aqui. */
function sanear(x) {
  const out = { v: 1, tareas: {}, tramos: {}, actualizada: Date.now() };
  if (!x || typeof x !== "object") return out;

  const tareas = x.tareas;
  if (tareas && typeof tareas === "object") {
    let i = 0;
    for (const [id, valor] of Object.entries(tareas)) {
      if (i >= TOPE_TAREAS) break;
      if (!/^[A-Za-z0-9_:.\-À-ɏ ]{1,120}$/.test(id)) continue;
      const estado = valor?.estado;
      if (!ESTADOS.includes(estado)) continue;
      // Una tarea en su estado por defecto no ocupa sitio: se omite en vez de
      // guardarse, para que la ejecucion no crezca con ruido.
      if (estado === "pendiente") continue;
      out.tareas[id] = { estado, actualizada: Date.now() };
      i++;
    }
  }

  const tramos = x.tramos;
  if (tramos && typeof tramos === "object") {
    let i = 0;
    for (const [id, valor] of Object.entries(tramos)) {
      if (i >= TOPE_TRAMOS) break;
      if (!/^[A-Za-z0-9_:.\-À-ɏ ]{1,120}$/.test(id)) continue;
      const medio = valor?.medioElegido;
      if (!MEDIOS.includes(medio)) continue;
      out.tramos[id] = { medioElegido: medio, actualizada: Date.now() };
      i++;
    }
  }
  return out;
}

/** La ruta tiene que existir y ser de quien escribe. */
async function esSuya(rutaId, email) {
  const raw = await kv(["GET", kRuta(rutaId)]);
  if (!raw) return false;
  try { return JSON.parse(raw).email === email; } catch { return false; }
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  const id = (new URL(req.url).searchParams.get("id") || "").trim();
  if (!idValido(id)) return Response.json({ ok: false, motivo: "id" }, { status: 400 });
  if (!(await esSuya(id, u.email))) return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });

  const raw = await kv(["GET", kEjec(id)]);
  let ejecucion = { v: 1, tareas: {}, tramos: {} };
  if (raw) { try { ejecucion = JSON.parse(raw); } catch {} }
  return Response.json({ ok: true, ejecucion }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * Guarda la ejecucion entera.
 *
 * El cliente manda el estado completo, no un parche: son unos pocos kilobytes
 * y evita que dos marcados seguidos se pisen con una fusion a medias.
 */
export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}
  const id = String(body?.id || "").trim();
  if (!idValido(id)) return Response.json({ ok: false, motivo: "id" }, { status: 400 });
  if (!(await esSuya(id, u.email))) return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });

  const ejecucion = sanear(body?.ejecucion);
  await kv(["SET", kEjec(id), JSON.stringify(ejecucion), "EX", String(TTL)]);
  return Response.json({ ok: true, ejecucion });
}

/** Volver a empezar la preparacion sin tocar el viaje. */
export async function DELETE(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  const id = (new URL(req.url).searchParams.get("id") || "").trim();
  if (!idValido(id)) return Response.json({ ok: false, motivo: "id" }, { status: 400 });
  if (!(await esSuya(id, u.email))) return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });

  await kv(["DEL", kEjec(id)]);
  return Response.json({ ok: true });
}
