// Codigo IATA de aerolinea -> nombre legible.
//
// Vivia dentro de components/Ofertas.js y sin exportar, asi que MiniOfertas
// —las mismas tarjetas, en el home— pintaba el codigo crudo: "CM", "JA", "UX"
// donde /ofertas decia "Copa", "JetSMART", "Air Europa". La misma oferta se
// leia distinto segun la pagina.
//
// El detector guarda el codigo crudo porque es lo que devuelve Travelpayouts;
// traducirlo es cosa de la interfaz. Cubre las aerolineas que aparecen en
// rutas desde los hubs trackeados; si falta alguna se muestra el codigo tal
// cual, que es mejor que un hueco.
export const AEROLINEAS = {
  AV: "Avianca", LA: "LATAM", DM: "Arajet", JA: "JetSMART", Y4: "Volaris",
  VB: "Viva Aerobus", AM: "Aeroméxico", CM: "Copa", P5: "Wingo", AR: "Aerolíneas Argentinas",
  G3: "Gol", AD: "Azul", H2: "Sky Airline", AC: "Air Canada", AA: "American",
  DL: "Delta", UA: "United", B6: "JetBlue", NK: "Spirit", F9: "Frontier",
  IB: "Iberia", UX: "Air Europa", TP: "TAP", AF: "Air France", KL: "KLM",
  LH: "Lufthansa", BA: "British Airways", AZ: "ITA Airways", LX: "Swiss",
  TK: "Turkish Airlines", EK: "Emirates", QR: "Qatar Airways", ET: "Ethiopian",
  AL: "Air Leisure", "2D": "Aero VIP",
  FR: "Ryanair", W4: "Wizz Air", BF: "French Bee", G4: "Allegiant",
  XL: "LATAM Ecuador", PU: "Plus Ultra", F8: "Flair", CA: "Air China", AS: "Alaska Airlines",
};

export function nombreAerolinea(cod) {
  const c = (cod || "").trim().toUpperCase();
  return AEROLINEAS[c] || cod || "—";
}
