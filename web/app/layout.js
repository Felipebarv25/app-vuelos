import "./globals.css";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppProvider } from "@/lib/AppContext";

// Fuente auto-hospedada por Next (sin @import bloqueante en el CSS).
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
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
  openGraph: {
    title: "Viajero 360 · Planea tu viaje perfecto",
    description: DESC,
    type: "website",
    url: "https://app-vuelos-mfos.vercel.app/",
    siteName: "Viajero 360",
    images: ["/icono-512.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Viajero 360 · Planea tu viaje perfecto",
    description: DESC,
    images: ["/icono-512.png"],
  },
};

export const viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={jakarta.variable}>
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
      </head>
      <body>
        <AppProvider>{children}</AppProvider>
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
