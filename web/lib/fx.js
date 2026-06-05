// Tasas de cambio en vivo. "porUsd" = cuántas unidades de moneda local equivalen
// a 1 USD (p. ej. COP ≈ 3.600/USD). Antes estas tasas estaban "quemadas" en el
// código (COP fijo en 4.000) y se desactualizaban con el tiempo; ahora se traen
// de /api/fx (que consulta un feed real) y SOLO se usan estos valores como
// respaldo si la red falla, para que la app nunca se quede sin tasas.

import { cacheado } from "./cache";

// Valores de respaldo orientativos (los que estaban quemados en la app).
export const PORUSD_FALLBACK = {
  USD: 1,
  COP: 4000,
  MXN: 18,
  EUR: 0.92,
  PEN: 3.7,
  CLP: 950,
  ARS: 1000,
  BRL: 5.4,
  UYU: 40,
  BOB: 6.9,
  CRC: 520,
  CAD: 1.36,
  CUP: 120,
  GBP: 0.79,
  CZK: 23,
  HUF: 360,
  TRY: 34,
  JPY: 150,
  KRW: 1350,
  THB: 35,
  IDR: 16000,
  SGD: 1.35,
  AED: 3.67,
  CNY: 7.2,
  INR: 84,
  MAD: 10,
  EGP: 49,
  ZAR: 18,
  AUD: 1.5,
  NZD: 1.65,
};

// Monedas que la app necesita convertir (presupuesto + costos locales por país).
export const MONEDAS_USADAS = Object.keys(PORUSD_FALLBACK);

// Tasas en vivo desde /api/fx, cacheadas 6 h en memoria + localStorage. Si la
// petición falla, devuelve los valores de respaldo (enVivo:false) y NO los
// cachea, para reintentar la próxima vez.
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
    (d) => d && d.enVivo // solo cachea si vino en vivo
  );
}

// USD que vale 1 unidad de la moneda (lo que el módulo de presupuesto llama
// "aUsd"). p. ej. con COP a 3.600 → 1 COP = 1/3600 USD. Devuelve null si no se
// conoce la moneda, para que el llamador use su propio respaldo.
export function aUsdDe(porUsd, cod) {
  const p = porUsd?.[cod];
  return p && p > 0 ? 1 / p : null;
}
