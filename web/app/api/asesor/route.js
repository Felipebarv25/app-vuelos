// Endpoint del "Asesor de viajes" (chat con IA de Claude).
// Usa el SDK oficial @anthropic-ai/sdk con streaming. La clave va en la variable
// de entorno ANTHROPIC_API_KEY (configúrala en Vercel → Settings → Environment
// Variables). Si no hay clave, responde 503 para que la UI muestre un aviso.

import Anthropic from "@anthropic-ai/sdk";
import { DESTINOS_PRESUPUESTO, REGIONES } from "@/lib/presupuesto";

export const runtime = "nodejs";
export const maxDuration = 30;

// Modelo: Sonnet 4.6 = gran calidad para asesoría de viajes a ~1/5 del costo de
// Opus. Si quieres máxima capacidad, cámbialo a "claude-opus-4-8".
const MODELO = "claude-sonnet-4-6";

// Construye un catálogo compacto para que el asesor conozca NUESTRA oferta real.
function catalogoTexto() {
  const porRegion = {};
  for (const d of DESTINOS_PRESUPUESTO) {
    (porRegion[d.region] ||= []).push(`${d.ciudad} (${d.pais}, ~US$${d.vuelo} vuelo i/v, ~US$${d.dia}/día)`);
  }
  return Object.entries(porRegion)
    .map(([reg, lista]) => `${REGIONES[reg] || reg}: ${lista.join("; ")}`)
    .join("\n");
}

function systemPrompt({ paisUsuario, ciudadUsuario, iataOrigen } = {}) {
  const ctxOrigen = paisUsuario
    ? `El viajero te escribe desde ${ciudadUsuario ? `${ciudadUsuario}, ` : ""}${paisUsuario}${iataOrigen ? ` (aeropuerto cercano: ${iataOrigen})` : ""}. Adapta las recomendaciones a su origen real, no asumas Bogotá/Medellín. Los costos del catálogo son una referencia tomada desde varios hubs (Bogotá, Medellín, Ciudad de México, Lima, Madrid, Miami, etc.); si el origen real del viajero es muy distinto, dile que el vuelo puede variar ±30% y que use el detector con su aeropuerto.`
    : `Si todavía no sabes desde qué ciudad/país viaja el usuario, pregúntale primero (es lo que más cambia el costo del vuelo). NO asumas Colombia ni ningún país por defecto.`;

  return `Eres "Brújula", la asesora de viajes de Viajero 360, una app que arma itinerarios y rutas por presupuesto para viajeros de cualquier país.

Contexto del viajero:
${ctxOrigen}

Tu rol:
- Recomendar destinos, rutas multiciudad y planes según el presupuesto, fechas, gustos y compañía del viajero.
- Ser cálida, cercana y MUY concreta. Respuestas breves y accionables. Evita relleno.

FORMATO (importante): el chat muestra TEXTO PLANO, NO renderiza Markdown. Por eso:
- NO uses tablas, NO uses encabezados con # ni ##, NO uses **negritas** con asteriscos.
- Usa viñetas simples con "•" o "-", y emojis con moderación.
- Mantén las respuestas cortas y fáciles de leer en un chat móvil.
- Responde SIEMPRE en el mismo idioma del usuario.
- Cuando propongas un viaje, sugiere usar las funciones de la app: "Ruta multiciudad por presupuesto", "Un destino" y el itinerario día a día con mapa.
- Usa el catálogo de abajo como referencia de costos (son estimados orientativos). Aclara que los precios reales se confirman con el detector de vuelos de la app desde el aeropuerto del viajero.

Límites:
- No des asesoría legal de visados ni consejos financieros/de inversión; sugiere verificar requisitos oficiales (la app tiene una sección /requisitos).
- No inventes precios muy alejados del catálogo. Si no sabes algo, dilo y ofrece una alternativa.

CATÁLOGO DE REFERENCIA (ciudad, país, vuelo i/v aprox., costo por día aprox.):
${catalogoTexto()}`;
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "sin_api_key" }, { status: 503 });
  }

  let mensajes;
  let contextoOrigen = {};
  try {
    const body = await req.json();
    mensajes = body.mensajes;
    // Contexto opcional para que Brújula NO asuma Colombia. El cliente lo manda
    // si tiene el dato (geo + selección del modal de Presupuesto).
    if (body.origen && typeof body.origen === "object") {
      const o = body.origen;
      contextoOrigen = {
        paisUsuario: typeof o.pais === "string" ? o.pais.slice(0, 60) : undefined,
        ciudadUsuario: typeof o.ciudad === "string" ? o.ciudad.slice(0, 60) : undefined,
        iataOrigen: typeof o.iata === "string" ? o.iata.slice(0, 5).toUpperCase() : undefined,
      };
    }
  } catch {
    return Response.json({ error: "json" }, { status: 400 });
  }
  if (!Array.isArray(mensajes) || !mensajes.length) {
    return Response.json({ error: "mensajes" }, { status: 400 });
  }

  // Saneamos: solo role+content de texto, máximo de historial razonable.
  const limpios = mensajes
    .slice(-10) // menos historial = menos tokens de entrada (mismo modelo)
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2500) }));
  // La API exige que el PRIMER mensaje sea del usuario: descartamos los mensajes
  // del asistente al inicio (p. ej. el saludo de bienvenida de la UI).
  while (limpios.length && limpios[0].role !== "user") limpios.shift();
  if (!limpios.length) {
    return Response.json({ error: "formato" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: MODELO,
    max_tokens: 800, // respuestas concisas = menor costo de salida (lo más caro)
    system: [
      { type: "text", text: systemPrompt(contextoOrigen), cache_control: { type: "ephemeral" } },
    ],
    messages: limpios,
  });

  const encoder = new TextEncoder();
  const rs = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (e) {
        controller.enqueue(encoder.encode("\n\n⚠️ Tuve un problema para responder. Intenta de nuevo."));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
