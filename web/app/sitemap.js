// Sitemap dinámico. Next.js lo expone en /sitemap.xml. Google lo encuentra
// vía robots.txt y empieza a indexar todas las /destino/<slug> automáticamente.
import { TODOS_SLUGS } from "@/lib/destinos";

const SITIO = "https://app-vuelos-mfos.vercel.app";

export default function sitemap() {
  const ahora = new Date().toISOString();

  const home = [
    {
      url: SITIO,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 1.0,
    },
    {
      url: `${SITIO}/destino`,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];

  const destinos = TODOS_SLUGS.map((slug) => ({
    url: `${SITIO}/destino/${slug}`,
    lastModified: ahora,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...home, ...destinos];
}
