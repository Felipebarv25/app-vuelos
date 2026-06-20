// FUENTE ÚNICA de precios de Viajero 360 Pro.
//
// ⚠️ IMPORTANTE: estos montos en USD DEBEN coincidir con el precio real de los
// productos de Lemon Squeezy a los que apuntan NEXT_PUBLIC_LS_URL_ANUAL /
// _MENSUAL / _LIFETIME. Si cambias un número aquí, actualiza también el precio
// del producto en el panel de Lemon Squeezy, o cobrarás un monto distinto al
// que muestras (mala experiencia + posible disputa de cobro).
//
// Estrategia de pricing (ver análisis): el anual se comunica como "centavos al
// mes" en vez de "60% de descuento" (un descuento tan grande devaluaba el
// mensual y se leía como trampa). El lifetime tiene una ancla "luego US$99"
// para crear urgencia sin cambiar el cobro actual de lanzamiento.
export const PRECIOS = {
  anual: {
    usd: 24,
    // Equivalente mensual del plan anual (para el framing "≈ US$2/mes").
    porMesUsd: 2,
    destacado: true,
  },
  mensual: {
    usd: 4.99,
    destacado: false,
  },
  lifetime: {
    usd: 39, // precio de lanzamiento (primeros 100)
    // Ancla: precio regular al que subirá tras el lanzamiento. Solo display.
    regularUsd: 99,
    destacado: false,
  },
};

// Formatea un monto USD para mostrar (sin decimales si es entero).
export function fmtUsd(v) {
  if (v == null) return "";
  return Number.isInteger(v) ? `US$ ${v}` : `US$ ${v.toFixed(2)}`;
}

// Convierte un monto USD a moneda local (aprox.) usando una tabla de tasas
// `porUsd` (la misma forma que devuelve /api/fx: { COP: 4000, MXN: 17, ... }).
// Devuelve string ya formateado o null si no hay tasa para esa moneda.
export function aLocalAprox(usd, moneda, porUsd) {
  const tasa = porUsd?.[moneda];
  if (!tasa || !usd) return null;
  const v = usd * tasa;
  // Redondeo "bonito": miles para COP/CLP, unidades para el resto.
  const monedasGrandes = ["COP", "CLP", "PYG", "ARS"];
  const redondeado = monedasGrandes.includes(moneda)
    ? Math.round(v / 1000) * 1000
    : Math.round(v);
  return `${redondeado.toLocaleString("es-CO")} ${moneda}`;
}
