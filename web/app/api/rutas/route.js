// Rutas multiparada guardadas.
//
// El modelo de /api/viajes guarda UNA ciudad por viaje, así que un itinerario
// de varias paradas no cabía ahí. Esto lo guarda entero: nombre que le pone el
// viajero, fecha de salida, paradas en orden, noches por ciudad y viajeros.
//
// Identidad unificada (Google o código por correo) vía lib/identidad, no solo
// getServerSession: los usuarios que entran con código también guardan.
//
// Cada ruta tiene un id público corto para compartirla por enlace sin exponer
// el correo de nadie. GET sin sesión pero con ?id= devuelve la ruta compartida.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv, kvActivo, pipeline } from "@/lib/kv";
import { identificarUsuario } from "@/lib/identidad";

const TOPE_RUTAS = 25;      // por usuario
const TOPE_OVERRIDES = 200;
const TOPE_PARADAS = 30;    // por ruta
const TTL = 60 * 60 * 24 * 365; // un año

function idPublico() {
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < 8; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

const kRuta = (id) => `ruta:${id}`;
const kUsuario = (email) => `rutas:user:${email}`;

// Limpia lo que llega del cliente. Nunca se confía en el navegador.
function sanearParadas(x) {
  if (!Array.isArray(x)) return [];
  return x.slice(0, TOPE_PARADAS).map((p) => ({
    ciudad: String(p?.ciudad || "").slice(0, 80),
    pais: String(p?.pais || "").slice(0, 80),
    iata: /^[A-Za-z]{3}$/.test(p?.iata || "") ? String(p.iata).toUpperCase() : "",
    lat: Number.isFinite(Number(p?.lat)) ? Number(p.lat) : null,
    lon: Number.isFinite(Number(p?.lon)) ? Number(p.lon) : null,
    noches: Math.max(0, Math.min(365, Math.round(Number(p?.noches) || 0))),
  })).filter((p) => p.ciudad);
}

// Lo que el usuario decidio a mano y no se puede recalcular.
//
//   overrides: monto fijado por linea, por ID de linea (no por posicion: si
//              cambias el orden de las ciudades, tu precio del hotel de Madrid
//              sigue siendo el de Madrid).
//   ajustes:   porcentajes de colchon, que son suyos y no nuestros.
function sanearPresupuesto(x) {
  const out = { overrides: {}, ajustes: {} };
  if (!x || typeof x !== "object") return out;

  const ov = x.overrides;
  if (ov && typeof ov === "object") {
    let n = 0;
    for (const [k, v] of Object.entries(ov)) {
      if (n >= TOPE_OVERRIDES) break;
      if (!/^[A-Za-z0-9_\-]{1,80}$/.test(k)) continue;
      const num = Number(v);
      if (!Number.isFinite(num) || num < 0 || num > 10_000_000) continue;
      out.overrides[k] = Math.round(num);
      n++;
    }
  }

  const pct = (v, def) => {
    const num = Number(v);
    return Number.isFinite(num) && num >= 0 && num <= 1 ? num : def;
  };
  out.ajustes = {
    contingenciaPct: pct(x.ajustes?.contingenciaPct, 0.1),
    margenCambiarioPct: pct(x.ajustes?.margenCambiarioPct, 0.03),
  };
  return out;
}

// Una ruta guardada antes del esquema v2 se lee igual: se le ponen los
// valores por defecto al vuelo. No se reescribe en KV hasta que el usuario
// guarde — migrar datos de nadie sin que los toque no hace falta.
export function migrarRuta(r) {
  if (!r || typeof r !== "object") return r;
  if (r.v >= 2) return r;
  return {
    ...r,
    v: 2,
    pasaporte: r.pasaporte || "CO",
    monedaVista: r.monedaVista || "COP",
    presupuesto: sanearPresupuesto(r.presupuesto),
    mesInicio: r.mesInicio || (r.fechaInicio ? String(r.fechaInicio).slice(0, 7) : ""),
  };
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();

  // Ruta compartida: pública por su id, sin necesidad de sesión.
  if (id) {
    if (!/^[a-f0-9]{16}$/.test(id)) return Response.json({ ok: false }, { status: 400 });
    const raw = await kv(["GET", kRuta(id)]);
    if (!raw) return Response.json({ ok: false, motivo: "no-existe" }, { status: 404 });
    try {
      const r = JSON.parse(raw);
      // El correo del dueño no viaja al cliente.
      const { email, ...publica } = r;
      return Response.json({ ok: true, ruta: migrarRuta(publica) });
    } catch {
      return Response.json({ ok: false }, { status: 500 });
    }
  }

  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  const ids = (await kv(["SMEMBERS", kUsuario(u.email)])) || [];
  const rutas = [];
  for (const rid of ids) {
    const raw = await kv(["GET", kRuta(rid)]);
    if (!raw) continue;
    try {
      const { email, ...publica } = JSON.parse(raw);
      rutas.push(migrarRuta(publica));
    } catch {}
  }
  rutas.sort((a, b) => (b.actualizada || 0) - (a.actualizada || 0));
  return Response.json({ ok: true, rutas });
}

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch {}

  const paradas = sanearParadas(body?.paradas);
  if (paradas.length < 2) {
    return Response.json({ ok: false, motivo: "faltan-paradas" }, { status: 400 });
  }

  const existente = /^[a-f0-9]{16}$/.test(body?.id || "") ? body.id : null;
  let id = existente;

  // Editar una ruta ajena no es posible: se comprueba el dueño.
  if (existente) {
    const raw = await kv(["GET", kRuta(existente)]);
    if (!raw) { id = null; }
    else {
      try {
        if (JSON.parse(raw).email !== u.email) {
          return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });
        }
      } catch { id = null; }
    }
  }
  if (!id) id = idPublico();

  const ruta = {
    id,
    email: u.email,
    nombre: String(body?.nombre || "").slice(0, 120) || `${paradas[0].ciudad} → ${paradas[paradas.length - 1].ciudad}`,
    paradas,
    viajeros: Math.max(1, Math.min(20, Math.round(Number(body?.viajeros) || 1))),
    // MES de salida "YYYY-MM". Antes era el dia exacto, pero un viaje que se
    // planea con meses de antelacion no tiene dia: se elegia uno inventado.
    // La fecha de regreso NO se guarda: sale de las noches de cada parada, y
    // tener las dos permitiria que se contradijeran sin saber cual manda.
    //
    // Se acepta tambien el formato largo, que es el que traen las rutas
    // guardadas antes de este cambio, y se recorta al mes.
    mesInicio: /^\d{4}-\d{2}(-\d{2})?$/.test(body?.mesInicio || body?.fechaInicio || "")
      ? String(body?.mesInicio || body?.fechaInicio).slice(0, 7)
      : "",
    moneda: String(body?.moneda || "USD").slice(0, 3).toUpperCase(),

    // --- Esquema v2 --------------------------------------------------------
    //
    // Hasta aqui una ruta guardada eran paradas, viajeros, nombre y mes: el
    // presupuesto se recalculaba entero cada vez y no habia donde guardar una
    // sola decision del viajero. Con el motor de lineas hace falta persistir
    // lo que NO se puede recalcular — lo que el usuario sabe y nosotros no.
    //
    // Se versiona en vez de reemplazar. Una ruta sin `v` es v1 y se lee igual;
    // migrarRuta() le pone los valores por defecto al leerla. Nadie pierde un
    // viaje por este cambio.
    v: 2,
    // Nacionalidad del pasaporte, que NO es el pais de salida: de eso depende
    // el calculo migratorio (visa, ETIAS, ETA), y hasta ahora se confundia con
    // el aeropuerto de origen.
    pasaporte: /^[A-Za-z]{2}$/.test(body?.pasaporte || "")
      ? String(body.pasaporte).toUpperCase()
      : "CO",
    // Moneda en la que el viajero quiere VER el presupuesto. La de cada linea
    // se guarda aparte, en su moneda natural.
    monedaVista: String(body?.monedaVista || "COP").slice(0, 3).toUpperCase(),
    presupuesto: sanearPresupuesto(body?.presupuesto),

    creada: Number(body?.creada) || Date.now(),
    actualizada: Date.now(),
  };

  await pipeline([
    ["SET", kRuta(id), JSON.stringify(ruta), "EX", String(TTL)],
    ["SADD", kUsuario(u.email), id],
    ["EXPIRE", kUsuario(u.email), String(TTL)],
  ]);

  // Poda: si el usuario pasa del tope, se borra la más vieja.
  const ids = (await kv(["SMEMBERS", kUsuario(u.email)])) || [];
  if (ids.length > TOPE_RUTAS) {
    const conFecha = [];
    for (const rid of ids) {
      const raw = await kv(["GET", kRuta(rid)]);
      if (!raw) { await kv(["SREM", kUsuario(u.email), rid]); continue; }
      try { conFecha.push({ rid, t: JSON.parse(raw).actualizada || 0 }); } catch {}
    }
    conFecha.sort((a, b) => a.t - b.t);
    for (const v of conFecha.slice(0, conFecha.length - TOPE_RUTAS)) {
      await pipeline([["DEL", kRuta(v.rid)], ["SREM", kUsuario(u.email), v.rid]]);
    }
  }

  const { email, ...publica } = ruta;
  return Response.json({ ok: true, ruta: publica });
}

export async function DELETE(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = (searchParams.get("id") || "").trim();
  if (!/^[a-f0-9]{16}$/.test(id)) return Response.json({ ok: false }, { status: 400 });

  const raw = await kv(["GET", kRuta(id)]);
  if (raw) {
    try {
      if (JSON.parse(raw).email !== u.email) {
        return Response.json({ ok: false, motivo: "no-es-tuya" }, { status: 403 });
      }
    } catch {}
  }
  await pipeline([["DEL", kRuta(id)], ["SREM", kUsuario(u.email), id]]);
  return Response.json({ ok: true });
}
