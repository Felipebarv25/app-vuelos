// Requisitos de entrada por país (visa, pasaporte, fiebre amarilla) a partir de
// datos abiertos y verídicos (Passport Index + REST Countries), servidos como
// estáticos. NUNCA inventamos: lo que no sabemos con certeza se remite a la
// fuente oficial. Estos datos son REFERENCIALES y deben verificarse antes de viajar.
import { PAISES_ISO } from "./paisesISO";

// --- Carga perezosa del dataset de visas (645 KB, una sola vez) ---
let _visas = null;
let _cargando = null;
export async function cargarVisas() {
  if (_visas) return _visas;
  if (_cargando) return _cargando;
  _cargando = fetch("/requisitos/visas.json")
    .then((r) => (r.ok ? r.json() : {}))
    .then((d) => (_visas = d))
    .catch(() => (_visas = {}));
  return _cargando;
}

// --- Lista de nacionalidades para el selector (ISO2 + nombre + bandera) ---
export function listaPaises() {
  return Object.entries(PAISES_ISO).map(([cc, info]) => ({ cc, ...info }));
}
export function nombrePais(cc) {
  return PAISES_ISO[cc]?.nombre || cc;
}
export function banderaPais(cc) {
  return PAISES_ISO[cc]?.bandera || "🌍";
}

// --- Nombre de país (en español, como lo da el geocoder) -> código ISO2 ---
function normaliza(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();
}
// Índice inverso nombre->cc + alias para variantes comunes del geocoder.
let _porNombre = null;
const ALIAS = {
  "estados unidos de america": "US",
  "estados unidos": "US",
  eeuu: "US",
  "reino unido": "GB",
  inglaterra: "GB",
  "gran bretana": "GB",
  "paises bajos": "NL",
  holanda: "NL",
  "republica checa": "CZ",
  chequia: "CZ",
  "corea del sur": "KR",
  "corea del norte": "KP",
  rusia: "RU",
  "emiratos arabes unidos": "AE",
  emiratos: "AE",
  "arabia saudita": "SA",
  "arabia saudi": "SA",
  turquia: "TR",
  "republica dominicana": "DO",
  "costa de marfil": "CI",
  birmania: "MM",
  vietnam: "VN",
  "ciudad del vaticano": "VA",
};
export function isoDesdeNombre(pais) {
  if (!pais) return null;
  if (!_porNombre) {
    _porNombre = {};
    for (const [cc, info] of Object.entries(PAISES_ISO)) {
      _porNombre[normaliza(info.nombre)] = cc;
    }
  }
  const n = normaliza(pais);
  return _porNombre[n] || ALIAS[n] || null;
}

// --- Interpretación del requisito de visa (valor crudo del dataset) ---
// Devuelve { tipo, color, dias? }. 'tipo' se traduce con t("req_"+tipo).
export function interpretarVisa(req) {
  if (req == null) return null;
  const s = String(req).trim();
  if (/^\d+$/.test(s)) return { tipo: "sinvisaDias", color: "emerald", dias: Number(s) };
  switch (s) {
    case "visa free":
      return { tipo: "sinvisa", color: "emerald" };
    case "visa on arrival":
      return { tipo: "llegada", color: "amber" };
    case "e-visa":
      return { tipo: "evisa", color: "amber" };
    case "eta":
      return { tipo: "eta", color: "amber" };
    case "visa required":
      return { tipo: "requerida", color: "rose" };
    case "no admission":
      return { tipo: "noadmision", color: "rose" };
    case "-1":
      return { tipo: "mismopais", color: "slate" };
    default:
      return { tipo: "desconocido", color: "slate" };
  }
}

// --- Fiebre amarilla: países con riesgo/exigencia de certificado (OMS/CDC) ---
// Se presenta como "puede exigirse certificado" + verificar en fuente oficial.
export const FIEBRE_AMARILLA = new Set([
  // África subsahariana
  "AO", "BJ", "BF", "BI", "CM", "CF", "TD", "CG", "CD", "CI", "GQ", "ER", "ET",
  "GA", "GM", "GH", "GN", "GW", "KE", "LR", "ML", "MR", "NE", "NG", "RW", "SN",
  "SL", "SS", "SD", "TG", "UG", "TZ", "ST", "ZM",
  // Sudamérica / Caribe tropical y Panamá
  "AR", "BO", "BR", "CO", "EC", "GF", "GY", "PA", "PY", "PE", "SR", "TT", "VE",
]);
export function exigeFiebreAmarilla(iso) {
  return FIEBRE_AMARILLA.has(iso);
}

// --- Enlaces a fuentes oficiales (verificación) ---
export function linkOficial(paisNombre, nacionalidadNombre) {
  const q = `requisitos de entrada a ${paisNombre} pasaporte ${nacionalidadNombre} sitio oficial embajada`;
  return "https://www.google.com/search?q=" + encodeURIComponent(q);
}
export function linkSalud(paisNombre) {
  const q = `vacunas y requisitos de salud para viajar a ${paisNombre} OMS`;
  return "https://www.google.com/search?q=" + encodeURIComponent(q);
}
