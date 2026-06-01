// Autocompletado del buscador en formato "Ciudad, País".
// Usa Nominatim con debounce y caché para ser rápido.

import { cacheado, fetchRapido } from "./cache";

const TTL = 1000 * 60 * 60 * 24; // 1 día

export async function sugerirCiudades(texto) {
  const q = texto.trim();
  if (q.length < 2) return [];
  const clave = `ac:${q.toLowerCase()}`;
  return cacheado(clave, TTL, async () => {
    try {
      const r = await fetchRapido(
        `https://nominatim.openstreetmap.org/search?format=json&accept-language=es&addressdetails=1&featuretype=city&limit=6&q=${encodeURIComponent(
          q
        )}`,
        { headers: { Accept: "application/json" } },
        7000
      );
      if (!r.ok) return [];
      const datos = await r.json();
      const vistos = new Set();
      const out = [];
      for (const d of datos) {
        const a = d.address || {};
        const ciudad =
          a.city || a.town || a.village || a.municipality || a.county ||
          d.display_name.split(",")[0];
        const pais = a.country || d.display_name.split(",").pop().trim();
        const etiqueta = `${ciudad}, ${pais}`;
        if (vistos.has(etiqueta)) continue;
        vistos.add(etiqueta);
        out.push({
          etiqueta,
          ciudad,
          pais,
          lat: parseFloat(d.lat),
          lon: parseFloat(d.lon),
          tipo: d.addresstype || d.type,
        });
      }
      return out;
    } catch {
      return [];
    }
  });
}
