// Sitemap dinámico. Next.js lo expone en /sitemap.xml. Google lo encuentra
// vía robots.txt y empieza a indexar todas las /destino/<slug> automáticamente.
//
// 2026-06-14: agregadas URLs EN para SEO i18n con hreflang. Cada entrada de
// destino incluye un mapa `alternates.languages` con las variantes es/en/
// x-default para que Google sepa que son la misma pagina en distinto idioma
// y no las trate como contenido duplicado.

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
      alternates: {
        languages: {
          es: SITIO,
          en: `${SITIO}/en`,
        },
      },
    },
    {
      url: `${SITIO}/destino`,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: {
        languages: {
          es: `${SITIO}/destino`,
          en: `${SITIO}/en/destino`,
        },
      },
    },
    {
      url: `${SITIO}/comparar`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // ES + EN per destination. Each ES entry declares the EN alternate (Google
  // uses this to consolidate ranking signal across language versions).
  const destinos = [];
  for (const slug of TODOS_SLUGS) {
    const urlEs = `${SITIO}/destino/${slug}`;
    const urlEn = `${SITIO}/en/destino/${slug}`;
    destinos.push({
      url: urlEs,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: { es: urlEs, en: urlEn, "x-default": urlEs },
      },
    });
    destinos.push({
      url: urlEn,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: {
        languages: { es: urlEs, en: urlEn, "x-default": urlEs },
      },
    });
  }

  return [...home, ...destinos];
}
