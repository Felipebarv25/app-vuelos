// API serverless que consulta TRAVELPAYOUTS en vivo para un destino dado,
// buscando la mejor oferta i/v entre BOG y MDE en los próximos 6 meses.
//
// Llama el endpoint público "Prices for dates".
// El token vive en la env var TRAVELPAYOUTS_TOKEN (servidor, no se expone).
// El marker (afiliado, opcional) en TRAVELPAYOUTS_MARKER.

export const maxDuration = 20;

const BASE = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const ORIGENES_DEFAULT = ["BOG", "MDE"];
const UA = "Anduve/1.0 (https://anduve-app.vercel.app)";

function mesISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

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

async function consultar(origen, destino, cuando, token, marker) {
  const url = new URL(BASE);
  url.searchParams.set("origin", origen);
  url.searchParams.set("destination", destino);
  url.searchParams.set("departure_at", cuando);
  url.searchParams.set("return_at", cuando.slice(0, 7));
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
    const escIda = fila.transfers === 0 || Number.isFinite(Number(fila.transfers)) ? Number(fila.transfers) : null;
    const escVuelta = fila.return_transfers === 0 || Number.isFinite(Number(fila.return_transfers)) ? Number(fila.return_transfers) : null;
    return {
      precio,
      origen,
      destino,
      aerolinea: fila.airline || "—",
      fecha_ida: (fila.departure_at || cuando).slice(0, 10),
      fecha_vuelta: (fila.return_at || "").slice(0, 10),
      link,
      escalas_ida: escIda,
      escalas_vuelta: escVuelta,
      duracion_ida: Number.isFinite(Number(fila.duration_to)) ? Number(fila.duration_to) : null,
      duracion_vuelta: Number.isFinite(Number(fila.duration_back)) ? Number(fila.duration_back) : null,
    };
  } catch {
    return null;
  }
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const iata = (searchParams.get("iata") || "").toUpperCase();
  const iata2 = (searchParams.get("iata2") || "").toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) return Response.json({ error: "iata inválido" }, { status: 400 });

  const origenesRaw = (searchParams.get("origenes") || "").toUpperCase();
  const origenesParsed = origenesRaw.split(",").map((x) => x.trim()).filter((x) => /^[A-Z]{3}$/.test(x)).slice(0, 3);
  const origenes = origenesParsed.length ? origenesParsed : ORIGENES_DEFAULT;

  const fecha = (searchParams.get("fecha") || "").trim();
  const diaExacto = /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null;
  const mes = (searchParams.get("mes") || "").trim();
  const mesSolicitado = /^\d{4}-\d{2}$/.test(mes) ? mes : null;

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return Response.json({ error: "Servidor no configurado", motivo: "Falta TRAVELPAYOUTS_TOKEN en el entorno" }, { status: 503 });
  const marker = process.env.TRAVELPAYOUTS_MARKER || "";
  const destinos = /^[A-Z]{3}$/.test(iata2) ? [iata, iata2] : [iata];

  // Prioridad: día exacto > mes del viaje > próximos seis meses.
  // Así Mi viaje puede consultar mayo de 2027 aunque el viajero todavía no
  // haya escogido el día concreto.
  const cuandos = diaExacto ? [diaExacto] : mesSolicitado ? [mesSolicitado] : proximosMeses(6);
  const tareas = [];
  for (const o of origenes) for (const d of destinos) for (const c of cuandos) tareas.push(consultar(o, d, c, token, marker));
  const resultados = (await Promise.all(tareas)).filter(Boolean);
  if (!resultados.length) return new Response(JSON.stringify({ encontrado: false }), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

  resultados.sort((a, b) => a.precio - b.precio);
  const mejor = resultados[0];
  const porMes = [];
  for (const r of resultados) {
    const m = (r.fecha_ida || "").slice(0, 7);
    if (!m) continue;
    const ya = porMes.find((x) => x.mes === m);
    if (!ya) porMes.push({ mes: m, precio: r.precio, fecha_ida: r.fecha_ida, aerolinea: r.aerolinea });
    else if (r.precio < ya.precio) Object.assign(ya, { precio: r.precio, fecha_ida: r.fecha_ida, aerolinea: r.aerolinea });
  }
  porMes.sort((a, b) => a.mes.localeCompare(b.mes));

  return new Response(JSON.stringify({ encontrado: true, ...mejor, porMes, esDeTuFecha: !!diaExacto, esDeTuMes: !!mesSolicitado, mesConsultado: mesSolicitado || null, visto: new Date().toISOString() }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=21600, stale-while-revalidate=86400" },
  });
}
