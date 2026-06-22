import React from "react";
import AnduveIcon from "./AnduveIcon";

/**
 * Lockup completo: ícono + "ANDUVE" wordmark.
 * "ANDU" en color de marca + "VE" en coral (rebrand 2026-06-21).
 *
 *   <AnduveLogo />                      // teal, horizontal
 *   <AnduveLogo variant="white" />      // para fotos / fondos oscuros
 */
export default function AnduveLogo({
  variant = "teal",
  iconSize = 40,
  fontSize = 22,
  gap = 10,
  animate = true,
  style = {},
}) {
  const isWhite = variant === "white";
  const word = isWhite ? "#ffffff" : "#0c5f58";
  const acento = isWhite ? "#ff9d7a" : "#f4734d";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, ...style }}>
      <AnduveIcon size={iconSize} variant={variant} animate={animate} />
      <span style={{ fontFamily: "var(--font-sora), Sora, system-ui, sans-serif", fontWeight: 800, fontSize, letterSpacing: "-0.02em", lineHeight: 1 }}>
        <span style={{ color: word }}>ANDU</span>
        <span style={{ color: acento }}>VE</span>
      </span>
    </span>
  );
}
