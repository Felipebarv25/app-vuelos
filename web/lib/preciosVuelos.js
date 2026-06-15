// Carga los precios REALES de vuelos i/v desde Colombia (BOG/MDE) que produce
// el detector de vuelos (`/ofertas.json`) y los expone como un mapa por destino,
// para que el módulo de presupuesto pueda usar precio real en vez del estimado.
//
// Devuelve un mapa con la llave "Ciudad|País" (igual que llaveCiudad de
// presupuesto.js). Cada entrada elige la MEJOR oferta entre BOG y MDE.

import { iataDe, iataAltDe } from "./iataCiudades";

let cache = null;
let promesaEnCurso = null;
// Cache en memoria de búsquedas EN VIVO por (ciudad|pais) durante la sesión.
const cacheVivo = new Map();

function normalizar(s = "") {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

// Algunos nombres del detector difieren del catálogo del presupuesto
// (acentos, variantes). Mapeo manual para los casos que NO se resuelven con
// normalización simple. Llave = "ciudad|pais" del detector → del presupuesto.
const ALIAS = {
  "ciudad de mexico|mexico": "Ciudad de México|México",
  "rio de janeiro|brasil": "Río de Janeiro|Brasil",
  "sao paulo|brasil": "São Paulo|Brasil",
  "nueva york|estados unidos": "Nueva York|Estados Unidos",
  "los angeles|estados unidos": "Los Ángeles|Estados Unidos",
  "tokio|japon": "Tokio|Japón",
  "pekin|china": "Pekín|China",
  "shanghai|china": "Shanghái|China",
  "munich|alemania": "Múnich|Alemania",
  "atenas|grecia": "Atenas|Grecia",
  "estambul|turquia": "Estambul|Turquía",
  "panama|panama": "Ciudad de Panamá|Panamá",
  "habana|cuba": "La Habana|Cuba",
  "san jose|costa rica": "San José|Costa Rica",
};

function llaveDestino(ciudad, pais) {
  const k = normalizar(ciudad) + "|" + normalizar(pais);
  return ALIAS[k] || `${ciudad}|${pais}`;
}

// Lee /ofertas.json y devuelve { llave → { porOrigen: { BOG, MDE }, mejor: oferta } }.
// `porOrigen` guarda la oferta vigente para CADA base de Colombia (antes solo
// se conservaba la mas barata, perdiendo info para la recomendacion "desde X
// ahorras Y"). `mejor` apunta a la mas barata como atajo de compatibilidad.
// Cachea el resultado en memoria; si falla devuelve {} (el presupuesto seguira
// usando los estimados sin romperse).
export async function obtenerPreciosReales() {
  if (cache) return cache;
  if (promesaEnCurso) return promesaEnCurso;

  promesaEnCurso = (async () => {
    try {
      const r = await fetch("/ofertas.json", { cache: "no-store" });
      if (!r.ok) throw new Error("ofertas.json " + r.status);
      const data = await r.json();
      const mapa = {};
      for (const ruta of data.rutas || []) {
        const llave = llaveDestino(ruta.ciudad, ruta.pais);
        const oferta = {
          precio: ruta.precio,
          fecha_ida: ruta.fecha_ida,
          fecha_vuelta: ruta.fecha_vuelta,
          link: ruta.link,
          origen: ruta.origen,
          visto: ruta.visto,
          generado: data.generado,
        };
        if (!mapa[llave]) mapa[llave] = { porOrigen: {}, mejor: null };
        // Conserva por origen (solo la mas barata si llegan varias muestras de la misma base).
        const anteriorMismaBase = mapa[llave].porOrigen[ruta.origen];
        if (!anteriorMismaBase || ruta.precio < anteriorMismaBase.precio) {
          mapa[llave].porOrigen[ruta.origen] = oferta;
        }
        if (!mapa[llave].mejor || oferta.precio < mapa[llave].mejor.precio) {
          mapa[llave].mejor = oferta;
        }
      }
      cache = mapa;
      return mapa;
    } catch {
      cache = {};
      return cache;
    } finally {
      promesaEnCurso = null;
    }
  })();

  return promesaEnCurso;
}

// Helper: devuelve la oferta para el destino y origen pedidos, con fallback
// a la mejor disponible si no hay match exacto. La logica que llama lo usa
// para mostrar "💡 Desde X ahorras Y" comparando con `mejor`.
export function ofertaParaOrigen(mapa, llave, origen) {
  const reg = mapa?.[llave];
  if (!reg) return null;
  if (origen && reg.porOrigen?.[origen]) return reg.porOrigen[origen];
  return reg.mejor || null;
}

// Busca el precio i/v EN VIVO desde Colombia (BOG/MDE) para un destino del
// catálogo, llamando al endpoint /api/vuelo-vivo (Travelpayouts server-side).
// Devuelve la oferta o null. Cachea por (ciudad|pais) durante la sesión.
export async function buscarVueloEnVivo(ciudad, pais) {
  const llave = `${ciudad}|${pais}`;
  if (cacheVivo.has(llave)) return cacheVivo.get(llave);

  const iata = iataDe(ciudad, pais);
  if (!iata) {
    cacheVivo.set(llave, null);
    return null;
  }
  const iata2 = iataAltDe(ciudad, pais);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 18000);
    const qs = iata2 ? `iata=${iata}&iata2=${iata2}` : `iata=${iata}`;
    const r = await fetch(`/api/vuelo-vivo?${qs}`, { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) {
      cacheVivo.set(llave, null);
      return null;
    }
    const data = await r.json();
    if (!data.encontrado) {
      cacheVivo.set(llave, null);
      return null;
    }
    const oferta = {
      precio: data.precio,
      fecha_ida: data.fecha_ida,
      fecha_vuelta: data.fecha_vuelta,
      link: data.link,
      origen: data.origen,
      visto: data.visto,
      vivo: true, // distinguir del precio estático del detector
    };
    cacheVivo.set(llave, oferta);
    return oferta;
  } catch {
    cacheVivo.set(llave, null);
    return null;
  }
}
