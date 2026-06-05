// Localización de nombres de POIs (lugares).
//
// El catálogo trae los nombres en español (precalc) o en el idioma local (OSM).
// Aquí ofrecemos:
//   · nombreLocalizado(lugar, lang): lee de lugar.nombres[lang] con fallback en
//     cascada → es → en → original.
//   · traducirLoteWD(lugares, lang): para los lugares con QID de Wikidata (id
//     "Q…" o tags.wikidata), consulta Wikidata wbgetentities en lotes de 50 y
//     escribe el label en lugar.nombres[lang]. Cachea en localStorage por
//     (qid|lang) con TTL 30 días. Devuelve true si MUTÓ algún lugar.

const TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 días
const CACHE_KEY = "nomwd:";

function leerCache(qid, lang) {
  try {
    const raw = localStorage.getItem(CACHE_KEY + qid + "|" + lang);
    if (!raw) return null;
    const { v, t } = JSON.parse(raw);
    if (Date.now() - t > TTL_MS) return null;
    return v; // puede ser "" (marcador de "no hay label en ese idioma")
  } catch {
    return null;
  }
}

function escribirCache(qid, lang, valor) {
  try {
    localStorage.setItem(
      CACHE_KEY + qid + "|" + lang,
      JSON.stringify({ v: valor, t: Date.now() })
    );
  } catch {
    // localStorage lleno o no disponible: seguir sin cache.
  }
}

export function nombreLocalizado(lugar, lang = "es") {
  if (!lugar) return "";
  const n = lugar.nombres || {};
  return n[lang] || n.es || n.en || lugar.nombre || "";
}

// Extrae QID de un lugar (id "Q…" del precalc, o tags.wikidata, o lugar.wd).
function qidDe(l) {
  if (!l) return null;
  if (l.wd && /^Q\d+$/.test(l.wd)) return l.wd;
  if (l.id && typeof l.id === "string") {
    const m = l.id.match(/Q\d+/);
    if (m) return m[0];
  }
  return null;
}

// Une los chunks en una sola llamada wbgetentities (Wikidata acepta hasta 50 ids).
async function pedirLabels(ids, lang) {
  const url =
    "https://www.wikidata.org/w/api.php?action=wbgetentities&ids=" +
    ids.join("|") +
    "&props=labels&languages=" + lang +
    "&format=json&origin=*";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return {};
    const d = await r.json();
    const out = {};
    for (const [qid, ent] of Object.entries(d.entities || {})) {
      out[qid] = ent.labels?.[lang]?.value || "";
    }
    return out;
  } catch {
    return {};
  }
}

// Traduce los nombres de la lista al idioma pedido (best-effort). Mutará el
// arreglo (asigna lugar.nombres[lang]) y devolverá true si hubo cambios para
// que el caller dispare re-render.
export async function traducirLoteWD(lugares, lang) {
  if (!Array.isArray(lugares) || !lang) return false;

  // Recopila QIDs pendientes (sin nombre en ese idioma y sin cache fresca).
  const pendientes = [];
  let cambio = false;

  for (const l of lugares) {
    if (!l) continue;
    l.nombres = l.nombres || {};
    if (l.nombres[lang]) continue;

    const qid = qidDe(l);
    if (!qid) continue;

    const cached = leerCache(qid, lang);
    if (cached !== null) {
      if (cached) {
        l.nombres[lang] = cached;
        cambio = true;
      }
      continue;
    }
    pendientes.push({ lugar: l, qid });
  }

  // Lotes de 50 QIDs por llamada.
  for (let i = 0; i < pendientes.length; i += 50) {
    const lote = pendientes.slice(i, i + 50);
    const ids = [...new Set(lote.map((p) => p.qid))];
    const labels = await pedirLabels(ids, lang);
    for (const { lugar, qid } of lote) {
      const v = labels[qid] || "";
      escribirCache(qid, lang, v);
      if (v) {
        lugar.nombres[lang] = v;
        cambio = true;
      }
    }
  }

  return cambio;
}
