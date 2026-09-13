// Imagen Open Graph 1200x630 por destino. Cuando alguien comparta el link
// /destino/madrid-espana en WhatsApp/Twitter, se ve una tarjeta con la bandera
// y el nombre del destino (en vez del icono cuadrado de la app).
import { ImageResponse } from "next/og";
import { getDestinoPorSlug, nombreDestino } from "@/lib/destinos";

// EDGE Y SIN generateStaticParams. Las dos cosas juntas no se pueden, y el
// orden en que se descubrio importa, asi que queda escrito:
//
// 1. Next 15 prohibe declarar `runtime = "edge"` y `generateStaticParams`
//    en la misma ruta, y aborta el build entero:
//
//      Page "/destino/[slug]/opengraph-image" cannot use both
//      `export const runtime = 'edge'` and export `generateStaticParams`.
//
// 2. Primero se quito el edge y se conservo la pre-generacion, razonando
//    que la primera peticion de una imagen OG la hace un rastreador de
//    WhatsApp y esos abandonan pronto. Compilaba en local y en Vercel.
//
// 3. Y fallaba en CI, de forma intermitente:
//
//      Error occurred prerendering page "/destino/atenas-grecia/opengraph-image"
//      [TypeError: fetch failed] { [cause]: [AggregateError: ] { code: 'ETIMEDOUT' } }
//
//    La causa no es nuestro codigo: @vercel/og pide
//    https://fonts.googleapis.com/css2 para resolver la tipografia. Con
//    generateStaticParams eso son 207 peticiones de red DURANTE EL BUILD, y
//    basta que una se agote para tirar el despliegue.
//
// Un build que depende de que Google responda no es un build. Se vuelve al
// edge y se genera al primer acceso: Vercel cachea la imagen en su CDN, asi
// que el rastreador lento es uno por destino y una sola vez, en vez de un
// despliegue que puede caerse cualquier martes.
export const runtime = "edge";
export const alt = "Anduve";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgDestino({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  const nombre = d ? nombreDestino(d) : "Anduve";
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
          background: "linear-gradient(135deg, #0c5f58 0%, #0a4d48 60%, #073a36 100%)",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Eyebrow con marca: "ANDU" blanco, "VE" coral — igual que el
            wordmark en la app. */}
        <div style={{ fontSize: 28, letterSpacing: 6, textTransform: "uppercase", opacity: 0.9, display: "flex", alignItems: "baseline" }}>
          <span>ANDU</span>
          <span style={{ color: "#ff9d7a" }}>VE</span>
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
