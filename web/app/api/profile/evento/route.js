// POST /api/profile/evento
// Headers: Authorization: Bearer <token>  (sesion de email)
// Body: { tipo, ciudad?, pais?, region?, categoria? }
//
// Registra una interaccion del usuario para construir su perfil de gustos.
// Tipos soportados:
//   - "busqueda": el usuario abrio una ciudad. categoria = tags inferidos.
//   - "vio_destino": abrio detalle de destino.
//   - "agrego_lugar": agrego un lugar al itinerario (peso mayor).
//   - "presupuesto": abrio el modal de presupuesto con cierta region.
//
// Cada evento incrementa el score de las categorias relevantes en el perfil.
// Sin token (anonimo) el endpoint responde ok:true pero no persiste; el
// cliente puede caer a localStorage en ese caso.

export const runtime = "nodejs";

import { kv, kvActivo } from "@/lib/kv";
import { leerSesion } from "@/lib/auth";
import { tagsDe, CATEGORIAS_GUSTO, normalizarCiudad } from "@/lib/destinosTags";

// Peso por tipo de evento — refleja la fuerza de la senal.
const PESOS = {
  busqueda: 0.5,
  vio_destino: 0.8,
  agrego_lugar: 1.5,
  presupuesto: 0.3,
};

// Tope de score por categoria para evitar que un usuario obsesionado con un
// tipo de viaje sature su perfil y nunca vea recomendaciones nuevas.
const TOPE_CATEGORIA = 50;

// Decaimiento: cada evento aplica una pequenisima reduccion al resto de las
// categorias (-0.01). Asi el perfil se va refinando con el tiempo y no queda
// "congelado" con primeras impresiones.
const DECAIMIENTO = 0.01;

function leerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+([A-Za-z0-9]+)$/i);
  return m ? m[1] : null;
}

export async function POST(req) {
  if (!kvActivo()) return Response.json({ ok: true, persistido: false });

  const token = leerToken(req);
  if (!token) return Response.json({ ok: true, persistido: false });

  const sesion = await leerSesion(token);
  if (!sesion?.email) return Response.json({ ok: true, persistido: false });

  let body = {};
  try { body = await req.json(); } catch {}

  const tipo = String(body?.tipo || "busqueda");
  const peso = PESOS[tipo] || 0.5;

  // Inferir categorias: si llegan explicitas usalas, si no calculalas con tagsDe.
  let categorias = [];
  if (Array.isArray(body?.categorias) && body.categorias.length) {
    categorias = body.categorias.filter((c) => CATEGORIAS_GUSTO.includes(c));
  } else {
    categorias = tagsDe({
      ciudad: body?.ciudad,
      region: body?.region,
    });
  }
  if (!categorias.length) return Response.json({ ok: true, persistido: false });

  // Leer perfil actual.
  const claveUsuario = `user:${sesion.email}`;
  let perfil = null;
  try {
    const raw = await kv(["GET", claveUsuario]);
    perfil = raw ? JSON.parse(raw) : null;
  } catch { perfil = null; }
  if (!perfil) {
    // Defensa: si el usuario tiene sesion pero no perfil (deberia siempre haber
    // uno tras /verificar), inicializa aqui.
    perfil = { email: sesion.email, nombre: sesion.nombre || sesion.email.split("@")[0], creado: Date.now(), gustos: {} };
  }
  if (!perfil.gustos || typeof perfil.gustos !== "object") perfil.gustos = {};

  // Aplicar decaimiento global.
  for (const k of CATEGORIAS_GUSTO) {
    const v = Number(perfil.gustos[k] || 0);
    if (v > 0) perfil.gustos[k] = Math.max(0, v - DECAIMIENTO);
  }

  // Sumar a las categorias relevantes (capped).
  for (const c of categorias) {
    const v = Number(perfil.gustos[c] || 0);
    perfil.gustos[c] = Math.min(TOPE_CATEGORIA, v + peso);
  }

  // Tambien guardamos el historial corto (ultimos 20) para Phase 4 si lo
  // queremos para recomendaciones colaborativas.
  if (!Array.isArray(perfil.historial)) perfil.historial = [];
  if (body?.ciudad) {
    perfil.historial.unshift({
      ciudad: body.ciudad,
      pais: body.pais || null,
      tipo,
      ts: Date.now(),
    });
    perfil.historial = perfil.historial.slice(0, 20);
  }

  perfil.actualizado = Date.now();
  await kv(["SET", claveUsuario, JSON.stringify(perfil)]);

  return Response.json({ ok: true, persistido: true, gustos: perfil.gustos });
}
