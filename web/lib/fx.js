// Tasas de cambio en vivo. "porUsd" = cuántas unidades de moneda local equivalen
// a 1 USD (p. ej. COP ≈ 3.600/USD). Antes estas tasas estaban "quemadas" en el
// código y se desactualizaban; ahora se traen de un feed real y SOLO se usan
// valores de respaldo si la red falla.

import { cacheado } from "./cache";

export const PORUSD_FALLBACK = {
  USD: 1, COP: 4000, MXN: 18, EUR: 0.92, PEN: 3.7, CLP: 950, ARS: 1000,
  BRL: 5.4, UYU: 40, BOB: 6.9, CRC: 520, CAD: 1.36, CUP: 120, GBP: 0.79,
  CZK: 23, HUF: 360, TRY: 34, JPY: 150, KRW: 1350, THB: 35, IDR: 16000,
  SGD: 1.35, AED: 3.67, CNY: 7.2, INR: 84, MAD: 10, EGP: 49, ZAR: 18,
  AUD: 1.5, NZD: 1.65,
};

export const MONEDAS_USADAS = Object.keys(PORUSD_FALLBACK);
const FUENTE = "https://open.er-api.com/v6/latest/USD";

export async function obtenerTasas() {
  return cacheado(
    "fx:porUsd",
    6 * 3600 * 1000,
    async () => {
      try {
        const r = await fetch("/api/fx");
        if (!r.ok) throw new Error("fx " + r.status);
        const d = await r.json();
        if (d && d.porUsd && d.porUsd.COP && d.enVivo) {
          return { porUsd: d.porUsd, fecha: d.fecha || null, fuente: d.fuente || null, enVivo: true };
        }
        throw new Error("fx sin datos en vivo");
      } catch {
        return { porUsd: PORUSD_FALLBACK, fecha: null, fuente: null, enVivo: false };
      }
    },
    (d) => d && d.enVivo
  );
}

// Versión servidor: no depende de una URL relativa (/api/fx), porque las rutas
// API se ejecutan sin contexto de navegador. Mantiene el mismo feed y respaldo.
export async function obtenerTasasServidor() {
  try {
    const r = await fetch(FUENTE, { next: { revalidate: 21600 } });
    if (!r.ok) throw new Error("er-api " + r.status);
    const d = await r.json();
    if (d.result !== "success" || !d.rates) throw new Error("er-api sin rates");
    const porUsd = { USD: 1 };
    for (const cod of MONEDAS_USADAS) {
      const v = d.rates[cod];
      porUsd[cod] = typeof v === "number" && v > 0 ? v : PORUSD_FALLBACK[cod];
    }
    return { porUsd, fecha: d.time_last_update_utc || null, fuente: "open.er-api.com", enVivo: true };
  } catch {
    return { porUsd: PORUSD_FALLBACK, fecha: null, fuente: "respaldo", enVivo: false };
  }
}

export function aUsdDe(porUsd, cod) {
  const p = porUsd?.[cod];
  return p && p > 0 ? 1 / p : null;
}
