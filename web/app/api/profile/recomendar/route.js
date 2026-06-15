// GET /api/profile/recomendar
// Headers: Authorization: Bearer <token>
// Devuelve: { ok, perfil: { topGustos: [...] }, tema, recomendaciones }
//
// `tema` es la categoria principal del usuario — el cliente lo usa para
// elegir el fondo del hero (playa, ciudad, historia, etc.). `recomendaciones`
// es una lista de destinos del catalogo ordenados por afinidad con el perfil
// (top 6 para mostrar como "Pensamos que te gustaria").

export const runtime = "nodejs";

import { kv, kvActivo } from "@/lib/kv";
import { leerSesion } from "@/lib/auth";
import { tagsDe, topGustos } from "@/lib/destinosTags";
import { DESTINOS_SEO } from "@/lib/destinos";

function leerToken(req) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+([A-Za-z0-9]+)$/i);
  return m ? m[1] : null;
}

export async function GET(req) {
  if (!kvActivo()) return Response.json({ ok: false, motivo: "no-storage" }, { status: 200 });
  const token = leerToken(req);
  if (!token) return Response.json({ ok: false, motivo: "sin-sesion" }, { status: 200 });
  const sesion = await leerSesion(token);
  if (!sesion?.email) return Response.json({ ok: false, motivo: "sesion-invalida" }, { status: 200 });

  let perfil = null;
  try {
    const raw = await kv(["GET", `user:${sesion.email}`]);
    perfil = raw ? JSON.parse(raw) : null;
  } catch { perfil = null; }

  const gustos = perfil?.gustos || {};
  const top = topGustos(gustos, 3);
  const tema = top[0] || "general";

  // Si no hay gustos, devolvemos respuesta vacia y el cliente usa los
  // defaults (no rompe la UI).
  if (!top.length) {
    return Response.json({
      ok: true,
      perfil: { topGustos: [], hayDatos: false },
      tema: "general",
      recomendaciones: [],
    });
  }

  // Puntuar cada destino segun cuantos de sus tags estan entre el top del usuario.
  // Score = sum(gustos[tag] para cada tag del destino que esta en top).
  const scoreados = DESTINOS_SEO.map((d) => {
    const tags = tagsDe(d);
    let score = 0;
    for (const t of tags) {
      score += Number(gustos[t] || 0);
    }
    return { d, score, tags };
  });

  scoreados.sort((a, b) => b.score - a.score);
  const recomendaciones = scoreados
    .filter((x) => x.score > 0)
    .slice(0, 6)
    .map((x) => ({
      slug: x.d.slug,
      ciudad: x.d.ciudad,
      pais: x.d.pais,
      bandera: x.d.bandera,
      vuelo: x.d.vuelo,
      tags: x.tags,
      score: Math.round(x.score * 10) / 10,
    }));

  return Response.json({
    ok: true,
    perfil: { topGustos: top, hayDatos: true },
    tema,
    recomendaciones,
  });
}
