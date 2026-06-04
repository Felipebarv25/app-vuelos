// "Mis viajes": guarda y recupera itinerarios en el propio dispositivo
// (localStorage). Sin backend ni cuenta: privado, instantáneo y gratis. Es la
// base de persistencia; más adelante se puede sincronizar con una cuenta real.
const CLAVE = "v360_viajes";

export function listarViajes() {
  try {
    const raw = localStorage.getItem(CLAVE);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function escribir(arr) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(arr));
  } catch {}
}

// Guarda (o actualiza) un viaje. Devuelve la lista nueva.
export function guardarViaje(viaje) {
  const arr = listarViajes();
  const v = { ...viaje, id: viaje.id || `${Date.now()}`, guardadoEn: new Date().toISOString() };
  // Evitar duplicados de la misma ciudad+fechas: si existe, lo reemplaza.
  const i = arr.findIndex(
    (x) => x.ciudad?.nombre === v.ciudad?.nombre && x.fechaInicio === v.fechaInicio && x.fechaFin === v.fechaFin
  );
  if (i >= 0) arr[i] = { ...v, id: arr[i].id };
  else arr.unshift(v);
  // Tope: 20 viajes guardados (los más recientes).
  escribir(arr.slice(0, 20));
  return listarViajes();
}

export function borrarViaje(id) {
  escribir(listarViajes().filter((v) => v.id !== id));
  return listarViajes();
}
