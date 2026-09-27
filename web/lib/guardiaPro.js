// EL SERVIDOR DECIDE. El navegador solo se entera.
//
// Toda la autorizacion pasa por aqui, y aqui nunca se lee nada que venga del
// cliente: ni un parametro `pro=true`, ni una cabecera, ni un campo del
// cuerpo, ni localStorage. La identidad sale de identificarUsuario (la que ya
// usa el resto del proyecto) y el plan sale de isPro, que lee KV, que solo
// escribe el webhook de Lemon Squeezy con firma verificada.
//
// Si alguien manda `{ pro: true }` en el cuerpo, esta funcion ni lo mira.
//
// LOS CONTADORES
//
// Un limite "5 al dia" necesita saber cuantas van hoy. Se cuenta en KV con una
// clave por usuario, capacidad y dia, que caduca sola a las 48 h: no hace
// falta limpiarla y no se acumula historial de nadie.
//
//   uso:<capacidad>:<email>:<YYYY-MM-DD>  ->  entero
//
// No se guarda QUE pregunto ni QUE consulto. Solo cuantas veces.
//
// SIN KV NO SE BLOQUEA
//
// Si KV no esta disponible no se puede contar, y ante la duda se deja pasar:
// romperle la app a un usuario porque nuestro almacen se cayo es peor que
// regalarle una consulta. Lo que NO se deja pasar nunca es una capacidad de
// solo-Pro: eso no depende de contar.

import { kv, kvActivo } from "./kv";
import { identificarUsuario } from "./identidad";
import { isPro } from "./entitlements";
import { evaluar } from "./features";
import { sujetoAnonimo } from "./sujeto";

const TTL_CONTADOR = 60 * 60 * 48;

const dia = () => new Date().toISOString().slice(0, 10);
const clave = (capacidad, sujeto, ventana) =>
  ventana === "dia" ? `uso:${capacidad}:${sujeto}:${dia()}` : `uso:${capacidad}:${sujeto}`;

// El sujeto de conteo anonimo vive en lib/sujeto: sin dependencias, para
// poder probarlo fuera de Next.js. Ver alli el porque del hash.
//
// Se IMPORTA ademas de reexportarse: `export {} from` no crea el identificador
// local, y `comprobar` lo llama aqui abajo.
export { sujetoAnonimo };

/** Cuantas veces lleva usado hoy este sujeto (email o ip:<hash>). 0 si no se sabe. */
export async function usoActual(capacidad, sujeto, ventana = "dia") {
  if (!kvActivo() || !sujeto) return 0;
  try {
    const v = await kv(["GET", clave(capacidad, sujeto, ventana)]);
    return Number(v) || 0;
  } catch { return 0; }
}

/** Suma uno. Se llama DESPUES de que la operacion haya salido bien. */
export async function anotarUso(capacidad, sujeto, ventana = "dia") {
  if (!kvActivo() || !sujeto) return;
  try {
    const k = clave(capacidad, sujeto, ventana);
    await kv(["INCR", k]);
    if (ventana === "dia") await kv(["EXPIRE", k, String(TTL_CONTADOR)]);
  } catch { /* contar es best-effort; nunca tumba la peticion */ }
}

/**
 * ¿Puede hacer esto?
 *
 * @returns {{permitido, motivo, email, pro, limite, usado, restante, anonimo}}
 *
 * `motivo` es lo que la pantalla necesita para explicarse:
 *   no-auth     hay que entrar para usar esto
 *   solo-pro    existe, pero es de Pro
 *   limite      lo tiene, pero se le acabo por hoy
 */
export async function comprobar(req, capacidad, { requiereSesion = true, ventana = "dia" } = {}) {
  const u = await identificarUsuario(req);
  const email = u?.email || null;

  if (!email) {
    // Sin sesion no hay a quien contarle los usos ni de quien leer el plan.
    if (requiereSesion) return { permitido: false, motivo: "no-auth", email: null, sujeto: null, pro: false, anonimo: true, limite: null, usado: 0, restante: null };

    // PERO "sin cuenta" no puede seguir significando "sin limite".
    //
    // Las dos capacidades que se dejan abiertas a proposito —la Brujula y la
    // busqueda de vuelos— son justo las dos que cuestan dinero por uso, y aqui
    // se devolvia `permitido: true` sin contar nada. La unica barrera real era
    // el rate limit del middleware, 90 peticiones por minuto y por IP, que no
    // es un presupuesto: es un caudal.
    //
    // Se cuenta por IP contra `limiteAnonimo`. Quien llama sigue sin necesitar
    // sesion; lo que cambia es que ahora hay un techo diario.
    const sujeto = sujetoAnonimo(req);
    const usado = await usoActual(capacidad, sujeto, ventana);
    const r = evaluar(capacidad, { pro: false, usado, anonimo: true });
    return { ...r, email: null, sujeto, pro: false, anonimo: true };
  }

  const pro = await isPro(email);
  const usado = await usoActual(capacidad, email, ventana);
  const r = evaluar(capacidad, { pro, usado });
  return { ...r, email, sujeto: email, pro, anonimo: false };
}

/** La respuesta HTTP estandar cuando el guardia dice que no. */
export function respuestaBloqueada(r, capacidad) {
  const estado = r.motivo === "no-auth" ? 401 : 402;
  return Response.json(
    {
      ok: false,
      motivo: r.motivo,
      capacidad,
      // Se devuelve el limite para que la pantalla pueda decir "5 de 5", en vez
      // de un "no puedes" sin explicacion.
      limite: r.limite ?? null,
      usado: r.usado ?? 0,
      pro: r.pro ?? false,
      // Quien llego al tope SIN cuenta necesita otro mensaje: no le sirve
      // "hazte Pro", le sirve "entra y tendras tu propio cupo".
      anonimo: r.anonimo ?? false,
    },
    { status: estado }
  );
}
