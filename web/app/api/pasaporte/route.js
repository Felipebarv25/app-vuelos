// El pasaporte: paises que el viajero ya conocio, y las ciudades de cada uno.
//
// Vive aparte de /api/viajes y /api/rutas porque no es un viaje: es el
// registro de lo que YA se hizo, y sobrevive a que se borren los itinerarios.
// Un usuario puede borrar todos sus viajes y seguir habiendo estado en 14
// paises; mezclarlo con las rutas habria atado un recuerdo a un borrador.
//
// UN SOLO DOCUMENTO POR USUARIO, no una clave por pais. La lista completa
// cabe de sobra —195 paises con sus ciudades son unos pocos KB— y asi leerla
// es UNA peticion en vez de 195. Se escribe entera en cada cambio; a esta
// escala, un merge parcial seria complejidad sin beneficio.
//
// Identidad unificada (Google o codigo por correo) via lib/identidad, igual
// que el resto: quien entra con codigo tambien guarda.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv, kvActivo } from "@/lib/kv";
import { identificarUsuario } from "@/lib/identidad";

const TOPE_PAISES = 195;      // los de la ONU: mas que eso es un error
const TOPE_CIUDADES = 60;     // por pais
const LARGO_CIUDAD = 60;
const TTL = 60 * 60 * 24 * 365 * 5; // cinco años: esto no caduca como un viaje

const kPasaporte = (email) => `pasaporte:${email}`;

/**
 * Limpia lo que llega del navegador. Nunca se confia en el cliente.
 *
 * Forma: { "co": { desde: "2026-09-04", ciudades: ["Medellín", ...] }, ... }
 * La clave es el ISO-2 en minusculas, que es lo que <Bandera> necesita.
 */
function sanear(x) {
  if (!x || typeof x !== "object") return {};
  const out = {};
  let n = 0;
  for (const [cc, v] of Object.entries(x)) {
    if (n >= TOPE_PAISES) break;
    const iso = String(cc || "").toLowerCase();
    if (!/^[a-z]{2}$/.test(iso)) continue;
    const ciudades = [];
    const vistas = new Set();
    for (const c of Array.isArray(v?.ciudades) ? v.ciudades : []) {
      const nombre = String(c || "").trim().slice(0, LARGO_CIUDAD);
      if (!nombre) continue;
      // Sin duplicados, comparando sin mayusculas ni tildes: quien escribe
      // "Medellin" despues de "Medellín" no queria dos entradas.
      const clave = nombre.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (vistas.has(clave)) continue;
      vistas.add(clave);
      ciudades.push(nombre);
      if (ciudades.length >= TOPE_CIUDADES) break;
    }
    const desde = /^\d{4}-\d{2}-\d{2}$/.test(v?.desde) ? v.desde : new Date().toISOString().slice(0, 10);
    out[iso] = { desde, ciudades };
    n++;
  }
  return out;
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  const raw = await kv(["GET", kPasaporte(u.email)]);
  if (!raw) return Response.json({ ok: true, paises: {} });
  try {
    const d = JSON.parse(raw);
    return Response.json({ ok: true, paises: sanear(d?.paises) });
  } catch {
    // Documento corrupto: se devuelve vacio en vez de romper la pagina. No se
    // borra, por si se puede recuperar a mano.
    return Response.json({ ok: true, paises: {} });
  }
}

export async function PUT(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  const u = await identificarUsuario(req);
  if (!u) return Response.json({ ok: false, motivo: "no-auth" }, { status: 401 });

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, motivo: "json" }, { status: 400 });
  }

  const paises = sanear(body?.paises);
  await kv(["SET", kPasaporte(u.email), JSON.stringify({ v: 1, paises }), "EX", String(TTL)]);
  return Response.json({ ok: true, paises });
}
