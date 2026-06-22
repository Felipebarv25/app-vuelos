// Generador de la imagen social (Open Graph / Twitter) 1200x630. La tarjeta
// que sale al compartir el sitio en WhatsApp/Twitter/etc.
//
// Diseño v2 (2026-06-18): alineado con la identidad de marca v5 — wordmark
// "Anduve" en Sora-equivalent con "360" en coral, planeta + viajero
// estilizado evocando el ícono, slogan "Descubre · Planea · Viaja".
//
// El ícono nuevo (AnduveIcon) es demasiado complejo para Satori (que es
// el motor detrás de ImageResponse) — incluye animaciones, drop-shadows y
// rotaciones que el motor no soporta bien. Reconstruimos la silueta esencial
// (medio planeta + walker simplificado + landmarks) con primitivas SVG que
// Satori sí entiende. Compartido por las rutas de convención
// app/opengraph-image.js y app/twitter-image.js.
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = "Anduve · Descubre · Planea · Viaja";

// Marca: teal principal #0C5F58 (Anduve), coral acento #F4734D.
const TEAL = "#0c5f58";
const TEAL_OSC = "#052b28";
const CORAL = "#ff9d7a";

export function renderOg() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: `linear-gradient(135deg, ${TEAL_OSC} 0%, ${TEAL} 60%, #134e4a 100%)`,
          color: "white",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Columna izquierda — texto */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "80px",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: 24,
              letterSpacing: 8,
              textTransform: "uppercase",
              opacity: 0.85,
              fontWeight: 700,
            }}
          >
            Descubre · Planea · Viaja
          </div>
          {/* Wordmark grande, "VE" en coral igual que en el logo */}
          <div
            style={{
              fontSize: 130,
              fontWeight: 800,
              letterSpacing: -3,
              marginTop: 18,
              lineHeight: 1,
              display: "flex",
              alignItems: "baseline",
            }}
          >
            <span style={{ color: "white" }}>ANDU</span>
            <span style={{ color: CORAL }}>VE</span>
          </div>
          <div
            style={{
              fontSize: 34,
              opacity: 0.92,
              marginTop: 28,
              maxWidth: 720,
              lineHeight: 1.32,
            }}
          >
            Itinerarios día a día · Vuelos baratos en vivo · Presupuesto
            por país
          </div>
        </div>

        {/* Columna derecha — ilustración del logo (medio planeta + walker
            + algunos landmarks visibles). Reconstruida con SVG simple que
            Satori renderiza sin problema. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            paddingRight: 80,
            width: 420,
          }}
        >
          <svg
            width="380"
            height="380"
            viewBox="0 0 200 200"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Planeta — círculo grande abajo */}
            <circle
              cx="100"
              cy="212"
              r="140"
              fill="rgba(255,255,255,0.12)"
              stroke="white"
              strokeWidth="3"
            />
            {/* Landmarks visibles sobre el horizonte */}
            {/* Edificios (izq) */}
            <rect x="20" y="50" width="11" height="22" rx="1" fill="white" />
            <rect x="33" y="42" width="12" height="30" rx="1" fill="white" />
            <rect x="46" y="57" width="9" height="15" rx="1" fill="white" />
            {/* Montañas (centro-izq) */}
            <path
              d="M 65 72 L 78 50 L 88 60 L 96 45 L 110 72 Z"
              fill="white"
            />
            <path d="M 92 52 L 96 45 L 100 52 L 96 50 Z" fill={CORAL} />
            {/* Torre Eiffel-like (derecha) */}
            <path
              d="M 138 72 L 145 36 L 152 72"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
            />
            <line x1="140" y1="56" x2="150" y2="56" stroke="white" strokeWidth="1.8" />
            <line x1="141.5" y1="64" x2="148.5" y2="64" stroke="white" strokeWidth="1.8" />
            <circle cx="145" cy="36" r="2" fill={CORAL} />
            {/* Walker — viajero estilizado */}
            <g fill="white" stroke="none">
              {/* Cabeza */}
              <circle cx="115" cy="35" r="6" />
              {/* Torso */}
              <rect x="111" y="40" width="8" height="22" rx="2" />
              {/* Mochila */}
              <rect
                x="105"
                y="44"
                width="7"
                height="11"
                rx="2"
                fill={CORAL}
              />
              {/* Piernas */}
              <path d="M 112 62 L 108 76 L 112 76 L 115 64 Z" />
              <path d="M 118 62 L 122 76 L 118 76 L 115 64 Z" />
            </g>
          </svg>
        </div>
      </div>
    ),
    { ...ogSize }
  );
}
