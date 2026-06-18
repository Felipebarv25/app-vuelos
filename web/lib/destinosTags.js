// Categorias de gusto por destino. Cada destino tiene 2-4 tags que describen
// que tipo de viaje representa. Cuando el usuario interactua con un destino
// (busca, abre detalle, agrega a su itinerario), se suma score a esas tags
// en su perfil (user:<email>.gustos en KV).
//
// Despues, /api/profile/recomendar usa esas tags para:
//  - Decidir el tema de fondo del hero (playa vs. ciudad historica).
//  - Ordenar destinos sugeridos en la home.
//
// Categorias soportadas: playa, ciudad, historia, naturaleza, montana,
// gastronomia, lujo, economico, aventura, nocturna, romantico, familiar,
// asia, desierto, invierno. Las últimas 3 (asia/desierto/invierno) activan
// los temas de fondo nuevos del hero — ver HERO_IMGS_POR_TEMA en page.js.

export const CATEGORIAS_GUSTO = [
  "playa", "ciudad", "historia", "naturaleza", "montana",
  "gastronomia", "lujo", "economico", "aventura", "nocturna",
  "romantico", "familiar", "asia", "desierto", "invierno",
];

// Diccionario por ciudad (minusculas, sin tildes). Si una ciudad no aparece,
// caemos a tagsPorRegion segun region del destino.
export const TAGS_POR_CIUDAD = {
  // --- Caribe / Playas top ---
  "cartagena": ["playa", "historia", "romantico", "gastronomia"],
  "cancun": ["playa", "lujo", "nocturna", "familiar"],
  "punta cana": ["playa", "lujo", "romantico", "familiar"],
  "rio de janeiro": ["playa", "ciudad", "nocturna", "aventura"],
  "miami": ["playa", "lujo", "ciudad", "nocturna"],
  "santa marta": ["playa", "naturaleza", "aventura", "economico"],
  "san andres": ["playa", "naturaleza", "romantico", "familiar"],
  // --- Ciudades historicas Europa ---
  "paris": ["ciudad", "historia", "romantico", "gastronomia"],
  "roma": ["historia", "ciudad", "gastronomia"],
  "florencia": ["historia", "ciudad", "romantico", "gastronomia"],
  "venecia": ["historia", "romantico", "ciudad"],
  "madrid": ["ciudad", "gastronomia", "nocturna", "historia"],
  "barcelona": ["ciudad", "playa", "gastronomia", "historia"],
  "lisboa": ["ciudad", "historia", "gastronomia", "economico"],
  "oporto": ["ciudad", "historia", "gastronomia", "economico"],
  "londres": ["ciudad", "historia", "gastronomia"],
  "amsterdam": ["ciudad", "historia", "nocturna"],
  "praga": ["historia", "ciudad", "economico", "romantico"],
  "viena": ["historia", "ciudad", "romantico", "gastronomia"],
  "budapest": ["historia", "ciudad", "economico", "romantico"],
  "berlin": ["ciudad", "historia", "nocturna"],
  "atenas": ["historia", "ciudad", "gastronomia"],
  "estambul": ["historia", "ciudad", "gastronomia"],
  // --- Asia ---
  "tokio": ["ciudad", "gastronomia", "nocturna", "lujo", "asia"],
  "kioto": ["historia", "naturaleza", "romantico", "asia"],
  "bangkok": ["ciudad", "gastronomia", "economico", "nocturna", "asia"],
  "bali": ["playa", "naturaleza", "romantico", "aventura", "asia"],
  "phuket": ["playa", "lujo", "romantico", "aventura", "asia"],
  "dubai": ["lujo", "ciudad", "playa", "aventura", "desierto"],
  "singapur": ["ciudad", "lujo", "gastronomia", "familiar", "asia"],
  "hong kong": ["ciudad", "gastronomia", "nocturna", "asia"],
  "seul": ["ciudad", "gastronomia", "nocturna", "asia"],
  // --- Latinoamerica ---
  "ciudad de mexico": ["ciudad", "historia", "gastronomia", "economico"],
  "buenos aires": ["ciudad", "gastronomia", "nocturna", "historia"],
  "lima": ["ciudad", "gastronomia", "historia"],
  "cusco": ["historia", "montana", "aventura", "naturaleza"],
  "santiago": ["ciudad", "gastronomia", "naturaleza"],
  "quito": ["historia", "ciudad", "naturaleza", "economico"],
  "medellin": ["ciudad", "naturaleza", "nocturna", "economico"],
  "bogota": ["ciudad", "gastronomia", "economico"],
  // --- Norteamerica ---
  "nueva york": ["ciudad", "lujo", "gastronomia", "nocturna"],
  "los angeles": ["ciudad", "playa", "lujo", "nocturna"],
  "san francisco": ["ciudad", "gastronomia", "naturaleza"],
  "las vegas": ["nocturna", "lujo", "ciudad", "desierto"],
  // --- Más Asia (cobertura adicional para activar tema "asia") ---
  "kuala lumpur": ["ciudad", "gastronomia", "asia"],
  "yakarta": ["ciudad", "asia", "economico"],
  "jakarta": ["ciudad", "asia", "economico"],
  "manila": ["ciudad", "asia", "economico"],
  "ho chi minh": ["ciudad", "gastronomia", "asia", "economico"],
  "saigon": ["ciudad", "gastronomia", "asia", "economico"],
  "hanoi": ["ciudad", "historia", "asia", "economico"],
  "taipei": ["ciudad", "gastronomia", "asia"],
  "beijing": ["ciudad", "historia", "asia"],
  "pekin": ["ciudad", "historia", "asia"],
  "shanghai": ["ciudad", "lujo", "asia"],
  "delhi": ["ciudad", "historia", "asia"],
  "nueva delhi": ["ciudad", "historia", "asia"],
  "mumbai": ["ciudad", "asia", "economico"],
  "bombay": ["ciudad", "asia", "economico"],
  // --- Desierto / África ---
  "marrakech": ["historia", "ciudad", "gastronomia", "desierto"],
  "casablanca": ["ciudad", "playa", "desierto"],
  "el cairo": ["historia", "ciudad", "desierto"],
  "cairo": ["historia", "ciudad", "desierto"],
  "doha": ["lujo", "ciudad", "desierto"],
  "abu dabi": ["lujo", "ciudad", "desierto"],
  "abu dhabi": ["lujo", "ciudad", "desierto"],
  "riad": ["ciudad", "desierto"],
  "phoenix": ["ciudad", "desierto", "familiar"],
  // --- Invierno / Norte frío ---
  "reikiavik": ["naturaleza", "aventura", "invierno"],
  "reykjavik": ["naturaleza", "aventura", "invierno"],
  "oslo": ["ciudad", "naturaleza", "invierno"],
  "estocolmo": ["ciudad", "historia", "invierno"],
  "helsinki": ["ciudad", "naturaleza", "invierno"],
  "copenhague": ["ciudad", "gastronomia", "invierno"],
  "moscu": ["ciudad", "historia", "invierno"],
  "zurich": ["ciudad", "naturaleza", "lujo", "invierno"],
  "ginebra": ["ciudad", "lujo", "invierno"],
  "montreal": ["ciudad", "gastronomia", "familiar", "invierno"],
  "sapporo": ["naturaleza", "gastronomia", "invierno", "asia"],
  "toronto": ["ciudad", "gastronomia", "familiar"],
  // --- Naturaleza / Aventura ---
  "machu picchu": ["historia", "montana", "aventura", "naturaleza"],
  "patagonia": ["naturaleza", "aventura", "montana"],
  "galapagos": ["naturaleza", "aventura", "lujo"],
  "iguazu": ["naturaleza", "aventura"],
  "guatape": ["naturaleza", "economico", "romantico"],
  "salar de uyuni": ["naturaleza", "aventura", "romantico"],
  "santorini": ["playa", "romantico", "lujo"],
  "mykonos": ["playa", "lujo", "nocturna"],
};

// Fallback por region: si no encontramos la ciudad arriba.
export const TAGS_POR_REGION = {
  europa: ["ciudad", "historia", "gastronomia"],
  asia: ["ciudad", "gastronomia", "asia"],
  norteamerica: ["ciudad", "playa"],
  sudamerica: ["ciudad", "naturaleza", "economico"],
  africa: ["aventura", "naturaleza", "historia"],
  oceania: ["playa", "naturaleza", "aventura"],
};

// Normaliza nombre de ciudad para lookup (sin tildes, minusculas, sin parentesis).
export function normalizarCiudad(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Devuelve los tags de un destino. Acepta { ciudad, region } u objeto similar.
export function tagsDe(destino) {
  if (!destino) return [];
  const ciu = normalizarCiudad(destino.ciudad || destino.nombre || "");
  if (TAGS_POR_CIUDAD[ciu]) return TAGS_POR_CIUDAD[ciu];
  // Match parcial (Rio de Janeiro -> Rio, Cusco -> Cuzco, etc.)
  for (const k of Object.keys(TAGS_POR_CIUDAD)) {
    if (ciu.includes(k) || k.includes(ciu)) return TAGS_POR_CIUDAD[k];
  }
  return TAGS_POR_REGION[destino.region] || ["ciudad"];
}

// Top N categorias de un objeto gustos { categoria: score }. Devuelve solo
// las categorias soportadas, ordenadas por score desc.
export function topGustos(gustos, n = 3) {
  if (!gustos || typeof gustos !== "object") return [];
  return Object.entries(gustos)
    .filter(([k, v]) => CATEGORIAS_GUSTO.includes(k) && Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .slice(0, n)
    .map(([k]) => k);
}
