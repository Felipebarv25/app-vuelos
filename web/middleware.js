// Middleware Next.js: rate limiting básico sobre /api/* + bloqueo de
// User-Agents de scraping conocidos. Usa Vercel KV (ya configurado)
// para contar requests por IP. Si KV no está, falla open (no bloquea).

import { NextResponse } from "next/server";

// Rate limits por endpoint. Diseño: limitar lo que MÁS valor tiene
// (datos en vivo, endpoints de búsqueda) sin bloquear las acciones
// normales del usuario (auth, viajes, alertas).
//
// Calibración: un usuario normal hace ~10-20 calls/min al navegar.
// Un scraper hace cientos. 90 calls/min deja margen amplio para
// usuarios reales y corta scrapers tempranamente.
const RATE_LIMITS = {
  // /api/lugares — Overpass + Photon. Caro de servir. Limitar fuerte.
  "/api/lugares": { ventanaSeg: 60, max: 30 },
  // /api/vuelo-vivo — Travelpayouts API. Cuota limitada. Limitar fuerte.
  "/api/vuelo-vivo": { ventanaSeg: 60, max: 30 },
  // Default para todos los otros /api/* — generoso pero corta scrapers.
  default: { ventanaSeg: 60, max: 90 },
};

// Bots y scrapers conocidos que NUNCA traen tráfico legítimo. Se les
// devuelve 403. (No incluimos Googlebot/Bingbot — los queremos para SEO.)
const BLOCKED_UA_PATTERNS = [
  /scrapy/i,
  /python-requests/i,
  /curl\/[0-9]/i,
  /wget/i,
  /axios\/[0-9]/i, // Axios server-side por defecto (clientes legítimos suelen ir desde browser).
  /java-http-client/i,
  /go-http-client/i,
  /httpie/i,
  /node-fetch/i,
];

// IP del cliente. En Vercel viene del header x-forwarded-for (primero) o
// x-real-ip. Fallback a una cadena para no romper el rate limit.
function getClientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

// Llamada al REST API de Vercel KV — INCR con expiración. Si KV no
// está configurado, retorna null y el middleware deja pasar.
async function incrementarContador(clave, ventanaSeg) {
  // LOS DOS JUEGOS DE NOMBRES. Es el mismo fallo que ya se corrigio en
  // /api/compartido y que aqui seguia vivo: Vercel inyecta KV_* cuando el KV se
  // crea desde su panel, y una integracion de Upstash directa inyecta UPSTASH_*.
  // lib/kv.js acepta ambos desde siempre; este fichero leia las variables a mano
  // y solo miraba KV_*.
  //
  // La consecuencia no era un error visible, que es lo que la hacia peligrosa:
  // sin credenciales, incrementarContador devuelve null, y arriba el codigo
  // exige `count !== null` para bloquear. Es decir, FALLA ABIERTO en silencio y
  // el rate limit deja de existir. Medido contra produccion antes de este
  // cambio: 130 peticiones a /api/track en 8 segundos, las 130 con HTTP 200 y
  // ni un solo 429, con el cupo por defecto en 90/min.
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  try {
    // INCR + EXPIRE en pipeline para atomicidad.
    const r = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", clave],
        ["EXPIRE", clave, String(ventanaSeg)],
      ]),
    });
    if (!r.ok) return null;
    const data = await r.json();
    // data = [{ result: <new_count> }, { result: 1 }]
    return data?.[0]?.result || null;
  } catch {
    return null;
  }
}

export async function middleware(req) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get("user-agent") || "";

  // 0) NUESTROS PROPIOS CRONES, ANTES QUE NADA.
  //
  // Esta comprobacion estaba mas abajo, dentro de la rama de /api/*, y por eso
  // llegaba tarde: el filtro de User-Agent del paso 1 ya habia devuelto 403.
  // El monitor de viajes (.github/workflows/monitor-viajes.yml) llama con curl,
  // curl manda "curl/8.x", y ese patron esta en la lista negra — asi que la
  // unica capacidad que justifica Anduve Pro, "miramos por ti mientras no
  // estas", llevaba desde su creacion sin ejecutarse ni una vez. Cuatro de
  // cuatro corridas en rojo con este mismo 403.
  //
  // El orden correcto es este: el secreto compartido es una credencial de
  // servidor y demuestra mucho mas que un User-Agent, que el comentario de
  // abajo ya reconoce como falsificable. Si la peticion trae el secreto bueno,
  // es nuestra, y no hay nada que filtrar.
  const secretAlertas = process.env.ALERTS_SHARED_SECRET;
  if (secretAlertas && req.headers.get("x-alert-secret") === secretAlertas) {
    return NextResponse.next();
  }

  // 1) Bloqueo de User-Agents de scraping conocidos
  if (BLOCKED_UA_PATTERNS.some((re) => re.test(ua))) {
    return new NextResponse(
      JSON.stringify({ error: "automated_clients_not_allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  // 2) Rate limiting solo en /api/*
  if (!pathname.startsWith("/api/")) return NextResponse.next();

  // 2b) El DETECTOR queda exento del rate limit. En una corrida postea a
  // /api/alertas/disparar una vez por ruta×mes (204×6 ≈ 1.224 llamadas) desde
  // la MISMA IP de GitHub Actions, y el cupo default es 90/min: pasado el
  // minuto empezaba a comerse 429 y —como el detector ignoraba la respuesta—
  // esas alertas se perdian sin dejar rastro. Se identifica por el secret
  // compartido, no por IP ni User-Agent (ambos falsificables); sin secret
  // configurado esta rama no existe.
  //
  // La comprobacion vive ahora en el paso 0, arriba del todo, porque aqui
  // llegaba despues del filtro de User-Agent y no salvaba a quien viniera con
  // curl. Se deja dicho aqui para que nadie la vuelva a bajar.

  // Detectar config específico del endpoint o usar default.
  let cfg = RATE_LIMITS.default;
  for (const ruta of Object.keys(RATE_LIMITS)) {
    if (ruta !== "default" && pathname.startsWith(ruta)) {
      cfg = RATE_LIMITS[ruta];
      break;
    }
  }

  const ip = getClientIp(req);
  // Ventana de tiempo discretizada: la clave cambia cada N segundos,
  // así no hace falta lógica de sliding window.
  const ventana = Math.floor(Date.now() / 1000 / cfg.ventanaSeg);
  const clave = `rl:${ip}:${pathname}:${ventana}`;

  const count = await incrementarContador(clave, cfg.ventanaSeg);
  if (count !== null && count > cfg.max) {
    return new NextResponse(
      JSON.stringify({
        error: "rate_limit_exceeded",
        retry_after_seconds: cfg.ventanaSeg,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(cfg.ventanaSeg),
        },
      }
    );
  }

  return NextResponse.next();
}

// Matcher: solo correr el middleware en /api/* + cualquier ruta donde
// queramos chequear el UA. Excluimos assets estáticos.
export const config = {
  matcher: [
    "/api/:path*",
    // Para el UA blocking en TODO menos assets:
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png|.*\\.jpg|.*\\.json).*)",
  ],
};
