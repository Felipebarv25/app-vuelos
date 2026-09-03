// ¿Se puede ir por tierra de A a B?
//
// El estimador de tramos solo miraba la distancia: York → Dublín son 348 km,
// asi que cotizaba "Tren, US$83". Entre medias esta el mar de Irlanda. Lo
// mismo con Liverpool → Dublin, Barcelona → Palma o Miami → La Habana: un
// tren o un bus imposibles, con precio y duracion inventados sobre un
// trayecto que nadie puede hacer.
//
// Esto no pretende ser un mapa. Es lo minimo para no mentir: a que masa de
// tierra pertenece cada pais, y que masas estan unidas por tunel o puente.
// Lo que no esta en la tabla devuelve null y NO se afirma nada — un
// verificador que grita en falso se deja de usar.

// Masa de tierra por ISO-2. Los paises continentales llevan su continente;
// las islas, su propia masa.
const MASA = {
  // --- Islas que importan porque se viaja a ellas ---
  GB: "britania", IE: "irlanda", IS: "islandia", MT: "malta", CY: "chipre",
  JP: "japon", TW: "taiwan", PH: "filipinas", ID: "indonesia", LK: "srilanka",
  MV: "maldivas", MG: "madagascar", MU: "mauricio", SC: "seychelles",
  NZ: "nuevazelanda", AU: "australia", PG: "papua", FJ: "fiyi", NC: "oceania_is",
  CU: "cuba", DO: "hispaniola", HT: "hispaniola", JM: "jamaica", PR: "puertorico",
  TT: "trinidad", BB: "barbados", BS: "bahamas", IS_: "islandia",
  CV: "caboverde", ST: "santotome", KM: "comoras", BH: "bahrein", SG: "singapur",

  // --- Continentes ---
  // Europa continental
  ES: "eurasia", PT: "eurasia", FR: "eurasia", AD: "eurasia", MC: "eurasia",
  IT: "eurasia", SM: "eurasia", VA: "eurasia", CH: "eurasia", LI: "eurasia",
  AT: "eurasia", DE: "eurasia", NL: "eurasia", BE: "eurasia", LU: "eurasia",
  DK: "eurasia", NO: "eurasia", SE: "eurasia", FI: "eurasia", EE: "eurasia",
  LV: "eurasia", LT: "eurasia", PL: "eurasia", CZ: "eurasia", SK: "eurasia",
  HU: "eurasia", SI: "eurasia", HR: "eurasia", BA: "eurasia", RS: "eurasia",
  ME: "eurasia", XK: "eurasia", MK: "eurasia", AL: "eurasia", GR: "eurasia",
  BG: "eurasia", RO: "eurasia", MD: "eurasia", UA: "eurasia", BY: "eurasia",
  RU: "eurasia", TR: "eurasia",
  // Asia continental (misma masa que Europa: Eurasia)
  GE: "eurasia", AM: "eurasia", AZ: "eurasia", IR: "eurasia", IQ: "eurasia",
  SY: "eurasia", LB: "eurasia", IL: "eurasia", PS: "eurasia", JO: "eurasia",
  SA: "eurasia", KW: "eurasia", QA: "eurasia", AE: "eurasia", OM: "eurasia",
  YE: "eurasia", KZ: "eurasia", UZ: "eurasia", TM: "eurasia", TJ: "eurasia",
  KG: "eurasia", AF: "eurasia", PK: "eurasia", IN: "eurasia", NP: "eurasia",
  BT: "eurasia", BD: "eurasia", MM: "eurasia", TH: "eurasia", LA: "eurasia",
  KH: "eurasia", VN: "eurasia", MY: "eurasia", CN: "eurasia", MN: "eurasia",
  KR: "eurasia", KP: "eurasia", HK: "eurasia", MO: "eurasia",
  // África continental
  MA: "africa", DZ: "africa", TN: "africa", LY: "africa", EG: "africa",
  SD: "africa", SS: "africa", ET: "africa", ER: "africa", DJ: "africa",
  SO: "africa", KE: "africa", UG: "africa", RW: "africa", BI: "africa",
  TZ: "africa", MZ: "africa", ZW: "africa", ZM: "africa", MW: "africa",
  BW: "africa", NA: "africa", ZA: "africa", LS: "africa", SZ: "africa",
  AO: "africa", CD: "africa", CG: "africa", GA: "africa", GQ: "africa",
  CM: "africa", CF: "africa", TD: "africa", NE: "africa", NG: "africa",
  BJ: "africa", TG: "africa", GH: "africa", CI: "africa", LR: "africa",
  SL: "africa", GN: "africa", GW: "africa", SN: "africa", GM: "africa",
  ML: "africa", BF: "africa", MR: "africa",
  // América del Norte y Central
  US: "america_norte", CA: "america_norte", MX: "america_norte",
  GT: "america_norte", BZ: "america_norte", SV: "america_norte",
  HN: "america_norte", NI: "america_norte", CR: "america_norte",
  PA: "america_norte",
  // América del Sur
  CO: "america_sur", VE: "america_sur", GY: "america_sur", SR: "america_sur",
  EC: "america_sur", PE: "america_sur", BR: "america_sur", BO: "america_sur",
  PY: "america_sur", CL: "america_sur", AR: "america_sur", UY: "america_sur",
};

// Pares de masas unidas por tierra pese a ser masas distintas.
//
// Solo hay una que importe de verdad para este publico: el Eurotunel, que
// hace que Londres → Paris en tren sea real. La otra excepcion es la que NO
// esta: entre Panama y Colombia no hay carretera (el tapon del Darien), asi
// que America del Norte y del Sur NO se tocan por tierra aunque el mapa lo
// parezca. Es el error clasico de cualquier estimador por distancia.
const UNIDAS = new Set(["britania|eurasia"]);

const par = (a, b) => [a, b].sort().join("|");

export function masaDe(iso) {
  const cc = String(iso || "").trim().toUpperCase();
  return MASA[cc] || null;
}

/**
 * ¿Hay agua de por medio? true / false / null (sin datos, no se afirma nada).
 */
export function hayCruceDeAgua(a, b) {
  const ma = masaDe(a?.pais);
  const mb = masaDe(b?.pais);
  if (!ma || !mb) return null;
  if (ma === mb) return false;
  return !UNIDAS.has(par(ma, mb));
}
