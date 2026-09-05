// Cliente del pasaporte: paises visitados, con la cuenta como fuente de verdad
// y el navegador como respaldo.
//
// El mismo patron que lib/viajes.js. Se escribe SIEMPRE en localStorage y
// ademas en la nube si hay sesion, para que:
//
//   - quien no ha entrado pueda empezar a marcar paises igual (y no perderlos
//     al registrarse: al iniciar sesion se fusiona lo local con lo de la nube),
//   - y quien si tiene cuenta lo vea desde cualquier dispositivo.
//
// La fusion se queda con la union de los dos lados y, en un pais que este en
// ambos, con la union de sus ciudades y la fecha MAS ANTIGUA. Perder un pais
// marcado es peor que quedarse con uno de mas: esto es un recuerdo, no un
// borrador.

const CLAVE = "anduve_pasaporte";

function normaliza(c) {
  return String(c || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function leerLocal() {
  try {
    const d = JSON.parse(localStorage.getItem(CLAVE) || "{}");
    return d && typeof d === "object" ? d : {};
  } catch {
    return {};
  }
}

function guardarLocal(paises) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(paises));
  } catch {}
}

/** Union de dos pasaportes. Nunca pierde un pais ni una ciudad. */
export function fusionar(a = {}, b = {}) {
  const out = {};
  for (const cc of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const x = a[cc] || {};
    const y = b[cc] || {};
    const ciudades = [];
    const vistas = new Set();
    for (const c of [...(x.ciudades || []), ...(y.ciudades || [])]) {
      const k = normaliza(c);
      if (!k || vistas.has(k)) continue;
      vistas.add(k);
      ciudades.push(c);
    }
    const fechas = [x.desde, y.desde].filter(Boolean).sort();
    out[cc] = { desde: fechas[0] || new Date().toISOString().slice(0, 10), ciudades };
  }
  return out;
}

/**
 * Carga el pasaporte. Con sesion, fusiona nube + local y devuelve el resultado
 * ya sincronizado en los dos sitios.
 *
 * @returns {Promise<{paises: object, enNube: boolean}>}
 */
export async function cargarPasaporte(usuario) {
  const local = leerLocal();
  if (!usuario) return { paises: local, enNube: false };
  try {
    const r = await fetch("/api/pasaporte", { cache: "no-store" });
    if (!r.ok) return { paises: local, enNube: false };
    const d = await r.json();
    if (!d?.ok) return { paises: local, enNube: false };
    const unido = fusionar(d.paises || {}, local);
    guardarLocal(unido);
    // Si lo local aportaba algo, se sube para que los dos lados coincidan.
    if (JSON.stringify(unido) !== JSON.stringify(d.paises || {})) {
      await guardarPasaporte(usuario, unido).catch(() => {});
    }
    return { paises: unido, enNube: true };
  } catch {
    return { paises: local, enNube: false };
  }
}

/** Guarda. Local siempre; la nube si hay sesion. */
export async function guardarPasaporte(usuario, paises) {
  guardarLocal(paises);
  if (!usuario) return false;
  try {
    const r = await fetch("/api/pasaporte", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paises }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

/** Cuantas ciudades hay anotadas en total. */
export function contarCiudades(paises = {}) {
  return Object.values(paises).reduce((s, p) => s + (p?.ciudades?.length || 0), 0);
}
