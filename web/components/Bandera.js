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
  // El alto se RESERVA con esta caja, y ademas se impone por CSS.
  //
  // Antes solo iba en el atributo height, y el preflight de Tailwind
  // (`img { height: auto }`) lo pisaba: el navegador reservaba 23 px y luego
  // repintaba a 17,25, porque flagcdn sirve cada bandera con SU proporcion
  // (Mexico 40x23, Suiza cuadrada, Nepal ni siquiera rectangular) y no la
  // 4:3 que asume este calculo. Con `loading="lazy"` y 207 banderas en
  // /destino eso son 207 repintados.
  //
  // `contain` es lo que permite fijar la caja sin deformar: la bandera se
  // dibuja dentro con su proporcion real y sobra aire arriba y abajo, en vez
  // de estirarse a 4:3.
  const alto = Math.round(size * 0.75);
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
