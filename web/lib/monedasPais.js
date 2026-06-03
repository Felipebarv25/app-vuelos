// Moneda local aproximada por país, para mostrar los costos de transporte en la
// moneda del lugar visitado ADEMÁS de en dólares. "porUsd" = cuántas unidades de
// la moneda local equivalen a 1 USD (tasa orientativa; el valor real varía).
// Países que usan el dólar (Ecuador, Panamá, EE. UU.) van con porUsd = 1.
const EUR = { cod: "EUR", sim: "€", porUsd: 0.92 };

export const MONEDA_PAIS = {
  Colombia: { cod: "COP", sim: "$", porUsd: 4000 },
  México: { cod: "MXN", sim: "$", porUsd: 18 },
  Perú: { cod: "PEN", sim: "S/", porUsd: 3.7 },
  Ecuador: { cod: "USD", sim: "US$", porUsd: 1 },
  Chile: { cod: "CLP", sim: "$", porUsd: 950 },
  Argentina: { cod: "ARS", sim: "$", porUsd: 1000 },
  Brasil: { cod: "BRL", sim: "R$", porUsd: 5.4 },
  Uruguay: { cod: "UYU", sim: "$U", porUsd: 40 },
  Bolivia: { cod: "BOB", sim: "Bs", porUsd: 6.9 },
  Panamá: { cod: "USD", sim: "US$", porUsd: 1 },
  "Costa Rica": { cod: "CRC", sim: "₡", porUsd: 520 },
  "Estados Unidos": { cod: "USD", sim: "US$", porUsd: 1 },
  Canadá: { cod: "CAD", sim: "C$", porUsd: 1.36 },
  Cuba: { cod: "CUP", sim: "$", porUsd: 120 },
  España: EUR,
  Portugal: EUR,
  Francia: EUR,
  Italia: EUR,
  "Países Bajos": EUR,
  Bélgica: EUR,
  Alemania: EUR,
  Austria: EUR,
  Grecia: EUR,
  Irlanda: EUR,
  "Reino Unido": { cod: "GBP", sim: "£", porUsd: 0.79 },
  Chequia: { cod: "CZK", sim: "Kč", porUsd: 23 },
  "República Checa": { cod: "CZK", sim: "Kč", porUsd: 23 },
  Hungría: { cod: "HUF", sim: "Ft", porUsd: 360 },
  Turquía: { cod: "TRY", sim: "₺", porUsd: 34 },
  Japón: { cod: "JPY", sim: "¥", porUsd: 150 },
  "Corea del Sur": { cod: "KRW", sim: "₩", porUsd: 1350 },
  Tailandia: { cod: "THB", sim: "฿", porUsd: 35 },
  Indonesia: { cod: "IDR", sim: "Rp", porUsd: 16000 },
  Singapur: { cod: "SGD", sim: "S$", porUsd: 1.35 },
  "Emiratos Árabes": { cod: "AED", sim: "AED", porUsd: 3.67 },
  "Emiratos Árabes Unidos": { cod: "AED", sim: "AED", porUsd: 3.67 },
  China: { cod: "CNY", sim: "¥", porUsd: 7.2 },
  India: { cod: "INR", sim: "₹", porUsd: 84 },
  Marruecos: { cod: "MAD", sim: "DH", porUsd: 10 },
  Egipto: { cod: "EGP", sim: "E£", porUsd: 49 },
  Sudáfrica: { cod: "ZAR", sim: "R", porUsd: 18 },
  Australia: { cod: "AUD", sim: "A$", porUsd: 1.5 },
  "Nueva Zelanda": { cod: "NZD", sim: "NZ$", porUsd: 1.65 },
};

// Devuelve la moneda local de un país (o null si no la conocemos / es USD).
export function monedaDePais(pais) {
  const m = MONEDA_PAIS[(pais || "").trim()];
  if (!m || m.cod === "USD") return null; // null = mostrar solo USD
  return m;
}

// Redondeo "bonito" para que las cifras locales no se vean falsamente precisas.
function redondear(n) {
  if (n >= 1000) return Math.round(n / 100) * 100;
  if (n >= 100) return Math.round(n / 10) * 10;
  return Math.round(n);
}

// Convierte un rango en USD [min,max] a texto en moneda local: "$4.000–12.000".
// Si min===max, muestra un solo valor.
export function costoLocal(usdMin, usdMax, moneda) {
  if (!moneda) return null;
  const a = redondear(usdMin * moneda.porUsd);
  const b = redondear(usdMax * moneda.porUsd);
  const fmt = (x) => x.toLocaleString("es-CO");
  return a === b ? `${moneda.sim}${fmt(a)}` : `${moneda.sim}${fmt(a)}–${fmt(b)}`;
}

// Texto en dólares de un rango [min,max]: "US$1–3" (o "US$5").
export function costoUsd(usdMin, usdMax) {
  return usdMin === usdMax ? `US$${usdMin}` : `US$${usdMin}–${usdMax}`;
}
