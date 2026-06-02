// Fotos de lugares — gratis y legal, vía Wikipedia (API REST pública).
// Devuelve una imagen atractiva del lugar para mostrar DENTRO de la app.

import { cacheado, fetchRapido } from "./cache";

const TTL = 1000 * 60 * 60 * 24 * 30; // 30 días

// Busca la mejor foto para "nombre" (en una ciudad para desambiguar).
// Estrategia en cascada para maximizar cobertura de fotos:
//  1) Wikipedia (artículo con imagen) — lugares famosos, además trae descripción.
//  2) Wikimedia Commons — fotos de muchos más lugares (sin necesidad de artículo).
export async function fotoDeLugar(nombre, ciudad = "") {
  // img2: clave nueva (la anterior cacheaba "sin foto" 30 días y dejaba tarjetas
  // grises para siempre). Ahora solo se cachea cuando SÍ hay foto.
  const clave = `img2:${nombre}|${ciudad}`.toLowerCase();
  return cacheado(
    clave,
    TTL,
    async () => {
      // 1) Wikipedia
      const wiki = await fotoWikipedia(nombre, ciudad);
      if (wiki?.url) return wiki;
      // 2) Wikimedia Commons (respaldo: muchas más fotos)
      const commons = await fotoCommons(nombre, ciudad);
      if (commons?.url) return { ...commons, extracto: wiki?.extracto || null };
      // 3) Sin foto: devolvemos la descripción si la había
      return wiki || null;
    },
    // Solo cachear si conseguimos una URL de foto; si no, reintentar luego.
    (d) => !!(d && d.url)
  );
}

async function fotoWikipedia(nombre, ciudad) {
  const titulo = await buscarTitulo(nombre, ciudad);
  if (!titulo) return null;
  // VERIFICACIÓN DE RELEVANCIA: el título encontrado debe corresponder de verdad
  // al lugar. Si no, Wikipedia trae artículos no relacionados (ej. "77 Towers"
  // devolvía el artículo de Nueva York). Mejor sin foto que con foto equivocada.
  if (!tituloCoincide(nombre, titulo)) return null;
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

// Normaliza texto: minúsculas, sin tildes, sin paréntesis/puntuación.
function norm(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ¿El título de Wikipedia/Commons corresponde de verdad al lugar buscado?
// Exige solapamiento real de palabras significativas (>3 letras).
function tituloCoincide(nombreLugar, titulo) {
  const a = norm(nombreLugar);
  const b = norm(titulo);
  if (!a || !b) return false;
  if (a === b || a.includes(b) || b.includes(a)) return true;
  const palabrasA = a.split(" ").filter((w) => w.length > 3);
  const palabrasB = new Set(b.split(" ").filter((w) => w.length > 3));
  if (!palabrasA.length) return false;
  const comunes = palabrasA.filter((w) => palabrasB.has(w)).length;
  // Al menos la mitad de las palabras significativas deben coincidir.
  return comunes / palabrasA.length >= 0.5;
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
    // Verificar que el archivo de Commons corresponda al lugar (el título del
    // archivo debe mencionar el nombre). Evita fotos de otra ciudad.
    const tituloArchivo = (primera?.title || "").replace(/^File:|\.[a-z]+$/gi, "");
    if (!tituloCoincide(nombre, tituloArchivo)) return null;
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
