// API serverless que consulta TRAVELPAYOUTS en vivo para un destino dado,
// buscando la mejor oferta i/v entre BOG y MDE en los próximos 6 meses.
//
// Llama el endpoint público "Prices for dates":
//   https://api.travelpayouts.com/aviasales/v3/prices_for_dates
// El token vive en la env var TRAVELPAYOUTS_TOKEN (servidor, no se expone).
// El marker (afiliado, opcional) en TRAVELPAYOUTS_MARKER.
//
// Cache edge 6h cuando hay resultado; no-store si vacío para reintentar pronto.

export const maxDuration = 20;

const BASE = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const ORIGENES = ["BOG", "MDE"];
const UA = "Viajero360/1.0 (https://app-vuelos-mfos.vercel.app)";

function mesISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Devuelve los próximos N meses en formato "YYYY-MM" empezando por el siguiente
// mes (los vuelos del mes actual suelen ser más caros y de poco valor).
function proximosMeses(n = 6) {
  const out = [];
  const ahora = new Date();
  ahora.setDate(1);
  ahora.setMonth(ahora.getMonth() + 1);
  for (let i = 0; i < n; i++) {
    const d = new Date(ahora);
    d.setMonth(d.getMonth() + i);
    out.push(mesISO(d));
  }
  return out;
}

async function consultar(origen, destino, mes, token, marker) {
  const url = new URL(BASE);
  url.searchParams.set("origin", origen);
  url.searchParams.set("destination", destino);
  url.searchParams.set("departure_at", mes);
  url.searchParams.set("return_at", mes);
  url.searchParams.set("currency", "usd");
  url.searchParams.set("sorting", "price");
  url.searchParams.set("one_way", "false");
  url.searchParams.set("limit", "1");
  url.searchParams.set("token", token);

  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const data = await r.json();
    const fila = (data.data || []).find((f) => Number(f.price) > 0);
    if (!fila) return null;
    const precio = Number(fila.price);
    let link = "https://www.aviasales.com" + (fila.link || "");
    if (marker) {
      const sep = link.includes("?") ? "&" : "?";
      link = `${link}${sep}marker=${marker}`;
    }
    return {
      precio,
      origen,
      destino,
      aerolinea: fila.airline || "—",
      fecha_ida: (fila.departure_at || mes).slice(0, 10),
      fecha_vuelta: (fila.return_at || "").slice(0, 10),
      link,
    };
  } catch {
    return null;
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const iata = (searchParams.get("iata") || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) {
    return Response.json({ error: "iata inválido" }, { status: 400 });
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    return Response.json(
      { error: "Servidor no configurado", motivo: "Falta TRAVELPAYOUTS_TOKEN en el entorno" },
      { status: 503 }
    );
  }
  const marker = process.env.TRAVELPAYOUTS_MARKER || "";

  // Combinaciones origen × mes en paralelo. Tope ~12 llamadas (2 × 6) que se
  // resuelven en <8s gracias a paralelismo.
  const meses = proximosMeses(6);
  const tareas = [];
  for (const o of ORIGENES) {
    for (const m of meses) {
      tareas.push(consultar(o, iata, m, token, marker));
    }
  }
  const resultados = (await Promise.all(tareas)).filter(Boolean);
  if (!resultados.length) {
    return new Response(
      JSON.stringify({ encontrado: false }),
      { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
    );
  }

  // Mejor (más barata).
  resultados.sort((a, b) => a.precio - b.precio);
  const mejor = resultados[0];

  return new Response(
    JSON.stringify({ encontrado: true, ...mejor, visto: new Date().toISOString() }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // 6h en edge: el precio no varía cada minuto y ahorra llamadas a Travelpayouts.
        "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400",
      },
    }
  );
}
