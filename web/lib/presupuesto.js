// Módulo de PRESUPUESTO de viaje.
// Dos modos:
//  1) Un destino: dado un presupuesto y región, qué ciudades caben (con desglose).
//  2) Ruta multiciudad: arma una RUTA de varias ciudades (vuelo internacional +
//     transporte entre ciudades + estadía) que entre en el presupuesto, y permite
//     regenerar otra ruta distinta.
//
// Los costos son PROMEDIOS orientativos para un turista de gama media, en USD.
// Vuelos = ida y vuelta aproximados desde Colombia (BOG/MDE). Son estimaciones
// para planear; el precio real se confirma con el detector de vuelos.

// Costo diario por persona (gama media) y vuelo i/v aproximado desde Colombia.
// dia = hospedaje + comida + transporte local + actividades/extras (USD/día).
export const DESTINOS_PRESUPUESTO = [
  // ---- Sudamérica (vuelos baratos desde Colombia) ----
  { ciudad: "Lima", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", vuelo: 320, dia: 55, lat: -12.0464, lon: -77.0428 },
  { ciudad: "Cusco", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", vuelo: 360, dia: 55, lat: -13.5319, lon: -71.9675 },
  { ciudad: "Quito", pais: "Ecuador", region: "sudamerica", bandera: "🇪🇨", vuelo: 300, dia: 50, lat: -0.1807, lon: -78.4678 },
  { ciudad: "Santiago", pais: "Chile", region: "sudamerica", bandera: "🇨🇱", vuelo: 450, dia: 70, lat: -33.4489, lon: -70.6693 },
  { ciudad: "Buenos Aires", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", vuelo: 520, dia: 60, lat: -34.6037, lon: -58.3816 },
  { ciudad: "Mendoza", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", vuelo: 560, dia: 60, lat: -32.8895, lon: -68.8458 },
  { ciudad: "Río de Janeiro", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", vuelo: 550, dia: 65, lat: -22.9068, lon: -43.1729 },
  { ciudad: "São Paulo", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", vuelo: 480, dia: 65, lat: -23.5505, lon: -46.6333 },
  { ciudad: "Montevideo", pais: "Uruguay", region: "sudamerica", bandera: "🇺🇾", vuelo: 560, dia: 70, lat: -34.9011, lon: -56.1645 },
  { ciudad: "La Paz", pais: "Bolivia", region: "sudamerica", bandera: "🇧🇴", vuelo: 420, dia: 45, lat: -16.4897, lon: -68.1193 },

  // ---- Norte y Centroamérica ----
  { ciudad: "Ciudad de México", pais: "México", region: "norteamerica", bandera: "🇲🇽", vuelo: 380, dia: 60, lat: 19.4326, lon: -99.1332 },
  { ciudad: "Cancún", pais: "México", region: "norteamerica", bandera: "🇲🇽", vuelo: 420, dia: 80, lat: 21.1619, lon: -86.8515 },
  { ciudad: "Ciudad de Panamá", pais: "Panamá", region: "norteamerica", bandera: "🇵🇦", vuelo: 280, dia: 65, lat: 8.9824, lon: -79.5199 },
  { ciudad: "San José", pais: "Costa Rica", region: "norteamerica", bandera: "🇨🇷", vuelo: 360, dia: 70, lat: 9.9281, lon: -84.0907 },
  { ciudad: "Miami", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 400, dia: 120, lat: 25.7617, lon: -80.1918 },
  { ciudad: "Nueva York", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 480, dia: 150, lat: 40.7128, lon: -74.006 },
  { ciudad: "Los Ángeles", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 520, dia: 140, lat: 34.0522, lon: -118.2437 },
  { ciudad: "Toronto", pais: "Canadá", region: "norteamerica", bandera: "🇨🇦", vuelo: 560, dia: 120, lat: 43.6532, lon: -79.3832 },
  { ciudad: "La Habana", pais: "Cuba", region: "norteamerica", bandera: "🇨🇺", vuelo: 420, dia: 60, lat: 23.1136, lon: -82.3666 },

  // ---- Europa ----
  { ciudad: "Madrid", pais: "España", region: "europa", bandera: "🇪🇸", vuelo: 800, dia: 100, lat: 40.4168, lon: -3.7038 },
  { ciudad: "Barcelona", pais: "España", region: "europa", bandera: "🇪🇸", vuelo: 820, dia: 110, lat: 41.3874, lon: 2.1686 },
  { ciudad: "Sevilla", pais: "España", region: "europa", bandera: "🇪🇸", vuelo: 830, dia: 90, lat: 37.3891, lon: -5.9845 },
  { ciudad: "Lisboa", pais: "Portugal", region: "europa", bandera: "🇵🇹", vuelo: 780, dia: 90, lat: 38.7223, lon: -9.1393 },
  { ciudad: "Oporto", pais: "Portugal", region: "europa", bandera: "🇵🇹", vuelo: 790, dia: 85, lat: 41.1579, lon: -8.6291 },
  { ciudad: "París", pais: "Francia", region: "europa", bandera: "🇫🇷", vuelo: 850, dia: 130, lat: 48.8566, lon: 2.3522 },
  { ciudad: "Niza", pais: "Francia", region: "europa", bandera: "🇫🇷", vuelo: 870, dia: 120, lat: 43.7102, lon: 7.262 },
  { ciudad: "Roma", pais: "Italia", region: "europa", bandera: "🇮🇹", vuelo: 880, dia: 110, lat: 41.9028, lon: 12.4964 },
  { ciudad: "Florencia", pais: "Italia", region: "europa", bandera: "🇮🇹", vuelo: 880, dia: 110, lat: 43.7696, lon: 11.2558 },
  { ciudad: "Venecia", pais: "Italia", region: "europa", bandera: "🇮🇹", vuelo: 890, dia: 120, lat: 45.4408, lon: 12.3155 },
  { ciudad: "Milán", pais: "Italia", region: "europa", bandera: "🇮🇹", vuelo: 860, dia: 120, lat: 45.4642, lon: 9.19 },
  { ciudad: "Londres", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", vuelo: 900, dia: 150, lat: 51.5074, lon: -0.1278 },
  { ciudad: "Ámsterdam", pais: "Países Bajos", region: "europa", bandera: "🇳🇱", vuelo: 880, dia: 130, lat: 52.3676, lon: 4.9041 },
  { ciudad: "Bruselas", pais: "Bélgica", region: "europa", bandera: "🇧🇪", vuelo: 870, dia: 115, lat: 50.8503, lon: 4.3517 },
  { ciudad: "Berlín", pais: "Alemania", region: "europa", bandera: "🇩🇪", vuelo: 870, dia: 110, lat: 52.52, lon: 13.405 },
  { ciudad: "Múnich", pais: "Alemania", region: "europa", bandera: "🇩🇪", vuelo: 880, dia: 120, lat: 48.1351, lon: 11.582 },
  { ciudad: "Viena", pais: "Austria", region: "europa", bandera: "🇦🇹", vuelo: 890, dia: 115, lat: 48.2082, lon: 16.3738 },
  { ciudad: "Praga", pais: "Chequia", region: "europa", bandera: "🇨🇿", vuelo: 900, dia: 85, lat: 50.0755, lon: 14.4378 },
  { ciudad: "Budapest", pais: "Hungría", region: "europa", bandera: "🇭🇺", vuelo: 900, dia: 80, lat: 47.4979, lon: 19.0402 },
  { ciudad: "Atenas", pais: "Grecia", region: "europa", bandera: "🇬🇷", vuelo: 920, dia: 90, lat: 37.9838, lon: 23.7275 },
  { ciudad: "Estambul", pais: "Turquía", region: "europa", bandera: "🇹🇷", vuelo: 850, dia: 70, lat: 41.0082, lon: 28.9784 },

  // ---- Asia ----
  { ciudad: "Tokio", pais: "Japón", region: "asia", bandera: "🇯🇵", vuelo: 1200, dia: 120, lat: 35.6762, lon: 139.6503 },
  { ciudad: "Kioto", pais: "Japón", region: "asia", bandera: "🇯🇵", vuelo: 1200, dia: 110, lat: 35.0116, lon: 135.7681 },
  { ciudad: "Seúl", pais: "Corea del Sur", region: "asia", bandera: "🇰🇷", vuelo: 1250, dia: 100, lat: 37.5665, lon: 126.978 },
  { ciudad: "Bangkok", pais: "Tailandia", region: "asia", bandera: "🇹🇭", vuelo: 1100, dia: 55, lat: 13.7563, lon: 100.5018 },
  { ciudad: "Bali", pais: "Indonesia", region: "asia", bandera: "🇮🇩", vuelo: 1250, dia: 60, lat: -8.3405, lon: 115.092 },
  { ciudad: "Singapur", pais: "Singapur", region: "asia", bandera: "🇸🇬", vuelo: 1300, dia: 110, lat: 1.3521, lon: 103.8198 },
  { ciudad: "Dubái", pais: "Emiratos Árabes", region: "asia", bandera: "🇦🇪", vuelo: 1000, dia: 130, lat: 25.2048, lon: 55.2708 },
  { ciudad: "Abu Dabi", pais: "Emiratos Árabes", region: "asia", bandera: "🇦🇪", vuelo: 1000, dia: 120, lat: 24.4539, lon: 54.3773 },
  { ciudad: "Pekín", pais: "China", region: "asia", bandera: "🇨🇳", vuelo: 1150, dia: 80, lat: 39.9042, lon: 116.4074 },
  { ciudad: "Shanghái", pais: "China", region: "asia", bandera: "🇨🇳", vuelo: 1180, dia: 90, lat: 31.2304, lon: 121.4737 },
  { ciudad: "Hong Kong", pais: "China", region: "asia", bandera: "🇭🇰", vuelo: 1250, dia: 120, lat: 22.3193, lon: 114.1694 },
  { ciudad: "Osaka", pais: "Japón", region: "asia", bandera: "🇯🇵", vuelo: 1200, dia: 110, lat: 34.6937, lon: 135.5023 },
  { ciudad: "Bombay", pais: "India", region: "asia", bandera: "🇮🇳", vuelo: 1300, dia: 60, lat: 19.076, lon: 72.8777 },
  { ciudad: "Phuket", pais: "Tailandia", region: "asia", bandera: "🇹🇭", vuelo: 1200, dia: 60, lat: 7.8804, lon: 98.3923 },

  // ---- Más Sudamérica ----
  { ciudad: "Guayaquil", pais: "Ecuador", region: "sudamerica", bandera: "🇪🇨", vuelo: 320, dia: 50, lat: -2.1709, lon: -79.9224 },
  { ciudad: "Arequipa", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", vuelo: 380, dia: 50, lat: -16.409, lon: -71.5375 },
  { ciudad: "Florianópolis", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", vuelo: 520, dia: 70, lat: -27.5954, lon: -48.548 },
  { ciudad: "Bariloche", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", vuelo: 600, dia: 75, lat: -41.1335, lon: -71.3103 },
  { ciudad: "Asunción", pais: "Paraguay", region: "sudamerica", bandera: "🇵🇾", vuelo: 520, dia: 55, lat: -25.2637, lon: -57.5759 },

  // ---- Más Norte y Centroamérica ----
  { ciudad: "Guadalajara", pais: "México", region: "norteamerica", bandera: "🇲🇽", vuelo: 400, dia: 60, lat: 20.6597, lon: -103.3496 },
  { ciudad: "Playa del Carmen", pais: "México", region: "norteamerica", bandera: "🇲🇽", vuelo: 430, dia: 85, lat: 20.6296, lon: -87.0739 },
  { ciudad: "San Francisco", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 560, dia: 160, lat: 37.7749, lon: -122.4194 },
  { ciudad: "Las Vegas", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 540, dia: 130, lat: 36.1699, lon: -115.1398 },
  { ciudad: "Chicago", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 520, dia: 140, lat: 41.8781, lon: -87.6298 },
  { ciudad: "Orlando", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", vuelo: 460, dia: 120, lat: 28.5383, lon: -81.3792 },
  { ciudad: "Montreal", pais: "Canadá", region: "norteamerica", bandera: "🇨🇦", vuelo: 560, dia: 115, lat: 45.5019, lon: -73.5674 },
  { ciudad: "Ciudad de Guatemala", pais: "Guatemala", region: "norteamerica", bandera: "🇬🇹", vuelo: 340, dia: 55, lat: 14.6349, lon: -90.5069 },

  // ---- Más Europa ----
  { ciudad: "Valencia", pais: "España", region: "europa", bandera: "🇪🇸", vuelo: 820, dia: 95, lat: 39.4699, lon: -0.3763 },
  { ciudad: "Nápoles", pais: "Italia", region: "europa", bandera: "🇮🇹", vuelo: 890, dia: 100, lat: 40.8518, lon: 14.2681 },
  { ciudad: "Edimburgo", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", vuelo: 910, dia: 130, lat: 55.9533, lon: -3.1883 },
  { ciudad: "Dublín", pais: "Irlanda", region: "europa", bandera: "🇮🇪", vuelo: 900, dia: 120, lat: 53.3498, lon: -6.2603 },
  { ciudad: "Copenhague", pais: "Dinamarca", region: "europa", bandera: "🇩🇰", vuelo: 950, dia: 140, lat: 55.6761, lon: 12.5683 },
  { ciudad: "Estocolmo", pais: "Suecia", region: "europa", bandera: "🇸🇪", vuelo: 980, dia: 140, lat: 59.3293, lon: 18.0686 },
  { ciudad: "Zúrich", pais: "Suiza", region: "europa", bandera: "🇨🇭", vuelo: 950, dia: 160, lat: 47.3769, lon: 8.5417 },
  { ciudad: "Varsovia", pais: "Polonia", region: "europa", bandera: "🇵🇱", vuelo: 920, dia: 80, lat: 52.2297, lon: 21.0122 },

  // ---- África ----
  { ciudad: "El Cairo", pais: "Egipto", region: "africa", bandera: "🇪🇬", vuelo: 1100, dia: 60, lat: 30.0444, lon: 31.2357 },
  { ciudad: "Marrakech", pais: "Marruecos", region: "africa", bandera: "🇲🇦", vuelo: 1000, dia: 65, lat: 31.6295, lon: -7.9811 },
  { ciudad: "Ciudad del Cabo", pais: "Sudáfrica", region: "africa", bandera: "🇿🇦", vuelo: 1300, dia: 95, lat: -33.9249, lon: 18.4241 },

  // ---- Oceanía ----
  { ciudad: "Sídney", pais: "Australia", region: "oceania", bandera: "🇦🇺", vuelo: 1800, dia: 140, lat: -33.8688, lon: 151.2093 },
  { ciudad: "Melbourne", pais: "Australia", region: "oceania", bandera: "🇦🇺", vuelo: 1850, dia: 130, lat: -37.8136, lon: 144.9631 },
  { ciudad: "Auckland", pais: "Nueva Zelanda", region: "oceania", bandera: "🇳🇿", vuelo: 1900, dia: 130, lat: -36.8485, lon: 174.7633 },
];

export const REGIONES = {
  todas: "🌍 Todo el mundo",
  sudamerica: "🌎 Sudamérica",
  norteamerica: "🌎 Norte y Centroamérica",
  europa: "🇪🇺 Europa",
  asia: "🌏 Asia",
  africa: "🌍 África",
  oceania: "🌏 Oceanía",
};

// Tasa de cambio aproximada para mostrar el presupuesto en moneda local.
// (Orientativa; el cálculo interno es en USD.)
export const MONEDAS = {
  USD: { nombre: "Dólares (USD)", simbolo: "US$", aUsd: 1 },
  COP: { nombre: "Pesos colombianos (COP)", simbolo: "$", aUsd: 1 / 4000 },
  MXN: { nombre: "Pesos mexicanos (MXN)", simbolo: "$", aUsd: 1 / 18 },
  EUR: { nombre: "Euros (EUR)", simbolo: "€", aUsd: 1.08 },
};

// ---------- Utilidades geográficas y de costo ----------

// Distancia aproximada en km entre dos puntos (haversine).
function distKm(a, b) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Costo aproximado (USD/persona) de un salto entre ciudades de la ruta
// (tren, bus o vuelo barato según la distancia).
function costoSalto(km) {
  if (km < 300) return 35;
  if (km < 700) return 70;
  if (km < 1500) return 120;
  if (km < 3000) return 200;
  return 320;
}

// PRNG con semilla (para que "Otra ruta" dé resultados variados pero estables).
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}

export function llaveCiudad(c) {
  return c.ciudad + "|" + c.pais;
}

// Ciudades candidatas para elegir como punto de salida en una región.
export function ciudadesDeRegion(region) {
  return DESTINOS_PRESUPUESTO.filter(
    (d) => region === "todas" || d.region === region
  ).sort((a, b) => a.ciudad.localeCompare(b.ciudad));
}

// ---------- Modo 1: un destino ----------

// Calcula qué destinos caben en el presupuesto (en USD) para N días y M personas.
// `preciosReales` (opcional): map { "Ciudad|País" → {precio, link, ...} } del
// detector de vuelos. Cuando hay coincidencia, usa el precio REAL en vez del
// estimado y marca esReal=true en el resultado.
export function calcularDestinos({ presupuestoUsd, dias, personas, region, preciosReales = {} }) {
  const lista = DESTINOS_PRESUPUESTO.filter(
    (d) => region === "todas" || d.region === region
  );

  const resultados = lista.map((d) => {
    const real = preciosReales[llaveCiudad(d)];
    const vueloUnit = real ? real.precio : d.vuelo;
    const vuelos = vueloUnit * personas;
    const estadia = d.dia * dias * personas;
    const total = vuelos + estadia;

    const desglose = {
      vuelo: vuelos,
      hospedaje: Math.round(d.dia * 0.45 * dias * personas),
      comida: Math.round(d.dia * 0.3 * dias * personas),
      transporte: Math.round(d.dia * 0.12 * dias * personas),
      extras: Math.round(d.dia * 0.13 * dias * personas),
    };

    return {
      ...d,
      vuelo: vueloUnit,
      vuelos,
      estadia,
      total,
      desglose,
      cabe: total <= presupuestoUsd,
      sobra: presupuestoUsd - total,
      esReal: !!real,
      vueloReal: real || null,
    };
  });

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

// ---------- Modo 2: ruta multiciudad ----------

// Construye una ruta de varias ciudades que entre en el presupuesto.
// region: continente; inicio: llaveCiudad de la ciudad de salida (opcional);
// semilla: cambia para obtener "otra ruta".
export function construirRuta({
  presupuestoUsd,
  dias,
  personas = 1,
  region = "europa",
  inicio,
  semilla = 0,
  excluir = [],
  preciosReales = {},
}) {
  const fuera = new Set(excluir);
  // Aplicamos precio real (si existe) sobre cada candidato ANTES de elegir la
  // entrada, así "la más barata" se basa en datos reales cuando los hay.
  const cands = DESTINOS_PRESUPUESTO.filter(
    (d) =>
      (region === "todas" || d.region === region) && !fuera.has(llaveCiudad(d))
  ).map((d) => {
    const real = preciosReales[llaveCiudad(d)];
    return real
      ? { ...d, vuelo: real.precio, esReal: true, vueloReal: real }
      : { ...d, esReal: false, vueloReal: null };
  });
  if (!cands.length) return null;

  // Ciudad de entrada/salida (define el vuelo internacional i/v).
  let entrada = cands.find((c) => llaveCiudad(c) === inicio);
  if (!entrada) entrada = [...cands].sort((a, b) => a.vuelo - b.vuelo)[0];

  const vueloIntl = entrada.vuelo * personas;
  const presupViaje = presupuestoUsd - vueloIntl; // queda para estadía + saltos

  const rnd = mulberry32((semilla * 2654435761) ^ hashStr(llaveCiudad(entrada)));

  const DIAS_MIN = 2;
  const maxCiudades = Math.min(6, Math.max(1, Math.floor(dias / DIAS_MIN)));

  // Costo "piso": cada ciudad con DIAS_MIN días + sus saltos.
  const costoPiso = (lista) =>
    lista.reduce(
      (s, c) => s + c.dia * personas * DIAS_MIN + (c.salto || 0) * personas,
      0
    );

  const ruta = [{ ...entrada, salto: 0, km: 0 }];
  const usados = new Set([llaveCiudad(entrada)]);

  while (ruta.length < maxCiudades) {
    const last = ruta[ruta.length - 1];
    const opciones = cands
      .filter((c) => !usados.has(llaveCiudad(c)))
      .map((c) => ({ c, km: distKm(last, c) }))
      .sort((a, b) => a.km - b.km);
    if (!opciones.length) break;
    // Variedad: elegir al azar entre las más cercanas (según la semilla).
    const top = opciones.slice(0, Math.min(4, opciones.length));
    const elegido = top[Math.floor(rnd() * top.length)];
    const salto = costoSalto(elegido.km);
    const cand = { ...elegido.c, salto, km: Math.round(elegido.km) };
    if (costoPiso([...ruta, cand]) <= presupViaje) {
      ruta.push(cand);
      usados.add(llaveCiudad(elegido.c));
    } else break;
  }

  // Repartir días: DIAS_MIN base por ciudad, luego el resto mientras quepa.
  ruta.forEach((c) => (c.diasAqui = DIAS_MIN));
  let diasRestantes = dias - DIAS_MIN * ruta.length;
  while (diasRestantes < 0 && ruta.length > 1) {
    const fuera = ruta.pop();
    usados.delete(llaveCiudad(fuera));
    diasRestantes = dias - DIAS_MIN * ruta.length;
  }

  const costoActual = () =>
    vueloIntl +
    ruta.reduce(
      (s, c) => s + c.dia * personas * c.diasAqui + c.salto * personas,
      0
    );

  let i = 0;
  let guard = 0;
  while (diasRestantes > 0 && guard < 5000) {
    guard++;
    const c = ruta[i % ruta.length];
    if (costoActual() + c.dia * personas <= presupuestoUsd) {
      c.diasAqui += 1;
      diasRestantes -= 1;
    } else {
      const algunaCabe = ruta.some(
        (x) => costoActual() + x.dia * personas <= presupuestoUsd
      );
      if (!algunaCabe) break;
    }
    i++;
  }

  // Desglose por categorías.
  const totDia = ruta.reduce((s, c) => s + c.dia * personas * c.diasAqui, 0);
  const saltos = ruta.reduce((s, c) => s + c.salto * personas, 0);
  const desglose = {
    vueloIntl,
    saltos,
    hospedaje: Math.round(totDia * 0.45),
    comida: Math.round(totDia * 0.3),
    transporte: Math.round(totDia * 0.12),
    extras: Math.round(totDia * 0.13),
  };
  const total = vueloIntl + saltos + totDia;

  return {
    entrada,
    region,
    ciudades: ruta,
    diasTotales: ruta.reduce((s, c) => s + c.diasAqui, 0),
    desglose,
    total,
    cabe: total <= presupuestoUsd,
    sobra: presupuestoUsd - total,
    esRealEntrada: !!entrada.esReal,
    vueloRealEntrada: entrada.vueloReal || null,
  };
}
