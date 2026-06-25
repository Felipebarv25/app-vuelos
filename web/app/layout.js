import "./globals.css";
import { Plus_Jakarta_Sans, Sora } from "next/font/google";
import Providers from "./providers";
import VitalsReporter from "@/components/VitalsReporter";

// Una sola tipografía en todo el sistema: Plus Jakarta Sans (cuerpo, titulares,
// chips). Sora se mantiene SOLO para el wordmark dentro del logo (es parte
// del diseño visual del brand mark). Fraunces (serif display) fue removida
// el 2026-06-23 a pedido del usuario para unificar la identidad tipográfica.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-jakarta",
});
const sora = Sora({
  subsets: ["latin"],
  weight: ["700", "800"],
  display: "swap",
  variable: "--font-sora",
});

// Debe coincidir EXACTO con HERO_IMG de page.js para que el preload sirva.
const HERO_IMG =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70";

const DESC =
  "Itinerarios día a día con mapa, GPS, transporte y los mejores lugares y restaurantes de cualquier ciudad del mundo. Rutas por presupuesto y precios de vuelos en vivo.";

export const metadata = {
  metadataBase: new URL("https://anduve-app.vercel.app"),
  title: "Anduve · Planea tu viaje perfecto",
  description: DESC,
  manifest: "/manifest.json",
  applicationName: "Anduve",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Anduve" },
  // SVG favicon viene de app/icon.svg (Next auto-fingerprinta el URL con
  // ?<hash> en build, cache-busting garantizado al deploy). Aquí solo
  // declaramos los PNG fallback (Android, iOS) que no necesitan fingerprint
  // porque viven en /public y los browsers actualizan al revalidar.
  icons: {
    icon: [
      { url: "/icono-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icono-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  // Google Search Console verification: cuando registres el sitio en Search
  // Console te dan un meta tag con un codigo unico. En vez de pegarlo a mano,
  // pones el valor en la env var GOOGLE_SITE_VERIFICATION en Vercel y Next
  // lo inyecta solo. Si la env var no esta, omite el meta (no rompe nada).
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
  },
  // og:image y twitter:image los genera la convención de archivos
  // app/opengraph-image.js y app/twitter-image.js (tarjeta 1200x630).
  openGraph: {
    title: "Anduve · Planea tu viaje perfecto",
    description: DESC,
    type: "website",
    url: "https://anduve-app.vercel.app/",
    siteName: "Anduve",
  },
  twitter: {
    card: "summary_large_image",
    title: "Anduve · Planea tu viaje perfecto",
    description: DESC,
  },
};

export const viewport = {
  themeColor: "#0c5f58",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es" className={`${jakarta.variable} ${sora.variable}`}>
      <head>
        {/* Script de boot: (1) migra claves de localStorage del prefijo viejo
            v360_* al nuevo anduve_* (rebrand 2026-06-21) y luego (2) aplica la
            clase 'dark' al <html> ANTES de que React hidrate (anti-FOUC: sin
            esto habría parpadeo blanco al cargar en modo oscuro). La migración
            se hace una sola vez por dispositivo y es transparente al usuario:
            no relog, no perder viajes/favoritos/preferencias. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var VIEJO='v360_';function mig(s){for(var i=s.length-1;i>=0;i--){var k=s.key(i);if(k&&k.indexOf(VIEJO)===0){var nk='anduve_'+k.slice(VIEJO.length);if(s.getItem(nk)===null){s.setItem(nk,s.getItem(k));}s.removeItem(k);}}}try{var ls=window.localStorage;if(!ls.getItem('anduve_migrated')){mig(ls);try{mig(window.sessionStorage);}catch(e){}ls.setItem('anduve_migrated','1');}}catch(e){}try{var p=localStorage.getItem('anduve_dark');var os=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches;if(p!==null?p==='1':os){document.documentElement.classList.add('dark');}}catch(e){}})();`,
          }}
        />
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
            (campo de busqueda Anduve directamente en Google). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "Organization",
                  "@id": "https://anduve-app.vercel.app/#organization",
                  name: "Anduve",
                  url: "https://anduve-app.vercel.app/",
                  logo: "https://anduve-app.vercel.app/icono-192.png",
                  description: "Planificador de viajes personalizado: itinerarios por presupuesto, precios reales de vuelos y recomendaciones globales.",
                  sameAs: ["https://github.com/Felipebarv25/app-vuelos"],
                },
                {
                  "@type": "TravelAgency",
                  "@id": "https://anduve-app.vercel.app/#agency",
                  name: "Anduve",
                  url: "https://anduve-app.vercel.app/",
                  description: "Itinerarios día a día, presupuestos por país, alertas de precios y planificación multiciudad para 80+ destinos.",
                  areaServed: { "@type": "Country", name: "Worldwide" },
                  priceRange: "$",
                },
                {
                  "@type": "WebSite",
                  "@id": "https://anduve-app.vercel.app/#website",
                  url: "https://anduve-app.vercel.app/",
                  name: "Anduve",
                  publisher: { "@id": "https://anduve-app.vercel.app/#organization" },
                  inLanguage: ["es", "en", "pt", "fr"],
                  potentialAction: {
                    "@type": "SearchAction",
                    target: {
                      "@type": "EntryPoint",
                      urlTemplate: "https://anduve-app.vercel.app/?q={search_term_string}",
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
        {/* Reporter de Web Vitals (LCP + CLS) — envía métricas reales
            de campo a /api/vitals para construir el dashboard en /panel.
            Lazy: solo corre en cliente, no afecta SSR. */}
        <VitalsReporter />
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
