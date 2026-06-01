import "./globals.css";

export const metadata = {
  title: "Viajero 360 · Planea tu viaje perfecto",
  description:
    "Itinerarios día a día con mapa, GPS, transporte y los mejores lugares y restaurantes de cualquier ciudad del mundo.",
  manifest: "/manifest.json",
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
      </head>
      <body>{children}</body>
    </html>
  );
}
