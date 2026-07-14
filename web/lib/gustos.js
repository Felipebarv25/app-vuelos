// Gustos del viajero (2026-07-13) — wizard "personaliza tu ruta" estilo
// preguntas de filtro (inspirado en el onboarding de Itinio, que el usuario
// quiso adoptar). Tres respuestas: intereses (multi), ritmo y momento.
// Se guardan en localStorage y el itinerario de CUALQUIER ciudad se arma
// mezclando las categorias elegidas (round-robin para variedad) en vez del
// bloque generico de imperdibles.

const CLAVE = "anduve_gustos";

// Catalogo de intereses -> categorias OSM reales (lib/osm.js CATEGORIAS).
export const INTERESES = {
  cultura:   { emoji: "🏛️", cats: ["museos", "monumentos"] },
  comida:    { emoji: "🍽️", cats: ["restaurantes", "cafes"] },
  naturaleza:{ emoji: "🌳", cats: ["parques"] },
  rumba:     { emoji: "🍸", cats: ["bares"] },
  compras:   { emoji: "🛍️", cats: ["compras"] },
  miradores: { emoji: "📸", cats: ["miradores"] },
  deporte:   { emoji: "⚽", cats: ["estadios"] },
};

// Ritmo -> horas de ruta por dia (el motor deriva las paradas de las horas).
export const HORAS_POR_RITMO = { relajado: 5, intenso: 9 };

export function leerGustos() {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (g && Array.isArray(g.intereses)) return g;
  } catch {}
  return null;
}

export function guardarGustos(g) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...g, ts: Date.now() })); } catch {}
}

export function borrarGustos() {
  try { localStorage.removeItem(CLAVE); } catch {}
}

// Categorias OSM a mezclar segun los gustos. De noche siempre entra "bares"
// (la ruta nocturna sin rumba no tiene sentido).
export function categoriasDeGustos(g, momento) {
  const cats = [];
  for (const i of g?.intereses || []) {
    for (const c of INTERESES[i]?.cats || []) if (!cats.includes(c)) cats.push(c);
  }
  const mom = momento || g?.momento;
  if (mom === "nocturno" && !cats.includes("bares")) cats.push("bares");
  return cats;
}

// Mezcla varias listas de lugares intercalando 1 de cada una (round-robin):
// asi el plan queda VARIADO (museo, restaurante, parque...) en vez de 5
// museos seguidos. Dedupe por nombre+coord aproximada.
export function intercalarLugares(listas) {
  const out = [];
  const vistos = new Set();
  const max = Math.max(0, ...listas.map((l) => l?.length || 0));
  for (let i = 0; i < max; i++) {
    for (const lista of listas) {
      const l = lista?.[i];
      if (!l) continue;
      const key = `${(l.nombre || "").toLowerCase()}|${l.coord?.[0]?.toFixed?.(3)},${l.coord?.[1]?.toFixed?.(3)}`;
      if (vistos.has(key)) continue;
      vistos.add(key);
      out.push(l);
    }
  }
  return out;
}
