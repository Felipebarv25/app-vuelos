"use client";
// Precio en USD + moneda local del usuario, en cualquier parte del app
// (feedback 2026-07-11: "no sé cuánto representa US$800 en mi moneda").
//
//   <PrecioDual usd={800} />          ->  US$ 800  ≈ $ 2.673.000 COP
//   <PrecioDual usd={800} soloLocal />  (solo la linea local, para meter
//                                        debajo de un precio ya renderizado)
//
// La moneda sale del pais del usuario (override manual > geo IP > COP).
// Si es USD o no hay tasa, no renderiza la linea local (cero ruido).

import { useEffect, useState } from "react";
import { obtenerTasas } from "@/lib/fx";
import { monedaDePais } from "@/lib/monedas";

// Modulo-level: 1 sola carga de tasas por sesion aunque haya 20 PrecioDual.
let _tasasP = null;
function tasas() {
  if (!_tasasP) _tasasP = obtenerTasas();
  return _tasasP;
}

export function monedaUsuario() {
  try {
    const manual = localStorage.getItem("anduve_moneda_vista");
    if (manual && manual !== "USD") return manual;
    const geo = sessionStorage.getItem("anduve_moneda_geo");
    if (geo) return geo;
    const iso = localStorage.getItem("anduve_pais_iso")
             || sessionStorage.getItem("anduve_pais_iso_geo");
    const m = iso ? monedaDePais(iso) : null;
    if (m) return m;
  } catch {}
  return "COP";
}

export default function PrecioDual({ usd, soloLocal = false, className = "" }) {
  const [local, setLocal] = useState(null); // "≈ $ 2.673.000 COP" | null

  useEffect(() => {
    let vivo = true;
    const mon = monedaUsuario();
    if (!usd || !Number.isFinite(Number(usd)) || mon === "USD") return;
    tasas().then((r) => {
      if (!vivo) return;
      const tasa = r?.porUsd?.[mon];
      if (!tasa || tasa <= 0) return;
      setLocal(`≈ ${Math.round(Number(usd) * tasa).toLocaleString("es-CO")} ${mon}`);
    });
    return () => { vivo = false; };
  }, [usd]);

  if (soloLocal) {
    return local ? <span className={className}>{local}</span> : null;
  }
  return (
    <span className={className}>
      US$ {Math.round(Number(usd)).toLocaleString("en-US")}
      {local && <span className="ml-1.5 font-medium opacity-70">{local}</span>}
    </span>
  );
}
