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
import { altoDeBandera } from "@/data/proporcionesBandera";

export default function Bandera({ cc, size = 16, className = "" }) {
  if (!cc) return null;
  const lo = String(cc).toLowerCase();
  // El alto es el REAL de esta bandera, no una proporcion supuesta.
  //
  // Aqui hubo 4:3 a pelo (size * 0.75) y no lo es casi ninguna: de los 242
  // paises que la app puede pintar, 109 son 3:2 y 73 son 2:1. El preflight de
  // Tailwind (`img { height: auto }`) pisaba ese atributo, asi que el
  // navegador reservaba un alto y repintaba en otro — 5,8 px de salto medidos
  // en Mexico, con 207 banderas en /destino.
  //
  // El intento intermedio fue fijar la caja a 4:3 con `object-fit: contain`.
  // Quitaba el salto pero encogia las mas altas: Suiza, que es CUADRADA,
  // salia a 18 px de ancho donde sus vecinas iban a 24. Con la tabla de
  // proporciones no hay que elegir entre las dos cosas.
  //
  // `contain` se queda como red: si llega un cc que no esta en la tabla, la
  // caja sera la del defecto y la bandera se ajusta dentro sin deformarse.
  const alto = altoDeBandera(cc, size);
  // Se pide por ANCHO (w40), no por "anchoxalto".
  //
  // flagcdn solo sirve un juego cerrado de tamanos, y cada uno tiene su alto
  // fijo: 36x27 existe, 36x28 no. Como el alto se calculaba redondeando
  // (size 18 -> 14, y a 2x -> 36x28), la bandera de Colombia daba 404 y
  // desaparecia. Con w<N> lo calcula flagcdn y siempre acierta.
  const w = (n) => `https://flagcdn.com/w${n}/${lo}.png`;
  // Los anchos que sirve flagcdn; se toma el primero que llegue al pedido.
  const ANCHOS = [20, 40, 80, 160, 320];
  const elegir = (px) => ANCHOS.find((a) => a >= px) || ANCHOS[ANCHOS.length - 1];
  return (
    <img
      src={w(elegir(size))}
      srcSet={`${w(elegir(size * 2))} 2x`}
      alt=""
      width={size}
      height={alto}
      style={{ height: alto, objectFit: "contain" }}
      className={`inline-block rounded-[2px] align-middle ${className}`}
      loading="lazy"
      onError={(e) => { e.currentTarget.style.display = "none"; }}
    />
  );
}
