// Viajes multiparada guardados en el propio navegador.
//
// Existe por dos razones. La primera: el usuario armó una ruta, cambió de
// pestaña en /mis-viajes y la perdió entera — el planificador solo está
// montado mientras su pestaña está activa, así que React lo desmonta y el
// estado se va; un refresco hacía lo mismo. La segunda: pidió poder tener
// TANTOS viajes como quiera, y con un único hueco de borrador crear el segundo
// pisaba el primero.
//
// Por eso es una lista y no un solo objeto. Cada entrada lleva un `uid` local;
// si además se ha guardado en la nube lleva el `id` del servidor.
//
// NO sustituye a "Guardar": eso sincroniza, permite compartir por enlace y
// sobrevive al cambio de dispositivo. Esto es la red de seguridad para que
// cambiar de pestaña no cueste media hora de trabajo.
//
// Vive en lib y no en PlanRuta porque el componente se carga diferido
// (`next/dynamic` con ssr:false) y de un import dinámico no se pueden sacar
// exports con nombre: la lista de /mis-viajes los necesita al montar.

const CLAVE = "anduve_rutas_local";
const TOPE = 25; // el mismo que aplica el servidor por usuario

export function leerLocales() {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE) || "[]");
    return Array.isArray(a) ? a.filter((x) => x?.uid && Array.isArray(x.paradas)) : [];
  } catch {
    return [];
  }
}

export function escribirLocal(entrada) {
  try {
    const resto = leerLocales().filter((x) => x.uid !== entrada.uid);
    localStorage.setItem(
      CLAVE,
      JSON.stringify([{ ...entrada, actualizado: Date.now() }, ...resto].slice(0, TOPE))
    );
  } catch {}
}

export function borrarLocal(uid) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(leerLocales().filter((x) => x.uid !== uid)));
  } catch {}
}

export function nuevoUid() {
  return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
