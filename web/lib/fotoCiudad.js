// Foto representativa de una ciudad desde la API REST de Wikipedia.
// Devuelve la URL del "originalimage" del artículo. Cache:
//   · Next.js cachea el fetch (revalidate 30 días).
//   · La consulta cae al wiki español primero; si no hay, al inglés.
// Si todo falla, devuelve null y el componente usa el gradiente como fallback.

const UA = "Anduve/1.0 (https://anduve-app.vercel.app)";
const TTL = 60 * 60 * 24 * 30; // 30 días en segundos

// Imagenes que NO venden un viaje: escudos, banderas, mapas, sellos, logos.
// Varios articulos de ciudades (es.wikipedia "Madrid", p.ej.) llevan el
// ESCUDO como imagen principal — el usuario reporto que parece el logo de
// un equipo de futbol (2026-07-11). Si el nombre del archivo delata uno de
// estos, descartamos y probamos el siguiente candidato (en.wikipedia suele
// tener skyline/panoramica).
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

export async function fotoCiudad(ciudad, pais) {
  // Probar es → en → "Ciudad, País" en inglés.
  const candidatos = [
    ["es", ciudad],
    ["en", ciudad],
    ["en", `${ciudad}, ${pais}`],
  ];
  for (const [w, titulo] of candidatos) {
    const f = await pedirWiki(w, titulo);
    if (f?.url) return f;
  }
  return null;
}
