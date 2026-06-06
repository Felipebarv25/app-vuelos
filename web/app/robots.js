// robots.txt para los crawlers. Apunta al sitemap dinámico.
const SITIO = "https://app-vuelos-mfos.vercel.app";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /api/ no necesita indexarse — son endpoints, no contenido.
        disallow: ["/api/", "/panel"],
      },
    ],
    sitemap: `${SITIO}/sitemap.xml`,
  };
}
