function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }

/**
 * Puntuación explicable. No pretende descubrir una "verdad" universal:
 * pondera coste, puerta a puerta, comodidad y confianza de los datos.
 */
export function puntuarTransporte(opciones = [], { nivel = "medio", prioridad = "equilibrado" } = {}) {
  const validas = opciones.filter((o) => o?.disponible !== false && n(o?.precio, -1) >= 0 && n(o?.puertaAPuerta_h, -1) >= 0);
  if (!validas.length) return [];

  const precios = validas.map((o) => n(o.precio));
  const tiempos = validas.map((o) => n(o.puertaAPuerta_h));
  const minP = Math.min(...precios); const maxP = Math.max(...precios);
  const minT = Math.min(...tiempos); const maxT = Math.max(...tiempos);
  const peso = prioridad === "barato"
    ? { precio: .60, tiempo: .20, comodidad: .10, confianza: .10 }
    : prioridad === "rapido"
      ? { precio: .15, tiempo: .60, comodidad: .15, confianza: .10 }
      : { precio: .35, tiempo: .35, comodidad: .20, confianza: .10 };

  const puntuadas = validas.map((o) => {
    const precio = maxP === minP ? 1 : 1 - (n(o.precio) - minP) / (maxP - minP);
    const tiempo = maxT === minT ? 1 : 1 - (n(o.puertaAPuerta_h) - minT) / (maxT - minT);
    const medio = String(o.medio || "").toLowerCase();
    let comodidad = medio === "tren" ? 0.95 : medio === "vuelo" ? 0.78 : medio === "bus" ? 0.58 : 0.65;
    if (nivel === "mochilero" && medio === "bus") comodidad += .08;
    if (nivel === "comodo" && medio === "tren") comodidad += .03;
    const confianza = o.fuente === "detectado" ? 1 : o.fuente === "curado" ? .85 : o.fuente === "estimado" ? .45 : .2;
    const score = (precio * peso.precio + tiempo * peso.tiempo + Math.min(1, comodidad) * peso.comodidad + confianza * peso.confianza) * 100;
    return { ...o, score: Math.round(score) };
  });

  puntuadas.sort((a, b) => b.score - a.score);
  const mejor = puntuadas[0];
  return puntuadas.map((o) => ({
    ...o,
    recomendado: o === mejor,
    explicacion: o === mejor
      ? "Mejor equilibrio para este viaje según precio, tiempo, comodidad y confianza de los datos."
      : o.score >= 75
        ? "Alternativa muy competitiva para este viaje."
        : o.score >= 55
          ? "Alternativa razonable, pero con algún compromiso."
          : "Pierde frente a otras opciones por precio, tiempo o confianza.",
  }));
}
