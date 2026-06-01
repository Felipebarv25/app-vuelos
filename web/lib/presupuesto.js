// Módulo de PRESUPUESTO de viaje.
// Dado un presupuesto y una región/destino, calcula qué países/ciudades se
// pueden visitar y desglosa costos (vuelo, hospedaje, comida, transporte, extras).
//
// Los costos son PROMEDIOS orientativos para un turista de gama media, en USD.
// Vuelos = ida y vuelta aproximados desde Colombia (BOG/MDE). Son estimaciones
// para planear; el precio real se confirma con el detector de vuelos.

// Costo diario por persona (gama media) y vuelo i/v aproximado desde Colombia.
// dia = hospedaje + comida + transporte local + actividades/extras (USD/día).
export const DESTINOS_PRESUPUESTO = [
  // ---- Sudamérica (vuelos baratos desde Colombia) ----
  { ciudad: "Lima", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", vuelo: 320, dia: 55, lat: -12.0464, lon: -77.0428 },
  { ciudad: "Quito", pais: "Ecuador", region: "sudamerica", bandera: "🇪🇨", vuelo: 300, dia: 50, lat: -0.1807, lon: -78.4678 },
  { ciudad: "Santiago", pais: "Chile", region: "sudamerica", bandera: "🇨🇱", vuelo: 450, dia: 70, lat: -33.4489, lon: -70.6693 },
  { ciudad: "Buenos Aires", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", vuelo: 520, dia: 60, lat: -34.6037, lon: -58.3816 },
  { ciudad: "Río de Janeiro", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", vuelo: 550, dia: 65, lat: -22.9068, lon: -43.1729 },
  { ciudad: "São Paulo", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", vuelo: 480, dia: 65, lat: -23.5505, lon: -46.6333 },
  { ciudad: "Cusco", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", vuelo: 360, dia: 55, lat: -13.5319, lon: -71.9675 },
  { ciudad: "Montevideo", pais: "Uruguay", region: "sudamerica", bandera: "🇺🇾", vuelo: 560, dia: 70, lat: -34.9011, lon: -56.1645 },

  // ---- Norte y Centroamérica ----
  { ciudad: "Ciudad de México", pais: "México", region: "norteamerica", bandera: "🇲🇽", vuelo: 380, dia: 60, lat: 19.4326, lon: -99.1332 },
  { ciudad: "Cancún", pais: "México", region: "norteamerica", bandera: "🇲🇽", vuelo: 420, dia: 80, lat: 21.1619, lon: -86.8515 },
  { ciudad: "Ciudad de Panamá", pais: "Panamá", region: "norteamerica", bandera: "🇵🇦", vuelo: 280, dia: 65, lat: 8.9824, lon: -79.5199 },
  { ciudad: "San José", pais: "Costa Rica", region: "norteamerica", bandera: "🇨🇷", vuelo: 360, dia: 70, lat: 9.9281, lon: -84.0907 },
  { ciudad: "Miami", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 400, dia: 120, lat: 25.7617, lon: -80.1918 },
  { ciudad: "Nueva York", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 480, dia: 150, lat: 40.7128, lon: -74.006 },
  { ciudad: "La Habana", pais: "Cuba", region: "norteamerica", bandera: "🇨🇺", vuelo: 420, dia: 60, lat: 23.1136, lon: -82.3666 },

  // ---- Europa ----
  { ciudad: "Madrid", pais: "España", region: "europa", bandera: "🇪🇸", vuelo: 800, dia: 100, lat: 40.4168, lon: -3.7038 },
  { ciudad: "Barcelona", pais: "España", region: "europa", bandera: "🇪🇸", vuelo: 820, dia: 110, lat: 41.3874, lon: 2.1686 },
  { ciudad: "Lisboa", pais: "Portugal", region: "europa", bandera: "🇵🇹", vuelo: 780, dia: 90, lat: 38.7223, lon: -9.1393 },
  { ciudad: "París", pais: "Francia", region: "europa", bandera: "🇫🇷", vuelo: 850, dia: 130, lat: 48.8566, lon: 2.3522 },
  { ciudad: "Roma", pais: "Italia", region: "europa", bandera: "🇮🇹", vuelo: 880, dia: 110, lat: 41.9028, lon: 12.4964 },
  { ciudad: "Milán", pais: "Italia", region: "europa", bandera: "🇮🇹", vuelo: 860, dia: 120, lat: 45.4642, lon: 9.19 },
  { ciudad: "Londres", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", vuelo: 900, dia: 150, lat: 51.5074, lon: -0.1278 },
  { ciudad: "Ámsterdam", pais: "Países Bajos", region: "europa", bandera: "🇳🇱", vuelo: 880, dia: 130, lat: 52.3676, lon: 4.9041 },
  { ciudad: "Berlín", pais: "Alemania", region: "europa", bandera: "🇩🇪", vuelo: 870, dia: 110, lat: 52.52, lon: 13.405 },
  { ciudad: "Praga", pais: "Chequia", region: "europa", bandera: "🇨🇿", vuelo: 900, dia: 85, lat: 50.0755, lon: 14.4378 },
  { ciudad: "Estambul", pais: "Turquía", region: "europa", bandera: "🇹🇷", vuelo: 850, dia: 70, lat: 41.0082, lon: 28.9784 },

  // ---- Asia ----
  { ciudad: "Tokio", pais: "Japón", region: "asia", bandera: "🇯🇵", vuelo: 1200, dia: 120, lat: 35.6762, lon: 139.6503 },
  { ciudad: "Bangkok", pais: "Tailandia", region: "asia", bandera: "🇹🇭", vuelo: 1100, dia: 55, lat: 13.7563, lon: 100.5018 },
  { ciudad: "Bali", pais: "Indonesia", region: "asia", bandera: "🇮🇩", vuelo: 1250, dia: 60, lat: -8.3405, lon: 115.092 },
  { ciudad: "Dubái", pais: "Emiratos Árabes", region: "asia", bandera: "🇦🇪", vuelo: 1000, dia: 130, lat: 25.2048, lon: 55.2708 },
  { ciudad: "Pekín", pais: "China", region: "asia", bandera: "🇨🇳", vuelo: 1150, dia: 80, lat: 39.9042, lon: 116.4074 },
];

export const REGIONES = {
  todas: "🌍 Todo el mundo",
  sudamerica: "🌎 Sudamérica",
  norteamerica: "🌎 Norte y Centroamérica",
  europa: "🇪🇺 Europa",
  asia: "🌏 Asia",
};

// Tasa de cambio aproximada para mostrar el presupuesto en moneda local.
// (Orientativa; el cálculo interno es en USD.)
export const MONEDAS = {
  USD: { nombre: "Dólares (USD)", simbolo: "US$", aUsd: 1 },
  COP: { nombre: "Pesos colombianos (COP)", simbolo: "$", aUsd: 1 / 4000 },
  MXN: { nombre: "Pesos mexicanos (MXN)", simbolo: "$", aUsd: 1 / 18 },
  EUR: { nombre: "Euros (EUR)", simbolo: "€", aUsd: 1.08 },
};

// Calcula qué destinos caben en el presupuesto (en USD) para N días y M personas.
// Devuelve cada destino con su desglose y si "cabe" o no.
export function calcularDestinos({ presupuestoUsd, dias, personas, region }) {
  const lista = DESTINOS_PRESUPUESTO.filter(
    (d) => region === "todas" || d.region === region
  );

  const resultados = lista.map((d) => {
    const vuelos = d.vuelo * personas;
    const estadia = d.dia * dias * personas;
    const total = vuelos + estadia;

    // Desglose del costo diario en categorías (proporciones típicas).
    const desglose = {
      vuelo: vuelos,
      hospedaje: Math.round(d.dia * 0.45 * dias * personas),
      comida: Math.round(d.dia * 0.3 * dias * personas),
      transporte: Math.round(d.dia * 0.12 * dias * personas),
      extras: Math.round(d.dia * 0.13 * dias * personas),
    };

    return {
      ...d,
      vuelos,
      estadia,
      total,
      desglose,
      cabe: total <= presupuestoUsd,
      sobra: presupuestoUsd - total,
    };
  });

  // Ordenar: primero los que caben (más baratos primero), luego los que no.
  resultados.sort((a, b) => {
    if (a.cabe !== b.cabe) return a.cabe ? -1 : 1;
    return a.total - b.total;
  });

  return resultados;
}

// Sugiere cuántos días alcanzan en un destino con un presupuesto dado.
export function diasPosibles(destino, presupuestoUsd, personas) {
  const restante = presupuestoUsd - destino.vuelo * personas;
  if (restante <= 0) return 0;
  return Math.floor(restante / (destino.dia * personas));
}
