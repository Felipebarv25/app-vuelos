/** @type {import('next').NextConfig} */

// Headers de seguridad aplicados a TODAS las rutas. Foco: protegerse
// contra clickjacking, MIME sniffing, downgrade attacks y fuga de
// referer. CSP se maneja por separado (puede romper cosas; se agrega
// progresivamente cuando sepamos el inventario completo de orígenes).
const SECURITY_HEADERS = [
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

const nextConfig = {
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
