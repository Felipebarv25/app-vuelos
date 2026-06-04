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

// --- Datos útiles del país (depositados en la web, sin enlaces externos) ---
export function infoPais(iso) {
  return PAISES_ISO[iso] || null;
}

// Nombres de idioma en inglés (REST Countries) -> español (los más comunes).
const IDIOMAS_ES = {
  Spanish: "Español", English: "Inglés", French: "Francés", Portuguese: "Portugués",
  Italian: "Italiano", German: "Alemán", Dutch: "Neerlandés", Japanese: "Japonés",
  "Mandarin Chinese": "Chino mandarín", Chinese: "Chino", Korean: "Coreano",
  Arabic: "Árabe", Russian: "Ruso", Turkish: "Turco", Greek: "Griego", Thai: "Tailandés",
  Hindi: "Hindi", Hebrew: "Hebreo", Polish: "Polaco", Czech: "Checo", Hungarian: "Húngaro",
  Swedish: "Sueco", Danish: "Danés", Norwegian: "Noruego", Finnish: "Finés",
  Vietnamese: "Vietnamita", Indonesian: "Indonesio", Malay: "Malayo", Croatian: "Croata",
  Romanian: "Rumano", Bulgarian: "Búlgaro", Ukrainian: "Ucraniano", Catalan: "Catalán",
  Persian: "Persa", Swahili: "Suajili", Filipino: "Filipino", Tagalog: "Tagalo",
};
export function idiomasEs(arr) {
  return (arr || []).map((x) => IDIOMAS_ES[x] || x);
}

// --- Enchufe / voltaje (datos estables, formato neutro: "V · Hz · tipos") ---
const ENCHUFES = {
  // Europa (230 V / 50 Hz)
  ES: "230 V · 50 Hz · C/F", FR: "230 V · 50 Hz · C/E", IT: "230 V · 50 Hz · C/F/L",
  GB: "230 V · 50 Hz · G", DE: "230 V · 50 Hz · C/F", NL: "230 V · 50 Hz · C/F",
  PT: "230 V · 50 Hz · C/F", CZ: "230 V · 50 Hz · C/E", AT: "230 V · 50 Hz · C/F",
  HU: "230 V · 50 Hz · C/F", GR: "230 V · 50 Hz · C/F", PL: "230 V · 50 Hz · C/E",
  CH: "230 V · 50 Hz · C/J", BE: "230 V · 50 Hz · C/E", IE: "230 V · 50 Hz · G",
  HR: "230 V · 50 Hz · C/F",
  // América
  US: "120 V · 60 Hz · A/B", CA: "120 V · 60 Hz · A/B", MX: "127 V · 60 Hz · A/B",
  CO: "110 V · 60 Hz · A/B", PE: "220 V · 60 Hz · A/C", EC: "120 V · 60 Hz · A/B",
  CL: "220 V · 50 Hz · C/L", AR: "220 V · 50 Hz · C/I", BR: "127/220 V · 60 Hz · C/N",
  UY: "230 V · 50 Hz · C/F/L", BO: "230 V · 50 Hz · A/C", PY: "220 V · 50 Hz · C",
  VE: "120 V · 60 Hz · A/B", PA: "110 V · 60 Hz · A/B", CR: "120 V · 60 Hz · A/B",
  GT: "120 V · 60 Hz · A/B", CU: "110/220 V · 60 Hz · A/B/C", DO: "120 V · 60 Hz · A/B",
  // Asia / Oceanía / África / Medio Oriente
  JP: "100 V · 50/60 Hz · A/B", TH: "230 V · 50 Hz · A/B/C", AE: "230 V · 50 Hz · G",
  IN: "230 V · 50 Hz · C/D/M", CN: "220 V · 50 Hz · A/C/I", KR: "220 V · 60 Hz · C/F",
  ID: "230 V · 50 Hz · C/F", SG: "230 V · 50 Hz · G", TR: "230 V · 50 Hz · C/F",
  MA: "220 V · 50 Hz · C/E", EG: "220 V · 50 Hz · C/F", ZA: "230 V · 50 Hz · D/M/N",
  AU: "230 V · 50 Hz · I", NZ: "230 V · 50 Hz · I",
};
export function enchufe(iso) {
  return ENCHUFES[iso] || null;
}

// --- Estaciones según la latitud (dato factual del hemisferio) ---
export function estacionesClave(lat) {
  if (lat == null) return null;
  if (Math.abs(lat) <= 23.5) return "tropical";
  return lat > 0 ? "norte" : "sur";
}

// --- Agua del grifo (orientativo). potable | precaucion | no ---
const AGUA = {
  potable: ["US", "CA", "GB", "IE", "FR", "ES", "IT", "DE", "NL", "PT", "AT", "CH",
    "BE", "GR", "PL", "CZ", "HU", "HR", "JP", "KR", "SG", "AU", "NZ", "CL", "UY", "CO", "CR"],
  precaucion: ["BR", "AR", "PA", "ZA", "AE", "TR", "MA", "DO"],
  no: ["MX", "PE", "EC", "BO", "PY", "VE", "GT", "CU", "TH", "IN", "CN", "ID", "EG"],
};
const _agua = {};
for (const [k, arr] of Object.entries(AGUA)) for (const cc of arr) _agua[cc] = k;
export function aguaClave(iso) {
  return _agua[iso] || null;
}

// --- Propina habitual (orientativo). no | incluido | diez | veinte ---
const PROPINA = {
  no: ["JP", "KR", "CN", "SG", "TH"],
  incluido: ["FR", "ES", "IT", "DE", "NL", "PT", "AT", "CH", "BE", "GR", "PL", "CZ", "HU", "HR"],
  veinte: ["US", "CA"],
  diez: ["CO", "MX", "PE", "AR", "BR", "CL", "EC", "UY", "BO", "PY", "VE", "PA", "CR",
    "GT", "CU", "DO", "IN", "MA", "EG", "ZA", "AE", "TR", "ID", "GB", "IE"],
};
const _propina = {};
for (const [k, arr] of Object.entries(PROPINA)) for (const cc of arr) _propina[cc] = k;
export function propinaClave(iso) {
  return _propina[iso] || null;
}
