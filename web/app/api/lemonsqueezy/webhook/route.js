// Webhook Lemon Squeezy.
//
// Lemon Squeezy es el Merchant of Record (MoR) que cobra y nos paga via Wise.
// A diferencia de Stripe, no hace falta tener cuenta empresarial colombiana.
// MoR = ellos manejan IVA, impuestos en cada pais del comprador, facturas, etc.
//
// Eventos que escuchamos (siempre con firma HMAC verificada):
//   order_created              ← compra one-time (Lifetime o PDF)
//   subscription_created       ← nueva suscripcion mensual/anual
//   subscription_updated       ← renovacion, cambio de plan, etc.
//   subscription_cancelled     ← cancelacion (pero sigue activa hasta until)
//   subscription_expired       ← termino la ventana paga -> borrar Pro
//   subscription_payment_failed← falla cobro -> dejamos pasar (LS reintenta)
//
// Setup en Lemon Squeezy:
//   1) Settings -> Webhooks -> Create
//   2) URL: https://anduve-app.vercel.app/api/lemonsqueezy/webhook
//   3) Marcar los eventos de arriba
//   4) Copiar Signing Secret -> Vercel env var LEMONSQUEEZY_WEBHOOK_SECRET
//
// Identificacion del usuario: usamos el email del customer (la cuenta de
// Lemon Squeezy del comprador) como llave en KV. El frontend hace match con
// el email de NextAuth Google.

export const runtime = "nodejs";

import crypto from "crypto";
import {
  activarSuscripcion,
  activarLifetime,
  cancelarPro,
  sumarCredito,
  marcarCancelada,
  eventoYaProcesado,
  contarActivacion,
} from "@/lib/entitlements";

// IDs de los productos Pro. El usuario los configura en Vercel env vars
// despues de crear los productos en Lemon Squeezy. Si alguno falta, el
// webhook ignora ese tipo de evento (no truena).
const PRODUCT_ANUAL = process.env.LEMONSQUEEZY_VARIANT_ANUAL || "";
const PRODUCT_MENSUAL = process.env.LEMONSQUEEZY_VARIANT_MENSUAL || "";
const PRODUCT_LIFETIME = process.env.LEMONSQUEEZY_VARIANT_LIFETIME || "";
const PRODUCT_PDF = process.env.LEMONSQUEEZY_VARIANT_PDF || "";
const PRODUCT_ALERTA = process.env.LEMONSQUEEZY_VARIANT_ALERTA || "";

function verificarFirma(rawBody, firma, secret) {
  if (!firma || !secret) return false;
  const hmac = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  // timingSafeEqual exige buffers del mismo largo; si la firma viene en otro
  // formato (raro) cae a comparacion segura simple.
  try {
    const a = Buffer.from(hmac, "hex");
    const b = Buffer.from(String(firma), "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function POST(req) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  // Lemon Squeezy manda la firma en el header X-Signature.
  const firma = req.headers.get("x-signature");
  const raw = await req.text();
  if (!verificarFirma(raw, firma, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  let evento;
  try { evento = JSON.parse(raw); } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const meta = evento?.meta || {};
  const data = evento?.data || {};
  const attrs = data?.attributes || {};
  const tipo = meta?.event_name || "";

  // Email del comprador: vive en attributes.user_email o customer_email
  // segun el evento. Tomamos el primero disponible.
  const email = (attrs.user_email || attrs.customer_email || "").toLowerCase();

  // variant_id identifica que producto compraron (anual vs mensual vs lifetime).
  const variantId = String(attrs.variant_id || attrs.first_subscription_item?.variant_id || "");

  if (!email) {
    return Response.json({ ok: true, ignored: "no-email", tipo });
  }

  // IDEMPOTENCIA.
  //
  // Lemon Squeezy reintenta cuando no recibe un 2xx, y puede entregar el mismo
  // evento mas de una vez. Aqui no era inofensivo: `order_created` de un PDF
  // llama a sumarCredito, que es un INCRBY, asi que tres entregas daban TRES
  // creditos por UNA compra. Y el catch de abajo devuelve 500, que es
  // precisamente lo que provoca el reintento.
  //
  // La llave combina el evento y el objeto al que se refiere. Un mismo id de
  // suscripcion recibe varios eventos distintos a lo largo de su vida, asi que
  // la llave no puede ser solo el id.
  const idObjeto = String(data?.id || attrs.order_id || attrs.subscription_id || "");
  const idEvento = idObjeto ? `${tipo}:${idObjeto}` : "";
  if (idEvento && (await eventoYaProcesado(idEvento))) {
    // 200 a proposito: para Lemon Squeezy esta entregado, y lo esta.
    return Response.json({ ok: true, tipo, duplicado: true });
  }

  try {
    switch (tipo) {
      case "subscription_created":
      case "subscription_updated":
      case "subscription_resumed": {
        // ends_at o renews_at indica hasta cuando vale el periodo pagado.
        const until = attrs.renews_at || attrs.ends_at || null;
        let plan = "mensual";
        if (variantId && variantId === PRODUCT_ANUAL) plan = "anual";
        if (until) {
          await activarSuscripcion(email, plan, until, variantId);
          if (tipo === "subscription_created") await contarActivacion(plan);
        }
        break;
      }

      case "subscription_cancelled": {
        // No se borra: el acceso sigue hasta el final del periodo pagado y
        // Lemon Squeezy mandara subscription_expired al final.
        //
        // Pero SI se anota, porque es informacion real que la pasarela nos da
        // y que el viajero tiene derecho a ver: "Pro activo hasta el 1 de
        // febrero, no se renovara" es muy distinto de "Pro activo".
        await marcarCancelada(email, attrs.ends_at || attrs.renews_at || null);
        break;
      }

      case "subscription_expired":
      case "subscription_payment_failed": {
        // Solo borrar si expiro de verdad. payment_failed se mantiene como
        // "esta intentando cobrar de nuevo" durante varios dias.
        if (tipo === "subscription_expired") await cancelarPro(email);
        break;
      }

      case "order_created": {
        // One-time: lifetime, pdf, alerta.
        if (variantId === PRODUCT_LIFETIME) {
          await activarLifetime(email, variantId);
          await contarActivacion("lifetime");
        } else if (variantId === PRODUCT_PDF) {
          await sumarCredito(email, "pdf", 1);
        } else if (variantId === PRODUCT_ALERTA) {
          await sumarCredito(email, "alerta", 1);
        }
        break;
      }

      case "order_refunded": {
        // Si refundean lifetime, se pierde Pro.
        if (variantId === PRODUCT_LIFETIME) await cancelarPro(email);
        break;
      }

      default:
        // Otros eventos: solo confirmamos para no provocar reintentos.
        break;
    }
  } catch (e) {
    console.error("LS webhook error:", e);
    return Response.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }

  return Response.json({ ok: true, tipo });
}
