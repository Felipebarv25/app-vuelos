// Cálculo de rutas e itinerarios — todo gratis.
// - Distancia/tiempo a pie con OSRM público (caminar).
// - Deep-links a Google Maps para transporte público real (estaciones, transbordos).

const OSRM = "https://router.project-osrm.org";

// Distancia en línea recta (Haversine) en metros — respaldo instantáneo.
export function distanciaMetros(a, b) {
  const R = 6371000;
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const lat1 = rad(a[0]);
  const lat2 = rad(b[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Estima minutos de caminata (velocidad media 4.8 km/h).
export function minutosCaminando(metros) {
  return Math.round((metros / 80)); // 80 m/min ≈ 4.8 km/h
}

// Pide a OSRM la duración real caminando entre dos puntos (más preciso que recta).
export async function rutaCaminando(a, b) {
  try {
    const url = `${OSRM}/route/v1/foot/${a[1]},${a[0]};${b[1]},${b[0]}?overview=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    const d = await res.json();
    const r = d.routes?.[0];
    if (!r) throw new Error();
    return {
      metros: Math.round(r.distance),
      minutos: Math.round(r.duration / 60),
      modo: "walking",
    };
  } catch {
    const m = distanciaMetros(a, b);
    return { metros: Math.round(m), minutos: minutosCaminando(m), modo: "walking" };
  }
}

// Ordena lugares por vecino más cercano (ruta razonable a pie).
export function ordenarPorCercania(lugares, inicio) {
  if (lugares.length < 2) return lugares.slice();
  const rest = lugares.slice();
  const ruta = [];
  // Punto de arranque: el más cercano al inicio (si se da), o el primero.
  let actual = inicio || rest[0].coord;
  while (rest.length) {
    let bi = 0;
    let bd = Infinity;
    rest.forEach((l, i) => {
      const d = distanciaMetros(actual, l.coord);
      if (d < bd) {
        bd = d;
        bi = i;
      }
    });
    const sig = rest.splice(bi, 1)[0];
    ruta.push(sig);
    actual = sig.coord;
  }
  return ruta;
}

// Deep-links a Google Maps (datos reales de transporte público).
export function linkComoLlegar(a, b, modo = "transit") {
  const o = `${a[0]},${a[1]}`;
  const d = `${b[0]},${b[1]}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${o}&destination=${d}&travelmode=${modo}`;
}

export function linkLugar(coord, nombre) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    nombre
  )}&center=${coord[0]},${coord[1]}`;
}

// Recomienda el medio de transporte según la distancia.
export function recomendarTransporte(metros) {
  if (metros < 1100)
    return { icono: "🚶", texto: "A pie", modo: "walking" };
  if (metros < 6000)
    return { icono: "🚇", texto: "Metro / bus", modo: "transit" };
  return { icono: "🚕", texto: "Taxi / metro", modo: "transit" };
}
