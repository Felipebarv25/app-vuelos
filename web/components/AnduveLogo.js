"use client";
import React from "react";

/**
 * AnduveLogo — lockup horizontal: ícono + wordmark "ANDU"+"VE".
 *
 * SVG tomada del archivo Anduve-Logo-Web del usuario (la versión
 * estática). El ícono es el mismo que AnduveIcon pero sin órbita
 * de landmarks — solo el walker en la cima del planeta.
 *
 *   <AnduveLogo />                       // teal (fondos claros)
 *   <AnduveLogo variant="white" />       // blanco (fotos / fondos oscuros)
 *   <AnduveLogo animate />               // walker animado bobbing + sway
 *
 * Nota: el wordmark "ANDU" usa el color principal (ink); "VE" siempre coral.
 */
const PRESETS = {
  teal:  { ink: "#0c5f58", accent: "#f4734d", surface: "rgba(12,95,88,0.09)",   halo: "#f6f4ee" },
  white: { ink: "#ffffff", accent: "#ff9d7a", surface: "rgba(255,255,255,0.12)", halo: "#1d3a33" },
};

// Versión estática (sin órbita de landmarks): solo planeta + walker.
// Esta es la SVG del Anduve-Logo-Web.html con viewBox="11 -63 156 156".
const INNER_STATIC = `<defs><clipPath id="%CLIP%" clipPathUnits="userSpaceOnUse"><rect x="-260" y="-130" width="720" height="258"/></clipPath></defs>
<g clip-path="url(#%CLIP%)">
  <circle cx="100" cy="332" r="260" style="fill:var(--vj-surface,rgba(255,255,255,0.12));" stroke="none"/>
</g>
<g transform="translate(0 13) translate(100 73) scale(3) translate(-100 -73)">
  <g fill="currentColor" stroke="none">
    <g transform="rotate(-21 100 56)">
      <path d="M98.5 56 L101.5 56 L101.5 62 L98.5 62 Z"/><circle cx="100" cy="62" r="1.5"/>
      <g transform="rotate(3 100 62)"><path d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z"/></g>
    </g>
    <g transform="rotate(23 100 56)">
      <path d="M98.5 56 L101.5 56 L101.5 62 L98.5 62 Z"/><circle cx="100" cy="62" r="1.5"/>
      <g transform="rotate(10 100 62)"><path d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z"/></g>
    </g>
    <g transform="rotate(-13 100 56)">
      <g transform="rotate(-26 100 41)"><path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z"/><path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z"/></g>
      <rect x="89" y="43.5" width="8" height="11" rx="3" style="fill:var(--vj-accent,#f4734d);"/>
      <rect x="94.4" y="42.5" width="1.9" height="10" rx="0.9" style="fill:var(--vj-accent,#f4734d);"/>
      <path d="M97.7 40.5 C97.7 38.2 103.1 38.2 103.1 40.5 L104 54.5 Q104 59 100.4 59 Q96.8 59 96.8 54.5 Z"/>
      <g transform="rotate(26 100 41)"><path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z"/><path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z"/></g>
      <circle cx="100.4" cy="32.5" r="5.2"/>
      <path d="M104.5 31.1 Q106.7 31.5 106.6 32.6 Q106.5 33.7 104.5 34.1 Z"/>
      <path d="M95.3 33 Q94.9 26.4 100.4 26.4 Q105.9 26.4 105.5 33 Q104 30.1 101 30.5 Q97.6 30.9 95.3 33 Z"/>
    </g>
  </g>
</g>`;

// Versión estática del ícono — solo planeta + walker, sin órbita.
function AnduveIconStatic({ size = 60, variant = "teal", className = "", style = {}, ...rest }) {
  const p = PRESETS[variant] || PRESETS.teal;
  const uid = "vj" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const html = INNER_STATIC.replace(/%CLIP%/g, uid);
  return (
    <svg
      // viewBox tightened + preserveAspectRatio="xMinYMid meet" para
      // alinear el walker a la IZQUIERDA del SVG container (no centrado
      // horizontalmente). Así el tagline debajo del pill se alinea con
      // el walker SIN compensar offset interno del SVG.
      viewBox="35 -55 130 145"
      preserveAspectRatio="xMinYMid meet"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{
        color: p.ink,
        ["--vj-accent"]: p.accent,
        ["--vj-surface"]: p.surface,
        overflow: "hidden",
        display: "block",
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  );
}

export default function AnduveLogo({
  variant = "teal",
  iconSize = 60,
  // Proporciones EXACTAS de la referencia Anduve-Logo-Web.html del
  // usuario:
  //   - icon 138px, font 74px → font ≈ icon × 0.535
  //   - gap 104px → gap ≈ icon × 0.75
  //   El translateY (textShiftY) lo quitamos: en el pill chico
  //   `align-items: center` del flex ya centra naturalmente y cualquier
  //   shift adicional lo desbalancea.
  fontSize = Math.round(iconSize * 0.535),
  // Gap reducido a 0.30 para que ANDUVE quede pegado al walker
  // (iteración con el usuario — la referencia ZIP era 0.75 pero a
  // tamaños chicos quedaba con demasiado aire).
  gap = Math.round(iconSize * 0.20),
  animate = false,
  style = {},
}) {
  const isWhite = variant === "white";
  const word = isWhite ? "#ffffff" : "#0c5f58";
  const acento = isWhite ? "#ff9d7a" : "#f4734d";
  // IMPORTANTE: el lockup SIEMPRE usa la versión estática (walker + planeta,
  // sin landmarks orbitando). Coincide con la referencia del usuario
  // (Anduve-Logo-Web.html). La versión animada con orbital se ve "ancha"
  // y descuadrada cuando va junto al wordmark — el orbital satura. El
  // walker estático es la composición correcta para uso con texto.
  // El `animate` prop entrante se ignora aquí; usar <AnduveIcon> directo
  // para la versión animada standalone.
  // Shift hacia abajo del wordmark — el centro óptico de Sora en
  // mayúsculas queda visualmente alto vs el walker. 0.10 = iteración
  // con el usuario.
  const textShiftY = Math.round(iconSize * 0.07);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap, ...style }}>
      <AnduveIconStatic size={iconSize} variant={variant} />
      <span
        style={{
          fontFamily: "var(--font-sora), Sora, system-ui, sans-serif",
          fontWeight: 800,
          fontSize,
          letterSpacing: "-0.02em",
          lineHeight: 1,
          transform: `translateY(${textShiftY}px)`,
        }}
      >
        <span style={{ color: word }}>ANDU</span>
        <span style={{ color: acento }}>VE</span>
      </span>
    </span>
  );
}
