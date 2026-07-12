// Foto representativa de una ciudad. Cascada en orden de precisión:
//   1) Wikipedia REST (ES → EN → "Ciudad, País" EN) — ya filtra escudos/mapas.
//   2) Wikimedia Commons búsqueda por texto — cubre ciudades sin artículo rico.
//   3) Wikimedia Commons por geoetiquetas — fotos tomadas cerca del centro.
//   4) Openverse (Flickr CC y otras fuentes libres bajo licencia abierta).
// Devuelve { url, ancho, alto, articulo } o null (el componente usa gradiente).
// Reutiliza fotoCommons / fotoCommonsGeo / fotoOpenverse de imagenes.js
// para no duplicar lógica de red ni filtros de imágenes malas.

import { fotoCommons, fotoCommonsGeo, fotoOpenverse } from "./imagenes";

const UA = "Anduve/1.0 (https://anduve-app.vercel.app)";
const TTL = 60 * 60 * 24 * 30; // 30 días en segundos

// Imagenes que NO venden un viaje: escudos, banderas, mapas, sellos, logos.
// Varios artículos de ciudades en es.wikipedia llevan el escudo como imagen
// principal. Si el nombre del archivo delata uno de estos, descartamos y
// probamos el siguiente candidato (en.wikipedia suele tener skyline/panorámica).
const RE_IMAGEN_MALA = /escudo|coat[_ %]?of[_ %]?arms|flag|bandera|seal|sello|logo|emblem|crest|mapa|map[_ .]|locator|montage|collage|blason/i;

async function pedirWiki(wiki, titulo) {
  const url = `https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(titulo)}`;
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: TTL },
    });
    if (!r.ok) return null;
    const d = await r.json();
    const img = d.originalimage?.source || d.thumbnail?.source || null;
    if (!img) return null;
    let nombreArchivo = img;
    try { nombreArchivo = decodeURIComponent(img); } catch {}
    if (RE_IMAGEN_MALA.test(nombreArchivo)) return null;
    // Atribución requerida por la licencia de Wikipedia/Commons: devolvemos
    // también la URL del artículo origen para que el componente pueda
    // mostrar "Foto: Wikipedia" con link al artículo (cumple CC-BY/SA).
    return {
      url: img,
      ancho: d.originalimage?.width,
      alto: d.originalimage?.height,
      articulo: d.content_urls?.desktop?.page || `https://${wiki}.wikipedia.org/wiki/${encodeURIComponent(titulo)}`,
    };
  } catch {
    return null;
  }
}

// Adapta el formato {url, ancho, link} de imagenes.js al formato que
// usan los componentes de /destino: {url, ancho, alto, articulo}.
function normalizar(f) {
  if (!f?.url) return null;
  return { url: f.url, ancho: f.ancho || null, alto: null, articulo: f.link || null };
}

export async function fotoCiudad(ciudad, pais, lat = null, lon = null) {
  // 1) Wikipedia: ES → EN → "Ciudad, País" en inglés
  for (const [w, titulo] of [["es", ciudad], ["en", ciudad], ["en", `${ciudad}, ${pais}`]]) {
    const f = await pedirWiki(w, titulo);
    if (f?.url) return f;
  }
  // 2) Wikimedia Commons por búsqueda de texto
  const commons = await fotoCommons(ciudad, pais);
  if (commons?.url) return normalizar(commons);
  // 3) Commons por geoetiquetas (fotos tomadas cerca del centro de la ciudad)
  if (lat != null && lon != null) {
    const geo = await fotoCommonsGeo(lat, lon);
    if (geo?.url) return normalizar(geo);
  }
  // 4) Openverse: Flickr CC y otras fuentes libres
  const ov = await fotoOpenverse(ciudad, pais);
  if (ov?.url) return normalizar(ov);

  return null;
}
