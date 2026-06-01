// Fotos de lugares — gratis y legal, vía Wikipedia (API REST pública).
// Devuelve una imagen atractiva del lugar para mostrar DENTRO de la app.

import { cacheado, fetchRapido } from "./cache";

const TTL = 1000 * 60 * 60 * 24 * 30; // 30 días

// Busca la mejor foto para "nombre" (en una ciudad para desambiguar).
export async function fotoDeLugar(nombre, ciudad = "") {
  const clave = `img:${nombre}|${ciudad}`.toLowerCase();
  return cacheado(clave, TTL, async () => {
    // 1) Buscar el artículo más probable en Wikipedia (español).
    const titulo = await buscarTitulo(nombre, ciudad);
    if (!titulo) return null;
    // 2) Traer el resumen con imagen (thumbnail) del artículo.
    try {
      const r = await fetchRapido(
        `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
          titulo
        )}`
      );
      if (!r.ok) return null;
      const d = await r.json();
      const url =
        d.originalimage?.source || d.thumbnail?.source || null;
      if (!url) return null;
      return {
        url,
        ancho: d.originalimage?.width || d.thumbnail?.width || null,
        extracto: d.extract || null,
        link: d.content_urls?.desktop?.page || null,
      };
    } catch {
      return null;
    }
  });
}

async function buscarTitulo(nombre, ciudad) {
  try {
    const q = ciudad ? `${nombre} ${ciudad}` : nombre;
    const r = await fetchRapido(
      `https://es.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        q
      )}&srlimit=1&format=json&origin=*`
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d.query?.search?.[0]?.title || null;
  } catch {
    return null;
  }
}
