"use client";
// Muestra, debajo del precio en USD, el equivalente APROXIMADO en la moneda
// local del visitante (COP, MXN, etc.). Razón de pricing: el mercado núcleo
// piensa en su moneda; "US$ 24" genera fricción/incertidumbre, "≈ $96.000 COP"
// es concreto. Es solo display: el cobro real sigue siendo en USD por Lemon
// Squeezy. Si no podemos detectar moneda o tasa, no renderiza nada (degradación
// elegante, nunca mostramos números inventados).
import { useEffect, useState } from "react";
import { obtenerTasas } from "@/lib/fx";
import { aLocalAprox } from "@/lib/precios";

// País (ISO-2) -> moneda local. Solo los mercados relevantes; el resto ve USD.
const PAIS_MONEDA = {
  CO: "COP", MX: "MXN", CL: "CLP", PE: "PEN", AR: "ARS",
  BR: "BRL", UY: "UYU", PY: "PYG", EC: "USD", VE: "USD",
};

export default function PrecioLocal({ usd, className = "", nota = "tasa aprox." }) {
  const [texto, setTexto] = useState(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // 1) Moneda del visitante (cacheada por sesión para no repetir geo).
        let moneda = null;
        try { moneda = sessionStorage.getItem("v360_moneda_local"); } catch {}
        if (!moneda) {
          const g = await fetch("/api/geo").then((r) => (r.ok ? r.json() : null)).catch(() => null);
          moneda = (g?.pais && PAIS_MONEDA[g.pais]) || "USD";
          try { sessionStorage.setItem("v360_moneda_local", moneda); } catch {}
        }
        // Si el visitante ya ve en USD, no hace falta el aproximado.
        if (!moneda || moneda === "USD") return;

        // 2) Tasas en vivo y conversión.
        const r = await obtenerTasas();
        const aprox = aLocalAprox(usd, moneda, r?.porUsd);
        if (vivo && aprox) setTexto(aprox);
      } catch {}
    })();
    return () => { vivo = false; };
  }, [usd]);

  if (!texto) return null;
  return (
    <div className={`text-[12px] font-semibold text-slate-400 ${className}`}>
      ≈ {texto} · {nota}
    </div>
  );
}
