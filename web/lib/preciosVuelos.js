// Carga los precios REALES de vuelos i/v desde Colombia (BOG/MDE) que produce
// el detector de vuelos (`/ofertas.json`) y los expone como un mapa por destino,
// para que el módulo de presupuesto pueda usar precio real en vez del estimado.
//
// Devuelve un mapa con la llave "Ciudad|País" (igual que llaveCiudad de
// presupuesto.js). Cada entrada elige la MEJOR oferta entre BOG y MDE.

let cache = null;
let promesaEnCurso = null;

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

// Lee /ofertas.json y devuelve { llave → { precio, fecha_ida, fecha_vuelta, link, origen, visto, generado } }.
// Cachea el resultado en memoria; si falla devuelve {} (el presupuesto seguirá
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
        const actual = mapa[llave];
        // Si ya hay una oferta para esta ciudad (otra base), nos quedamos con la más barata.
        if (!actual || ruta.precio < actual.precio) {
          mapa[llave] = {
            precio: ruta.precio,
            fecha_ida: ruta.fecha_ida,
            fecha_vuelta: ruta.fecha_vuelta,
            link: ruta.link,
            origen: ruta.origen,
            visto: ruta.visto,
            generado: data.generado,
          };
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
