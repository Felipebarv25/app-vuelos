// "Mis viajes": guarda y recupera itinerarios. Dos modos:
//   · LOCAL: localStorage del navegador (privado, instantáneo, gratis).
//   · NUBE: cuando el usuario está logueado con Google, los viajes pasan por
//     /api/viajes (Vercel KV detrás). Así puede abrir su lista en otro
//     dispositivo (PC ↔ teléfono).
// Estrategia: si hay sesión Google, intentamos nube; si falla, fallback a
// local sin romper. Mantenemos las funciones SÍNCRONAS para retrocompatibilidad.

const CLAVE = "anduve_viajes";

// ---------- LOCAL (legacy, retrocompatible) ----------

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

// ---------- NUBE (Vercel KV vía /api/viajes) ----------

function enNube(usuario) {
  return !!usuario?.google && !!usuario?.email;
}

async function pedirNube(url, opciones) {
  try {
    const r = await fetch(url, opciones);
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Lista los viajes DICIENDO de donde salieron.
//
// El fallback a local existia desde el principio y esta bien — mejor algo que
// nada —, pero se tragaba el fallo en silencio: la pagina seguia mostrando
// "SINCRONIZADO" con /api/viajes devolviendo 503 y la lista vacia. Afirmar
// que algo esta a salvo en la nube cuando no lo esta es la peor de las
// mentiras que puede contar esta app.
//
//   sincronizado: los datos vienen de la nube y estan a salvo alli
//   motivo: por que no, cuando no ("sin-sesion" | "nube-caida")
export async function listarViajesConEstado(usuario) {
  if (enNube(usuario)) {
    const data = await pedirNube("/api/viajes");
    if (data?.viajes) return { viajes: data.viajes, sincronizado: true, motivo: null };
    return { viajes: listarViajes(), sincronizado: false, motivo: "nube-caida" };
  }
  return { viajes: listarViajes(), sincronizado: false, motivo: "sin-sesion" };
}

// Firma vieja, para quien solo quiere la lista.
export async function listarViajesAsync(usuario) {
  return (await listarViajesConEstado(usuario)).viajes;
}

export async function guardarViajeAsync(usuario, viaje) {
  if (enNube(usuario)) {
    const data = await pedirNube("/api/viajes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(viaje),
    });
    if (data?.viajes) return data.viajes;
  }
  // Local o fallback.
  return guardarViaje(viaje);
}

export async function borrarViajeAsync(usuario, id) {
  if (enNube(usuario)) {
    const data = await pedirNube(`/api/viajes?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (data?.viajes) return data.viajes;
  }
  return borrarViaje(id);
}
