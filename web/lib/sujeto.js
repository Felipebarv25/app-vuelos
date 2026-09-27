// A QUIEN SE LE CUENTAN LOS USOS CUANDO NO HAY CUENTA.
//
// lib/guardiaPro cuenta por email, pero las dos capacidades que cuestan dinero
// —la Brujula y la busqueda de vuelos— se pueden usar sin sesion. Sin email no
// hay a quien contarle nada, y lo unico que queda es la IP.
//
// Vive en su propio fichero porque guardiaPro importa lib/identidad, que
// importa next-auth: eso hace que la funcion no se pueda probar fuera de
// Next.js. Aqui no hay ninguna dependencia, asi que las pruebas la ejecutan
// tal cual, sin dobles.
//
// LA IP NO SE GUARDA. Se guarda un hash corto (djb2, el mismo que lib/identidad
// usa para no exponer correos en KV): la clave sirve para contar y no para
// saber quien es. Dos IPs podrian colisionar; la consecuencia seria compartir
// cupo durante un dia, no un fallo.

function hash(s) {
  let h = 5381;
  const t = String(s || "");
  for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Sujeto de conteo para una peticion sin sesion: `ip:<hash>`.
 *
 * Vercel pone la IP real como primer valor de x-forwarded-for. Si no llega
 * ninguna cabecera el sujeto es "ip:desconocido", de modo que TODO el trafico
 * sin IP comparte un unico cupo diario. No es un efecto secundario: un cliente
 * que no deja ver su origen es exactamente al que no conviene darle uno propio.
 */
export function sujetoAnonimo(req) {
  const xff = req?.headers?.get?.("x-forwarded-for") || "";
  const ip = xff.split(",")[0].trim() || req?.headers?.get?.("x-real-ip") || "";
  return `ip:${ip ? hash(ip) : "desconocido"}`;
}
