import React from "react";
import Viajero360Icon from "./Viajero360Icon";

/**
 * Lockup completo: ícono + "Viajero 360".
 * Usa la fuente que prefieras (el sistema usa "Sora"). El "360" va en coral.
 *
 *   <Viajero360Logo />                      // teal, horizontal
 *   <Viajero360Logo variant="white" />      // para fotos / fondos oscuros
 */
export default function Viajero360Logo({
  variant = "teal",
  iconSize = 40,
  fontSize = 22,
  gap = 10,
  animate = true,
  style = {},
}) {
  const isWhite = variant === "white";
  const word = isWhite ? "#ffffff" : "#0f766e";
  const num = isWhite ? "#ff9d7a" : "#f4734d";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, ...style }}>
      <Viajero360Icon size={iconSize} variant={variant} animate={animate} />
      <span style={{ fontFamily: "var(--font-sora), Sora, system-ui, sans-serif", fontWeight: 800, fontSize, letterSpacing: "-0.01em", lineHeight: 1 }}>
        <span style={{ color: word }}>Viajero</span>
        <span style={{ color: num }}> 360</span>
      </span>
    </span>
  );
}
