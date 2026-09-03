// Ilustracion de fondo del banner de viaje.
//
// La franja derecha del banner estaba vacia: media tarjeta de degradado sin
// nada que decir. Esto la ocupa con un trayecto punteado, sus pines y el
// muneco de Anduve caminando encima — el mismo del logo, con su mochila coral.
//
// Es GENERICA a proposito. No hay ilustracion por ciudad ni assets externos:
// un SVG inline sirve para Madrid y para Tokio, pesa nada y no falla si se cae
// un CDN. Va detras del texto y sin capturar clics.
//
// Los pines NO representan las paradas reales. Es decoracion, y mezclarla con
// el dato induciria a leer un mapa donde no hay mapa: el mapa de verdad esta
// mas abajo en la tarjeta.
//
// El viewBox es MUY ancho (420x110) a proposito. Con `slice` el navegador
// recorta el eje que sobra, y con un viewBox mas alto recortaba por arriba y
// por abajo: el pin de origen quedaba fuera de la tarjeta. Estas proporciones
// son las del banner real, asi que apenas hay recorte.

const CORAL = "#f4734d";

export default function IlustracionRuta({ className = "" }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full ${className}`}
      viewBox="0 0 420 110"
      preserveAspectRatio="xMaxYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        {/* Profundidad: un halo verde arriba a la derecha, donde el degradado
            del banner ya es mas claro. */}
        <radialGradient id="halo-ruta" cx="0.84" cy="0.2" r="0.7">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="420" height="110" fill="url(#halo-ruta)" />

      {/* El trayecto. Punteado corto y muy separado, como los mapas de vuelo.
          Arranca abajo a la izquierda y sube a la derecha, para no cruzarse ni
          con el titulo (izquierda) ni con el boton de volver (arriba). */}
      <path
        d="M244 88 C 272 80, 280 58, 302 50 C 324 42, 344 48, 366 34"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />

      {/* Pines. El de origen en coral: es de donde sales, y es el unico punto
          del recorrido que no se elige dos veces. */}
      <circle cx="244" cy="88" r="7.5" fill={CORAL} />
      <circle cx="244" cy="88" r="2.6" fill="#ffffff" />

      {[
        [302, 50, "2"],
        [366, 34, "3"],
      ].map(([cx, cy, n]) => (
        <g key={n}>
          <circle cx={cx} cy={cy} r="7.5" fill="#ffffff" fillOpacity="0.85" />
          <text
            x={cx}
            y={cy + 2.9}
            textAnchor="middle"
            fontSize="8.5"
            fontWeight="700"
            fill="#073a36"
          >
            {n}
          </text>
        </g>
      ))}

      {/* EL MUNECO, con los trazos EXACTOS del logo.
          Estaba dibujado a mano — cabeza redonda, torso de una linea, piernas
          de dos trazos — y se parecia, pero no era. La silueta del logo no es
          eso: tiene hombros, la mochila con su correa, el brazo en angulo y la
          cabeza con pelo. Aqui van los mismos paths de AnduveLogo.js, sin
          redibujar nada: en blanco, con la mochila coral, que es lo que lo
          hace reconocible.

          El SVG del logo dibuja al muneco alrededor de (100, 50) en su propio
          sistema; se traslada y se escala a este lienzo. */}
      <g transform="translate(266, 44) scale(0.62) translate(-100, -50)">
        {/* pierna de atras */}
        <g transform="rotate(-10 100 62)">
          <path
            d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z"
            fill="#ffffff"
            fillOpacity="0.92"
          />
        </g>
        {/* pierna de delante */}
        <g transform="rotate(10 100 62)">
          <path
            d="M98.5 62 L101.5 62 L101.5 68.6 Q101.7 69.7 102.6 70.1 Q103.6 70.5 104 71.1 Q104.4 71.5 104.4 71.9 Q104.4 72.3 103.8 72.3 L98.8 72.3 Q98.3 72.3 98.3 71.6 Z"
            fill="#ffffff"
            fillOpacity="0.92"
          />
        </g>
        {/* torso inclinado, con los brazos y la mochila */}
        <g transform="rotate(-13 100 56)">
          <g transform="rotate(-26 100 41)">
            <path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z" fill="#ffffff" fillOpacity="0.92" />
            <path
              d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z"
              fill="#ffffff"
              fillOpacity="0.92"
            />
          </g>
          {/* mochila y su correa, en coral */}
          <rect x="89" y="43.5" width="8" height="11" rx="3" fill={CORAL} />
          <rect x="94.4" y="42.5" width="1.9" height="10" rx="0.9" fill={CORAL} />
          <path
            d="M97.7 40.5 C97.7 38.2 103.1 38.2 103.1 40.5 L104 54.5 Q104 59 100.4 59 Q96.8 59 96.8 54.5 Z"
            fill="#ffffff"
            fillOpacity="0.92"
          />
          <g transform="rotate(26 100 41)">
            <path d="M98.7 41 L101.3 41 L100.7 54.5 L99.3 54.5 Z" fill="#ffffff" fillOpacity="0.92" />
            <path
              d="M99.1 54.5 Q98.4 54.5 98.3 55.6 Q97.5 55.7 97.7 56.6 Q97.9 57.3 98.7 57.2 Q98.8 58.2 99.5 58.4 Q100 58.6 100.5 58.4 Q101.4 58.1 101.4 57 L101.4 55.5 Q101.4 54.5 100 54.5 Z"
              fill="#ffffff"
              fillOpacity="0.92"
            />
          </g>
          {/* cabeza, oreja y pelo */}
          <circle cx="100.4" cy="32.5" r="5.2" fill="#ffffff" fillOpacity="0.92" />
          <path d="M104.5 31.1 Q106.7 31.5 106.6 32.6 Q106.5 33.7 104.5 34.1 Z" fill="#ffffff" fillOpacity="0.92" />
          <path
            d="M95.3 33 Q94.9 26.4 100.4 26.4 Q105.9 26.4 105.5 33 Q104 30.1 101 30.5 Q97.6 30.9 95.3 33 Z"
            fill="#ffffff"
            fillOpacity="0.92"
          />
        </g>
      </g>
    </svg>
  );
}
