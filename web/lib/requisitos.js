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

// ============================================================================
// QW3 — Mejor época para viajar por país. Datos orientativos basados en clima,
// temporada turística y costo. Para países sin datos específicos, fallback por
// hemisferio usando la latitud.
// ============================================================================
const MEJOR_EPOCA_PAIS = {
  // Europa
  ES: { mejor: "Mayo–junio · septiembre–octubre", evitar: "Julio–agosto (calor + alta temporada)", clima: "Mediterráneo" },
  FR: { mejor: "Mayo–junio · septiembre–octubre", evitar: "Julio–agosto (todo más caro)", clima: "Templado" },
  IT: { mejor: "Abril–junio · septiembre–octubre", evitar: "Julio–agosto", clima: "Mediterráneo" },
  GB: { mejor: "Mayo–septiembre", evitar: "Diciembre–febrero (frío + lluvia)", clima: "Templado lluvioso" },
  DE: { mejor: "Mayo–septiembre", evitar: "Noviembre–febrero (frío)", clima: "Templado continental" },
  NL: { mejor: "Abril–septiembre", evitar: "Diciembre–febrero", clima: "Templado marítimo" },
  PT: { mejor: "Mayo–septiembre", evitar: "Diciembre–febrero", clima: "Mediterráneo atlántico" },
  GR: { mejor: "Mayo–junio · septiembre–octubre", evitar: "Julio–agosto", clima: "Mediterráneo" },
  CH: { mejor: "Junio–septiembre (verano) · enero–marzo (ski)", clima: "Alpino" },
  AT: { mejor: "Mayo–septiembre · diciembre (Navidad) · enero–marzo (ski)", clima: "Continental alpino" },
  TR: { mejor: "Abril–junio · septiembre–noviembre", evitar: "Julio–agosto", clima: "Mediterráneo/continental" },
  // Asia
  JP: { mejor: "Marzo–mayo (sakura) · octubre–noviembre (otoño)", evitar: "Junio (lluvias) · agosto (calor)", clima: "Templado con 4 estaciones" },
  TH: { mejor: "Noviembre–febrero (seca y fresca)", evitar: "Mayo–octubre (monzón)", clima: "Tropical" },
  SG: { mejor: "Febrero–abril", evitar: "Noviembre–enero (monzón)", clima: "Tropical ecuatorial" },
  ID: { mejor: "Mayo–septiembre (seca)", evitar: "Diciembre–marzo (lluvias)", clima: "Tropical" },
  VN: { mejor: "Octubre–abril (norte) · enero–agosto (sur)", clima: "Tropical, varía mucho por región" },
  KR: { mejor: "Marzo–mayo · septiembre–noviembre", evitar: "Diciembre–febrero (frío)", clima: "Templado con 4 estaciones" },
  CN: { mejor: "Abril–junio · septiembre–octubre", evitar: "Julio–agosto (calor y multitudes)", clima: "Muy variable según región" },
  IN: { mejor: "Noviembre–marzo (seca, fresca)", evitar: "Abril–junio (calor) · julio–septiembre (monzón)", clima: "Variable según región" },
  // Oriente Medio
  AE: { mejor: "Noviembre–marzo", evitar: "Junio–septiembre (calor extremo)", clima: "Desértico" },
  IL: { mejor: "Marzo–mayo · septiembre–noviembre", evitar: "Julio–agosto (calor)", clima: "Mediterráneo/desértico" },
  // América
  US: { mejor: "Depende del estado (varía mucho)", clima: "Variable según estado" },
  CA: { mejor: "Junio–septiembre (verano)", evitar: "Diciembre–febrero (frío extremo)", clima: "Frío continental" },
  MX: { mejor: "Noviembre–abril (seca)", evitar: "Junio–octubre (huracanes en costa)", clima: "Variable por región" },
  AR: { mejor: "Marzo–mayo · septiembre–noviembre", evitar: "Diciembre–febrero (verano austral en BA)", clima: "Templado austral" },
  BR: { mejor: "Abril–junio · septiembre–octubre", evitar: "Diciembre–marzo (lluvias)", clima: "Tropical (varía por región)" },
  CL: { mejor: "Septiembre–marzo (verano austral)", evitar: "Mayo–julio (invierno)", clima: "Variado (desierto a Patagonia)" },
  PE: { mejor: "Mayo–septiembre (seca, ideal para Machu Picchu)", evitar: "Diciembre–marzo (lluvias en sierra)", clima: "Costa árida · sierra estacional · selva tropical" },
  CO: { mejor: "Diciembre–marzo · julio–agosto", evitar: "Abril–mayo · octubre–noviembre (lluvias)", clima: "Tropical (no hay 4 estaciones)" },
  EC: { mejor: "Junio–septiembre · diciembre (seca)", clima: "Tropical (varía por altura)" },
  CR: { mejor: "Diciembre–abril (seca)", evitar: "Septiembre–octubre (más lluvias)", clima: "Tropical" },
  DO: { mejor: "Diciembre–abril", evitar: "Agosto–octubre (huracanes)", clima: "Tropical" },
  CU: { mejor: "Noviembre–abril", evitar: "Junio–noviembre (huracanes)", clima: "Tropical" },
  // Oceanía
  AU: { mejor: "Marzo–mayo · septiembre–noviembre", clima: "Variable (norte tropical · sur templado)" },
  NZ: { mejor: "Diciembre–febrero (verano austral) · julio–agosto (ski)", clima: "Templado oceánico" },
  // África
  EG: { mejor: "Octubre–abril", evitar: "Junio–agosto (calor extremo)", clima: "Desértico" },
  MA: { mejor: "Marzo–mayo · septiembre–noviembre", evitar: "Julio–agosto (calor) · diciembre–febrero (frío en montañas)", clima: "Mediterráneo/desértico" },
  ZA: { mejor: "Mayo–septiembre (seca, mejor para safaris)", clima: "Templado (estaciones invertidas)" },
};

const MEJOR_EPOCA_FALLBACK = {
  norte: { mejor: "Primavera (mar–may) · otoño (sep–nov)", evitar: "Invierno (dic–feb) si buscas calor", clima: "Estaciones marcadas (verano caliente · invierno frío)" },
  sur: { mejor: "Otoño austral (mar–may) · primavera austral (sep–nov)", evitar: "Invierno austral (jun–ago)", clima: "Estaciones invertidas vs. hemisferio norte" },
  tropical: { mejor: "Temporada seca (varía por región)", evitar: "Temporada de lluvias", clima: "Cálido todo el año" },
};

export function mejorEpoca(destinoIso, lat) {
  if (MEJOR_EPOCA_PAIS[destinoIso]) return MEJOR_EPOCA_PAIS[destinoIso];
  if (lat == null) return null;
  if (Math.abs(lat) <= 23.5) return MEJOR_EPOCA_FALLBACK.tropical;
  return lat > 0 ? MEJOR_EPOCA_FALLBACK.norte : MEJOR_EPOCA_FALLBACK.sur;
}

// ============================================================================
// QW4 — Autorización electrónica previa (ETIAS / ESTA / eTA / etc.) según
// pasaporte y destino. Datos orientativos con enlace a la fuente oficial; el
// usuario debe confirmar en el sitio del gobierno antes de viajar.
// ============================================================================

// Países del Espacio Schengen (ETIAS aplicará cuando esté operativo).
const SCHENGEN = new Set([
  "AT", "BE", "CH", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR", "HU",
  "IS", "IT", "LI", "LT", "LU", "LV", "MT", "NL", "NO", "PL", "PT", "SE", "SI", "SK",
  "BG", "RO", // entraron Schengen en 2024
]);

// Nacionalidades visa-exempt para Schengen (necesitarán ETIAS).
// Lista de ~60 países; aproximada. Fuente: home affairs UE.
const VISAEXEMPT_SCHENGEN = new Set([
  // Latam
  "CO", "PE", "AR", "BR", "CL", "MX", "EC", "PA", "CR", "GT", "HN", "SV", "NI", "UY", "PY", "VE",
  // Norteamérica
  "US", "CA",
  // Asia
  "JP", "KR", "SG", "MY", "BN", "TW", "HK", "MO", "IL", "AE", "QA", "GE", "MD", "MN",
  // Oceanía y Pacífico
  "AU", "NZ", "TL",
  // Europa no UE
  "GB", "AL", "BA", "MK", "ME", "RS", "UA", "AD", "MC", "SM", "VA", "LI", "CH",
  // Otros
  "PS", // status especial
]);

// US Visa Waiver Program — necesitan ESTA.
const VWP_EEUU = new Set([
  "AT", "AU", "BE", "BG", "CL", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE",
  "GR", "HU", "IS", "IE", "IL", "IT", "JP", "KR", "LV", "LI", "LT", "LU", "MT",
  "MC", "NL", "NZ", "NO", "PL", "PT", "QA", "RO", "SM", "SG", "SK", "SI", "ES",
  "SE", "CH", "TW", "GB", "AD",
]);

// Canadá eTA — visa-exempt countries.
const ETA_CANADA = new Set([
  "AT", "AU", "BE", "BR" /* parcial */, "CL", "TW", "HR", "CY", "CZ", "DK", "EE",
  "FI", "FR", "DE", "GR", "HU", "IS", "IE", "IL", "IT", "JP", "KR", "LV", "LI",
  "LT", "LU", "MT", "MX", "MC", "NL", "NZ", "NO", "PL", "PT", "RO", "SM", "SG",
  "SK", "SI", "ES", "SE", "CH", "AE", "GB", "AD", "VA",
]);

// UK ETA — lista en expansión (2024-2025).
const UK_ETA = new Set([
  "QA", "BH", "JO", "KW", "OM", "SA", "AE",
  "AU", "CA", "US", "NZ", "JP", "KR", "SG", "TW", "HK", "MO", "IL",
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "MC", "NL", "NO", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "CH", "VA", "AD", "SM", "BR", "CL", "MX", "AR",
]);

// Australia ETA / eVisitor
const AUS_ETA = new Set(["US", "CA", "JP", "KR", "SG", "MY", "BN", "HK", "TW"]);
const AUS_EVISITOR = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "MC", "NL", "NO", "PL", "PT",
  "RO", "SM", "SK", "SI", "ES", "SE", "CH", "VA", "AD",
]);

// Nueva Zelanda NZeTA.
const NZ_ETA = new Set([
  "US", "CA", "GB", "JP", "KR", "SG", "MY", "BN", "TW", "HK",
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU",
  "IS", "IE", "IT", "LV", "LI", "LT", "LU", "MT", "MC", "NL", "NO", "PL", "PT",
  "RO", "SM", "SK", "SI", "ES", "SE", "CH", "VA", "AD", "IL", "AE",
]);

export function autorizacionElectronica(destinoIso, nacionalidadIso) {
  if (!destinoIso || !nacionalidadIso || destinoIso === nacionalidadIso) return null;

  // 1) Schengen → ETIAS
  if (SCHENGEN.has(destinoIso) && VISAEXEMPT_SCHENGEN.has(nacionalidadIso)) {
    return {
      tipo: "ETIAS",
      nombre: "ETIAS — Sistema Europeo de Información y Autorización de Viajes",
      url: "https://travel-europe.europa.eu/etias_en",
      pais: "Espacio Schengen",
      nota: "Operativo a finales de 2026. Costo ~7€. Vigencia 3 años.",
    };
  }
  // 2) US → ESTA
  if (destinoIso === "US" && VWP_EEUU.has(nacionalidadIso)) {
    return {
      tipo: "ESTA",
      nombre: "ESTA — Electronic System for Travel Authorization",
      url: "https://esta.cbp.dhs.gov/",
      pais: "Estados Unidos",
      nota: "Costo 21 USD. Vigencia 2 años o hasta que expire el pasaporte.",
    };
  }
  // 3) Canadá → eTA
  if (destinoIso === "CA" && ETA_CANADA.has(nacionalidadIso)) {
    return {
      tipo: "eTA",
      nombre: "eTA — Electronic Travel Authorization",
      url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html",
      pais: "Canadá",
      nota: "Costo 7 CAD. Vigencia 5 años o hasta que expire el pasaporte.",
    };
  }
  // 4) UK → UK ETA
  if (destinoIso === "GB" && UK_ETA.has(nacionalidadIso)) {
    return {
      tipo: "UK ETA",
      nombre: "UK ETA — Electronic Travel Authorisation",
      url: "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta",
      pais: "Reino Unido",
      nota: "Costo £16. Vigencia 2 años.",
    };
  }
  // 5) Australia → ETA / eVisitor
  if (destinoIso === "AU") {
    if (AUS_ETA.has(nacionalidadIso)) {
      return {
        tipo: "ETA",
        nombre: "ETA — Electronic Travel Authority (Subclass 601)",
        url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601",
        pais: "Australia",
        nota: "Costo 20 AUD. Estancias de hasta 3 meses.",
      };
    }
    if (AUS_EVISITOR.has(nacionalidadIso)) {
      return {
        tipo: "eVisitor",
        nombre: "eVisitor — Subclass 651",
        url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/evisitor-651",
        pais: "Australia",
        nota: "Gratuita. Estancias de hasta 3 meses.",
      };
    }
  }
  // 6) Nueva Zelanda → NZeTA
  if (destinoIso === "NZ" && NZ_ETA.has(nacionalidadIso)) {
    return {
      tipo: "NZeTA",
      nombre: "NZeTA — New Zealand Electronic Travel Authority",
      url: "https://www.immigration.govt.nz/new-zealand-visas/apply-for-a-visa/about-visa/nzeta",
      pais: "Nueva Zelanda",
      nota: "Costo 17–23 NZD. Vigencia 2 años.",
    };
  }
  return null;
}
