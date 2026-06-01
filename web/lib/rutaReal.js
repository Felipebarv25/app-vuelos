// Rutas reales DENTRO de la app (sin mandar a Google Maps).
// Usa OSRM público para trazar el camino y estimar tiempo a pie/auto.
// Para transporte público mostramos una estimación con costo aproximado.

import { cacheado, fetchRapido } from "./cache";
import { distanciaMetros } from "./rutas";

const TTL = 1000 * 60 * 60 * 24 * 7; // 7 días

// Trae la geometría real de la ruta (lista de coordenadas) y su duración.
export async function trazarRuta(a, b, perfil = "foot") {
  const clave = `ruta:${perfil}:${a[0].toFixed(4)},${a[1].toFixed(4)}-${b[0].toFixed(
    4
  )},${b[1].toFixed(4)}`;
  return cacheado(clave, TTL, async () => {
    try {
      const r = await fetchRapido(
        `https://router.project-osrm.org/route/v1/${perfil}/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`
      );
      if (!r.ok) throw new Error();
      const d = await r.json();
      const ruta = d.routes?.[0];
      if (!ruta) throw new Error();
      // GeoJSON da [lon,lat]; Leaflet quiere [lat,lon].
      const coords = ruta.geometry.coordinates.map((c) => [c[1], c[0]]);
      return {
        coords,
        metros: Math.round(ruta.distance),
        minutos: Math.round(ruta.duration / 60),
      };
    } catch {
      // Respaldo: línea recta + estimación.
      const m = distanciaMetros(a, b);
      return { coords: [a, b], metros: Math.round(m), minutos: Math.round(m / 80) };
    }
  });
}

// Recomienda transporte con tiempo y COSTO aproximado, según distancia.
// Costos en USD (orientativos, mundiales). El usuario ve algo accionable
// sin salir de la app.
export function planTransporte(metros) {
  const km = metros / 1000;
  const opciones = [];

  // A pie
  opciones.push({
    modo: "walking",
    icono: "🚶",
    nombre: "Caminar",
    minutos: Math.round(metros / 80),
    costo: "Gratis",
    recomendado: metros < 1200,
  });

  // Transporte público (metro/bus)
  if (km > 0.6) {
    opciones.push({
      modo: "transit",
      icono: "🚇",
      nombre: "Metro / Bus",
      minutos: Math.round(km * 4 + 8), // velocidad media puerta a puerta
      costo: "≈ US$ 1–3",
      recomendado: km >= 1.2 && km <= 12,
    });
  }

  // Bici compartida (distancias medias)
  if (km > 0.8 && km < 8) {
    opciones.push({
      modo: "cycling",
      icono: "🚲",
      nombre: "Bici",
      minutos: Math.round(km * 4),
      costo: "≈ US$ 1–4",
      recomendado: false,
    });
  }

  // Taxi / app
  opciones.push({
    modo: "driving",
    icono: "🚕",
    nombre: "Taxi / App",
    minutos: Math.round(km * 2.2 + 4),
    costo: `≈ US$ ${Math.max(4, Math.round(2.5 + km * 1.4))}`,
    recomendado: km > 12,
  });

  // Ordenar: recomendado primero
  opciones.sort((x, y) => (y.recomendado ? 1 : 0) - (x.recomendado ? 1 : 0));
  return opciones;
}

export function perfilDeModo(modo) {
  if (modo === "driving" || modo === "transit") return "driving";
  if (modo === "cycling") return "bike";
  return "foot";
}
