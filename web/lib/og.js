// Generador de la imagen social (Open Graph / Twitter) 1200x630. Antes el
// preview al compartir usaba el ícono cuadrado de la app (se veía pobre); esto
// produce una tarjeta con la marca y la propuesta de valor. Compartido por las
// rutas de convención app/opengraph-image.js y app/twitter-image.js.
import { ImageResponse } from "next/og";

export const ogSize = { width: 1200, height: 630 };
export const ogContentType = "image/png";
export const ogAlt = "Viajero 360 · Planea tu viaje perfecto";

export function renderOg() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #312e81 0%, #0f766e 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 10, textTransform: "uppercase", opacity: 0.8 }}>
          Viajero 360
        </div>
        <div style={{ fontSize: 92, fontWeight: 800, lineHeight: 1.05, marginTop: 14 }}>
          Planea tu viaje perfecto
        </div>
        <div style={{ fontSize: 34, opacity: 0.92, marginTop: 30, maxWidth: 960, lineHeight: 1.35 }}>
          Itinerarios día a día · Rutas por presupuesto · Vuelos baratos desde Colombia
        </div>
      </div>
    ),
    { ...ogSize }
  );
}
