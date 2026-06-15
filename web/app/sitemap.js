// Sitemap dinámico. Next.js lo expone en /sitemap.xml. Google lo encuentra
// vía robots.txt y empieza a indexar todas las /destino/<slug> automáticamente.
//
// SEO i18n con 4 idiomas: ES (default), EN, PT, FR. Cada destino entrega
// 4 URLs hermanas + alternates.languages para que Google consolide ranking.

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
      alternates: { languages: { es: SITIO, en: `${SITIO}/en`, pt: `${SITIO}/pt`, fr: `${SITIO}/fr` } },
    },
    {
      url: `${SITIO}/destino`,
      lastModified: ahora,
      changeFrequency: "weekly",
      priority: 0.9,
      alternates: { languages: { es: `${SITIO}/destino`, en: `${SITIO}/en/destino` } },
    },
    {
      url: `${SITIO}/comparar`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${SITIO}/pro`,
      lastModified: ahora,
      changeFrequency: "monthly",
      priority: 0.85,
    },
  ];

  const langs = ["", "en", "pt", "fr"]; // "" = ES (default, sin prefijo)
  const destinos = [];
  for (const slug of TODOS_SLUGS) {
    const urlEs = `${SITIO}/destino/${slug}`;
    const urlEn = `${SITIO}/en/destino/${slug}`;
    const urlPt = `${SITIO}/pt/destino/${slug}`;
    const urlFr = `${SITIO}/fr/destino/${slug}`;
    const languages = {
      es: urlEs,
      en: urlEn,
      pt: urlPt,
      fr: urlFr,
      "x-default": urlEs,
    };
    for (const lang of langs) {
      const url = lang ? `${SITIO}/${lang}/destino/${slug}` : urlEs;
      destinos.push({
        url,
        lastModified: ahora,
        changeFrequency: "weekly",
        priority: 0.8,
        alternates: { languages },
      });
    }
  }

  return [...home, ...destinos];
}
