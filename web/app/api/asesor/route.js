// Endpoint del "Asesor de viajes" (chat con IA de Claude).
// Usa el SDK oficial @anthropic-ai/sdk con streaming. La clave va en la variable
// de entorno ANTHROPIC_API_KEY (configúrala en Vercel → Settings → Environment
// Variables). Si no hay clave, responde 503 para que la UI muestre un aviso.

import Anthropic from "@anthropic-ai/sdk";
import { DESTINOS_PRESUPUESTO, REGIONES } from "@/lib/presupuesto";
import { contextoDeViaje, REGLAS_ASESOR_VIAJE } from "@/lib/contextoViaje";
import { comprobar, anotarUso, respuestaBloqueada } from "@/lib/guardiaPro";

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

  return `Eres "Brújula", la asesora de viajes de Anduve, una app que arma itinerarios y rutas por presupuesto para viajeros de cualquier país.

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

// EL SEGUNDO MODO DEL ASESOR: hablar de UN viaje concreto.
//
// Brujula (arriba) recomienda destinos a quien no sabe a donde ir. Cuando el
// viaje ya existe la conversacion es otra —"¿me alcanza?", "¿por que tren?",
// "¿que me falta?"— y necesita los datos de ESE viaje, no el catalogo.
//
// EL CONTEXTO LO ARMA EL SERVIDOR, NO EL CLIENTE
//
// El navegador manda DATOS, nunca el texto del prompt. Si aceptaramos la
// prosa ya redactada, cualquiera podria mandar el system prompt que quisiera
// y usar nuestra clave como un Claude gratis. Aqui se sanea lo que llega y
// la frase la escribe lib/contextoViaje, que es nuestro.
const TOPE_PARADAS = 30;
const TOPE_TRAMOS = 30;
const TOPE_TAREAS = 40;
const TOPE_CONTEXTO = 12000; // caracteres

const txt = (x, max = 80) => String(x ?? "").slice(0, max);
const num = (x) => (Number.isFinite(Number(x)) ? Number(x) : null);

function sanearViaje(v) {
  if (!v || typeof v !== "object") return null;
  const paradas = Array.isArray(v.paradas) ? v.paradas.slice(0, TOPE_PARADAS).map((p) => ({
    ciudad: txt(p?.ciudad), pais: txt(p?.pais, 4), noches: Math.max(0, Math.min(365, Math.round(num(p?.noches) || 0))),
  })).filter((p) => p.ciudad) : [];
  if (paradas.length < 2) return null;
  return {
    paradas,
    // El id de la ruta NO se copia: el asesor no lo necesita y no hay razon
    // para que un identificador del viajero salga de nuestro servidor.
    mesInicio: /^\d{4}-\d{2}$/.test(v.mesInicio || "") ? v.mesInicio : "",
    fechaIda: /^\d{4}-\d{2}-\d{2}$/.test(v.fechaIda || "") ? v.fechaIda : "",
    nivel: ["mochilero", "medio", "comodo"].includes(v.nivel) ? v.nivel : "medio",
    pasaporte: /^[A-Za-z]{2}$/.test(v.pasaporte || "") ? String(v.pasaporte).toUpperCase() : "CO",
    monedaVista: /^[A-Za-z]{3}$/.test(v.monedaVista || "") ? String(v.monedaVista).toUpperCase() : "USD",
  };
}

function sanearAnalisis(a) {
  if (!a || typeof a !== "object") return {};
  const p = a.presupuesto || {};
  return {
    presupuesto: {
      total: num(p.total), transporte: num(p.transporte), alojamientoYVida: num(p.alojamientoYVida),
      contingencia: num(p.contingencia), monedaVista: txt(p.monedaVista, 3).toUpperCase() || "USD",
      tasaVistaPorUsd: num(p.tasaVistaPorUsd) || 1, conversionEsRespaldo: Boolean(p.conversionEsRespaldo),
    },
    tramos: (Array.isArray(a.tramos) ? a.tramos : []).slice(0, TOPE_TRAMOS).map((t) => ({
      desde: txt(t?.desde), hasta: txt(t?.hasta),
      medio: txt(t?.medio, 20), medioRecomendado: txt(t?.medioRecomendado, 20),
      precio: num(t?.precio), precioRecomendado: num(t?.precioRecomendado),
      puertaAPuerta_h: num(t?.puertaAPuerta_h), puertaAPuertaRecomendada_h: num(t?.puertaAPuertaRecomendada_h),
      fuente: txt(t?.fuente, 20), fuenteRecomendada: txt(t?.fuenteRecomendada, 20),
      alternativas: (Array.isArray(t?.alternativas) ? t.alternativas : []).slice(0, 5)
        .map((x) => ({ medio: txt(x?.medio, 20), precio: num(x?.precio) })),
    })),
    estadia: (Array.isArray(a.estadia) ? a.estadia : []).slice(0, TOPE_PARADAS).map((e) => ({
      ciudad: txt(e?.ciudad), noches: Math.max(0, Math.round(num(e?.noches) || 0)),
      diarioUsd: num(e?.diarioUsd), totalUsd: num(e?.totalUsd), fuente: txt(e?.fuente, 20),
    })),
    inteligencia: {
      oportunidades: (Array.isArray(a.inteligencia?.oportunidades) ? a.inteligencia.oportunidades : []).slice(0, 5)
        .map((o) => ({ titulo: txt(o?.titulo, 160), prioridad: txt(o?.prioridad, 10), confianza: txt(o?.confianza, 10), dinero: num(o?.dinero) })),
      faltantes: (Array.isArray(a.inteligencia?.faltantes) ? a.inteligencia.faltantes : []).slice(0, 8)
        .map((f) => ({ texto: txt(f?.texto, 260) })),
    },
  };
}

function sanearPlan(pl) {
  if (!pl || typeof pl !== "object") return null;
  return {
    estadoViaje: txt(pl.estadoViaje, 30),
    tareas: (Array.isArray(pl.tareas) ? pl.tareas : []).slice(0, TOPE_TAREAS).map((t) => ({
      titulo: txt(t?.titulo, 160), prioridad: txt(t?.prioridad, 10), requiereAccion: Boolean(t?.requiereAccion),
    })),
  };
}

export async function POST(req) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "sin_api_key" }, { status: 503 });
  }

  let mensajes;
  let contextoOrigen = {};
  let contextoViaje = null;
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
    // Modo "mi viaje": llegan los datos, no el texto.
    if (body.viaje && typeof body.viaje === "object") {
      const viaje = sanearViaje(body.viaje);
      if (viaje) {
        const texto = contextoDeViaje({
          viaje,
          analisis: sanearAnalisis(body.analisis),
          plan: sanearPlan(body.plan),
          idioma: /^[a-z]{2}$/.test(body.idioma || "") ? body.idioma : "es",
        });
        if (texto) contextoViaje = texto.slice(0, TOPE_CONTEXTO);
      }
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

  // EL GUARDIA. Va aqui y no mas abajo porque a partir de la siguiente linea
  // se gasta dinero de verdad.
  //
  // Este endpoint estaba ABIERTO: sin sesion, sin limite y con la clave de
  // Anthropic detras. Cualquiera podia usarlo como un Claude gratis pagado
  // por Anduve. Lo encontre en la auditoria y es el agujero mas caro de los
  // que habia.
  //
  // El modo VIAJE exige sesion: solo lo usa el asesor del tablero, que ya
  // necesita un viaje guardado, asi que no rompe ninguna pantalla. El modo
  // general (la Brujula, que recomienda destinos a quien no sabe a donde ir)
  // se deja abierto a proposito: es la puerta de entrada al producto y
  // cerrarla seria pedirle a alguien que se registre antes de saber que es
  // esto. Queda con su limite por usuario cuando hay sesion.
  const guardia = await comprobar(req, "asesor", { requiereSesion: Boolean(contextoViaje) });
  if (!guardia.permitido) return respuestaBloqueada(guardia, "asesor");

  const client = new Anthropic({ apiKey });

  const stream = client.messages.stream({
    model: MODELO,
    max_tokens: 800, // respuestas concisas = menor costo de salida (lo más caro)
    // DOS BLOQUES, y el punto de cache al final del segundo.
    //
    // El cache es una coincidencia de PREFIJO: cualquier byte distinto
    // invalida todo lo que viene detras. En el modo viaje el prefijo entero
    // —reglas + datos de ESE viaje— es estable durante la conversacion, asi
    // que a partir del segundo mensaje se lee de cache en vez de reenviarse.
    // Meter los datos del viaje dentro del prompt general habria roto el
    // cache compartido del asesor de destinos en cada peticion.
    system: contextoViaje
      ? [
          { type: "text", text: REGLAS_ASESOR_VIAJE },
          { type: "text", text: contextoViaje, cache_control: { type: "ephemeral" } },
        ]
      : [
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
        // Se cuenta al final: si el modelo fallo antes de escribir nada, no
        // se le descuenta un uso a nadie.
        // Se cuenta al SUJETO, que es el email si hay sesion y la IP si no.
        // Antes era `if (guardia.email)`, asi que el trafico anonimo —el unico
        // sin techo— era ademas el unico que no dejaba rastro de cuanto gastaba.
        if (guardia.sujeto) anotarUso("asesor", guardia.sujeto);
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
