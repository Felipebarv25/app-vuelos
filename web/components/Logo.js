// Logo de marca: viajero con mochila CAMINANDO sobre un planeta que rota
// trayendo landmarks de fondo (Eiffel, montana, bosque, ciudad, piramide).
// Caminata estilo Liam Gallagher (swagger lateral, arms ligeramente afuera,
// sin grandes balanceos, head ligeramente forward).
//
// Prop `animado` activa la rotacion del planeta (12s linear) + swagger del
// viajero (1.4s con rotacion -1deg/+1deg). Respeta prefers-reduced-motion.
// Monocromatico (currentColor) para integrarse con el contexto.
export function Logo({ size = 32, className = "", animado = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      className={`${className} ${animado ? "logo-animado" : ""}`}
      aria-hidden="true"
    >
      {/* Anillo exterior dasheado (concepto 360 / globo, estatico) */}
      <circle
        cx="50"
        cy="62"
        r="44"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2.5 3.5"
        opacity="0.28"
      />

      {/* GRUPO ROTATORIO: planeta + landmarks anclados a su superficie */}
      <g className="logo-planeta">
        {/* Linea solida del planeta */}
        <circle
          cx="50"
          cy="62"
          r="34"
          stroke="currentColor"
          strokeWidth="2.4"
          fill="none"
        />

        {/* Landmarks posicionados en la perimetria del planeta, orientados
            radialmente hacia afuera. Cada uno usa transform translate+rotate
            para anclarse al punto de la circunferencia y apuntar hacia afuera. */}

        {/* 2 o'clock: TORRE EIFFEL (60 grados) — pos (79.4, 45) */}
        <g transform="translate(79.4 45) rotate(60)">
          <path
            d="M -2.4 0 L 0 -9 L 2.4 0 Z"
            stroke="currentColor"
            strokeWidth="0.9"
            fill="none"
            strokeLinejoin="round"
          />
          <line x1="-1.7" y1="-3" x2="1.7" y2="-3" stroke="currentColor" strokeWidth="0.8" />
          <line x1="-1.2" y1="-5.5" x2="1.2" y2="-5.5" stroke="currentColor" strokeWidth="0.8" />
          <circle cx="0" cy="-9" r="0.5" fill="currentColor" />
        </g>

        {/* 4 o'clock: MONTANA (120 grados) — pos (79.4, 79) */}
        <g transform="translate(79.4 79) rotate(120)">
          <path d="M -4 0 L -1.2 -5 L 0.5 -3 L 2 -7 L 4 0 Z" fill="currentColor" />
          <path d="M -1.2 -5 L 0 -3.2 L 0.5 -3" fill="#fff" opacity="0.5" />
        </g>

        {/* 6 o'clock: BOSQUE (180 grados) — pos (50, 96) */}
        <g transform="translate(50 96) rotate(180)">
          <circle cx="-2.6" cy="-2.5" r="1.8" fill="currentColor" />
          <rect x="-2.9" y="-1" width="0.6" height="1.4" fill="currentColor" />
          <circle cx="0" cy="-3.2" r="2.1" fill="currentColor" />
          <rect x="-0.3" y="-1.5" width="0.6" height="1.7" fill="currentColor" />
          <circle cx="2.6" cy="-2.5" r="1.8" fill="currentColor" />
          <rect x="2.3" y="-1" width="0.6" height="1.4" fill="currentColor" />
        </g>

        {/* 8 o'clock: SKYLINE DE CIUDAD (240 grados) — pos (20.6, 79) */}
        <g transform="translate(20.6 79) rotate(240)">
          <rect x="-4" y="-4" width="1.5" height="4" fill="currentColor" />
          <rect x="-2" y="-6.5" width="1.5" height="6.5" fill="currentColor" />
          <rect x="0" y="-3.5" width="1.5" height="3.5" fill="currentColor" />
          <rect x="2" y="-5.5" width="1.7" height="5.5" fill="currentColor" />
          {/* ventanas */}
          <rect x="-1.7" y="-5.5" width="0.4" height="0.4" fill="#fff" opacity="0.7" />
          <rect x="-1.7" y="-4" width="0.4" height="0.4" fill="#fff" opacity="0.7" />
          <rect x="2.3" y="-4.5" width="0.4" height="0.4" fill="#fff" opacity="0.7" />
          <rect x="2.3" y="-3" width="0.4" height="0.4" fill="#fff" opacity="0.7" />
        </g>

        {/* 10 o'clock: PIRAMIDE (300 grados) — pos (20.6, 45) */}
        <g transform="translate(20.6 45) rotate(300)">
          <path d="M -4 0 L 0 -6 L 4 0 Z" fill="currentColor" />
          {/* lineas de relleno (efecto bloques de piedra) */}
          <line x1="-2.5" y1="-2" x2="2.5" y2="-2" stroke="#fff" strokeWidth="0.4" opacity="0.4" />
          <line x1="-1.4" y1="-4" x2="1.4" y2="-4" stroke="#fff" strokeWidth="0.4" opacity="0.4" />
        </g>
      </g>

      {/* VIAJERO FIJO en la cima — silueta estilo Liam Gallagher: ligero lean
          forward, arms separados del cuerpo, head ligeramente abajo. La
          animacion swagger se aplica al grupo interno. */}
      <g transform="translate(50 22)">
        <g className="logo-viajero">
          {/* Mochila atras (visible al lado izq por la inclinacion) */}
          <rect x="-5.5" y="3" width="3.5" height="7.5" rx="1" fill="currentColor" opacity="0.85" />
          {/* Tira de mochila */}
          <line x1="-3.2" y1="3" x2="-2" y2="2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.85" />

          {/* Cabeza ligeramente inclinada forward (Gallagher head tilt) */}
          <circle cx="0.3" cy="-1" r="3.2" fill="currentColor" />

          {/* Cuerpo con ligero forward lean (Gallagher swagger) */}
          <path
            d="M -2.8 2.5 Q -2.8 1.5 0.3 1.5 Q 3.3 1.5 3.3 2.5 L 2.3 12 L -2 12 Z"
            fill="currentColor"
          />

          {/* Brazos separados del cuerpo (Gallagher style: arms held out, no swing) */}
          {/* Brazo izquierdo */}
          <line x1="-3" y1="4" x2="-5.5" y2="11" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          {/* Brazo derecho */}
          <line x1="3.3" y1="4" x2="5" y2="11.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />

          {/* Piernas caminando: una adelantada, una atrasada (paso de Gallagher) */}
          <line x1="-1" y1="12" x2="-2.8" y2="19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          <line x1="1.5" y1="12" x2="3" y2="19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

// Logo + nombre, para cabeceras. `tono`: 'claro' (texto blanco) | 'marca' (teal).
// Pasa `animado` para que el logo del header tambien camine.
export function LogoMarca({ tono = "marca", size = 32, className = "", animado = false }) {
  const color = tono === "claro" ? "text-white" : "text-marca-600";
  return (
    <span className={`inline-flex items-center gap-2 ${color} ${className}`}>
      <Logo size={size} animado={animado} />
      <span className="font-display text-[20px] font-bold tracking-tight lg:text-[22px]">
        Viajero <span className="text-acento-500">360</span>
      </span>
    </span>
  );
}
