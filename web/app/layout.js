import "./globals.css";
import { Plus_Jakarta_Sans, Fraunces } from "next/font/google";
import Providers from "./providers";

// Cuerpo/UI: Plus Jakarta Sans (legible). Titulares: Fraunces (display editorial
// con carácter). Ambas auto-hospedadas por Next (sin @import bloqueante).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-fraunces",
});

// Debe coincidir EXACTO con HERO_IMG de page.js para que el preload sirva.
const HERO_IMG =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70";

const DESC =
  "Itinerarios día a día con mapa, GPS, transporte y los mejores lugares y restaurantes de cualquier ciudad del mundo. Rutas por presupuesto y ofertas de vuelos desde Colombia.";

export const metadata = {
  metadataBase: new URL("https://app-vuelos-mfos.vercel.app"),
  title: "Viajero 360 · Planea tu viaje perfecto",
  description: DESC,
  manifest: "/manifest.json",
  applicationName: "Viajero 360",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Viajero 360" },
  icons: { icon: "/icono-192.png", apple: "/apple-touch-icon.png" },
  // og:image y twitter:image los genera la convención de archivos
  // app/opengraph-image.js y app/twitter-image.js (tarjeta 1200x630).
  openGraph: {
    title: "Viajero 360 · Planea tu viaje perfecto",
    description: DESC,
    type: "website",
    url: "https://app-vuelos-mfos.vercel.app/",
    siteName: "Viajero 360",
  },
  twitter: {
    card: "summary_large_image",
    title: "Viajero 360 · Planea tu viaje perfecto",
    description: DESC,
  },
};

export const viewport = {
  themeColor: "#0f766e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${jakarta.variable} ${fraunces.variable}`}>
      <head>
        {/* Conexiones tempranas a los dominios de imágenes (acelera la 1ª foto) */}
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="" />
        <link rel="preconnect" href="https://upload.wikimedia.org" crossOrigin="" />
        <link rel="dns-prefetch" href="https://es.wikipedia.org" />
        <link rel="dns-prefetch" href="https://commons.wikimedia.org" />
        {/* Preload del hero (imagen LCP de la portada) */}
        <link rel="preload" as="image" href={HERO_IMG} fetchPriority="high" />
        {/* El CSS de Leaflet ya NO se carga aquí: lo inyecta el componente Mapa
            solo cuando hace falta (no bloquea el render del inicio). */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        {/* Schema.org: Organization + WebSite con SearchAction. Ayuda a Google
            a entender la marca y muestra un sitelinks searchbox en la SERP
            (campo de busqueda Viajero 360 directamente en Google). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://app-vuelos-mfos.vercel.app/#organization",
                  name: "Viajero 360",
                  url: "https://app-vuelos-mfos.vercel.app/",
                  logo: "https://app-vuelos-mfos.vercel.app/icono-192.png",
                  description: "Planificador de viajes personalizado: itinerarios por presupuesto, precios reales de vuelos y recomendaciones globales.",
                  sameAs: ["https://github.com/Felipebarv25/app-vuelos"],
                },
                {
                  "@type": "TravelAgency",
                  "@id": "https://app-vuelos-mfos.vercel.app/#agency",
                  name: "Viajero 360",
                  url: "https://app-vuelos-mfos.vercel.app/",
                  description: "Itinerarios día a día, presupuestos por país, alertas de precios y planificación multiciudad para 80+ destinos.",
                  areaServed: { "@type": "Country", name: "Worldwide" },
                  priceRange: "$",
                },
                {
                  "@type": "WebSite",
                  "@id": "https://app-vuelos-mfos.vercel.app/#website",
                  url: "https://app-vuelos-mfos.vercel.app/",
                  name: "Viajero 360",
                  publisher: { "@id": "https://app-vuelos-mfos.vercel.app/#organization" },
                  inLanguage: ["es", "en", "pt", "fr"],
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: "https://app-vuelos-mfos.vercel.app/?q={search_term_string}",
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* Registra el service worker para que la app sea instalable y rápida */}
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').catch(function(){});
              });
            }`,
          }}
        />
      </body>
    </html>
  );
}
