// Fotos de lugares — gratis y legal, vía Wikipedia (API REST pública).
// Devuelve una imagen atractiva del lugar para mostrar DENTRO de la app.

import { cacheado, fetchRapido } from "./cache";

const TTL = 1000 * 60 * 60 * 24 * 30; // 30 días

// Busca la mejor foto para "nombre" (en una ciudad para desambiguar).
// Estrategia en cascada para maximizar cobertura de fotos:
//  1) Wikipedia (artículo con imagen) — lugares famosos, además trae descripción.
//  2) Wikimedia Commons — fotos de muchos más lugares (sin necesidad de artículo).
export async function fotoDeLugar(nombre, ciudad = "") {
  const clave = `img:${nombre}|${ciudad}`.toLowerCase();
  return cacheado(clave, TTL, async () => {
    // 1) Wikipedia
    const wiki = await fotoWikipedia(nombre, ciudad);
    if (wiki?.url) return wiki;
    // 2) Wikimedia Commons (respaldo: muchas más fotos)
    const commons = await fotoCommons(nombre, ciudad);
    if (commons?.url) return { ...commons, extracto: wiki?.extracto || null };
    // 3) Sin foto: devolvemos la descripción si la había
    return wiki || null;
  });
}

async function fotoWikipedia(nombre, ciudad) {
  const titulo = await buscarTitulo(nombre, ciudad);
  if (!titulo) return null;
  try {
    const r = await fetchRapido(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const url = d.originalimage?.source || d.thumbnail?.source || null;
    return {
      url,
      ancho: d.originalimage?.width || d.thumbnail?.width || null,
      extracto: d.extract || null,
      link: d.content_urls?.desktop?.page || null,
    };
  } catch {
    return null;
  }
}

async function fotoCommons(nombre, ciudad) {
  try {
    const q = ciudad ? `${nombre} ${ciudad}` : nombre;
    // Buscar archivos de imagen en Commons por texto.
    const r = await fetchRapido(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=1&gsrsearch=${encodeURIComponent(
        q
      )}&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const paginas = d.query?.pages;
    if (!paginas) return null;
    const primera = Object.values(paginas)[0];
    const info = primera?.imageinfo?.[0];
    const url = info?.thumburl || info?.url || null;
    if (!url) return null;
    return { url, ancho: info?.thumbwidth || 800, link: info?.descriptionurl || null };
  } catch {
    return null;
  }
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
