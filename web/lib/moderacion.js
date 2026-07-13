// Moderacion de lenguaje del chat (2026-07-13, pedido del usuario).
// Filtro server-side de groserias/obscenidades ES (Colombia incluida) + EN.
//
// Anti-evasion: minusculas, sin tildes, leetspeak (0->o, 3->e, ...), letras
// repetidas ("puuuta") y letras separadas ("p.u.t.a") hasta 2 separadores.
// Con limites de palabra para no caer en falsos positivos (problema
// Scunthorpe): "computa", "escupitajo", etc. NO disparan.
//
// Deliberadamente NO incluye palabras de doble uso cotidiano en Colombia
// ("marica" entre amigos, "chimba" positivo, "coger" el bus). El boton de
// reportar cubre lo que el filtro deja pasar.

const PALABRAS = [
  // ES generales
  "puta", "puto", "putas", "putos", "putica", "putita",
  "mierda", "carajo", "joder", "cabron", "cabrona", "pendejo", "pendeja",
  "imbecil", "estupido", "estupida", "idiota", "gilipollas",
  "verga", "polla", "culo", "tetas", "zorra", "perra",
  "chingar", "chingada", "chingado", "chingon",
  "culiao", "culiado", "culero", "follar", "porno",
  "conchatumadre", "conchetumare", "malnacido",
  // ES colombianas ("hp" a secas NO va: colision con HP portatiles/venues)
  "hijueputa", "jueputa", "hptas", "hpta",
  "malparido", "malparida", "gonorrea", "gonorriento", "gonorrienta",
  "carechimba", "pirobo", "piroba", "maricon", "maricones",
  "carecul", "careverga", "triplehijueputa",
  // EN
  "fuck", "fucking", "fucker", "motherfucker", "shit", "bullshit",
  "bitch", "asshole", "cunt", "dick", "cock", "pussy", "whore", "slut",
  "faggot", "nigger", "nigga", "bastard", "wanker",
];

const LEET = { 0: "o", 1: "i", 3: "e", 4: "a", 5: "s", 7: "t", "@": "a", $: "s" };

function normalizar(texto) {
  let t = String(texto || "").toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [k, v] of Object.entries(LEET)) t = t.split(k).join(v);
  return t;
}

// "puta" -> /(^|[^a-zñ])p+[\s.*_-]{0,2}u+[\s.*_-]{0,2}t+[\s.*_-]{0,2}a+($|[^a-zñ])/
// (letras repetidas y hasta 2 separadores entre letras, con borde de palabra).
const REGEXES = PALABRAS.map((w) => new RegExp(
  "(^|[^a-zñ])" + w.split("").map((c) => `${c}+`).join("[\\s.*_-]{0,2}") + "($|[^a-zñ])"
));

export function contieneLenguajeOfensivo(texto) {
  const t = normalizar(texto);
  return REGEXES.some((re) => re.test(t));
}
