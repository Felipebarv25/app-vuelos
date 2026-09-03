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

const CORAL = "#f4734d";

export default function IlustracionRuta({ className = "", opacidad = 1 }) {
  return (
    <svg
      className={`absolute inset-0 z-0 h-full w-full pointer-events-none ${className}`}
      viewBox="0 0 420 190"
      preserveAspectRatio="xMaxYMid slice"
      fill="none"
      aria-hidden="true"
      style={{ opacity: opacidad }}
    >
      <defs>
        {/* Profundidad: un halo verde arriba a la derecha, donde el degradado
            del banner ya es mas claro. */}
        <radialGradient id="halo-ruta" cx="0.82" cy="0.16" r="0.62">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="420" height="190" fill="url(#halo-ruta)" />

      {/* El trayecto. Punteado corto y muy separado, como los mapas de vuelo. */}
      <path
        d="M232 148 C 268 132, 274 96, 300 82 C 326 68, 344 76, 366 52"
        stroke="#ffffff"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="2 9"
      />

      {/* Pines. El de origen en coral: es de donde sales, y es el unico punto
          del recorrido que el viajero no elige dos veces. */}
      <g>
        <circle cx="232" cy="148" r="9" fill={CORAL} />
        <circle cx="232" cy="148" r="3.2" fill="#ffffff" />

        {[
          [300, 82, "2"],
          [366, 52, "3"],
        ].map(([cx, cy, n]) => (
          <g key={n}>
            <circle cx={cx} cy={cy} r="8.5" fill="#ffffff" fillOpacity="0.85" />
            <text
              x={cx}
              y={cy + 3.2}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill="#073a36"
            >
              {n}
            </text>
          </g>
        ))}
      </g>

      {/* El muneco de Anduve, caminando sobre la linea. Cabeza, cuerpo,
          piernas en zancada y la mochila coral, que es lo que lo hace
          reconocible a este tamano. */}
      <g transform="translate(258, 96) scale(1.15)" fill="none">
        <circle cx="9" cy="0" r="3.6" fill="#ffffff" fillOpacity="0.9" />
        {/* mochila */}
        <path
          d="M3.2 6.5 h3.4 a1.6 1.6 0 0 1 1.6 1.6 v4.2 a1.6 1.6 0 0 1 -1.6 1.6 h-3.4 z"
          fill={CORAL}
          fillOpacity="0.92"
        />
        {/* cuerpo */}
        <path
          d="M8.6 5.2 v9.4"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* brazo adelantado */}
        <path
          d="M8.8 8 l4.6 -1.6"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="2"
          strokeLinecap="round"
        />
        {/* piernas en zancada */}
        <path
          d="M8.6 14.4 l-3.6 5.4 M8.6 14.4 l4.4 4.8"
          stroke="#ffffff"
          strokeOpacity="0.9"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}
