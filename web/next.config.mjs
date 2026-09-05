/** @type {import('next').NextConfig} */

// Content Security Policy — allowlist de orígenes confiables.
// Empieza como Report-Only: el browser REPORTA violaciones pero NO
// las bloquea. Esto nos deja un periodo de observación donde podemos
// agregar lo que falte sin romper la app. Cuando estabilice, cambiar
// el header name a "Content-Security-Policy" (sin -Report-Only).
const CSP_DIRECTIVES = [
  "default-src 'self'",
  // Scripts: self + inline (next/script + el migrador en layout.js)
  // + Google OAuth/analytics + GTM si lo agregamos.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://*.googleapis.com",
  // Styles: self + inline (Tailwind + next/font generan algunos)
  // + Google Fonts si todavía se usa.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
  // Imgs: self + data: + blob: + las fuentes de fotos que usamos.
  // *.tile.openstreetmap.org son los tiles de los dos mapas (Mapa.js y
  // MapaRuta.js). La CSP va en Report-Only, asi que hoy nada de esto
  // bloquea, pero el dia que pase a modo real tiene que estar completo.
  "img-src 'self' data: blob: https://images.unsplash.com https://*.unsplash.com https://upload.wikimedia.org https://commons.wikimedia.org https://*.tile.openstreetmap.org https://tiles.openfreemap.org https://*.googleusercontent.com https://flagcdn.com",
  // Fonts: self (next/font auto-hosts) + Google Fonts CDN fallback.
  "font-src 'self' data: https://fonts.gstatic.com",
  // Conexiones (fetch/XHR/EventSource/WebSocket): self + APIs que usa
  // la app server-side y client-side.
  "connect-src 'self' https://api.travelpayouts.com https://aviasales-api.travelpayouts.com https://*.api.travelpayouts.com https://api.exchangerate.host https://open.er-api.com https://nominatim.openstreetmap.org https://*.overpass-api.de https://overpass-api.de https://photon.komoot.io https://wwwnc.cdc.gov https://en.wikipedia.org https://es.wikipedia.org https://*.wikipedia.org https://commons.wikimedia.org https://www.wikidata.org https://*.vercel-insights.com https://va.vercel-scripts.com https://tiles.openfreemap.org https://*.tile.openstreetmap.org",
  // Frames: solo Google OAuth popup.
  "frame-src 'self' https://accounts.google.com",
  // Bloquea formas peligrosas que la app no usa.
  // maplibre crea su worker desde un blob: sin esto el mapa no arranca
  // cuando la CSP pase a modo real.
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  // Reporte de violaciones a un endpoint propio para diagnosticar.
  "report-uri /api/csp-report",
];
const CSP_VALUE = CSP_DIRECTIVES.join("; ");

// Headers de seguridad aplicados a TODAS las rutas. Foco: protegerse
// contra clickjacking, MIME sniffing, downgrade attacks y fuga de
// referer.
const SECURITY_HEADERS = [
  // CSP en modo Report-Only: NO bloquea, solo reporta. Una vez
  // estable migrar a "Content-Security-Policy" (sin -Report-Only).
  { key: "Content-Security-Policy-Report-Only", value: CSP_VALUE },
  // HTTPS forzado 2 años + subdominios; opt-in al preload list de browsers.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Bloquea que sitios externos embeban nuestro contenido en <iframe>
  // (clickjacking). Permitimos same-origin para popups internos.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // No dejes que el browser adivine el MIME type (evita XSS via archivo
  // subido que pretende ser imagen pero es JS).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Cuando navegas FUERA de Anduve, no expongas la URL completa.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Bloquea APIs sensibles que NO usamos. Reduce superficie de ataque.
  // Si en el futuro usamos cámara (escanear pasaporte), abrir aquí.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), payment=(), geolocation=(self), interest-cohort=()" },
  // Bloquea cross-origin window opens que abusen window.opener.
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

// DONDE SE ESCRIBE .next
//
// Este repositorio vive dentro de OneDrive, y OneDrive intenta sincronizar
// .next mientras Next lo esta escribiendo: bloquea ficheros a medias y el
// build se queda colgado. Por eso las compilaciones se hacian a mano en una
// copia fuera de la carpeta sincronizada.
//
// Con ANDUVE_DIST_DIR se le dice a Next que escriba en otro sitio sin mover
// el proyecto. Sin la variable, todo sigue igual que siempre (.next), asi que
// Vercel no se entera de nada: alli no existe OneDrive ni la variable.
//
//   scripts/dev.ps1  la pone y lanza el servidor
const DIST_DIR = process.env.ANDUVE_DIST_DIR || ".next";

const nextConfig = {
  distDir: DIST_DIR,
  reactStrictMode: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
      // Datos crudos del detector y datasets internos: no indexar y no
      // dejarse embeber. Quien quiera los datos que use la app o la API
      // pública con rate limiting.
      {
        source: "/(ofertas|requisitos|data)/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, nosnippet" },
        ],
      },
    ];
  },
};

export default nextConfig;
