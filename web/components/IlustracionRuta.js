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

export default function IlustracionRuta({ className = "", opacidad = 1 }) {
  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-0 h-full w-full ${className}`}
      viewBox="0 0 420 110"
      preserveAspectRatio="xMaxYMid slice"
      fill="none"
      aria-hidden="true"
      style={{ opacity: opacidad }}
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

      {/* El muneco de Anduve, caminando sobre la linea. Cabeza, torso, un
          brazo adelantado, piernas en zancada y la mochila coral, que es lo
          que lo hace reconocible a este tamano. */}
      <g transform="translate(266, 44)">
        {/* mochila: detras del torso, pequena y con esquinas redondeadas */}
        <rect x="-4.6" y="4.6" width="4.6" height="7" rx="1.6" fill={CORAL} fillOpacity="0.95" />
        {/* cabeza */}
        <circle cx="0" cy="0" r="3.1" fill="#ffffff" fillOpacity="0.9" />
        {/* torso */}
        <path
          d="M0 3.4 V12"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
        {/* brazo adelantado */}
        <path
          d="M0.4 6.4 L4.6 4.6"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        {/* piernas en zancada */}
        <path
          d="M0 12 L-3.4 18 M0 12 L4.2 17.2"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
