// Lista canónica de destinos para las páginas estáticas de SEO.
// Une el catálogo del presupuesto (que aporta vuelo/dia/región/bandera) con el
// índice de ciudades precalculadas (slug que corresponde al JSON de /lugares/).
//
// Por qué dos fuentes:
//   · DESTINOS_PRESUPUESTO trae los datos de viaje (costo, región, lat/lon).
//   · PRECALC ya tiene los slugs ÚNICOS que usa el resto de la app y, si
//     coincide, los lugares precalculados para mostrar el "Top lugares".
//
// Resultado: para cada destino tenemos slug, nombre legible, país, bandera,
// vuelo aproximado, costo diario, región y si hay lugares precalculados.

import { DESTINOS_PRESUPUESTO } from "./presupuesto";
import { PRECALC } from "./precalcIndex";

// Quita tildes/diéresis y normaliza a "ciudad-pais" en minúsculas.
function slugify(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function slugDe(ciudad, pais) {
  return `${slugify(ciudad)}-${slugify(pais)}`;
}

// Map slug → flag de "tiene lugares precalculados" (JSON estático en /lugares/).
const PRECALC_SLUGS = new Set(PRECALC.map((p) => p.s));

// Lista completa de destinos enriquecida con slug + bandera precalc.
export const DESTINOS_SEO = DESTINOS_PRESUPUESTO.map((d) => {
  const slug = slugDe(d.ciudad, d.pais);
  return {
    ...d,
    slug,
    tienePrecalc: PRECALC_SLUGS.has(slug),
  };
});

// Map para búsquedas rápidas por slug.
const POR_SLUG = Object.fromEntries(DESTINOS_SEO.map((d) => [d.slug, d]));

export function getDestinoPorSlug(slug) {
  return POR_SLUG[slug] || null;
}

// Busca un destino cuando el slug recibido es solo la ciudad (sin país).
// El slug completo tiene formato "ciudad-pais"; buscamos todos los slugs que
// empiecen con `ciudadSlug + "-"` para evitar coincidencias parciales.
// Devuelve el destino solo si hay exactamente 1 coincidencia; null en caso
// de ambigüedad (0 o >1 matches) para no redirigir a la ciudad equivocada.
export function getDestinoPorCiudadSlug(ciudadSlug) {
  if (!ciudadSlug) return null;
  const prefijo = ciudadSlug + "-";
  const matches = DESTINOS_SEO.filter((d) => d.slug.startsWith(prefijo));
  return matches.length === 1 ? matches[0] : null;
}

// Slugs disponibles (los que tienen entry en el catálogo). Lo que pasamos a
// generateStaticParams en Next.js para que pre-renderice todas las páginas.
export const TODOS_SLUGS = DESTINOS_SEO.map((d) => d.slug);

// Nombre legible "Ciudad, País" para títulos.
export function nombreDestino(d) {
  return d ? `${d.ciudad}, ${d.pais}` : "";
}
