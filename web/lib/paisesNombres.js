// Nombres localizados de países + alias comunes para búsqueda tolerante.
//
// El catálogo PAISES_ISO tiene solo códigos ISO como "nombre" (bug del
// generador), así que aquí resolvemos nombres reales via Intl.DisplayNames
// en varios idiomas + agregamos alias populares (USA, EEUU, UK, etc.) para
// que la búsqueda sea "a prueba de tontos".

const IDIOMAS_BUSQUEDA = ["es", "en", "pt", "fr"];

// Alias adicionales (típos, abreviaciones, gentilicios) por código ISO.
// Todo en minúsculas y sin diacríticos. Los oficiales ya llegan por Intl.
const ALIAS = {
  US: ["usa", "eeuu", "ee.uu.", "ee uu", "estados unidos", "united states", "america", "estadounidense"],
  GB: ["uk", "inglaterra", "england", "reino unido", "britain", "great britain", "gran bretana", "britanico"],
  KR: ["corea del sur", "south korea", "korea"],
  KP: ["corea del norte", "north korea"],
  RU: ["rusia", "russia"],
  CN: ["china", "chino"],
  JP: ["japon", "japan", "nihon"],
  DE: ["alemania", "germany", "deutschland"],
  FR: ["francia", "france"],
  IT: ["italia", "italy"],
  ES: ["espana", "spain"],
  PT: ["portugal"],
  NL: ["holanda", "paises bajos", "netherlands", "nederland"],
  CH: ["suiza", "switzerland", "schweiz"],
  AT: ["austria"],
  BE: ["belgica", "belgium"],
  SE: ["suecia", "sweden"],
  NO: ["noruega", "norway"],
  DK: ["dinamarca", "denmark"],
  FI: ["finlandia", "finland"],
  IE: ["irlanda", "ireland"],
  GR: ["grecia", "greece"],
  PL: ["polonia", "poland"],
  CZ: ["republica checa", "czechia", "czech"],
  TR: ["turquia", "turkey"],
  IL: ["israel"],
  AE: ["emiratos", "emiratos arabes", "uae", "united arab emirates", "dubai", "abu dabi"],
  SA: ["arabia saudita", "saudi arabia"],
  EG: ["egipto", "egypt"],
  MA: ["marruecos", "morocco"],
  ZA: ["sudafrica", "south africa"],
  IN: ["india"],
  TH: ["tailandia", "thailand"],
  VN: ["vietnam"],
  ID: ["indonesia", "bali"],
  PH: ["filipinas", "philippines"],
  SG: ["singapur", "singapore"],
  MY: ["malasia", "malaysia"],
  AU: ["australia"],
  NZ: ["nueva zelanda", "new zealand"],
  BR: ["brasil", "brazil"],
  AR: ["argentina"],
  CL: ["chile"],
  PE: ["peru"],
  CO: ["colombia"],
  VE: ["venezuela"],
  EC: ["ecuador"],
  BO: ["bolivia"],
  PY: ["paraguay"],
  UY: ["uruguay"],
  MX: ["mexico"],
  GT: ["guatemala"],
  HN: ["honduras"],
  SV: ["el salvador", "salvador"],
  NI: ["nicaragua"],
  CR: ["costa rica"],
  PA: ["panama"],
  CU: ["cuba"],
  DO: ["republica dominicana", "dominican republic"],
  PR: ["puerto rico"],
  HT: ["haiti"],
  JM: ["jamaica"],
  CA: ["canada"],
  IS: ["islandia", "iceland"],
  UA: ["ucrania", "ukraine"],
  RS: ["serbia"],
  HR: ["croacia", "croatia"],
  HU: ["hungria", "hungary"],
  RO: ["rumania", "romania"],
  BG: ["bulgaria"],
  LK: ["sri lanka", "ceilan"],
  KE: ["kenia", "kenya"],
  NG: ["nigeria"],
  ET: ["etiopia", "ethiopia"],
  QA: ["qatar", "catar"],
  KW: ["kuwait"],
  IR: ["iran"],
  IQ: ["irak", "iraq"],
  SY: ["siria", "syria"],
  LB: ["libano", "lebanon"],
  JO: ["jordania", "jordan"],
  PK: ["pakistan"],
  BD: ["bangladesh"],
  NP: ["nepal"],
  MM: ["myanmar", "birmania"],
  KH: ["camboya", "cambodia"],
  LA: ["laos"],
  MN: ["mongolia"],
  KZ: ["kazajistan", "kazakhstan"],
  UZ: ["uzbekistan"],
  AF: ["afganistan", "afghanistan"],
  DZ: ["argelia", "algeria"],
  TN: ["tunez", "tunisia"],
  LY: ["libia", "libya"],
  SD: ["sudan"],
  AO: ["angola"],
  MZ: ["mozambique"],
  GH: ["ghana"],
  CI: ["costa de marfil", "ivory coast"],
  SN: ["senegal"],
  UG: ["uganda"],
  TZ: ["tanzania"],
  ZW: ["zimbabue", "zimbabwe"],
  ZM: ["zambia"],
  RW: ["ruanda", "rwanda"],
  MG: ["madagascar"],
  MU: ["mauricio", "mauritius"],
  SC: ["seychelles"],
  FJ: ["fiyi", "fiji"],
  PG: ["papua nueva guinea", "papua new guinea"],
  MT: ["malta"],
  CY: ["chipre", "cyprus"],
  LU: ["luxemburgo", "luxembourg"],
  LI: ["liechtenstein"],
  MC: ["monaco"],
  AD: ["andorra"],
  SM: ["san marino"],
  VA: ["ciudad del vaticano", "vaticano", "vatican"],
  SI: ["eslovenia", "slovenia"],
  SK: ["eslovaquia", "slovakia"],
  EE: ["estonia"],
  LV: ["letonia", "latvia"],
  LT: ["lituania", "lithuania"],
  BY: ["bielorrusia", "belarus"],
  MD: ["moldavia", "moldova"],
  AL: ["albania"],
  MK: ["macedonia", "macedonia del norte", "north macedonia"],
  ME: ["montenegro"],
  BA: ["bosnia", "bosnia y herzegovina"],
  XK: ["kosovo"],
  GE: ["georgia"],
  AM: ["armenia"],
  AZ: ["azerbaiyan", "azerbaijan"],
};

function normalizar(s) {
  return (s || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Cache de los DisplayNames por idioma. Fallback silencioso si el entorno
// no soporta Intl.DisplayNames (server-side old, algunos WebViews viejos).
let _dn = null;
function getDisplayNames() {
  if (_dn) return _dn;
  _dn = [];
  try {
    for (const lang of IDIOMAS_BUSQUEDA) {
      _dn.push(new Intl.DisplayNames([lang], { type: "region" }));
    }
  } catch {
    _dn = [];
  }
  return _dn;
}

// Nombre a mostrar en la UI (idioma del usuario, con fallback en cadena
// es -> en -> código).
export function nombrePaisMostrar(cc, lang = "es") {
  if (!cc) return "";
  const orden = [lang, "es", "en"];
  for (const l of orden) {
    try {
      const dn = new Intl.DisplayNames([l], { type: "region" });
      const n = dn.of(cc.toUpperCase());
      if (n && n !== cc.toUpperCase()) return n;
    } catch {}
  }
  return cc.toUpperCase();
}

// Todos los alias buscables de un país (nombre en 4 idiomas + código +
// alias manuales). Todo normalizado a lowercase sin diacríticos.
export function aliasBusqueda(cc) {
  const CC = cc.toUpperCase();
  const set = new Set([CC.toLowerCase()]);
  for (const dn of getDisplayNames()) {
    try {
      const n = dn.of(CC);
      if (n) set.add(normalizar(n));
    } catch {}
  }
  for (const a of ALIAS[CC] || []) set.add(normalizar(a));
  return Array.from(set);
}

export { normalizar };
