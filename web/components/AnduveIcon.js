"use client";
import React from "react";

/**
 * AnduveIcon — versión ANIMADA del logo (rebrand 2026-06-21).
 *
 * SVG tomada DIRECTAMENTE del archivo Anduve-Logo-Animado del usuario:
 *   - Planeta grande (cy=332, r=260) con landmarks orbitando cada 20s
 *   - Walker estático en la cima del planeta, con bob/sway/legs/arms a 1s
 *   - Keyframes vj-* viven en globals.css (no inline <style>, para
 *     compatibilidad cross-browser)
 *
 *   <AnduveIcon size={120} />                       // teal (fondos claros)
 *   <AnduveIcon size={120} variant="white" />       // blanco (fotos / fondos oscuros)
 *   <AnduveIcon size={120} animate={false} />       // estático
 */
const PRESETS = {
  teal:  { ink: "#0c5f58", accent: "#f4734d", surface: "rgba(12,95,88,0.09)",   halo: "#f6f4ee" },
  white: { ink: "#ffffff", accent: "#ff9d7a", surface: "rgba(255,255,255,0.12)", halo: "#1d3a33" },
};

const INNER = `<defs><clipPath id="%CLIP%" clipPathUnits="userSpaceOnUse"><rect x="-260" y="-130" width="720" height="258"/></clipPath></defs>
<g clip-path="url(#%CLIP%)">
  <circle cx="100" cy="332" r="260" style="fill:var(--vj-surface,rgba(12,95,88,0.09));" stroke="none"/>
  <g style="transform-box:view-box;transform-origin:100px 332px;animation:vj-spin 20s linear infinite;">
    <g transform="rotate(0 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -20s infinite;"><rect x="85" y="50" width="11" height="22" rx="1"/><rect x="98" y="42" width="12" height="30" rx="1"/><rect x="111" y="57" width="9" height="15" rx="1"/><line x1="101" y1="50" x2="107" y2="50"/><line x1="101" y1="57" x2="107" y2="57"/><g style="stroke:var(--vj-accent,#f4734d);"><line x1="104" y1="42" x2="104" y2="35"/><path d="M104 35 L110 37 L104 40 Z" style="fill:var(--vj-accent,#f4734d);"/></g></g></g>
    <g transform="rotate(45 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -17.5s infinite;"><path d="M80 72 L97 46 L114 72"/><path d="M103 72 L116 56 L122 72"/><path d="M92 53 L97 46 L102 53"/></g></g>
    <g transform="rotate(90 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -15s infinite;"><line x1="91" y1="72" x2="91" y2="62"/><path d="M84 62 L91 48 L98 62 Z"/><path d="M86 68 L91 58 L96 68 Z"/><line x1="108" y1="72" x2="108" y2="65"/><path d="M102 65 L108 54 L114 65 Z"/></g></g>
    <g transform="rotate(135 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -12.5s infinite;"><path d="M93 72 L100 40 L107 72"/><path d="M95 66 Q100 60 105 66"/><line x1="96" y1="58" x2="104" y2="58"/><line x1="97.5" y1="50" x2="102.5" y2="50"/><g style="stroke:var(--vj-accent,#f4734d);"><line x1="100" y1="40" x2="100" y2="33"/><path d="M100 33 L106 35 L100 38 Z" style="fill:var(--vj-accent,#f4734d);"/></g></g></g>
    <g transform="rotate(180 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -10s infinite;"><path d="M83 72 L100 45 L117 72 Z"/><line x1="100" y1="45" x2="109" y2="72"/></g></g>
    <g transform="rotate(225 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -7.5s infinite;"><path d="M85 53 L100 43 L115 53 Z"/><line x1="84" y1="56" x2="116" y2="56"/><line x1="90" y1="56" x2="90" y2="72"/><line x1="97" y1="56" x2="97" y2="72"/><line x1="104" y1="56" x2="104" y2="72"/><line x1="110" y1="56" x2="110" y2="72"/><line x1="84" y1="72" x2="116" y2="72"/></g></g>
    <g transform="rotate(270 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -5s infinite;"><g style="stroke:var(--vj-accent,#f4734d);" stroke-width="2.2"><circle cx="82" cy="35" r="4.4" style="fill:var(--vj-accent,#f4734d);fill-opacity:0.2;"/><line x1="88.5" y1="35" x2="91.5" y2="35"/><line x1="75.5" y1="35" x2="72.5" y2="35"/><line x1="82" y1="28.6" x2="82" y2="25.5"/><line x1="82" y1="41.4" x2="82" y2="44.5"/><line x1="86.6" y1="30.4" x2="88.7" y2="28.3"/><line x1="77.4" y1="39.6" x2="75.3" y2="41.7"/><line x1="86.6" y1="39.6" x2="88.7" y2="41.7"/><line x1="77.4" y1="30.4" x2="75.3" y2="28.3"/></g><path d="M98 72 Q101 60 103 49"/><path d="M103 48 Q91 47 84 54"/><path d="M103 48 Q93 39 86 41"/><path d="M103 48 Q103 38 107 36"/><path d="M103 48 Q113 39 120 41"/><path d="M103 48 Q115 47 122 54"/><circle cx="100.5" cy="51" r="1.6" style="fill:currentColor;" stroke="none"/><circle cx="105.5" cy="51" r="1.6" style="fill:currentColor;" stroke="none"/></g></g>
    <g transform="rotate(315 100 332) translate(0 1.5)"><g style="transform-box:fill-box;transform-origin:50% 86%;animation:vj-pop 20s ease-in-out -2.5s infinite;"><circle cx="100" cy="55" r="13"/><circle cx="100" cy="55" r="1.8" style="fill:currentColor;"/><line x1="100" y1="42" x2="100" y2="68"/><line x1="87" y1="55" x2="113" y2="55"/><line x1="91" y1="46" x2="109" y2="64"/><line x1="109" y1="46" x2="91" y2="64"/><path d="M93 72 L100 55 L107 72"/><circle cx="100" cy="42" r="2.6" style="fill:var(--vj-accent,#f4734d);stroke:var(--vj-accent,#f4734d);"/></g></g>
  </g>
</g>
<g transform="translate(0 13) translate(100 73) scale(3) translate(-100 -73)"><g fill="currentColor" stroke="none" style="transform-box:view-box;transform-origin:100px 72px;animation:vj-bob 0.5s ease-in-out infinite;filter:drop-shadow(0 0 1.8px var(--vj-halo,#f6f4ee)) drop-shadow(0 0 1.8px var(--vj-halo,#f6f4ee)) drop-shadow(0 0 1.8px var(--vj-halo,#f6f4ee));">
  <g style="transform-box:view-box;transform-origin:100px 56px;animation:vj-legb 1s ease-in-out infinite;">
    <path d="M98.5 56 L101.5 56 L101.5 62 L98.5 62 Z"/><circle cx="100" cy="62" r="1.5"/>
    <g style="transform-box:fill-box;transform-origin:28% 0%;animation:vj-kneeb 1s ease-in-out infinite;"><path d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z"/></g>
  </g>
  <g style="transform-box:view-box;transform-origin:100px 56px;animation:vj-legf 1s ease-in-out infinite;">
    <path d="M98.5 56 L101.5 56 L101.5 62 L98.5 62 Z"/><circle cx="100" cy="62" r="1.5"/>
    <g style="transform-box:fill-box;transform-origin:28% 0%;animation:vj-kneef 1s ease-in-out infinite;"><path d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z"/></g>
  </g>
  <g style="transform-box:view-box;transform-origin:100px 56px;animation:vj-sway 1s ease-in-out infinite;">
    <g style="transform-box:view-box;transform-origin:100px 41px;animation:vj-armb 1s ease-in-out infinite;"><path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z"/><path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z"/></g>
    <rect x="89" y="43.5" width="8" height="11" rx="3" style="fill:var(--vj-accent,#f4734d);"/>
    <rect x="94.4" y="42.5" width="1.9" height="10" rx="0.9" style="fill:var(--vj-accent,#f4734d);"/>
    <path d="M97.7 40.5 C97.7 38.2 103.1 38.2 103.1 40.5 L104 54.5 Q104 59 100.4 59 Q96.8 59 96.8 54.5 Z"/>
    <g style="transform-box:view-box;transform-origin:100px 41px;animation:vj-arma 1s ease-in-out infinite;"><path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z"/><path d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z"/></g>
    <circle cx="100.4" cy="32.5" r="5.2"/>
    <path d="M104.5 31.1 Q106.7 31.5 106.6 32.6 Q106.5 33.7 104.5 34.1 Z"/>
    <path d="M95.3 33 Q94.9 26.4 100.4 26.4 Q105.9 26.4 105.5 33 Q104 30.1 101 30.5 Q97.6 30.9 95.3 33 Z"/>
  </g>
</g></g>`;

export default function AnduveIcon({
  size = 120,
  animate = true,
  variant = "teal",
  ink,
  accent,
  surface,
  halo,
  className = "",
  style = {},
  ...rest
}) {
  const p = PRESETS[variant] || PRESETS.teal;
  const _ink = ink ?? p.ink;
  const _accent = accent ?? p.accent;
  const _surface = surface ?? p.surface;
  const _halo = halo ?? p.halo;

  const uid = "vj" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  // Si animate=false, override que congela todas las vj-*.
  const stop = animate
    ? ""
    : `<style>.${uid}-root *{animation:none !important}</style>`;
  const html = stop + INNER.replace(/%CLIP%/g, uid);

  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={uid + "-root " + className}
      style={{
        color: _ink,
        ["--vj-accent"]: _accent,
        ["--vj-surface"]: _surface,
        ["--vj-halo"]: _halo,
        overflow: "visible",
        display: "block",
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
      {...rest}
    />
  );
}
