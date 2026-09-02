"use client";
// Bandera de país como PNG (flagcdn), no como emoji.
//
// Los emoji de bandera (🇨🇴) NO renderizan en Windows: Segoe UI Emoji no
// incluye las banderas, así que el navegador dibuja los dos indicadores
// regionales como letras sueltas y el usuario ve "co Colombia" en vez de
// "🇨🇴 Colombia" (justo lo que pasaba en los chips de /ofertas).
//
// Vivía copiado en Ofertas.js y SelectorPais.js; al agregar el tercer uso
// (SelectorOrigen) se centralizó aquí.
export default function Bandera({ cc, size = 16, className = "" }) {
  if (!cc) return null;
  const lo = String(cc).toLowerCase();
  const alto = Math.round(size * 0.75);
  return (
    <img
      src={`https://flagcdn.com/${size}x${alto}/${lo}.png`}
      srcSet={`https://flagcdn.com/${size * 2}x${alto * 2}/${lo}.png 2x`}
      alt=""
      width={size}
      height={alto}
      className={`inline-block rounded-[2px] align-middle ${className}`}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
