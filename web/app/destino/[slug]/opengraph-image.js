// Imagen Open Graph 1200x630 por destino. Cuando alguien comparta el link
// /destino/madrid-espana en WhatsApp/Twitter, se ve una tarjeta con la bandera
// y el nombre del destino (en vez del icono cuadrado de la app).
import { ImageResponse } from "next/og";
import { getDestinoPorSlug, nombreDestino, TODOS_SLUGS } from "@/lib/destinos";

export const runtime = "edge";
export const alt = "Viajero 360";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Pre-generar la imagen para cada destino (cachea en build/edge).
export async function generateStaticParams() {
  return TODOS_SLUGS.map((slug) => ({ slug }));
}

export default async function OgDestino({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  const nombre = d ? nombreDestino(d) : "Viajero 360";
  const bandera = d?.bandera || "🌍";

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
          background: "linear-gradient(135deg, #0c5f58 0%, #0f766e 60%, #134e4a 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Eyebrow con marca: "Viajero" blanco, "360" coral — igual que el
            wordmark en la app. */}
        <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", opacity: 0.9, display: "flex", alignItems: "baseline" }}>
          <span>Viajero</span>
          <span style={{ color: "#ff9d7a", marginLeft: 10 }}>360</span>
          <span style={{ marginLeft: 18, opacity: 0.7 }}>· Viaja a</span>
        </div>
        <div style={{ fontSize: 130, marginTop: 10 }}>{bandera}</div>
        <div style={{ fontSize: 90, fontWeight: 800, lineHeight: 1.05, marginTop: 8 }}>
          {d?.ciudad || "Tu destino"}
        </div>
        <div style={{ fontSize: 36, opacity: 0.92, marginTop: 14 }}>
          {d?.pais ? `${d.pais} · Itinerario y precios` : "Itinerario y precios"}
        </div>
      </div>
    ),
    { ...size }
  );
}
