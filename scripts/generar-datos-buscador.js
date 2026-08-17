// Genera web/data/hubs-prioritarios.js con DOS cosas:
//
//   HUBS_PRIORITARIOS  aeropuertos que la app ya trata como destino u origen.
//                      El buscador los sube en el ranking para que un homonimo
//                      diminuto no le gane a un hub.
//   ALIAS_CIUDAD       nombre en español -> nombre de ciudad del catalogo IATA
//                      (que esta solo en ingles / en el idioma local).
//
// Los alias se DERIVAN de los datos curados de la app siempre que se pueda: por
// cada "Ciudad|Pais" -> IATA de lib/iataCiudades.js se mira que ciudad usa el
// catalogo para ESE iata. Asi el alias es correcto por construccion en vez de
// depender de lo que uno crea recordar: "Florencia" sale a "Firenze" y no a
// "Florence" (que es Florence, South Carolina).
//
// La lista manual de abajo cubre ciudades del mundo que no estan en el catalogo
// curado. Cada entrada OBLIGA a declarar el pais esperado y se valida: si el
// termino del catalogo no existe en ese pais, la entrada se descarta y se
// reporta. Esto es lo que fallo en el commit anterior — se verifico que el
// termino ingles resolviera "a algo", no que resolviera al pais correcto, y
// venecia/napoles/florencia terminaron apuntando a Florida y South Carolina.
const fs = require("fs");
const path = require("path");
const WEB = path.join(__dirname, "..", "web");

const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
const cat = require(path.join(WEB, "public/aeropuertos.json"));
const porIata = new Map(cat.map((a) => [a.i, a]));
const porCiudad = new Map();
for (const a of cat) {
  const k = norm(a.c);
  if (!porCiudad.has(k)) porCiudad.set(k, []);
  porCiudad.get(k).push(a);
}

// ---------- 1) hubs prioritarios ----------
// Solo codigos en posicion de VALOR. Antes cazaba cualquier "XXX" del fichero,
// asi que se colaban codigos de moneda ("USD", "COP") y codigos citados en los
// comentarios.
function codigosDe(archivo) {
  const s = fs.readFileSync(path.join(WEB, archivo), "utf8");
  const out = new Set();
  for (const m of s.matchAll(/":\s*"([A-Z]{3})"/g)) out.add(m[1]);
  for (const m of s.matchAll(/iata:\s*"([A-Z]{3})"/g)) out.add(m[1]);
  return out;
}
const METRO = {
  LON: { pais: "GB", es: "Londres", aps: ["LHR", "LGW", "LTN", "STN", "LCY"] },
  PAR: { pais: "FR", es: "París", aps: ["CDG", "ORY", "BVA"] },
  ROM: { pais: "IT", es: "Roma", aps: ["FCO", "CIA"] },
  MIL: { pais: "IT", es: "Milán", aps: ["MXP", "LIN", "BGY"] },
  TYO: { pais: "JP", es: "Tokio", aps: ["NRT", "HND"] },
  NYC: { pais: "US", es: "Nueva York", aps: ["JFK", "LGA", "EWR"] },
  BJS: { pais: "CN", es: "Pekín", aps: ["PEK", "PKX"] },
  SAO: { pais: "BR", es: "São Paulo", aps: ["GRU", "CGH", "VCP"] },
  BUE: { pais: "AR", es: "Buenos Aires", aps: ["EZE", "AEP"] },
  SEL: { pais: "KR", es: "Seúl", aps: ["ICN", "GMP"] },
  SHA: { pais: "CN", es: "Shanghái", aps: ["PVG", "SHA"] },
  RIO: { pais: "BR", es: "Río de Janeiro", aps: ["GIG", "SDU"] },
  MOW: { pais: "RU", es: "Moscú", aps: ["SVO", "DME", "VKO"] },
  WAS: { pais: "US", es: "Washington", aps: ["IAD", "DCA", "BWI"] },
  CHI: { pais: "US", es: "Chicago", aps: ["ORD", "MDW"] },
  YTO: { pais: "CA", es: "Toronto", aps: ["YYZ", "YTZ"] },
  YMQ: { pais: "CA", es: "Montreal", aps: ["YUL"] },
  STO: { pais: "SE", es: "Estocolmo", aps: ["ARN", "BMA"] },
  OSA: { pais: "JP", es: "Osaka", aps: ["KIX", "ITM"] },
  UKY: { pais: "JP", es: "Kioto", aps: ["KIX", "ITM"] }, // Kyoto no tiene aeropuerto propio
};

// Codigos IATA de config.py (ORIGENES, DESTINOS, DESTINOS_NACIONALES). Se lee
// el fichero en vez de pedirlos por argumento para que regenerar sea un solo
// comando: node scripts/generar-datos-buscador.js
function codigosDeConfigPy() {
  const py = fs.readFileSync(path.join(__dirname, "..", "config.py"), "utf8");
  const out = new Set();
  for (const nombre of ["ORIGENES", "DESTINOS", "DESTINOS_NACIONALES"]) {
    const i = py.indexOf(nombre + " = {");
    if (i === -1) continue;
    // Hasta la linea que cierra la llave al inicio de linea.
    const resto = py.slice(i);
    const fin = resto.search(/\n\}/);
    const bloque = fin === -1 ? resto : resto.slice(0, fin);
    for (const m of bloque.matchAll(/"([A-Z]{3})"\s*:/g)) out.add(m[1]);
  }
  return out;
}

// DOS niveles. Un solo nivel no alcanza: al expandir el codigo de metro LON a
// LHR/LGW/LTN/STN/LCY los cinco quedaban empatados y ganaba el que estuviera
// primero en el catalogo (Luton). Igual con ROM -> FCO/CIA, que dejaba Ciampino
// por encima de Fiumicino.
//   principales = aeropuerto principal de cada ciudad curada, primer aeropuerto
//                 de cada codigo de metro, origenes y codigos de config.py
//   secundarios = segundos aeropuertos (IATA_ALT) y el resto de cada metro
const principales = new Set();
const secundarios = new Set();
const avisos = [];
const srcCiu = fs.readFileSync(path.join(WEB, "lib/iataCiudades.js"), "utf8");
const iAltPos = srcCiu.indexOf("IATA_ALT");
const iCiuPos = srcCiu.indexOf("IATA_CIUDAD");
// Solo el bloque del aeropuerto PRINCIPAL alimenta los candidatos a principal.
const bloquePrincipal = iCiuPos > iAltPos ? srcCiu.slice(iCiuPos) : srcCiu.slice(iCiuPos, iAltPos);
const codigosDeTexto = (txt) => {
  const out = new Set();
  for (const m of txt.matchAll(/":\s*"([A-Z]{3})"/g)) out.add(m[1]);
  for (const m of txt.matchAll(/iata:\s*"([A-Z]{3})"/g)) out.add(m[1]);
  return out;
};
const candidatos = new Set([
  ...codigosDeTexto(bloquePrincipal),
  ...codigosDe("lib/paisesOrigen.js"),
  ...codigosDeConfigPy(),
]);
for (const code of candidatos) {
  if (porIata.has(code)) { principales.add(code); continue; }
  const m = METRO[code];
  if (!m) { avisos.push(`hub ${code}: no esta en el catalogo ni es metro conocido`); continue; }
  let primero = true;
  for (const c of m.aps) {
    const ap = porIata.get(c);
    if (!ap) { avisos.push(`hub ${code}->${c}: no existe en el catalogo`); continue; }
    if (ap.p !== m.pais) { avisos.push(`hub ${code}->${c}: pais ${ap.p} != ${m.pais}`); continue; }
    if (primero) { principales.add(c); primero = false; } else secundarios.add(c);
  }
}

// ---------- 2) alias derivados del catalogo curado ----------
const src = fs.readFileSync(path.join(WEB, "lib/iataCiudades.js"), "utf8");
// IATA_ALT esta ANTES en el fichero, pero el aeropuerto principal manda: si se
// lee en orden de aparicion, "Nueva York" queda apuntando a Newark y "Milan" a
// Bergamo. Se parte el fichero y se procesa IATA_CIUDAD primero.
const iAlt = src.indexOf("IATA_ALT");
const iCiu = src.indexOf("IATA_CIUDAD");
const bloques = iCiu > iAlt
  ? [src.slice(iCiu), src.slice(iAlt, iCiu)]
  : [src.slice(iCiu, iAlt), src.slice(iAlt)];
const curados = bloques.flatMap((b) =>
  [...b.matchAll(/"([^"|]+)\|([^"]+)":\s*"([A-Z]{3})"/g)].map((m) => ({
    ciudad: m[1], pais: m[2], iata: m[3],
  }))
);

// Los segundos aeropuertos declarados en IATA_ALT son hubs, pero de segundo
// nivel: Gatwick cuenta, y no debe ganarle a Heathrow.
for (const m of (src.slice(src.indexOf("IATA_ALT")).match(/":\s*"[A-Z]{3}"/g) || [])) {
  const c = m.match(/"([A-Z]{3})"/)[1];
  if (porIata.has(c) && !principales.has(c)) secundarios.add(c);
}

const alias = {};
const derivados = [];
for (const d of curados) {
  const ap = porIata.get(d.iata);
  if (!ap) continue;                        // codigo de metro: ya cubierto arriba
  const es = norm(d.ciudad);
  const dest = norm(ap.c);
  if (!es || es === dest) continue;         // el nombre ya coincide
  // Si escribir el nombre español ya encuentra ese aeropuerto por su ciudad,
  // no hace falta alias.
  if ((porCiudad.get(es) || []).some((x) => x.i === d.iata)) continue;
  if (!alias[es]) alias[es] = [];
  if (!alias[es].includes(dest)) {
    alias[es].push(dest);
    derivados.push(`${d.ciudad} -> ${ap.c} (${d.iata}, ${ap.p})`);
  }
}

// ---------- 3) lista manual, con pais OBLIGATORIO y validado ----------
const MANUAL = [
  ["tokio", "tokyo", "JP"], ["nueva york", "new york", "US"], ["londres", "london", "GB"],
  ["pekin", "beijing", "CN"], ["roma", "rome", "IT"], ["lisboa", "lisbon", "PT"],
  ["ginebra", "geneva", "CH"], ["moscu", "moscow", "RU", "SVO", "Moscú"], ["copenhague", "copenhagen", "DK"],
  ["la habana", "havana", "CU"], ["estambul", "istanbul", "TR"], ["atenas", "athens", "GR"],
  ["viena", "vienna", "AT"], ["praga", "prague", "CZ"], ["varsovia", "warsaw", "PL"],
  ["venecia", "venezia", "IT"], ["napoles", "napoli", "IT"], ["florencia", "firenze", "IT"],
  ["turin", "torino", "IT"], ["genova", "genova", "IT"], ["marsella", "marseille", "FR"],
  ["niza", "nice", "FR"], ["burdeos", "bordeaux", "FR"], ["oporto", "porto", "PT"],
  ["nueva delhi", "new delhi", "IN"], ["bombay", "mumbai", "IN"], ["seul", "seoul", "KR"],
  ["singapur", "singapore", "SG"], ["ciudad del cabo", "cape town", "ZA"],
  ["basilea", "bale", "CH"], ["bruselas", "brussels", "BE"], ["amberes", "antwerp", "BE"],
  ["gotemburgo", "gothenburg", "SE", "GOT", "Gotemburgo"], ["estocolmo", "stockholm", "SE"],
  ["reikiavik", "reykjavik", "IS", "KEF", "Reikiavik"], ["edimburgo", "edinburgh", "GB"],
  ["belgrado", "belgrad", "RS"], ["bucarest", "bucharest", "RO", "OTP", "Bucarest"],
  ["abu dabi", "abu dhabi", "AE"], ["nueva orleans", "new orleans", "US", "MSY", "Nueva Orleans"],
  ["ciudad de mexico", "mexico city", "MX"], ["argel", "algiers", "DZ"],
  ["tunez", "tunis", "TN"], ["jartum", "khartoum", "SD"], ["adis abeba", "addis ababa", "ET"],
  ["damasco", "damascus", "SY"], ["teheran", "tehran", "IR", "IKA", "Teherán"], ["cracovia", "krakow", "PL"],
  ["riad", "riyadh", "SA", "RUH", "Riad"], ["sidney", "sydney", "AU"], ["hamburgo", "hamburg", "DE", "HAM", "Hamburgo"],
  ["colonia", "cologne", "DE"], ["el cairo", "cairo", "EG"], ["bagdad", "baghdad", "IQ"],
  ["yakarta", "jakarta", "ID"], ["medellin", "rionegro", "CO"],
  ["buenos aires", "ezeiza", "AR"], ["panama", "tocumen", "PA"],
  ["ciudad de panama", "tocumen", "PA"], ["ciudad de guatemala", "guatemala city", "GT"],
  ["playa del carmen", "cancun", "MX"], ["filadelfia", "philadelphia", "US", "PHL", "Filadelfia"],
  ["montreal", "montreal", "CA"], ["frankfurt", "frankfurt", "DE"],
];
// Ciudades con mas de un aeropuerto de primer nivel, donde hay que decir cual
// es EL principal. Son las unicas 6 del dataset; el generador aborta si aparece
// una nueva sin declarar, para que no se decida sola por orden del catalogo.
const DESEMPATE = ["LHR", "CDG", "GRU", "PVG", "NRT", "IST"];

const manualOk = [];
const manualMal = [];
for (const [es, dest, pais, principal] of MANUAL) {
  const e = norm(es), d = norm(dest);
  // El buscador hace includes(), asi que basta con que alguna ciudad del
  // catalogo CONTENGA el termino y este en el pais declarado.
  const coincide = cat.filter((x) => norm(x.c).includes(d));
  const enPais = coincide.filter((x) => x.p === pais);
  if (!enPais.length) {
    manualMal.push(`${es} -> "${dest}" en ${pais}: NO EXISTE (hay en: ${[...new Set(coincide.map((x) => x.p))].join(",") || "ningun pais"})`);
    continue;
  }
  if (!alias[e]) alias[e] = [];
  // El destino manual va PRIMERO: es el revisado a mano y con pais declarado.
  if (!alias[e].includes(d)) alias[e].unshift(d);
  manualOk.push(`${es} -> ${dest} (${enPais.map((x) => x.i).join(",")})`);
  // Si la entrada declara el aeropuerto principal de esa ciudad, se promueve
  // SOLO ese. Hace falta para ciudades que la app no tiene en su catalogo
  // curado: sin esto ninguno de los seis aeropuertos de Moscu era hub y el
  // buscador devolvia Bykovo antes que Sheremetyevo.
  if (principal) {
    const ap = porIata.get(principal);
    if (!ap) avisos.push(`manual ${es}: principal ${principal} no existe`);
    else if (ap.p !== pais) avisos.push(`manual ${es}: principal ${principal} esta en ${ap.p}, no en ${pais}`);
    else principales.add(principal);
  }
  // OJO: no se promueve el resto de la ciudad. Se hacia, y como enPais
  // trae TODOS los de la ciudad, "atenas" convertia en hub tambien a HEW
  // (Hellinikon, cerrado) y "londres" a Luton y Biggin Hill, con lo que
  // empataban con ATH y Heathrow y el desempate lo decidia el orden del
  // catalogo. Los hubs salen solo de las listas curadas.
}

console.log(`=== ALIAS DERIVADOS DEL CATALOGO CURADO (${derivados.length}) ===`);
derivados.forEach((x) => console.log("  " + x));
console.log(`\n=== ALIAS MANUALES VALIDADOS (${manualOk.length}) ===`);
manualOk.forEach((x) => console.log("  " + x));
console.log(`\n=== MANUALES DESCARTADOS POR PAIS (${manualMal.length}) ===`);
manualMal.forEach((x) => console.log("  " + x));
console.log(`\n=== AVISOS (${avisos.length}) ===`);
avisos.forEach((x) => console.log("  " + x));

for (const c of principales) secundarios.delete(c);

// Verificar que toda ciudad con varios principales tenga su desempate.
const porCiudadPais = new Map();
for (const a of cat) {
  if (!principales.has(a.i)) continue;
  const k = norm(a.c) + "|" + a.p;
  if (!porCiudadPais.has(k)) porCiudadPais.set(k, []);
  porCiudadPais.get(k).push(a.i);
}
const sinDesempate = [];
for (const [k, v] of porCiudadPais) {
  if (v.length < 2) continue;
  if (!v.some((c) => DESEMPATE.includes(c))) sinDesempate.push(`${k} -> ${v.join(", ")}`);
}
if (sinDesempate.length) {
  console.error("");
  console.error("ERROR: ciudades con varios hubs principales y ningun desempate:");
  sinDesempate.forEach((x) => console.error("  " + x));
  process.exit(1);
}
// ---------- 4) etiquetas comerciales ----------
// El catalogo IATA nombra las ciudades como el dato oficial, no como las llama
// la gente: MDE es "Rionegro", EZE es "Ezeiza", PTY es "Tocumen", FRA es
// "Frankfurt-am-Main". Un colombiano que abre el planificador y navega la lista
// de su pais no reconoce "Rionegro" como Medellin.
//
// Y no es solo cosmetico: Ofertas.js casa el destino elegido contra
// ofertas.json POR NOMBRE DE CIUDAD, y ese JSON usa nombres comerciales en
// español ("Londres", "Tokio", "Buenos Aires", "Nueva York", "Pekin",
// "São Paulo", "Milan", "Ciudad de Mexico", "Paris"). Con la etiqueta del
// catalogo esos 9 destinos NUNCA casaban: la app gastaba una llamada en vivo a
// Travelpayouts y decia "sin historial" para rutas que si tenia precalculadas.
//
// Fuentes, por prioridad: paisesOrigen.js (nombres comerciales por IATA),
// iataCiudades.js (claves "Ciudad|Pais"), y las tablas METRO/MANUAL de arriba.
// Correcciones donde la derivacion automatica dice algo FALSO.
const ETIQUETA_MANUAL = {
  // El catalogo curado usa CUN como aeropuerto de Playa del Carmen, pero el
  // aeropuerto es el de Cancun: la etiqueta tiene que decir donde aterrizas.
  CUN: "Cancún",
  // Kioto no tiene aeropuerto propio; lo sirven los dos de Osaka. La tabla
  // METRO mapea UKY -> KIX/ITM para poder buscarlo, pero etiquetarlos "Kioto"
  // seria mentir sobre donde aterriza el avion.
  KIX: "Osaka",
  ITM: "Osaka",
};

const etiquetas = {};
function etiquetar(iata, nombre, fuente) {
  if (!iata || !nombre) return;
  const ap = porIata.get(iata);
  if (!ap) return;
  // Fuera el sufijo entre parentesis: paisesOrigen.js trae "Londres (Heathrow)"
  // y "Nueva York (JFK)" para desambiguar en SU lista, pero aqui sobra por dos
  // razones. Una, el nombre del aeropuerto ya se muestra al lado en el
  // desplegable, asi que Heathrow y Gatwick se distinguen solos. Dos, esta
  // etiqueta es la que Ofertas.js compara contra ofertas.json, y "Roma
  // (Fiumicino)" no casaria nunca con "Roma".
  const limpio = String(nombre).replace(/\s*\([^)]*\)\s*$/, "").trim();
  if (!limpio) return;
  if (norm(ap.c) === norm(limpio)) return;      // ya coincide, no hace falta
  if (etiquetas[iata] && etiquetas[iata] !== limpio) {
    avisos.push(`etiqueta ${iata}: "${etiquetas[iata]}" vs "${limpio}" (${fuente}), se queda la primera`);
    return;
  }
  etiquetas[iata] = limpio;
}

// a) paisesOrigen.js: { iata: "MDE", ciudad: "Medellín" }
const srcOrig = fs.readFileSync(path.join(WEB, "lib/paisesOrigen.js"), "utf8");
for (const m of srcOrig.matchAll(/iata:\s*"([A-Z]{3})"\s*,\s*ciudad:\s*"([^"]+)"/g)) {
  etiquetar(m[1], m[2], "paisesOrigen");
}
// b) iataCiudades.js: "Medellín|Colombia": "MDE"
for (const d of curados) etiquetar(d.iata, d.ciudad, "iataCiudades");
// c) codigos de metro: el nombre en español va en la tabla METRO
for (const code in METRO) {
  const m = METRO[code];
  if (!m.es) continue;
  for (const c of m.aps) etiquetar(c, m.es, "METRO");
}
// d) alias manuales que declararon aeropuerto principal
for (const [es, , , principal, etiqueta] of MANUAL) {
  if (principal && etiqueta) etiquetar(principal, etiqueta, "MANUAL");
}

// Las correcciones a mano mandan sobre lo derivado.
for (const iata in ETIQUETA_MANUAL) {
  if (!porIata.has(iata)) { avisos.push(`etiqueta manual ${iata}: no existe`); continue; }
  etiquetas[iata] = ETIQUETA_MANUAL[iata];
}
// Fuera las que acabaron diciendo lo mismo que el catalogo: no aportan nada y
// solo engordan el fichero.
for (const iata in etiquetas) {
  if (norm(porIata.get(iata).c) === norm(etiquetas[iata])) delete etiquetas[iata];
}

const clavesEtiqueta = Object.keys(etiquetas).sort();
console.log(`\netiquetas comerciales: ${clavesEtiqueta.length}`);
for (const k of clavesEtiqueta) {
  console.log(`  ${k}: "${porIata.get(k).c}" -> "${etiquetas[k]}"`);
}

const listaHubs = [...principales].sort();
const listaSec = [...secundarios].sort();
const clavesAlias = Object.keys(alias).sort();
console.log(`\nhubs: ${listaHubs.length} | alias: ${clavesAlias.length}`);

const fmtSet = (arr) => "[\n  " + arr.map((x) => JSON.stringify(x)).join(",\n  ") + ",\n]";
const fmtObj = (ks) => "{\n" + ks.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(alias[k])},`).join("\n") + "\n}";
const fmtDes = fmtSet(DESEMPATE);
const fmtEti = "{\n" + clavesEtiqueta.map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(etiquetas[k])},`).join("\n") + "\n}";

const salida = `// GENERADO — no editar a mano.
//
// Datos del buscador de aeropuertos, derivados de las listas que ya mantiene la
// app: lib/iataCiudades.js (destinos del planificador de presupuesto),
// lib/paisesOrigen.js (aeropuertos de origen) y config.py (ORIGENES, DESTINOS,
// DESTINOS_NACIONALES). Regenerar con scripts/generar-datos-buscador.js.
//
// HUBS_PRIORITARIOS — ${listaHubs.length} aeropuertos principales (+ ${listaSec.length} secundarios) que la app trata como destino u origen real.
// El ranking los sube para que un homonimo diminuto no le gane a un hub: sin
// esto "Londres" devolvia London/YXU (Ontario) antes de Heathrow, "París"
// devolvia Paris/PHT (Texas) antes de CDG, "Madrid" ponia ECV antes de MAD y
// "Bali" ponia un aeropuerto de Camerun en primer lugar.
//
// ALIAS_CIUDAD — ${clavesAlias.length} nombres en español -> nombre de la ciudad en el catalogo
// IATA, que esta en ingles o en el idioma local. Sin esto el nombre español no
// encuentra la ciudad ("Tokio", "Nueva York", "Estambul" daban cero) o, peor,
// encuentra la equivocada: "Medellin" daba EOH (Olaya Herrera) en vez de MDE,
// "Panama" daba Panama City, Florida en vez de Tocumen, y "Florencia" /
// "Venecia" / "Napoles" daban Florence (South Carolina), Venice y Naples
// (Florida) en vez de Firenze, Venezia y Napoli.
//
// Los codigos de METRO de esas fuentes (LON, PAR, ROM, TYO, NYC, BUE...) no
// existen en el catalogo de aeropuertos y se resolvieron a sus aeropuertos
// reales, validando el pais de cada uno.
export const HUBS_PRIORITARIOS = new Set(${fmtSet(listaHubs)});

// Segundos aeropuertos de una misma ciudad: cuentan, pero por debajo del
// principal (Gatwick no debe ganarle a Heathrow, Ciampino no a Fiumicino).
export const HUBS_SECUNDARIOS = new Set(${fmtSet(listaSec)});

export const ALIAS_CIUDAD = ${fmtObj(clavesAlias)};

// Cuando una ciudad tiene mas de un aeropuerto de primer nivel, este es EL
// principal. Sin esto el empate lo rompia el orden del catalogo y "Londres"
// devolvia Gatwick antes que Heathrow.
export const HUB_DESEMPATE = new Set(${fmtDes});

// Nombre comercial de ${clavesEtiqueta.length} aeropuertos cuyo nombre de ciudad en el catalogo IATA
// no es el que usa la gente: MDE es "Rionegro", EZE es "Ezeiza", PTY es
// "Tocumen", LHR es "London". Se usa para MOSTRAR y tambien para buscar, asi
// que lo que se ve en la lista siempre se puede escribir.
export const ETIQUETA_CIUDAD = ${fmtEti};
`;
fs.writeFileSync(path.join(WEB, "data/hubs-prioritarios.js"), salida);
console.log("escrito web/data/hubs-prioritarios.js");
