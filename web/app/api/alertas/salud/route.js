// GET /api/alertas/salud
// Diagnostico del MOTOR DE CORREOS de alertas. Existe porque el 2026-08-17 el
// usuario reporto "no me llegan los correos" y no habia forma de saber donde se
// rompia la cadena: el detector ignoraba la respuesta HTTP de /disparar y
// /disparar devuelve 401 tanto si falta el secret en Vercel como si el header
// viene mal. Sin este endpoint el diagnostico era adivinar.
//
// La cadena completa es:
//   detector.py (GitHub Actions, cron horario)
//     -> POST /api/alertas/disparar   [necesita ALERTS_SHARED_SECRET en AMBOS lados]
//        -> lee alertas de KV          [necesita KV_REST_API_URL/TOKEN]
//        -> enviarAlertaPrecio()       [necesita RESEND_API_KEY]
//           -> Resend                  [FROM debe ser un dominio verificado]
//
// Solo devuelve BOOLEANOS de configuracion, nunca valores. Es seguro publico:
// si `secret` sale false el endpoint /disparar esta CERRADO (401 a todo), no
// abierto, asi que no le da nada util a un atacante.
//
// Con el header X-Alert-Secret correcto agrega el conteo real de alertas, que
// es la otra mitad del diagnostico: puede estar todo configurado y no llegar
// nada simplemente porque las alertas ya se dispararon (activa:false).

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv, kvActivo } from "@/lib/kv";
import { leerAlerta } from "@/lib/alertas";

const FROM_COMPARTIDO = "onboarding@resend.dev";

export async function GET(req) {
  const secret = process.env.ALERTS_SHARED_SECRET || "";
  const from = process.env.RESEND_FROM || "";

  const salud = {
    // --- Los tres interruptores silenciosos ---
    kv: kvActivo(),
    resend: !!process.env.RESEND_API_KEY,
    // Si esto es false, el detector recibe 401 en CADA llamada y jamas sale un
    // correo, sin ningun error visible en los logs de Actions.
    secret: !!secret,

    // Resend solo permite enviar a CUALQUIER destinatario si el FROM usa un
    // dominio propio verificado. Con el onboarding@resend.dev compartido solo
    // llegan correos a la direccion dueña de la cuenta Resend — funciona para
    // el dueño de la app y falla en silencio para todos los demas usuarios.
    dominioPropio: !!from && !from.includes(FROM_COMPARTIDO),
    from: from || `Anduve <${FROM_COMPARTIDO}> (default)`,
  };

  salud.listoParaEnviar = salud.kv && salud.resend && salud.secret;
  salud.listoParaTerceros = salud.listoParaEnviar && salud.dominioPropio;

  // Detalle de alertas: solo con el secret correcto (revela cuantos usuarios
  // tienen alertas, eso si es informacion de negocio).
  const autorizado = !!secret && req.headers.get("x-alert-secret") === secret;
  if (autorizado && salud.kv) {
    salud.alertas = await resumirAlertas();
  } else {
    salud.alertas = "requiere X-Alert-Secret";
  }

  return new Response(JSON.stringify(salud, null, 2), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Recorre las alertas guardadas y cuenta cuantas pueden disparar hoy. Usa SCAN
// (no KEYS) para no bloquear Redis si algun dia hay muchas.
async function resumirAlertas() {
  const ids = new Set();
  let cursor = "0";
  let vueltas = 0;
  do {
    const r = await kv(["SCAN", cursor, "MATCH", "alerta:*", "COUNT", "200"]);
    if (!Array.isArray(r)) break;
    cursor = String(r[0]);
    for (const clave of r[1] || []) ids.add(String(clave).slice("alerta:".length));
  } while (cursor !== "0" && ++vueltas < 50);

  const res = {
    total: 0,
    activas: 0,
    yaDisparadas: 0,
    // Desglose por tolerancia a escalas: el default de una alerta nueva es 0
    // (solo directos) y el detector solo notifica el vuelo MAS BARATO del mes,
    // que casi nunca es directo. Sobre el historial real solo el 20% de las
    // observaciones notificadas son directas, y solo el 4.7% pasan tambien el
    // filtro anti-spam. Una alerta en 0 es la mas dificil de disparar.
    soloDirectos: 0,
    conEscalas: 0,
  };

  for (const id of ids) {
    const a = await leerAlerta(id);
    if (!a) continue;
    res.total++;
    if (a.activa) res.activas++;
    else res.yaDisparadas++;
    const max = Number.isFinite(Number(a.escalasMax)) ? Number(a.escalasMax) : 99;
    if (max === 0) res.soloDirectos++;
    else res.conEscalas++;
  }
  return res;
}
