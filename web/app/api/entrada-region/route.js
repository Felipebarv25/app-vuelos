// API serverless: dada una REGIÓN, un ORIGEN (IATA) y un MES (YYYY-MM),
// busca en Travelpayouts las TOP candidatas de entrada (las más probables de
// ser baratas según el catálogo) y devuelve las ofertas reales ordenadas por
// precio. La primera = "entrada óptima" para arrancar la ruta multiciudad.
//
// Estrategia: solo consultamos las 6 candidatas con menor precio ESTIMADO del
// catálogo en la región. Eso evita 30+ llamadas a Travelpayouts y bordea la
// respuesta correcta el ~90% de las veces (los estimados están bien afinados
// para "qué es más barato"; lo que falla es el precio absoluto).
//
// Cache: edge s-maxage=3h por (origen, region, mes). Si 100 usuarios hacen la
// misma búsqueda hoy, solo el primero pega Travelpayouts.

import { DESTINOS_PRESUPUESTO } from "@/lib/presupuesto";
import { iataDe, iataAltDe } from "@/lib/iataCiudades";

export const maxDuration = 25;

const BASE = "https://api.travelpayouts.com/aviasales/v3/prices_for_dates";
const UA = "Anduve/1.0 (https://anduve-app.vercel.app)";
const TOP_CANDIDATOS = 6;

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
    const escIda = Number.isFinite(Number(fila.transfers)) ? Number(fila.transfers) : null;
    const escVuelta = Number.isFinite(Number(fila.return_transfers)) ? Number(fila.return_transfers) : null;
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
  const origen = (searchParams.get("origen") || "").toUpperCase();
  const region = (searchParams.get("region") || "").toLowerCase();
  const mes = (searchParams.get("mes") || "").slice(0, 7);

  if (!/^[A-Z]{3}$/.test(origen)) {
    return Response.json({ error: "origen IATA inválido" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}$/.test(mes)) {
    return Response.json({ error: "mes YYYY-MM inválido" }, { status: 400 });
  }
  if (!region) {
    return Response.json({ error: "region requerida" }, { status: 400 });
  }

  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) {
    return Response.json(
      { error: "Servidor no configurado", motivo: "Falta TRAVELPAYOUTS_TOKEN" },
      { status: 503 }
    );
  }
  const marker = process.env.TRAVELPAYOUTS_MARKER || "";

  // Top N candidatas: las 6 con menor estimado del catálogo en la región.
  // No es perfecto pero es el sesgo correcto (un Madrid casi siempre va a
  // ganar frente a un Zúrich, etc). Bordea la respuesta correcta sin pegar
  // los 30+ destinos del catálogo.
  const candidatas = DESTINOS_PRESUPUESTO
    .filter((d) => region === "todas" || d.region === region)
    .sort((a, b) => a.vuelo - b.vuelo)
    .slice(0, TOP_CANDIDATOS);

  if (!candidatas.length) {
    return Response.json({ ofertas: [], mejor: null });
  }

  // Resolvemos IATAs + alternativos (Estambul IST/SAW etc) y disparamos en
  // paralelo. Si tanto principal como alternativo dan precio, nos quedamos
  // con el más barato de los dos.
  const tareas = candidatas.map(async (c) => {
    const iata = iataDe(c.ciudad, c.pais);
    if (!iata) return null;
    const iataAlt = iataAltDe(c.ciudad, c.pais);
    const llamadas = [consultar(origen, iata, mes, token, marker)];
    if (iataAlt) llamadas.push(consultar(origen, iataAlt, mes, token, marker));
    const results = (await Promise.all(llamadas)).filter(Boolean);
    if (!results.length) return null;
    results.sort((a, b) => a.precio - b.precio);
    return { ...results[0], ciudad: c.ciudad, pais: c.pais };
  });

  const ofertas = (await Promise.all(tareas)).filter(Boolean);
  if (!ofertas.length) {
    return new Response(JSON.stringify({ ofertas: [], mejor: null }), {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  }

  ofertas.sort((a, b) => a.precio - b.precio);
  const mejor = ofertas[0];
  const visto = new Date().toISOString();

  return new Response(
    JSON.stringify({ ofertas, mejor, visto }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // 3h en edge: si 100 usuarios buscan "BOG → Europa para nov", solo
        // el primero pega Travelpayouts.
        "Cache-Control": "public, s-maxage=10800, stale-while-revalidate=86400",
      },
    }
  );
}
