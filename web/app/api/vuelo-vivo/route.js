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
// Origenes por defecto (Colombia): BOG/MDE — son los que el detector escanea
// cada 3h y los que la mayoria de usuarios usan. Si el cliente pasa `origenes=`
// (CSV de IATAs), se respeta esa lista en lugar del default. Asi un viajero
// en Mexico puede pedir MEX+CUN, uno en Ecuador puede pedir UIO+GYE, etc.
const ORIGENES_DEFAULT = ["BOG", "MDE"];
const UA = "Anduve/1.0 (https://anduve-app.vercel.app)";

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
    // Escalas: Travelpayouts devuelve `transfers` (ida) y `return_transfers`
    // (vuelta). 0 = directo. Si vienen ausentes, los dejamos null y la UI
    // muestra "—" (no asumimos directo para no mentir).
    const escIda = fila.transfers === 0 || Number.isFinite(Number(fila.transfers))
      ? Number(fila.transfers)
      : null;
    const escVuelta = fila.return_transfers === 0 || Number.isFinite(Number(fila.return_transfers))
      ? Number(fila.return_transfers)
      : null;
    return {
      precio,
      origen,
      destino,
      aerolinea: fila.airline || "—",
      fecha_ida: (fila.departure_at || mes).slice(0, 10),
      fecha_vuelta: (fila.return_at || "").slice(0, 10),
      link,
      escalas_ida: escIda,
      escalas_vuelta: escVuelta,
    };
  } catch {
    return null;
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const iata = (searchParams.get("iata") || "").toUpperCase();
  const iata2 = (searchParams.get("iata2") || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) {
    return Response.json({ error: "iata inválido" }, { status: 400 });
  }
  // Parametro opcional: `origenes=BOG,MDE` o `origenes=MEX,CUN` etc.
  // Solo aceptamos hasta 3 origenes para acotar el numero de llamadas (24 = 3*N
  // destinos * 6 meses). Cae al default si no llega o si llega vacio.
  const origenesRaw = (searchParams.get("origenes") || "").toUpperCase();
  const origenesParsed = origenesRaw
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^[A-Z]{3}$/.test(x))
    .slice(0, 3);
  const origenes = origenesParsed.length ? origenesParsed : ORIGENES_DEFAULT;

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    return Response.json(
      { error: "Servidor no configurado", motivo: "Falta TRAVELPAYOUTS_TOKEN en el entorno" },
      { status: 503 }
    );
  }
  const marker = process.env.TRAVELPAYOUTS_MARKER || "";

  // Destinos a probar: principal + alternativo si lo trae (ciudades con más de
  // un aeropuerto, p. ej. Estambul IST+SAW). Travelpayouts a veces no tiene
  // datos en uno y sí en el otro.
  const destinos = /^[A-Z]{3}$/.test(iata2) ? [iata, iata2] : [iata];

  // Combinaciones origen × destino × mes en paralelo. Tope ~36 llamadas (3 × 2 × 6).
  const meses = proximosMeses(6);
  const tareas = [];
  for (const o of origenes) {
    for (const d of destinos) {
      for (const m of meses) {
        tareas.push(consultar(o, d, m, token, marker));
      }
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
