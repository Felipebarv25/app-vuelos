// Fotos de lugares — gratis y legal, vía Wikipedia (API REST pública).
// Devuelve una imagen atractiva del lugar para mostrar DENTRO de la app.

import { cacheado, fetchRapido } from "./cache";

const TTL = 1000 * 60 * 60 * 24 * 30; // 30 días

// Rechaza imágenes que NO son fotos del lugar: mapas de localización, banderas,
// escudos, logos y diagramas. En Wikipedia el "pageimage" de muchos artículos
// geográficos es justo el mapita del infobox (un municipio resaltado en rojo),
// que se veía feo en las tarjetas. Los SVG casi siempre son mapas/escudos/logos.
function esImagenMala(url) {
  if (!url) return true;
  const u = decodeURIComponent(url).toLowerCase();
  if (/\.svg/.test(u)) return true; // mapas, banderas, escudos, logos
  return /locator|location[_ ]?map|locali[zs]a|\bmapa\b|\bmap\b|boundary|escudo|coat[_ ]of[_ ]arms|flag[_ ]of|bandera|\.ogg|\.ogv/.test(u);
}

// Busca la mejor foto para "nombre" (en una ciudad para desambiguar).
// Estrategia en cascada para maximizar cobertura de fotos:
//  1) Wikipedia (artículo con imagen) — lugares famosos, además trae descripción.
//  2) Wikimedia Commons — fotos de muchos más lugares (sin necesidad de artículo).
export async function fotoDeLugar(nombre, ciudad = "") {
  // img3: clave nueva (la anterior podía haber cacheado mapas de localización /
  // escudos. Ahora descartamos esas imágenes y solo cacheamos fotos reales).
  const clave = `img3:${nombre}|${ciudad}`.toLowerCase();
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

// UNA sola llamada a Wikipedia: busca el artículo y, de paso, trae su miniatura
// y un extracto. Antes eran 2 peticiones secuenciales (buscar título + resumen);
// con `generator=search` + `prop=pageimages|extracts` obtenemos todo de una,
// lo que reduce a la mitad la red al cargar muchas fotos (landing/itinerario).
async function fotoWikipedia(nombre, ciudad) {
  try {
    const q = ciudad ? `${nombre} ${ciudad}` : nombre;
    const r = await fetchRapido(
      `https://es.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
        `&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrlimit=1` +
        `&prop=pageimages|extracts&piprop=thumbnail&pithumbsize=800` +
        `&exintro=1&explaintext=1&exsentences=2`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const pagina = Object.values(d.query?.pages || {})[0];
    if (!pagina) return null;
    // VERIFICACIÓN DE RELEVANCIA: el artículo encontrado debe corresponder de
    // verdad al lugar. Si no, Wikipedia trae artículos no relacionados (ej.
    // "77 Towers" devolvía el de Nueva York). Mejor sin foto que con foto errada.
    if (!tituloCoincide(nombre, pagina.title)) return null;
    // Las páginas de desambiguación no son un lugar: ni su foto ni su extracto sirven.
    const esDesambiguacion =
      /\(desambiguaci/i.test(pagina.title || "") ||
      /puede referirse a/i.test(pagina.extract || "");
    const fuente = pagina.thumbnail?.source;
    const url = !esImagenMala(fuente) ? fuente : null;
    return {
      url: url || null,
      ancho: url ? pagina.thumbnail?.width || null : null,
      extracto: esDesambiguacion ? null : pagina.extract || null,
      link: `https://es.wikipedia.org/wiki/${encodeURIComponent(pagina.title)}`,
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
  const lista = await fotosCommons(nombre, ciudad, 1);
  return lista?.[0] || null;
}

// Variante que devuelve VARIAS fotos validas (para galeria). limite = 5 ideal.
async function fotosCommons(nombre, ciudad, limite = 5) {
  try {
    const q = ciudad ? `${nombre} ${ciudad}` : nombre;
    const r = await fetchRapido(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=20&gsrsearch=${encodeURIComponent(
        q
      )}&prop=imageinfo&iiprop=url&iiurlwidth=1200&format=json&origin=*`
    );
    if (!r.ok) return [];
    const d = await r.json();
    const paginas = d.query?.pages;
    if (!paginas) return [];
    const candidatos = Object.values(paginas).sort(
      (a, b) => (a.index || 0) - (b.index || 0)
    );
    const out = [];
    const yaVistas = new Set();
    for (const pag of candidatos) {
      const info = pag?.imageinfo?.[0];
      const url = info?.thumburl || info?.url || null;
      if (!url || esImagenMala(url)) continue;
      if (yaVistas.has(url)) continue;
      const tituloArchivo = (pag?.title || "").replace(/^File:|\.[a-z]+$/gi, "");
      if (!tituloCoincide(nombre, tituloArchivo)) continue;
      yaVistas.add(url);
      out.push({ url, ancho: info?.thumbwidth || 1200, link: info?.descriptionurl || null });
      if (out.length >= limite) break;
    }
    return out;
  } catch {
    return [];
  }
}

// Galeria de un lugar: hasta `limite` fotos (~5) tomadas de Wikimedia Commons.
// Se cachea ~30 dias y NO solapa con `fotoDeLugar` (que cachea la principal).
// Devuelve { urls: string[] } o { urls: [] } si no encontro nada relevante.
export async function galeriaDeLugar(nombre, ciudad = "", limite = 5) {
  const clave = `gal1:${nombre}|${ciudad}|${limite}`.toLowerCase();
  return cacheado(
    clave,
    TTL,
    async () => {
      const fotos = await fotosCommons(nombre, ciudad, limite);
      return { urls: fotos.map((f) => f.url) };
    },
    (d) => !!(d && d.urls && d.urls.length > 0)
  );
}
