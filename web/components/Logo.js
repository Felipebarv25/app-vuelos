// Logo de marca: viajero con mochila caminando sobre el horizonte de un
// planeta, con landmarks (arbol, montana, edificio) en la curva. Pasa el prop
// `animado` para activar la version con movimiento (suelo que fluye bajo el
// viajero + leve bobbing al caminar). Usa currentColor para integrarse al
// contexto (blanco sobre foto, teal sobre fondo claro).
export function Logo({ size = 28, className = "", animado = false }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={`${className} ${animado ? "logo-animado" : ""}`}
      aria-hidden="true"
    >
      {/* Anillo exterior con guiones — concepto 360 / globo */}
      <circle
        cx="32"
        cy="40"
        r="26"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2.4 3.4"
        opacity="0.32"
      />

      {/* Arco solido del horizonte (la "tierra") */}
      <path
        d="M 8 42 A 24 24 0 0 1 56 42"
        stroke="currentColor"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />

      {/* Arco con guiones encima — anima como flujo de la tierra bajo el viajero */}
      <path
        className="logo-flujo"
        d="M 8 42 A 24 24 0 0 1 56 42"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="3 5"
        fill="none"
        strokeLinecap="round"
        opacity="0.45"
      />

      {/* Landmarks fijos en la curva: arbol (izq), montana (centro-izq), edificio (der) */}
      <g opacity="0.6">
        {/* Arbol */}
        <g transform="translate(14 39)">
          <circle cx="0" cy="-2.2" r="2.2" fill="currentColor" />
          <rect x="-0.4" y="0" width="0.8" height="2" fill="currentColor" />
        </g>
        {/* Montana */}
        <path d="M 21 41 L 25 33.5 L 29 41 Z" fill="currentColor" />
        {/* Edificio */}
        <g transform="translate(47 39)">
          <rect x="-2.4" y="-5" width="4.8" height="7" fill="currentColor" />
          <rect x="-1.6" y="-4" width="0.9" height="0.9" fill="#fff" opacity="0.85" />
          <rect x="-0.2" y="-4" width="0.9" height="0.9" fill="#fff" opacity="0.85" />
          <rect x="1.2" y="-4" width="0.9" height="0.9" fill="#fff" opacity="0.85" />
          <rect x="-1.6" y="-2.4" width="0.9" height="0.9" fill="#fff" opacity="0.85" />
          <rect x="-0.2" y="-2.4" width="0.9" height="0.9" fill="#fff" opacity="0.85" />
          <rect x="1.2" y="-2.4" width="0.9" height="0.9" fill="#fff" opacity="0.85" />
        </g>
      </g>

      {/* Viajero en el polo norte (centro) — el wrapper de transform fija la
          posicion, el group interno hace el bobbing del caminar */}
      <g transform="translate(32 17)">
        <g className="logo-viajero">
          {/* Mochila — visible detras del cuerpo, ligeramente al lado */}
          <rect x="-4.6" y="2.5" width="3.2" height="6" rx="0.9" fill="currentColor" opacity="0.85" />
          {/* Cabeza */}
          <circle cx="0" cy="-0.6" r="2.5" fill="currentColor" />
          {/* Cuerpo — torso con hombros */}
          <path
            d="M -2.3 2.4 Q -2.3 1.6 0 1.6 Q 2.3 1.6 2.3 2.4 L 1.8 10 L -1.8 10 Z"
            fill="currentColor"
          />
          {/* Piernas (caminando) */}
          <line x1="-1" y1="10" x2="-2.2" y2="15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          <line x1="1" y1="10" x2="2" y2="15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

// Logo + nombre, para cabeceras. `tono`: 'claro' (texto blanco) | 'marca' (teal).
// Pasa `animado` para que el logo del header tambien camine.
export function LogoMarca({ tono = "marca", size = 28, className = "", animado = false }) {
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
