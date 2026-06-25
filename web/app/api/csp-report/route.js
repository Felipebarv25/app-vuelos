// Endpoint que recibe los reportes de violación del Content-Security-Policy
// (modo Report-Only en next.config.mjs). Los logueamos a console + KV
// con TTL 7 días para revisar qué orígenes faltan en la allowlist
// antes de hacer el switch a CSP enforcing.
//
// Estructura del body que envía el browser:
//   {
//     "csp-report": {
//       "document-uri": "https://anduve-app.vercel.app/destino/madrid-espana",
//       "violated-directive": "img-src",
//       "blocked-uri": "https://example.com/foto.jpg",
//       ...
//     }
//   }

export const runtime = "edge";

export async function POST(req) {
  let datos;
  try {
    datos = await req.json();
  } catch {
    return new Response(null, { status: 204 });
  }

  const reporte = datos?.["csp-report"] || datos || {};
  const evento = {
    ts: new Date().toISOString(),
    uri: reporte["document-uri"]?.slice(0, 200),
    directiva: reporte["violated-directive"] || reporte["effective-directive"],
    bloqueado: reporte["blocked-uri"]?.slice(0, 200),
    referrer: reporte["referrer"]?.slice(0, 200),
  };

  // Log a Vercel logs siempre.
  console.warn("[CSP] violación:", JSON.stringify(evento));

  // Guardar en KV con TTL 7 días si está configurado (sirve para
  // construir un dashboard de qué orígenes faltan en allowlist).
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (url && token) {
    try {
      const clave = `csp:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`;
      await fetch(`${url}/setex/${encodeURIComponent(clave)}/604800`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(evento),
      });
    } catch {
      // Sin KV no rompemos nada; el console.warn ya quedó.
    }
  }

  return new Response(null, { status: 204 });
}
