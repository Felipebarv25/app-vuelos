// Compartir el itinerario actual por enlace público.
// 1) Pide al endpoint /api/compartido que guarde el viaje y devuelva un id.
// 2) Devuelve la URL pública /viaje/<id>.
// Si la nube falla (no hay KV), devuelve null y el caller debe usar el
// compartir-por-texto que ya existe (writeText con resumen).

export async function compartirEnlace(viaje) {
  try {
    const r = await fetch("/api/compartido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ viaje }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.url || null;
  } catch {
    return null;
  }
}
