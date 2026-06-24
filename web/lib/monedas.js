// Catálogo de monedas ISO 4217 (las activas más comunes, ~80 monedas
// que cubren ~99% del PIB mundial). Cada entrada:
//   code   — ISO 4217 (3 letras, en mayúscula)
//   nombre — nombre legible en español (los browsers lo localizan via
//            Intl.DisplayNames si se necesita)
//   simbolo — símbolo corto para mostrar ($, €, ¥, etc.)
//   paises — array de ISO-2 de países donde es la moneda principal.
//            Sirve para auto-detectar la moneda según el país del visitante.

export const MONEDAS = [
  { code: "USD", nombre: "Dólar estadounidense",       simbolo: "US$", paises: ["US", "EC", "PA", "SV", "PR"] },
  { code: "EUR", nombre: "Euro",                       simbolo: "€",   paises: ["ES", "FR", "DE", "IT", "PT", "NL", "BE", "AT", "IE", "FI", "GR", "LU", "MT", "CY", "EE", "LV", "LT", "SK", "SI", "HR", "AD", "MC", "SM", "VA", "ME", "XK"] },
  { code: "COP", nombre: "Peso colombiano",            simbolo: "$",   paises: ["CO"] },
  { code: "MXN", nombre: "Peso mexicano",              simbolo: "$",   paises: ["MX"] },
  { code: "ARS", nombre: "Peso argentino",             simbolo: "$",   paises: ["AR"] },
  { code: "BRL", nombre: "Real brasileño",             simbolo: "R$",  paises: ["BR"] },
  { code: "CLP", nombre: "Peso chileno",               simbolo: "$",   paises: ["CL"] },
  { code: "PEN", nombre: "Sol peruano",                simbolo: "S/",  paises: ["PE"] },
  { code: "UYU", nombre: "Peso uruguayo",              simbolo: "$U",  paises: ["UY"] },
  { code: "PYG", nombre: "Guaraní paraguayo",          simbolo: "₲",   paises: ["PY"] },
  { code: "BOB", nombre: "Boliviano",                  simbolo: "Bs",  paises: ["BO"] },
  { code: "VES", nombre: "Bolívar venezolano",         simbolo: "Bs.S", paises: ["VE"] },
  { code: "CRC", nombre: "Colón costarricense",        simbolo: "₡",   paises: ["CR"] },
  { code: "GTQ", nombre: "Quetzal guatemalteco",       simbolo: "Q",   paises: ["GT"] },
  { code: "HNL", nombre: "Lempira hondureño",          simbolo: "L",   paises: ["HN"] },
  { code: "NIO", nombre: "Córdoba nicaragüense",       simbolo: "C$",  paises: ["NI"] },
  { code: "DOP", nombre: "Peso dominicano",            simbolo: "RD$", paises: ["DO"] },
  { code: "CUP", nombre: "Peso cubano",                simbolo: "$",   paises: ["CU"] },
  { code: "HTG", nombre: "Gourde haitiano",            simbolo: "G",   paises: ["HT"] },
  { code: "JMD", nombre: "Dólar jamaicano",            simbolo: "J$",  paises: ["JM"] },
  { code: "TTD", nombre: "Dólar de Trinidad",          simbolo: "TT$", paises: ["TT"] },
  { code: "GBP", nombre: "Libra esterlina",            simbolo: "£",   paises: ["GB", "IM", "JE", "GG"] },
  { code: "CHF", nombre: "Franco suizo",               simbolo: "CHF", paises: ["CH", "LI"] },
  { code: "NOK", nombre: "Corona noruega",             simbolo: "kr",  paises: ["NO"] },
  { code: "SEK", nombre: "Corona sueca",               simbolo: "kr",  paises: ["SE"] },
  { code: "DKK", nombre: "Corona danesa",              simbolo: "kr",  paises: ["DK", "GL", "FO"] },
  { code: "ISK", nombre: "Corona islandesa",           simbolo: "kr",  paises: ["IS"] },
  { code: "PLN", nombre: "Zloty polaco",               simbolo: "zł",  paises: ["PL"] },
  { code: "CZK", nombre: "Corona checa",               simbolo: "Kč",  paises: ["CZ"] },
  { code: "HUF", nombre: "Florín húngaro",             simbolo: "Ft",  paises: ["HU"] },
  { code: "RON", nombre: "Leu rumano",                 simbolo: "lei", paises: ["RO"] },
  { code: "BGN", nombre: "Lev búlgaro",                simbolo: "лв",  paises: ["BG"] },
  { code: "TRY", nombre: "Lira turca",                 simbolo: "₺",   paises: ["TR"] },
  { code: "RUB", nombre: "Rublo ruso",                 simbolo: "₽",   paises: ["RU"] },
  { code: "UAH", nombre: "Grivna ucraniana",           simbolo: "₴",   paises: ["UA"] },
  { code: "JPY", nombre: "Yen japonés",                simbolo: "¥",   paises: ["JP"] },
  { code: "CNY", nombre: "Yuan chino",                 simbolo: "¥",   paises: ["CN"] },
  { code: "HKD", nombre: "Dólar de Hong Kong",         simbolo: "HK$", paises: ["HK"] },
  { code: "TWD", nombre: "Nuevo dólar taiwanés",       simbolo: "NT$", paises: ["TW"] },
  { code: "KRW", nombre: "Won surcoreano",             simbolo: "₩",   paises: ["KR"] },
  { code: "SGD", nombre: "Dólar de Singapur",          simbolo: "S$",  paises: ["SG"] },
  { code: "MYR", nombre: "Ringgit malayo",             simbolo: "RM",  paises: ["MY"] },
  { code: "THB", nombre: "Baht tailandés",             simbolo: "฿",   paises: ["TH"] },
  { code: "PHP", nombre: "Peso filipino",              simbolo: "₱",   paises: ["PH"] },
  { code: "IDR", nombre: "Rupia indonesia",            simbolo: "Rp",  paises: ["ID"] },
  { code: "VND", nombre: "Dong vietnamita",            simbolo: "₫",   paises: ["VN"] },
  { code: "INR", nombre: "Rupia india",                simbolo: "₹",   paises: ["IN", "BT"] },
  { code: "PKR", nombre: "Rupia pakistaní",            simbolo: "₨",   paises: ["PK"] },
  { code: "BDT", nombre: "Taka bangladesí",            simbolo: "৳",   paises: ["BD"] },
  { code: "LKR", nombre: "Rupia de Sri Lanka",         simbolo: "Rs",  paises: ["LK"] },
  { code: "NPR", nombre: "Rupia nepalesa",             simbolo: "Rs",  paises: ["NP"] },
  { code: "AED", nombre: "Dírham EAU",                 simbolo: "د.إ", paises: ["AE"] },
  { code: "SAR", nombre: "Riyal saudí",                simbolo: "ر.س", paises: ["SA"] },
  { code: "QAR", nombre: "Riyal qatarí",               simbolo: "ر.ق", paises: ["QA"] },
  { code: "KWD", nombre: "Dinar kuwaití",              simbolo: "د.ك", paises: ["KW"] },
  { code: "BHD", nombre: "Dinar de Baréin",            simbolo: ".د.ب", paises: ["BH"] },
  { code: "OMR", nombre: "Rial omaní",                 simbolo: "ر.ع", paises: ["OM"] },
  { code: "JOD", nombre: "Dinar jordano",              simbolo: "د.ا", paises: ["JO"] },
  { code: "ILS", nombre: "Shéquel israelí",            simbolo: "₪",   paises: ["IL"] },
  { code: "EGP", nombre: "Libra egipcia",              simbolo: "£",   paises: ["EG"] },
  { code: "MAD", nombre: "Dírham marroquí",            simbolo: "د.م", paises: ["MA"] },
  { code: "TND", nombre: "Dinar tunecino",             simbolo: "د.ت", paises: ["TN"] },
  { code: "DZD", nombre: "Dinar argelino",             simbolo: "د.ج", paises: ["DZ"] },
  { code: "ZAR", nombre: "Rand sudafricano",           simbolo: "R",   paises: ["ZA"] },
  { code: "NGN", nombre: "Naira nigeriana",            simbolo: "₦",   paises: ["NG"] },
  { code: "KES", nombre: "Chelín keniano",             simbolo: "KSh", paises: ["KE"] },
  { code: "GHS", nombre: "Cedi ghanés",                simbolo: "₵",   paises: ["GH"] },
  { code: "ETB", nombre: "Birr etíope",                simbolo: "Br",  paises: ["ET"] },
  { code: "UGX", nombre: "Chelín ugandés",             simbolo: "USh", paises: ["UG"] },
  { code: "TZS", nombre: "Chelín tanzano",             simbolo: "TSh", paises: ["TZ"] },
  { code: "CAD", nombre: "Dólar canadiense",           simbolo: "C$",  paises: ["CA"] },
  { code: "AUD", nombre: "Dólar australiano",          simbolo: "A$",  paises: ["AU"] },
  { code: "NZD", nombre: "Dólar neozelandés",          simbolo: "NZ$", paises: ["NZ"] },
  { code: "FJD", nombre: "Dólar de Fiji",              simbolo: "FJ$", paises: ["FJ"] },
];

// Mapa rápido país-ISO → moneda code. Se construye una sola vez.
let _paisAMoneda = null;
export function monedaDePais(iso) {
  if (!iso) return null;
  if (!_paisAMoneda) {
    _paisAMoneda = {};
    for (const m of MONEDAS) {
      for (const p of m.paises) {
        _paisAMoneda[p] = m.code;
      }
    }
  }
  return _paisAMoneda[iso.toUpperCase()] || null;
}

// Símbolo corto de una moneda — para prefijo del input.
export function simboloMoneda(code) {
  const m = MONEDAS.find((x) => x.code === code);
  return m?.simbolo || code;
}

// Búsqueda fuzzy: code o nombre que matchee. Retorna hasta 12 matches.
export function buscarMonedas(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return MONEDAS.slice(0, 12);
  const exactos = [];
  const prefijos = [];
  const contiene = [];
  for (const m of MONEDAS) {
    const code = m.code.toLowerCase();
    const nombre = m.nombre.toLowerCase();
    if (code === q) exactos.push(m);
    else if (code.startsWith(q)) prefijos.push(m);
    else if (nombre.startsWith(q)) prefijos.push(m);
    else if (code.includes(q) || nombre.includes(q)) contiene.push(m);
  }
  return [...exactos, ...prefijos, ...contiene].slice(0, 12);
}
