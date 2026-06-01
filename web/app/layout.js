import "./globals.css";

export const metadata = {
  title: "Viajero 360 · Planea tu viaje perfecto",
  description:
    "Itinerarios día a día con mapa, GPS, transporte y los mejores lugares y restaurantes de cualquier ciudad del mundo.",
  manifest: "/manifest.json",
  applicationName: "Viajero 360",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Viajero 360",
  },
  icons: {
    icon: "/icono-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#2563eb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
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
