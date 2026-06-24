"use client";
// Logo de marca Anduve (rebrand 2026-06-21) — mismo viajero estilo Liam sobre
// planeta que rota; teal base #0c5f58, wordmark "ANDU" + "VE" coral.
// Autocontenido (SVG inline + @keyframes), themeable por variant (teal/white).
//
// Mantenemos los exports antiguos `Logo` y `LogoMarca` como adaptadores para
// no tener que tocar todos los call-sites de la app. Mapean `tono` ("claro"
// vs "marca") al nuevo `variant` ("white" vs "teal"). En modo oscuro
// `tono="marca"` cambia automáticamente a variant blanco para legibilidad.
import { useApp } from "@/lib/AppContext";
import AnduveIcon from "./AnduveIcon";
import AnduveLogo from "./AnduveLogo";

function variantPara(tono, darkMode) {
  if (tono === "claro") return "white";
  return darkMode ? "white" : "teal";
}

// API antigua: <Logo size animado tono className />
//  - tono "claro"  → variant blanco + coral (para fotos/fondos oscuros).
//  - tono "marca" (default) → teal en claro, blanco en oscuro.
// `animado` se mapea a `animate`; el ícono NUEVO está animado por defecto
// con planeta rotando + viajero caminando (sway/arms/legs).
export function Logo({ size = 32, className = "", animado = false, tono = "marca" }) {
  const { darkMode } = useApp();
  return (
    <AnduveIcon
      size={size}
      variant={variantPara(tono, darkMode)}
      animate={animado}
      className={className}
    />
  );
}

// API antigua: <LogoMarca tono size animado className />. Lockup ícono + texto
// "ANDUVE". La "VE" siempre en coral; "ANDU" cambia de color según variant.
export function LogoMarca({ tono = "marca", size = 32, className = "", animado = false }) {
  const { darkMode } = useApp();
  return (
    <span className={className}>
      <AnduveLogo
        variant={variantPara(tono, darkMode)}
        iconSize={size}
        animate={animado}
        style={{ verticalAlign: "middle" }}
      />
      {/* fontSize, gap y translateY los calcula AnduveLogo con las
          proporciones EXACTAS de la referencia del usuario (font ≈
          icon×0.535, gap ≈ icon×0.75). No pasamos overrides. */}
    </span>
  );
}
