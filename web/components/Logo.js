// Logo de marca v4 — inspirado en la referencia que envio el usuario:
// composicion estatica con TODOS los elementos visibles al mismo tiempo.
// Viajero protagonista (silueta clara de perfil con mochila caminando a la
// derecha) sobre el horizonte de un planeta, con landmarks distribuidos
// alrededor: Torre Eiffel, pinos, casas, montanas nevadas, edificios. Sol
// arriba a la derecha y flecha curva arriba a la izquierda (sugieren
// movimiento/destino).
//
// Animacion (opt-in via `animado`): subtil swagger del viajero (estilo Liam
// Gallagher) + sol gira lentamente. La composicion principal es estatica
// para que se lea como logo de empresa a cualquier tamano.
// Respeta prefers-reduced-motion.
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
      {/* Anillo exterior grueso — contenedor de la composicion */}
      <circle
        cx="50"
        cy="50"
        r="46"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />

      {/* ===== Decoraciones arriba (sol + flecha) ===== */}

      {/* Flecha curva arriba izq — sugiere viaje */}
      <g opacity="0.7">
        <path
          d="M 15 28 Q 25 18 36 22"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 33 18 L 36 22 L 32 24"
          stroke="currentColor"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Sol arriba derecha. Doble wrapper: el exterior posiciona (transform
          SVG nativo), el interior rota (CSS animation). Sin esto, la
          animacion de rotacion borraria el translate. */}
      <g transform="translate(78 22)">
        <g className="logo-sol">
          <circle r="3.6" fill="currentColor" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
            <line
              key={deg}
              x1="0"
              y1="-5.2"
              x2="0"
              y2="-7.2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              transform={`rotate(${deg})`}
            />
          ))}
        </g>
      </g>

      {/* ===== Planeta (mitad inferior visible) ===== */}

      {/* Cuerpo solido del planeta */}
      <circle cx="50" cy="92" r="32" fill="currentColor" opacity="0.88" />

      {/* Continentes simples (formas blobby como en la referencia) */}
      <g fill="#fff" opacity="0.28">
        <path d="M 38 76 Q 42 73 46 75 Q 48 78 45 80 Q 40 80 38 76 Z" />
        <path d="M 56 78 Q 62 74 65 77 Q 67 81 62 82 Q 57 82 56 78 Z" />
        <path d="M 30 84 Q 33 81 36 83 Q 35 86 32 86 Q 30 85 30 84 Z" />
      </g>

      {/* Linea del horizonte (suelo donde estan los landmarks) */}
      <path
        d="M 18 60 Q 50 70 82 60"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />

      {/* ===== Landmarks SOBRE el horizonte ===== */}

      {/* Torre Eiffel (izquierda) */}
      <g transform="translate(24 60)">
        <path d="M -3 0 L 0 -14 L 3 0" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="-2.3" y1="-4" x2="2.3" y2="-4" stroke="currentColor" strokeWidth="1.1" />
        <line x1="-1.6" y1="-8" x2="1.6" y2="-8" stroke="currentColor" strokeWidth="1" />
        <line x1="-1" y1="-11" x2="1" y2="-11" stroke="currentColor" strokeWidth="0.9" />
        <circle cx="0" cy="-14" r="0.6" fill="currentColor" />
      </g>

      {/* Pinos (entre Eiffel y viajero) */}
      <g transform="translate(33 61.5)">
        <path d="M -2.6 0 L 0 -7 L 2.6 0 Z" fill="currentColor" />
        <rect x="-0.5" y="0" width="1" height="1.5" fill="currentColor" />
      </g>
      <g transform="translate(39 62.3)">
        <path d="M -2.2 0 L 0 -6 L 2.2 0 Z" fill="currentColor" />
        <rect x="-0.45" y="0" width="0.9" height="1.3" fill="currentColor" />
      </g>

      {/* Casita (al lado de los pinos) */}
      <g transform="translate(44.5 63)">
        <rect x="-2" y="-4" width="4" height="4" fill="currentColor" />
        <path d="M -2.5 -4 L 0 -6 L 2.5 -4" stroke="currentColor" strokeWidth="1" fill="currentColor" />
        <rect x="-0.6" y="-2.5" width="1.2" height="2.5" fill="#fff" opacity="0.5" />
      </g>

      {/* Montanas nevadas (derecha del viajero) */}
      <g transform="translate(64 63)">
        <path d="M -5 0 L -1 -6 L 1.5 -3 L 4 -8 L 7 0 Z" fill="currentColor" />
        <path d="M 3 -6 L 4 -8 L 5 -6 L 4 -5 Z" fill="#fff" opacity="0.65" />
        <path d="M -1.5 -4.5 L -1 -6 L -0.5 -4.5 L -1 -3.8 Z" fill="#fff" opacity="0.55" />
      </g>

      {/* Edificios derecha (rascacielos) */}
      <g transform="translate(77 62)">
        <rect x="-2.5" y="-5" width="2" height="5" fill="currentColor" />
        <rect x="-0.2" y="-7" width="2.2" height="7" fill="currentColor" />
        <rect x="2.3" y="-4" width="1.8" height="4" fill="currentColor" />
        {/* ventanas */}
        <rect x="-2.1" y="-4.2" width="0.4" height="0.4" fill="#fff" opacity="0.6" />
        <rect x="-2.1" y="-3" width="0.4" height="0.4" fill="#fff" opacity="0.6" />
        <rect x="0.2" y="-5.8" width="0.4" height="0.4" fill="#fff" opacity="0.6" />
        <rect x="0.2" y="-4.4" width="0.4" height="0.4" fill="#fff" opacity="0.6" />
        <rect x="0.2" y="-3" width="0.4" height="0.4" fill="#fff" opacity="0.6" />
        <rect x="2.7" y="-3" width="0.4" height="0.4" fill="#fff" opacity="0.6" />
      </g>

      {/* ===== VIAJERO PROTAGONISTA (centrado, perfil mirando a la derecha) ===== */}

      <g transform="translate(52 60)">
        <g className="logo-viajero">
          {/* Mochila atras (lado izq porque mira a la derecha) — tamano notable */}
          <rect x="-5" y="-12" width="3.6" height="11" rx="1" fill="currentColor" />
          <path d="M -1.6 -12 Q -0.8 -14 1.4 -13" stroke="currentColor" strokeWidth="0.9" fill="none" opacity="0.85" strokeLinecap="round" />

          {/* Cabeza ligeramente inclinada hacia adelante */}
          <circle cx="1" cy="-17" r="3.6" fill="currentColor" />

          {/* Cuerpo: torso con lean adelante (Gallagher posture) */}
          <path
            d="M -2.2 -13.5 Q -2.5 -14.5 0.8 -14.5 Q 3.8 -14.5 3.8 -13.5 L 3 -3 L -1.3 -3 Z"
            fill="currentColor"
          />

          {/* Brazo unico visible (perfil): swing forward */}
          <line
            x1="3"
            y1="-12"
            x2="6"
            y2="-4.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />

          {/* Piernas en paso (una adelantada, una atras). El traveler camina
              SOBRE el horizonte: las piernas terminan en y=0 (linea horizonte) */}
          <line
            x1="-0.5"
            y1="-3"
            x2="-3"
            y2="0"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
          <line
            x1="2"
            y1="-3"
            x2="4"
            y2="0"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
          />
        </g>
      </g>
    </svg>
  );
}

// Logo + nombre, para cabeceras. `tono`: 'claro' (texto blanco) | 'marca' (teal).
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
