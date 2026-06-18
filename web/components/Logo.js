"use client";
// Logo de marca v5 — viajero estilo Liam sobre planeta que rota mostrando
// paisajes (ciudad, montañas, árboles, monumentos, museo, playa, sol). Diseño
// proporcionado por el usuario el 2026-06-17, viewBox 200x200, autocontenido
// (SVG inline + @keyframes), themeable por variant (teal/white).
//
// Mantenemos los exports antiguos `Logo` y `LogoMarca` como adaptadores para
// no tener que tocar todos los call-sites de la app. Mapean `tono` ("claro"
// vs "marca") al nuevo `variant` ("white" vs "teal"). En modo oscuro
// `tono="marca"` cambia automáticamente a variant blanco para legibilidad.
import { useApp } from "@/lib/AppContext";
import Viajero360Icon from "./Viajero360Icon";
import Viajero360Logo from "./Viajero360Logo";

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
    <Viajero360Icon
      size={size}
      variant={variantPara(tono, darkMode)}
      animate={animado}
      className={className}
    />
  );
}

// API antigua: <LogoMarca tono size animado className />. Lockup ícono + texto
// "Viajero 360". El "360" siempre en coral; la palabra "Viajero" cambia de
// color según variant.
export function LogoMarca({ tono = "marca", size = 32, className = "", animado = false }) {
  const { darkMode } = useApp();
  return (
    <span className={className}>
      <Viajero360Logo
        variant={variantPara(tono, darkMode)}
        iconSize={size}
        fontSize={Math.round(size * 0.62)}
        animate={animado}
        style={{ verticalAlign: "middle" }}
      />
    </span>
  );
}
