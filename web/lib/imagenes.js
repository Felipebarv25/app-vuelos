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
// Estrategia en cascada para MAXIMA cobertura (no-negociable 2026-07-11:
// "en todos los lugares debe haber foto"):
//  1) Wikipedia (artículo con imagen) — lugares famosos, además trae descripción.
//  2) Wikimedia Commons por TEXTO — muchos más lugares (sin artículo).
//  3) Wikimedia Commons por GEOLOCALIZACION — fotos tomadas EN las coordenadas
//     del lugar (radio 150m). Cubre los POIs sin artículo ni título que
//     coincida: la foto es del sitio real, tomada ahí.
// coord = [lat, lon] opcional; sin coord la cascada llega hasta el paso 2.
export async function fotoDeLugar(nombre, ciudad = "", coord = null, wd = null) {
  // img5: clave nueva — cascada con Wikidata P18 (nivel 0) y Openverse.
  const clave = `img5:${nombre}|${ciudad}`.toLowerCase();
  return cacheado(
    clave,
    TTL,
    async () => {
      // 0) Wikidata P18: la imagen OFICIAL de la entidad. Muchos lugares
      // traen su QID desde OSM/precalc (`wd`) y es la señal más precisa que
      // existe — cero riesgo de foto equivocada.
      if (wd) {
        const oficial = await fotoWikidata(wd);
        if (oficial?.url) return oficial;
      }
      // 1) Wikipedia
      const wiki = await fotoWikipedia(nombre, ciudad);
      if (wiki?.url) return wiki;
      // 2) Wikimedia Commons por texto (respaldo: muchas más fotos)
      const commons = await fotoCommons(nombre, ciudad);
      if (commons?.url) return { ...commons, extracto: wiki?.extracto || null };
      // 3) Commons por coordenadas: fotos hechas en el sitio exacto.
      if (coord?.length === 2) {
        const geo = await fotoCommonsGeo(coord[0], coord[1]);
        if (geo?.url) return { ...geo, extracto: wiki?.extracto || null };
        // 4) Mapillary (nivel calle): cubre bares/discotecas/tiendas que
        // Commons no tiene. Via nuestro endpoint (token server-side). Si no
        // hay MAPILLARY_TOKEN configurado, responde ok:false y seguimos.
        const calle = await fotoCalle(coord[0], coord[1]);
        if (calle?.url) return { ...calle, extracto: wiki?.extracto || null };
      }
      // 5) Openverse (CC search de WordPress: Flickr y otras fuentes libres,
      // sin API key). Con verificación de título para no colar fotos ajenas.
      const ov = await fotoOpenverse(nombre, ciudad);
      if (ov?.url) return { ...ov, extracto: wiki?.extracto || null };
      // 6) Sin foto: devolvemos la descripción si la había
      return wiki || null;
    },
    // Solo cachear si conseguimos una URL de foto; si no, reintentar luego.
    (d) => !!(d && d.url)
  );
}

// Imagen oficial de una entidad Wikidata (propiedad P18) → URL directa via
// Special:FilePath (redirige al archivo en Commons; ?width= lo sirve ya
// escalado). Es la fuente MÁS precisa: la comunidad eligió esa foto para
// representar exactamente ese lugar.
async function fotoWikidata(qid) {
  try {
    const r = await fetchRapido(
      `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(qid)}&property=P18&format=json&origin=*`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const archivo = d?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!archivo || esImagenMala(archivo)) return null;
    return {
      url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(archivo)}?width=800`,
      ancho: 800,
      link: `https://www.wikidata.org/wiki/${qid}`,
    };
  } catch {
    return null;
  }
}

// Openverse (api.openverse.org): buscador de imágenes con licencia libre
// (agrega Flickr CC, Wikimedia y más). Sin API key (rate limit anónimo
// generoso para nuestro volumen con caché de 30 días). Verificamos que el
// título corresponda al lugar para no colar resultados ajenos.
async function fotoOpenverse(nombre, ciudad) {
  try {
    const q = ciudad ? `${nombre} ${ciudad}` : nombre;
    const r = await fetchRapido(
      `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&page_size=8&mature=false&filter_dead=false`
    );
    if (!r.ok) return null;
    const d = await r.json();
    for (const img of d?.results || []) {
      const url = img?.url || img?.thumbnail;
      if (!url || esImagenMala(url)) continue;
      if (!tituloCoincide(nombre, img?.title || "")) continue;
      return { url, ancho: img?.width || null, link: img?.foreign_landing_url || null };
    }
    return null;
  } catch {
    return null;
  }
}

// Foto a nivel de calle via /api/foto-calle (Mapillary, token en el server).
async function fotoCalle(lat, lon) {
  try {
    const r = await fetchRapido(`/api/foto-calle?lat=${lat}&lon=${lon}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d?.ok && d.url ? { url: d.url, ancho: 1024, link: null } : null;
  } catch {
    return null;
  }
}

// Fotos de Commons GEOETIQUETADAS cerca de [lat, lon]. No dependen del nombre:
// son fotos que alguien tomó parado en ese lugar. Radio corto (150m) para no
// traer la cuadra de al lado. Se prefieren archivos JPG grandes y se filtran
// mapas/escudos igual que el resto.
async function fotoCommonsGeo(lat, lon) {
  try {
    const r = await fetchRapido(
      `https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*` +
        `&generator=geosearch&ggscoord=${lat}%7C${lon}&ggsradius=150&ggslimit=10&ggsnamespace=6` +
        `&prop=imageinfo&iiprop=url|size&iiurlwidth=800`
    );
    if (!r.ok) return null;
    const d = await r.json();
    const paginas = Object.values(d.query?.pages || {});
    if (!paginas.length) return null;
    // Mejor candidata: no-mala, suficientemente grande, la más grande primero.
    const candidatas = paginas
      .map((p) => p?.imageinfo?.[0])
      .filter((i) => i && (i.thumburl || i.url) && !esImagenMala(i.thumburl || i.url))
      .filter((i) => (i.width || 0) >= 500)
      .sort((a, b) => (b.width || 0) - (a.width || 0));
    const mejor = candidatas[0];
    if (!mejor) return null;
    return {
      url: mejor.thumburl || mejor.url,
      ancho: mejor.thumbwidth || mejor.width || null,
      link: mejor.descriptionurl || null,
    };
  } catch {
    return null;
  }
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

// Coincidencia mas suave para galerias: basta con que UNA palabra significativa
// se solape. Asi traemos varios angulos del mismo lugar (la API a veces titula
// como "Side view of X" o "Detail of X night") sin descartar todo.
function tituloCoincideSuave(nombreLugar, titulo) {
  const a = norm(nombreLugar);
  const b = norm(titulo);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const palabrasA = a.split(" ").filter((w) => w.length > 3);
  const palabrasB = new Set(b.split(" ").filter((w) => w.length > 3));
  return palabrasA.some((w) => palabrasB.has(w));
}

// Variante que devuelve VARIAS fotos validas (para galeria). limite = 5 ideal.
async function fotosCommons(nombre, ciudad, limite = 5, suave = false) {
  try {
    const q = ciudad ? `${nombre} ${ciudad}` : nombre;
    const r = await fetchRapido(
      `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit=30&gsrsearch=${encodeURIComponent(
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
    const aceptar = suave ? tituloCoincideSuave : tituloCoincide;
    for (const pag of candidatos) {
      const info = pag?.imageinfo?.[0];
      const url = info?.thumburl || info?.url || null;
      if (!url || esImagenMala(url)) continue;
      if (yaVistas.has(url)) continue;
      const tituloArchivo = (pag?.title || "").replace(/^File:|\.[a-z]+$/gi, "");
      if (!aceptar(nombre, tituloArchivo)) continue;
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
// gal2: clave nueva tras pasar a busqueda permisiva (suave) — la v1 podia
// cachear arrays casi vacios para lugares con titulos largos.
export async function galeriaDeLugar(nombre, ciudad = "", limite = 5) {
  const clave = `gal2:${nombre}|${ciudad}|${limite}`.toLowerCase();
  return cacheado(
    clave,
    TTL,
    async () => {
      // Estricto primero (= la foto principal); si trae poco, complementamos con
      // busqueda suave (cualquier palabra significativa) hasta llegar al limite.
      const estrictas = await fotosCommons(nombre, ciudad, limite, false);
      let urls = estrictas.map((f) => f.url);
      if (urls.length < limite) {
        const suaves = await fotosCommons(nombre, ciudad, limite, true);
        const yaVistas = new Set(urls);
        for (const f of suaves) {
          if (yaVistas.has(f.url)) continue;
          yaVistas.add(f.url);
          urls.push(f.url);
          if (urls.length >= limite) break;
        }
      }
      return { urls };
    },
    (d) => !!(d && d.urls && d.urls.length > 0)
  );
}
