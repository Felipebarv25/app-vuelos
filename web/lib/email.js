// Envio de emails transaccionales via Resend (https://resend.com).
// Free tier: 100 emails/dia, 3.000/mes. Sobra para magic code.
//
// Setup:
//   1) crea cuenta en resend.com (GitHub login)
//   2) Settings -> API Keys -> Create -> copia el token (re_...)
//   3) en Vercel: RESEND_API_KEY = ese token
//   4) por defecto usamos onboarding@resend.dev como FROM (no requiere
//      verificar dominio). Cuando tengas dominio propio lo cambias a
//      hola@<tu-dominio> verificandolo en Resend primero.
//
// Si RESEND_API_KEY no esta, las funciones devuelven { ok:false, motivo:
// "no-configurado" } y el endpoint llamador se encarga de avisar.

const FROM_DEFAULT = "Viajero 360 <onboarding@resend.dev>";

export function emailDisponible() {
  return !!process.env.RESEND_API_KEY;
}

async function enviar({ to, subject, html, text }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, motivo: "no-configurado" };

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || FROM_DEFAULT,
        to,
        subject,
        html,
        text,
      }),
    });
    if (!r.ok) {
      const data = await r.json().catch(() => ({}));
      return { ok: false, motivo: "resend-error", detalle: data?.message || r.status };
    }
    const data = await r.json();
    return { ok: true, id: data?.id || null };
  } catch (e) {
    return { ok: false, motivo: "fetch-error", detalle: String(e?.message || e) };
  }
}

// Plantilla del email del codigo. Minimalista, marca-consistente, mobile-first.
// Se traduce por idioma del cliente; default ES.
const PLANTILLAS = {
  es: {
    subject: (codigo) => `${codigo} es tu codigo de Viajero 360`,
    saludo: "Hola viajero,",
    intro: "Este es tu codigo para entrar a Viajero 360:",
    expira: "El codigo expira en 10 minutos. Si no fuiste tu, ignora este mensaje.",
    firma: "Equipo Viajero 360",
  },
  en: {
    subject: (codigo) => `${codigo} is your Viajero 360 code`,
    saludo: "Hi traveler,",
    intro: "Here is your code to sign in to Viajero 360:",
    expira: "The code expires in 10 minutes. If this wasn't you, ignore this email.",
    firma: "Viajero 360 Team",
  },
  pt: {
    subject: (codigo) => `${codigo} é seu código do Viajero 360`,
    saludo: "Olá viajante,",
    intro: "Aqui está seu código para entrar no Viajero 360:",
    expira: "O código expira em 10 minutos. Se não foi você, ignore este email.",
    firma: "Equipe Viajero 360",
  },
  fr: {
    subject: (codigo) => `${codigo} est votre code Viajero 360`,
    saludo: "Bonjour voyageur,",
    intro: "Voici votre code pour entrer dans Viajero 360 :",
    expira: "Le code expire dans 10 minutes. Si ce n'était pas vous, ignorez ce message.",
    firma: "L'équipe Viajero 360",
  },
};

// Alerta de precio: el detector encontro un vuelo bajo del umbral del usuario.
// El email lleva al usuario directo al link de reserva (con marker de afiliado
// si el detector incluyo uno) y le da contexto del ahorro.
const PLANTILLAS_ALERTA = {
  es: {
    subject: (ciudad, precio) => `🔥 ${ciudad} US$${precio} — tu alerta de precio`,
    saludo: "¡Buen viaje a la vista!",
    intro: (ciudad, precio, umbral, origen) =>
      `Encontramos un vuelo a <b>${ciudad}</b> a <b>US$ ${precio}</b> ida y vuelta` +
      (origen ? ` desde ${origen}` : "") +
      ` — por debajo del umbral de US$ ${umbral} que configuraste.`,
    cta: "Ver el vuelo",
    aviso: "Los precios pueden cambiar en minutos. Si lo quieres, reserva ya.",
    extra: "Es buena practica verificar el precio final en Google Vuelos antes de comprar.",
    firma: "Equipo Viajero 360",
  },
  en: {
    subject: (ciudad, precio) => `🔥 ${ciudad} US$${precio} — your price alert`,
    saludo: "Trip alert!",
    intro: (ciudad, precio, umbral, origen) =>
      `We found a round-trip flight to <b>${ciudad}</b> at <b>US$ ${precio}</b>` +
      (origen ? ` from ${origen}` : "") +
      ` — below your US$ ${umbral} target.`,
    cta: "View the flight",
    aviso: "Prices change fast. Book now if it works for you.",
    extra: "Good practice: verify the final price on Google Flights before buying.",
    firma: "Viajero 360 Team",
  },
  pt: {
    subject: (ciudad, precio) => `🔥 ${ciudad} US$${precio} — seu alerta de preço`,
    saludo: "Alerta de viagem!",
    intro: (ciudad, precio, umbral, origen) =>
      `Encontramos um voo ida e volta para <b>${ciudad}</b> a <b>US$ ${precio}</b>` +
      (origen ? ` desde ${origen}` : "") +
      ` — abaixo do seu alvo de US$ ${umbral}.`,
    cta: "Ver o voo",
    aviso: "Os preços mudam rápido. Reserve agora se servir.",
    extra: "Boa prática: confirme o preço final no Google Voos.",
    firma: "Equipe Viajero 360",
  },
  fr: {
    subject: (ciudad, precio) => `🔥 ${ciudad} US$${precio} — votre alerte prix`,
    saludo: "Alerte voyage !",
    intro: (ciudad, precio, umbral, origen) =>
      `Nous avons trouvé un vol A/R vers <b>${ciudad}</b> à <b>US$ ${precio}</b>` +
      (origen ? ` depuis ${origen}` : "") +
      ` — sous votre cible de US$ ${umbral}.`,
    cta: "Voir le vol",
    aviso: "Les prix changent vite. Réservez maintenant si c'est bon pour vous.",
    extra: "Bonne pratique : vérifiez le prix final sur Google Flights.",
    firma: "L'équipe Viajero 360",
  },
};

export async function enviarAlertaPrecio({
  to,
  ciudad,
  pais,
  precio,
  umbral,
  origen = "",
  fecha_ida = "",
  fecha_vuelta = "",
  link = "",
  aerolinea = "",
  lang = "es",
}) {
  const T = PLANTILLAS_ALERTA[lang] || PLANTILLAS_ALERTA.es;
  const ahorro = Math.max(0, umbral - precio);
  const html = `
<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${T.subject(ciudad, precio)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 4px 16px rgba(15,23,42,.06);">
        <tr><td>
          <div style="font-size:13px;font-weight:700;letter-spacing:.18em;color:#0f766e;text-transform:uppercase;">Viajero 360</div>
          <h1 style="margin:8px 0 24px 0;font-size:22px;color:#0f3d3a;">${T.saludo}</h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.55;color:#334155;">${T.intro(ciudad, precio, umbral, origen)}</p>

          <div style="margin:24px 0;padding:24px;background:linear-gradient(135deg,#0f766e,#1d9690);border-radius:14px;text-align:center;color:#ffffff;">
            <div style="font-size:32px;font-weight:800;letter-spacing:-.5px;">US$ ${precio}</div>
            <div style="font-size:13px;opacity:.85;margin-top:6px;">${ciudad}${pais ? ", " + pais : ""}${aerolinea ? " · " + aerolinea : ""}</div>
            ${fecha_ida ? `<div style="font-size:13px;opacity:.85;margin-top:4px;">${fecha_ida}${fecha_vuelta ? " → " + fecha_vuelta : ""}</div>` : ""}
            ${ahorro > 0 ? `<div style="display:inline-block;margin-top:12px;padding:4px 10px;background:rgba(16,185,129,.25);border-radius:999px;font-size:12px;font-weight:700;">Ahorras US$ ${ahorro}</div>` : ""}
          </div>

          ${link ? `<a href="${link}" target="_blank" style="display:inline-block;padding:14px 28px;background:#f4633f;color:#ffffff;text-decoration:none;border-radius:14px;font-size:15px;font-weight:700;">${T.cta} →</a>` : ""}

          <p style="margin:24px 0 6px 0;font-size:13px;line-height:1.5;color:#64748b;">${T.aviso}</p>
          <p style="margin:0 0 20px 0;font-size:12px;line-height:1.5;color:#94a3b8;">${T.extra}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <div style="font-size:12px;color:#94a3b8;text-align:center;">${T.firma}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = `${T.saludo}\n\n${T.intro(ciudad, precio, umbral, origen).replace(/<[^>]+>/g, "")}\n\nUS$ ${precio} - ${ciudad}${aerolinea ? " (" + aerolinea + ")" : ""}\n${fecha_ida}${fecha_vuelta ? " - " + fecha_vuelta : ""}\n\n${link ? T.cta + ": " + link + "\n\n" : ""}${T.aviso}\n\n- ${T.firma}`;

  return enviar({ to, subject: T.subject(ciudad, precio), html, text });
}

export async function enviarCodigoLogin({ to, codigo, lang = "es" }) {
  const T = PLANTILLAS[lang] || PLANTILLAS.es;
  const html = `
<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<title>${T.subject(codigo)}</title>
</head>
<body style="margin:0;padding:0;background:#f6f7fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f6f7fb;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:18px;padding:32px;box-shadow:0 4px 16px rgba(15,23,42,.06);">
        <tr><td>
          <div style="font-size:13px;font-weight:700;letter-spacing:.18em;color:#0f766e;text-transform:uppercase;">Viajero 360</div>
          <h1 style="margin:8px 0 24px 0;font-size:22px;color:#0f3d3a;">${T.saludo}</h1>
          <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#334155;">${T.intro}</p>
          <div style="margin:24px 0;padding:24px;background:linear-gradient(135deg,#0f766e,#1d9690);border-radius:14px;text-align:center;">
            <div style="font-size:36px;font-weight:800;letter-spacing:.4em;color:#ffffff;font-family:'Courier New',monospace;">${codigo}</div>
          </div>
          <p style="margin:0 0 20px 0;font-size:13px;line-height:1.5;color:#64748b;">${T.expira}</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">
          <div style="font-size:12px;color:#94a3b8;text-align:center;">${T.firma}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  const text = `${T.saludo}\n\n${T.intro}\n\n  ${codigo}\n\n${T.expira}\n\n— ${T.firma}`;

  return enviar({ to, subject: T.subject(codigo), html, text });
}
