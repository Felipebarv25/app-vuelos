// POST /api/auth/codigo/enviar
// Body: { email, lang? }
// Genera un codigo de 6 digitos, lo guarda en KV con TTL 10min y lo envia
// al email del usuario via Resend. Rate limit basico (5 codigos / 15 min).

export const runtime = "nodejs";

import { kvActivo } from "@/lib/kv";
import { emailValido, generarCodigo, guardarCodigo, rateLimit, normalizarEmail } from "@/lib/auth";
import { enviarCodigoLogin, emailDisponible } from "@/lib/email";

export async function POST(req) {
  if (!kvActivo()) {
    return Response.json({ ok: false, motivo: "no-storage" }, { status: 503 });
  }
  if (!emailDisponible()) {
    return Response.json({ ok: false, motivo: "no-email" }, { status: 503 });
  }

  let body = {};
  try { body = await req.json(); } catch {}
  const email = normalizarEmail(body?.email);
  const lang = ["es", "en", "pt", "fr"].includes(body?.lang) ? body.lang : "es";

  if (!emailValido(email)) {
    return Response.json({ ok: false, motivo: "email-invalido" }, { status: 400 });
  }

  const dentroLimite = await rateLimit(email);
  if (!dentroLimite) {
    return Response.json({ ok: false, motivo: "rate-limit" }, { status: 429 });
  }

  const codigo = generarCodigo();
  const guardado = await guardarCodigo(email, codigo);
  if (!guardado) {
    return Response.json({ ok: false, motivo: "no-guardado" }, { status: 500 });
  }

  const env = await enviarCodigoLogin({ to: email, codigo, lang });
  if (!env.ok) {
    // El codigo quedo guardado; loggea el motivo para depurar pero no se lo
    // exponemos al cliente con detalle (seguridad).
    console.error("Email no enviado:", env);
    return Response.json({ ok: false, motivo: "email-fallo" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
