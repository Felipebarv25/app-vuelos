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

import { costoTramoReal } from "./tramos";

// Costo diario por persona (gama media) y vuelo i/v aproximado desde Colombia.
// dia = hospedaje + comida + transporte local + actividades/extras (USD/día).
// Recalibrado 2026-07-18 (feedback del usuario): los paises CAROS estaban muy
// subvalorados (Suiza/nordicos/EEUU grandes). Referencias: hotel 3* + comer
// fuera 2 veces + transporte publico + 1 actividad, temporada media.
// `bandera` (emoji) e `iso` conviven a proposito y NO sobra ninguno.
//
// El emoji NO se ve en Windows: Segoe UI Emoji no trae banderas y el
// navegador dibuja los dos indicadores regionales como letras, asi que en la
// mitad de los equipos de este publico las tarjetas decian "es Madrid". Todo
// lo que se pinta en pantalla usa <Bandera cc={d.iso}>, que es un PNG.
//
// El emoji se queda para lo que NO es DOM: la imagen de Open Graph (la genera
// Vercel en Linux, donde si renderiza) y el itinerario en texto plano que el
// asesor deja copiar. Ahi un <img> no sirve.
//
// El `iso` se derivo del propio emoji restando el offset de los indicadores
// regionales (U+1F1E6 = A), no de una tabla escrita a mano: 207 destinos.
export const DESTINOS_PRESUPUESTO = [
  // ---- Sudamérica (vuelos baratos desde Colombia) ----
  { ciudad: "Lima", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", iso: "pe", vuelo: 320, dia: 55, lat: -12.0464, lon: -77.0428 },
  { ciudad: "Cusco", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", iso: "pe", vuelo: 360, dia: 55, lat: -13.5319, lon: -71.9675 },
  { ciudad: "Quito", pais: "Ecuador", region: "sudamerica", bandera: "🇪🇨", iso: "ec", vuelo: 300, dia: 50, lat: -0.1807, lon: -78.4678 },
  { ciudad: "Santiago", pais: "Chile", region: "sudamerica", bandera: "🇨🇱", iso: "cl", vuelo: 450, dia: 70, lat: -33.4489, lon: -70.6693 },
  { ciudad: "Buenos Aires", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", iso: "ar", vuelo: 520, dia: 60, lat: -34.6037, lon: -58.3816 },
  { ciudad: "Mendoza", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", iso: "ar", vuelo: 560, dia: 60, lat: -32.8895, lon: -68.8458 },
  { ciudad: "Río de Janeiro", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 550, dia: 65, lat: -22.9068, lon: -43.1729 },
  { ciudad: "São Paulo", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 480, dia: 65, lat: -23.5505, lon: -46.6333 },
  { ciudad: "Montevideo", pais: "Uruguay", region: "sudamerica", bandera: "🇺🇾", iso: "uy", vuelo: 560, dia: 70, lat: -34.9011, lon: -56.1645 },
  { ciudad: "La Paz", pais: "Bolivia", region: "sudamerica", bandera: "🇧🇴", iso: "bo", vuelo: 420, dia: 45, lat: -16.4897, lon: -68.1193 },

  // ---- Norte y Centroamérica ----
  { ciudad: "Ciudad de México", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 380, dia: 60, lat: 19.4326, lon: -99.1332 },
  { ciudad: "Cancún", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 420, dia: 90, lat: 21.1619, lon: -86.8515 },
  { ciudad: "Ciudad de Panamá", pais: "Panamá", region: "norteamerica", bandera: "🇵🇦", iso: "pa", vuelo: 280, dia: 65, lat: 8.9824, lon: -79.5199 },
  { ciudad: "San José", pais: "Costa Rica", region: "norteamerica", bandera: "🇨🇷", iso: "cr", vuelo: 360, dia: 70, lat: 9.9281, lon: -84.0907 },
  { ciudad: "Miami", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 400, dia: 150, lat: 25.7617, lon: -80.1918 },
  { ciudad: "Nueva York", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 480, dia: 200, lat: 40.7128, lon: -74.006 },
  { ciudad: "Los Ángeles", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 520, dia: 170, lat: 34.0522, lon: -118.2437 },
  { ciudad: "Toronto", pais: "Canadá", region: "norteamerica", bandera: "🇨🇦", iso: "ca", vuelo: 560, dia: 120, lat: 43.6532, lon: -79.3832 },
  { ciudad: "La Habana", pais: "Cuba", region: "norteamerica", bandera: "🇨🇺", iso: "cu", vuelo: 420, dia: 60, lat: 23.1136, lon: -82.3666 },

  // ---- Europa ----
  { ciudad: "Madrid", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 800, dia: 100, lat: 40.4168, lon: -3.7038 },
  { ciudad: "Barcelona", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 820, dia: 110, lat: 41.3874, lon: 2.1686 },
  { ciudad: "Sevilla", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 830, dia: 90, lat: 37.3891, lon: -5.9845 },
  { ciudad: "Lisboa", pais: "Portugal", region: "europa", bandera: "🇵🇹", iso: "pt", vuelo: 780, dia: 90, lat: 38.7223, lon: -9.1393 },
  { ciudad: "Oporto", pais: "Portugal", region: "europa", bandera: "🇵🇹", iso: "pt", vuelo: 790, dia: 85, lat: 41.1579, lon: -8.6291 },
  { ciudad: "París", pais: "Francia", region: "europa", bandera: "🇫🇷", iso: "fr", vuelo: 850, dia: 150, lat: 48.8566, lon: 2.3522 },
  { ciudad: "Niza", pais: "Francia", region: "europa", bandera: "🇫🇷", iso: "fr", vuelo: 870, dia: 120, lat: 43.7102, lon: 7.262 },
  { ciudad: "Roma", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 880, dia: 110, lat: 41.9028, lon: 12.4964 },
  { ciudad: "Florencia", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 880, dia: 110, lat: 43.7696, lon: 11.2558 },
  { ciudad: "Venecia", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 890, dia: 140, lat: 45.4408, lon: 12.3155 },
  { ciudad: "Milán", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 860, dia: 120, lat: 45.4642, lon: 9.19 },
  { ciudad: "Londres", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", iso: "gb", vuelo: 900, dia: 170, lat: 51.5074, lon: -0.1278 },
  { ciudad: "Ámsterdam", pais: "Países Bajos", region: "europa", bandera: "🇳🇱", iso: "nl", vuelo: 880, dia: 160, lat: 52.3676, lon: 4.9041 },
  { ciudad: "Bruselas", pais: "Bélgica", region: "europa", bandera: "🇧🇪", iso: "be", vuelo: 870, dia: 115, lat: 50.8503, lon: 4.3517 },
  { ciudad: "Berlín", pais: "Alemania", region: "europa", bandera: "🇩🇪", iso: "de", vuelo: 870, dia: 110, lat: 52.52, lon: 13.405 },
  { ciudad: "Múnich", pais: "Alemania", region: "europa", bandera: "🇩🇪", iso: "de", vuelo: 880, dia: 120, lat: 48.1351, lon: 11.582 },
  { ciudad: "Viena", pais: "Austria", region: "europa", bandera: "🇦🇹", iso: "at", vuelo: 890, dia: 115, lat: 48.2082, lon: 16.3738 },
  { ciudad: "Praga", pais: "Chequia", region: "europa", bandera: "🇨🇿", iso: "cz", vuelo: 900, dia: 85, lat: 50.0755, lon: 14.4378 },
  { ciudad: "Budapest", pais: "Hungría", region: "europa", bandera: "🇭🇺", iso: "hu", vuelo: 900, dia: 80, lat: 47.4979, lon: 19.0402 },
  { ciudad: "Atenas", pais: "Grecia", region: "europa", bandera: "🇬🇷", iso: "gr", vuelo: 920, dia: 90, lat: 37.9838, lon: 23.7275 },
  { ciudad: "Estambul", pais: "Turquía", region: "europa", bandera: "🇹🇷", iso: "tr", vuelo: 850, dia: 70, lat: 41.0082, lon: 28.9784 },

  // ---- Asia ----
  { ciudad: "Tokio", pais: "Japón", region: "asia", bandera: "🇯🇵", iso: "jp", vuelo: 1200, dia: 120, lat: 35.6762, lon: 139.6503 },
  { ciudad: "Kioto", pais: "Japón", region: "asia", bandera: "🇯🇵", iso: "jp", vuelo: 1200, dia: 110, lat: 35.0116, lon: 135.7681 },
  { ciudad: "Seúl", pais: "Corea del Sur", region: "asia", bandera: "🇰🇷", iso: "kr", vuelo: 1250, dia: 100, lat: 37.5665, lon: 126.978 },
  { ciudad: "Bangkok", pais: "Tailandia", region: "asia", bandera: "🇹🇭", iso: "th", vuelo: 1100, dia: 55, lat: 13.7563, lon: 100.5018 },
  { ciudad: "Bali", pais: "Indonesia", region: "asia", bandera: "🇮🇩", iso: "id", vuelo: 1250, dia: 60, lat: -8.3405, lon: 115.092 },
  { ciudad: "Singapur", pais: "Singapur", region: "asia", bandera: "🇸🇬", iso: "sg", vuelo: 1300, dia: 150, lat: 1.3521, lon: 103.8198 },
  { ciudad: "Dubái", pais: "Emiratos Árabes", region: "asia", bandera: "🇦🇪", iso: "ae", vuelo: 1000, dia: 150, lat: 25.2048, lon: 55.2708 },
  { ciudad: "Abu Dabi", pais: "Emiratos Árabes", region: "asia", bandera: "🇦🇪", iso: "ae", vuelo: 1000, dia: 120, lat: 24.4539, lon: 54.3773 },
  { ciudad: "Pekín", pais: "China", region: "asia", bandera: "🇨🇳", iso: "cn", vuelo: 1150, dia: 80, lat: 39.9042, lon: 116.4074 },
  { ciudad: "Shanghái", pais: "China", region: "asia", bandera: "🇨🇳", iso: "cn", vuelo: 1180, dia: 90, lat: 31.2304, lon: 121.4737 },
  { ciudad: "Hong Kong", pais: "China", region: "asia", bandera: "🇭🇰", iso: "hk", vuelo: 1250, dia: 140, lat: 22.3193, lon: 114.1694 },
  { ciudad: "Osaka", pais: "Japón", region: "asia", bandera: "🇯🇵", iso: "jp", vuelo: 1200, dia: 110, lat: 34.6937, lon: 135.5023 },
  { ciudad: "Bombay", pais: "India", region: "asia", bandera: "🇮🇳", iso: "in", vuelo: 1300, dia: 60, lat: 19.076, lon: 72.8777 },
  { ciudad: "Phuket", pais: "Tailandia", region: "asia", bandera: "🇹🇭", iso: "th", vuelo: 1200, dia: 60, lat: 7.8804, lon: 98.3923 },

  // ---- Más Sudamérica ----
  { ciudad: "Guayaquil", pais: "Ecuador", region: "sudamerica", bandera: "🇪🇨", iso: "ec", vuelo: 320, dia: 50, lat: -2.1709, lon: -79.9224 },
  { ciudad: "Arequipa", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", iso: "pe", vuelo: 380, dia: 50, lat: -16.409, lon: -71.5375 },
  { ciudad: "Florianópolis", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 520, dia: 70, lat: -27.5954, lon: -48.548 },
  { ciudad: "Bariloche", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", iso: "ar", vuelo: 600, dia: 75, lat: -41.1335, lon: -71.3103 },
  { ciudad: "Asunción", pais: "Paraguay", region: "sudamerica", bandera: "🇵🇾", iso: "py", vuelo: 520, dia: 55, lat: -25.2637, lon: -57.5759 },

  // ---- Más Norte y Centroamérica ----
  { ciudad: "Guadalajara", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 400, dia: 60, lat: 20.6597, lon: -103.3496 },
  { ciudad: "Playa del Carmen", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 430, dia: 85, lat: 20.6296, lon: -87.0739 },
  { ciudad: "San Francisco", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 560, dia: 200, lat: 37.7749, lon: -122.4194 },
  { ciudad: "Las Vegas", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 540, dia: 150, lat: 36.1699, lon: -115.1398 },
  { ciudad: "Chicago", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 520, dia: 150, lat: 41.8781, lon: -87.6298 },
  { ciudad: "Orlando", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 460, dia: 120, lat: 28.5383, lon: -81.3792 },
  { ciudad: "Montreal", pais: "Canadá", region: "norteamerica", bandera: "🇨🇦", iso: "ca", vuelo: 560, dia: 115, lat: 45.5019, lon: -73.5674 },
  { ciudad: "Ciudad de Guatemala", pais: "Guatemala", region: "norteamerica", bandera: "🇬🇹", iso: "gt", vuelo: 340, dia: 55, lat: 14.6349, lon: -90.5069 },

  // ---- Más Europa ----
  { ciudad: "Valencia", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 820, dia: 95, lat: 39.4699, lon: -0.3763 },
  { ciudad: "Nápoles", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 890, dia: 100, lat: 40.8518, lon: 14.2681 },
  { ciudad: "Edimburgo", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", iso: "gb", vuelo: 910, dia: 130, lat: 55.9533, lon: -3.1883 },
  { ciudad: "Dublín", pais: "Irlanda", region: "europa", bandera: "🇮🇪", iso: "ie", vuelo: 900, dia: 140, lat: 53.3498, lon: -6.2603 },
  { ciudad: "Copenhague", pais: "Dinamarca", region: "europa", bandera: "🇩🇰", iso: "dk", vuelo: 950, dia: 170, lat: 55.6761, lon: 12.5683 },
  { ciudad: "Estocolmo", pais: "Suecia", region: "europa", bandera: "🇸🇪", iso: "se", vuelo: 980, dia: 165, lat: 59.3293, lon: 18.0686 },
  { ciudad: "Zúrich", pais: "Suiza", region: "europa", bandera: "🇨🇭", iso: "ch", vuelo: 950, dia: 230, lat: 47.3769, lon: 8.5417 },
  { ciudad: "Varsovia", pais: "Polonia", region: "europa", bandera: "🇵🇱", iso: "pl", vuelo: 920, dia: 80, lat: 52.2297, lon: 21.0122 },

  // ---- África ----
  { ciudad: "El Cairo", pais: "Egipto", region: "africa", bandera: "🇪🇬", iso: "eg", vuelo: 1100, dia: 60, lat: 30.0444, lon: 31.2357 },
  { ciudad: "Marrakech", pais: "Marruecos", region: "africa", bandera: "🇲🇦", iso: "ma", vuelo: 1000, dia: 65, lat: 31.6295, lon: -7.9811 },
  { ciudad: "Ciudad del Cabo", pais: "Sudáfrica", region: "africa", bandera: "🇿🇦", iso: "za", vuelo: 1300, dia: 95, lat: -33.9249, lon: 18.4241 },

  // ---- Oceanía ----
  { ciudad: "Sídney", pais: "Australia", region: "oceania", bandera: "🇦🇺", iso: "au", vuelo: 1800, dia: 160, lat: -33.8688, lon: 151.2093 },
  { ciudad: "Melbourne", pais: "Australia", region: "oceania", bandera: "🇦🇺", iso: "au", vuelo: 1850, dia: 150, lat: -37.8136, lon: 144.9631 },
  { ciudad: "Auckland", pais: "Nueva Zelanda", region: "oceania", bandera: "🇳🇿", iso: "nz", vuelo: 1900, dia: 130, lat: -36.8485, lon: 174.7633 },
  // ==== EXPANSION SEO 2026-07-11: ~100 destinos nuevos. vuelo = i/v aprox
  // USD desde Colombia (calibrado contra los existentes: Lima 320, Madrid
  // 800, Bangkok 1100); dia = costo diario USD/persona. Los precios reales
  // de vuelo los sobreescribe el detector cuando trackea la ruta. ====
  // Colombia (SEO domestico — el publico principal busca "viaje a Cartagena")
  { ciudad: "Cartagena", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 150, dia: 60, lat: 10.391, lon: -75.4794 },
  { ciudad: "Santa Marta", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 140, dia: 50, lat: 11.2408, lon: -74.199 },
  { ciudad: "San Andrés", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 220, dia: 70, lat: 12.5847, lon: -81.7006 },
  { ciudad: "Medellín", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 120, dia: 50, lat: 6.2442, lon: -75.5812 },
  { ciudad: "Bogotá", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 120, dia: 55, lat: 4.711, lon: -74.0721 },
  { ciudad: "Cali", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 120, dia: 45, lat: 3.4516, lon: -76.532 },
  { ciudad: "Salento", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 130, dia: 40, lat: 4.6372, lon: -75.5703 },
  { ciudad: "Guatapé", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 120, dia: 35, lat: 6.2326, lon: -75.1592 },
  { ciudad: "Villa de Leyva", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 120, dia: 40, lat: 5.6325, lon: -73.5247 },
  { ciudad: "Barichara", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 130, dia: 40, lat: 6.6349, lon: -73.2228 },
  { ciudad: "Leticia", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 250, dia: 50, lat: -4.2153, lon: -69.9406 },
  { ciudad: "Popayán", pais: "Colombia", region: "sudamerica", bandera: "🇨🇴", iso: "co", vuelo: 130, dia: 35, lat: 2.4448, lon: -76.6147 },
  // Sudamérica secundaria
  { ciudad: "Salta", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", iso: "ar", vuelo: 600, dia: 45, lat: -24.7821, lon: -65.4232 },
  { ciudad: "Ushuaia", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", iso: "ar", vuelo: 800, dia: 85, lat: -54.8019, lon: -68.303 },
  { ciudad: "Córdoba", pais: "Argentina", region: "sudamerica", bandera: "🇦🇷", iso: "ar", vuelo: 560, dia: 50, lat: -31.4201, lon: -64.1888 },
  { ciudad: "Valparaíso", pais: "Chile", region: "sudamerica", bandera: "🇨🇱", iso: "cl", vuelo: 480, dia: 60, lat: -33.0472, lon: -71.6127 },
  { ciudad: "San Pedro de Atacama", pais: "Chile", region: "sudamerica", bandera: "🇨🇱", iso: "cl", vuelo: 550, dia: 85, lat: -22.9098, lon: -68.2003 },
  { ciudad: "Puerto Varas", pais: "Chile", region: "sudamerica", bandera: "🇨🇱", iso: "cl", vuelo: 560, dia: 65, lat: -41.3195, lon: -72.9854 },
  { ciudad: "Salvador", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 550, dia: 55, lat: -12.9777, lon: -38.5016 },
  { ciudad: "Recife", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 560, dia: 55, lat: -8.0476, lon: -34.877 },
  { ciudad: "Fortaleza", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 550, dia: 55, lat: -3.7319, lon: -38.5267 },
  { ciudad: "Foz do Iguaçu", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 520, dia: 55, lat: -25.5478, lon: -54.5882 },
  { ciudad: "Manaos", pais: "Brasil", region: "sudamerica", bandera: "🇧🇷", iso: "br", vuelo: 480, dia: 55, lat: -3.119, lon: -60.0217 },
  { ciudad: "Cuenca", pais: "Ecuador", region: "sudamerica", bandera: "🇪🇨", iso: "ec", vuelo: 320, dia: 40, lat: -2.9001, lon: -79.0059 },
  { ciudad: "Baños", pais: "Ecuador", region: "sudamerica", bandera: "🇪🇨", iso: "ec", vuelo: 320, dia: 35, lat: -1.3928, lon: -78.4269 },
  { ciudad: "Uyuni", pais: "Bolivia", region: "sudamerica", bandera: "🇧🇴", iso: "bo", vuelo: 450, dia: 45, lat: -20.4597, lon: -66.8249 },
  { ciudad: "Sucre", pais: "Bolivia", region: "sudamerica", bandera: "🇧🇴", iso: "bo", vuelo: 430, dia: 40, lat: -19.0196, lon: -65.262 },
  { ciudad: "Trujillo", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", iso: "pe", vuelo: 360, dia: 45, lat: -8.1091, lon: -79.0215 },
  { ciudad: "Iquitos", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", iso: "pe", vuelo: 420, dia: 45, lat: -3.7437, lon: -73.2516 },
  { ciudad: "Paracas", pais: "Perú", region: "sudamerica", bandera: "🇵🇪", iso: "pe", vuelo: 360, dia: 55, lat: -13.8351, lon: -76.2503 },
  // Norte/Centroamérica y Caribe
  { ciudad: "Oaxaca", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 520, dia: 50, lat: 17.0732, lon: -96.7266 },
  { ciudad: "Mérida", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 500, dia: 55, lat: 20.9674, lon: -89.5926 },
  { ciudad: "San Miguel de Allende", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 520, dia: 60, lat: 20.9144, lon: -100.7452 },
  { ciudad: "Puerto Vallarta", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 520, dia: 70, lat: 20.6534, lon: -105.2253 },
  { ciudad: "Tulum", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 450, dia: 95, lat: 20.2114, lon: -87.4654 },
  { ciudad: "Guanajuato", pais: "México", region: "norteamerica", bandera: "🇲🇽", iso: "mx", vuelo: 520, dia: 50, lat: 21.019, lon: -101.2574 },
  { ciudad: "Boston", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 520, dia: 160, lat: 42.3601, lon: -71.0589 },
  { ciudad: "Washington", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 500, dia: 140, lat: 38.9072, lon: -77.0369 },
  { ciudad: "Seattle", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 600, dia: 150, lat: 47.6062, lon: -122.3321 },
  { ciudad: "Nueva Orleans", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 520, dia: 100, lat: 29.9511, lon: -90.0715 },
  { ciudad: "Honolulu", pais: "Estados Unidos", region: "norteamerica", bandera: "🇺🇸", iso: "us", vuelo: 900, dia: 190, lat: 21.3069, lon: -157.8583 },
  { ciudad: "Vancouver", pais: "Canadá", region: "norteamerica", bandera: "🇨🇦", iso: "ca", vuelo: 650, dia: 140, lat: 49.2827, lon: -123.1207 },
  { ciudad: "Quebec", pais: "Canadá", region: "norteamerica", bandera: "🇨🇦", iso: "ca", vuelo: 650, dia: 95, lat: 46.8139, lon: -71.208 },
  { ciudad: "Santo Domingo", pais: "República Dominicana", region: "norteamerica", bandera: "🇩🇴", iso: "do", vuelo: 350, dia: 60, lat: 18.4861, lon: -69.9312 },
  { ciudad: "San Juan", pais: "Puerto Rico", region: "norteamerica", bandera: "🇵🇷", iso: "pr", vuelo: 400, dia: 90, lat: 18.4655, lon: -66.1057 },
  { ciudad: "Montego Bay", pais: "Jamaica", region: "norteamerica", bandera: "🇯🇲", iso: "jm", vuelo: 400, dia: 80, lat: 18.4762, lon: -77.8939 },
  { ciudad: "Oranjestad", pais: "Aruba", region: "norteamerica", bandera: "🇦🇼", iso: "aw", vuelo: 350, dia: 95, lat: 12.5211, lon: -70.0349 },
  { ciudad: "Willemstad", pais: "Curazao", region: "norteamerica", bandera: "🇨🇼", iso: "cw", vuelo: 320, dia: 85, lat: 12.1091, lon: -68.9316 },
  // Europa secundaria
  { ciudad: "Granada", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 850, dia: 85, lat: 37.1773, lon: -3.5986 },
  { ciudad: "Bilbao", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 880, dia: 95, lat: 43.263, lon: -2.935 },
  { ciudad: "San Sebastián", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 900, dia: 100, lat: 43.3183, lon: -1.9812 },
  { ciudad: "Toledo", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 800, dia: 85, lat: 39.8628, lon: -4.0273 },
  { ciudad: "Córdoba", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 850, dia: 85, lat: 37.8882, lon: -4.7794 },
  { ciudad: "Palma de Mallorca", pais: "España", region: "europa", bandera: "🇪🇸", iso: "es", vuelo: 900, dia: 100, lat: 39.5696, lon: 2.6502 },
  { ciudad: "Brujas", pais: "Bélgica", region: "europa", bandera: "🇧🇪", iso: "be", vuelo: 900, dia: 105, lat: 51.2093, lon: 3.2247 },
  { ciudad: "Gante", pais: "Bélgica", region: "europa", bandera: "🇧🇪", iso: "be", vuelo: 900, dia: 100, lat: 51.0543, lon: 3.7174 },
  { ciudad: "Lyon", pais: "Francia", region: "europa", bandera: "🇫🇷", iso: "fr", vuelo: 920, dia: 100, lat: 45.764, lon: 4.8357 },
  { ciudad: "Marsella", pais: "Francia", region: "europa", bandera: "🇫🇷", iso: "fr", vuelo: 920, dia: 95, lat: 43.2965, lon: 5.3698 },
  { ciudad: "Burdeos", pais: "Francia", region: "europa", bandera: "🇫🇷", iso: "fr", vuelo: 920, dia: 95, lat: 44.8378, lon: -0.5792 },
  { ciudad: "Estrasburgo", pais: "Francia", region: "europa", bandera: "🇫🇷", iso: "fr", vuelo: 950, dia: 100, lat: 48.5734, lon: 7.7521 },
  { ciudad: "Turín", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 900, dia: 95, lat: 45.0703, lon: 7.6869 },
  { ciudad: "Bolonia", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 900, dia: 95, lat: 44.4949, lon: 11.3426 },
  { ciudad: "Verona", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 900, dia: 95, lat: 45.4384, lon: 10.9916 },
  { ciudad: "Palermo", pais: "Italia", region: "europa", bandera: "🇮🇹", iso: "it", vuelo: 950, dia: 85, lat: 38.1157, lon: 13.3615 },
  { ciudad: "Santorini", pais: "Grecia", region: "europa", bandera: "🇬🇷", iso: "gr", vuelo: 1050, dia: 140, lat: 36.3932, lon: 25.4615 },
  { ciudad: "Mykonos", pais: "Grecia", region: "europa", bandera: "🇬🇷", iso: "gr", vuelo: 1050, dia: 160, lat: 37.4467, lon: 25.3289 },
  { ciudad: "Heraclión", pais: "Grecia", region: "europa", bandera: "🇬🇷", iso: "gr", vuelo: 1050, dia: 85, lat: 35.3387, lon: 25.1442 },
  { ciudad: "Dubrovnik", pais: "Croacia", region: "europa", bandera: "🇭🇷", iso: "hr", vuelo: 1000, dia: 90, lat: 42.6507, lon: 18.0944 },
  { ciudad: "Split", pais: "Croacia", region: "europa", bandera: "🇭🇷", iso: "hr", vuelo: 1000, dia: 80, lat: 43.5081, lon: 16.4402 },
  { ciudad: "Liubliana", pais: "Eslovenia", region: "europa", bandera: "🇸🇮", iso: "si", vuelo: 950, dia: 80, lat: 46.0569, lon: 14.5058 },
  { ciudad: "Cracovia", pais: "Polonia", region: "europa", bandera: "🇵🇱", iso: "pl", vuelo: 900, dia: 65, lat: 50.0647, lon: 19.945 },
  { ciudad: "Gdansk", pais: "Polonia", region: "europa", bandera: "🇵🇱", iso: "pl", vuelo: 950, dia: 65, lat: 54.352, lon: 18.6466 },
  { ciudad: "Salzburgo", pais: "Austria", region: "europa", bandera: "🇦🇹", iso: "at", vuelo: 950, dia: 100, lat: 47.8095, lon: 13.055 },
  { ciudad: "Innsbruck", pais: "Austria", region: "europa", bandera: "🇦🇹", iso: "at", vuelo: 950, dia: 105, lat: 47.2692, lon: 11.4041 },
  { ciudad: "Hamburgo", pais: "Alemania", region: "europa", bandera: "🇩🇪", iso: "de", vuelo: 900, dia: 100, lat: 53.5511, lon: 9.9937 },
  { ciudad: "Colonia", pais: "Alemania", region: "europa", bandera: "🇩🇪", iso: "de", vuelo: 880, dia: 95, lat: 50.9375, lon: 6.9603 },
  { ciudad: "Dresde", pais: "Alemania", region: "europa", bandera: "🇩🇪", iso: "de", vuelo: 920, dia: 90, lat: 51.0504, lon: 13.7373 },
  { ciudad: "Rotterdam", pais: "Países Bajos", region: "europa", bandera: "🇳🇱", iso: "nl", vuelo: 900, dia: 105, lat: 51.9244, lon: 4.4777 },
  { ciudad: "Oxford", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", iso: "gb", vuelo: 950, dia: 110, lat: 51.7548, lon: -1.2544 },
  { ciudad: "Cambridge", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", iso: "gb", vuelo: 950, dia: 110, lat: 52.2053, lon: 0.1218 },
  { ciudad: "Liverpool", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", iso: "gb", vuelo: 900, dia: 95, lat: 53.4084, lon: -2.9916 },
  { ciudad: "Glasgow", pais: "Reino Unido", region: "europa", bandera: "🇬🇧", iso: "gb", vuelo: 950, dia: 95, lat: 55.8642, lon: -4.2518 },
  { ciudad: "Ginebra", pais: "Suiza", region: "europa", bandera: "🇨🇭", iso: "ch", vuelo: 950, dia: 220, lat: 46.2044, lon: 6.1432 },
  { ciudad: "Lucerna", pais: "Suiza", region: "europa", bandera: "🇨🇭", iso: "ch", vuelo: 980, dia: 210, lat: 47.0502, lon: 8.3093 },
  { ciudad: "Interlaken", pais: "Suiza", region: "europa", bandera: "🇨🇭", iso: "ch", vuelo: 980, dia: 220, lat: 46.6863, lon: 7.8632 },
  { ciudad: "Reikiavik", pais: "Islandia", region: "europa", bandera: "🇮🇸", iso: "is", vuelo: 1000, dia: 200, lat: 64.1466, lon: -21.9426 },
  { ciudad: "Helsinki", pais: "Finlandia", region: "europa", bandera: "🇫🇮", iso: "fi", vuelo: 1000, dia: 110, lat: 60.1699, lon: 24.9384 },
  { ciudad: "Oslo", pais: "Noruega", region: "europa", bandera: "🇳🇴", iso: "no", vuelo: 1000, dia: 180, lat: 59.9139, lon: 10.7522 },
  { ciudad: "Bergen", pais: "Noruega", region: "europa", bandera: "🇳🇴", iso: "no", vuelo: 1050, dia: 170, lat: 60.3913, lon: 5.3221 },
  { ciudad: "Tallin", pais: "Estonia", region: "europa", bandera: "🇪🇪", iso: "ee", vuelo: 980, dia: 75, lat: 59.437, lon: 24.7536 },
  { ciudad: "Riga", pais: "Letonia", region: "europa", bandera: "🇱🇻", iso: "lv", vuelo: 980, dia: 70, lat: 56.9496, lon: 24.1052 },
  // Asia
  { ciudad: "Nara", pais: "Japón", region: "asia", bandera: "🇯🇵", iso: "jp", vuelo: 1500, dia: 85, lat: 34.6851, lon: 135.8048 },
  { ciudad: "Hiroshima", pais: "Japón", region: "asia", bandera: "🇯🇵", iso: "jp", vuelo: 1550, dia: 85, lat: 34.3853, lon: 132.4553 },
  { ciudad: "Sapporo", pais: "Japón", region: "asia", bandera: "🇯🇵", iso: "jp", vuelo: 1600, dia: 90, lat: 43.0618, lon: 141.3545 },
  { ciudad: "Busán", pais: "Corea del Sur", region: "asia", bandera: "🇰🇷", iso: "kr", vuelo: 1500, dia: 80, lat: 35.1796, lon: 129.0756 },
  { ciudad: "Chiang Mai", pais: "Tailandia", region: "asia", bandera: "🇹🇭", iso: "th", vuelo: 1250, dia: 40, lat: 18.7883, lon: 98.9853 },
  { ciudad: "Krabi", pais: "Tailandia", region: "asia", bandera: "🇹🇭", iso: "th", vuelo: 1250, dia: 50, lat: 8.0863, lon: 98.9063 },
  { ciudad: "Hanói", pais: "Vietnam", region: "asia", bandera: "🇻🇳", iso: "vn", vuelo: 1350, dia: 40, lat: 21.0278, lon: 105.8342 },
  { ciudad: "Ho Chi Minh", pais: "Vietnam", region: "asia", bandera: "🇻🇳", iso: "vn", vuelo: 1350, dia: 40, lat: 10.8231, lon: 106.6297 },
  { ciudad: "Da Nang", pais: "Vietnam", region: "asia", bandera: "🇻🇳", iso: "vn", vuelo: 1400, dia: 45, lat: 16.0544, lon: 108.2022 },
  { ciudad: "Siem Reap", pais: "Camboya", region: "asia", bandera: "🇰🇭", iso: "kh", vuelo: 1400, dia: 45, lat: 13.3671, lon: 103.8448 },
  { ciudad: "Kuala Lumpur", pais: "Malasia", region: "asia", bandera: "🇲🇾", iso: "my", vuelo: 1300, dia: 50, lat: 3.139, lon: 101.6869 },
  { ciudad: "Manila", pais: "Filipinas", region: "asia", bandera: "🇵🇭", iso: "ph", vuelo: 1450, dia: 55, lat: 14.5995, lon: 120.9842 },
  { ciudad: "Cebú", pais: "Filipinas", region: "asia", bandera: "🇵🇭", iso: "ph", vuelo: 1500, dia: 50, lat: 10.3157, lon: 123.8854 },
  { ciudad: "Taipéi", pais: "Taiwán", region: "asia", bandera: "🇹🇼", iso: "tw", vuelo: 1500, dia: 70, lat: 25.033, lon: 121.5654 },
  { ciudad: "Katmandú", pais: "Nepal", region: "asia", bandera: "🇳🇵", iso: "np", vuelo: 1400, dia: 35, lat: 27.7172, lon: 85.324 },
  { ciudad: "Nueva Delhi", pais: "India", region: "asia", bandera: "🇮🇳", iso: "in", vuelo: 1300, dia: 40, lat: 28.6139, lon: 77.209 },
  { ciudad: "Agra", pais: "India", region: "asia", bandera: "🇮🇳", iso: "in", vuelo: 1350, dia: 35, lat: 27.1767, lon: 78.0081 },
  { ciudad: "Jaipur", pais: "India", region: "asia", bandera: "🇮🇳", iso: "in", vuelo: 1350, dia: 35, lat: 26.9124, lon: 75.7873 },
  { ciudad: "Colombo", pais: "Sri Lanka", region: "asia", bandera: "🇱🇰", iso: "lk", vuelo: 1400, dia: 45, lat: 6.9271, lon: 79.8612 },
  // Medio Oriente y África
  { ciudad: "Tel Aviv", pais: "Israel", region: "asia", bandera: "🇮🇱", iso: "il", vuelo: 1100, dia: 110, lat: 32.0853, lon: 34.7818 },
  { ciudad: "Jerusalén", pais: "Israel", region: "asia", bandera: "🇮🇱", iso: "il", vuelo: 1100, dia: 95, lat: 31.7683, lon: 35.2137 },
  { ciudad: "Amán", pais: "Jordania", region: "asia", bandera: "🇯🇴", iso: "jo", vuelo: 1150, dia: 70, lat: 31.9539, lon: 35.9106 },
  { ciudad: "Doha", pais: "Catar", region: "asia", bandera: "🇶🇦", iso: "qa", vuelo: 1200, dia: 110, lat: 25.2854, lon: 51.531 },
  { ciudad: "Mascate", pais: "Omán", region: "asia", bandera: "🇴🇲", iso: "om", vuelo: 1250, dia: 90, lat: 23.588, lon: 58.3829 },
  { ciudad: "Casablanca", pais: "Marruecos", region: "africa", bandera: "🇲🇦", iso: "ma", vuelo: 950, dia: 60, lat: 33.5731, lon: -7.5898 },
  { ciudad: "Fez", pais: "Marruecos", region: "africa", bandera: "🇲🇦", iso: "ma", vuelo: 980, dia: 50, lat: 34.0181, lon: -5.0078 },
  { ciudad: "Túnez", pais: "Túnez", region: "africa", bandera: "🇹🇳", iso: "tn", vuelo: 1000, dia: 55, lat: 36.8065, lon: 10.1815 },
  { ciudad: "Nairobi", pais: "Kenia", region: "africa", bandera: "🇰🇪", iso: "ke", vuelo: 1300, dia: 70, lat: -1.2921, lon: 36.8219 },
  { ciudad: "Zanzíbar", pais: "Tanzania", region: "africa", bandera: "🇹🇿", iso: "tz", vuelo: 1400, dia: 80, lat: -6.1659, lon: 39.2026 },
  { ciudad: "Johannesburgo", pais: "Sudáfrica", region: "africa", bandera: "🇿🇦", iso: "za", vuelo: 1300, dia: 70, lat: -26.2041, lon: 28.0473 },
  // Oceanía
  { ciudad: "Brisbane", pais: "Australia", region: "oceania", bandera: "🇦🇺", iso: "au", vuelo: 1900, dia: 110, lat: -27.4698, lon: 153.0251 },
  { ciudad: "Perth", pais: "Australia", region: "oceania", bandera: "🇦🇺", iso: "au", vuelo: 2000, dia: 105, lat: -31.9505, lon: 115.8605 },
  { ciudad: "Cairns", pais: "Australia", region: "oceania", bandera: "🇦🇺", iso: "au", vuelo: 2000, dia: 110, lat: -16.9186, lon: 145.7781 },
  { ciudad: "Queenstown", pais: "Nueva Zelanda", region: "oceania", bandera: "🇳🇿", iso: "nz", vuelo: 2100, dia: 160, lat: -45.0312, lon: 168.6626 },
  { ciudad: "Wellington", pais: "Nueva Zelanda", region: "oceania", bandera: "🇳🇿", iso: "nz", vuelo: 2000, dia: 105, lat: -41.2866, lon: 174.7756 },
];

// En que se va el costo diario. El `dia` de cada ciudad es un agregado
// (hospedaje + comida + transporte local + actividades); estas proporciones lo
// reparten para poder ensenarlo por tipologia de gasto. Estaban escritas a
// mano en los dos sitios que calculan un desglose, con el riesgo obvio de que
// una se tocara y la otra no. Suman 1.
export const REPARTO_DIARIO = {
  hospedaje: 0.45,
  comida: 0.3,
  transporte: 0.12,
  extras: 0.13,
};

export const REGIONES = {
  todas: "Todo el mundo",
  sudamerica: "Sudamérica",
  norteamerica: "Norte y Centroamérica",
  europa: "Europa",
  asia: "Asia",
  africa: "África",
  oceania: "Oceanía",
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
// (tren, bus o vuelo barato según la distancia). DEPRECADO: lo dejamos para
// compat por si algo externo lo importa, pero `construirRuta` ahora usa
// `costoTramoReal` de lib/tramos.js que tiene tabla curada por par de ciudades
// para los tramos comunes (AVE Madrid-Barcelona, Eurostar París-Londres, etc).
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

// Helper local: obtiene la oferta del detector para (destino, origen).
//
// ⚠️ REGLA DE ORO (bug 2026-07-18): el detector escanea desde MUCHOS origenes
// (BOG/MDE pero tambien MAD, MIA, GRU, SCL... para las landings SEO). Un
// MAD→Milan a US$51 NO es el vuelo de un usuario que sale de Rionegro. Por
// eso el fallback NUNCA cruza de pais: si no hay oferta del aeropuerto
// exacto, solo se consideran los demas aeropuertos del MISMO pais del
// usuario (`origenes`); si tampoco hay, se usa el ESTIMADO del catalogo.
function mejorEntre(reg, origenes) {
  let m = null;
  for (const o of origenes || []) {
    const of = reg.porOrigen?.[o];
    if (of && (!m || of.precio < m.precio)) m = of;
  }
  return m;
}

function ofertaPara(preciosReales, llave, origen, origenes = null) {
  const reg = preciosReales?.[llave];
  if (!reg) return null;
  if (reg.precio) return reg; // formato viejo (plana)
  if (origen && reg.porOrigen?.[origen]) return reg.porOrigen[origen];
  // Fallback restringido a los aeropuertos del pais del usuario. Sin lista y
  // con origen fijado: estricto (solo ese aeropuerto). Sin origen ni lista:
  // sin datos reales (mejor un estimado honesto que un precio de otro pais).
  const permitidos = origenes || (origen ? [origen] : null);
  return permitidos ? mejorEntre(reg, permitidos) : null;
}

// Helper: la mejor oferta DENTRO de los origenes permitidos (para el chip
// "💡 desde X te ahorras Y" — comparar BOG vs MDE, nunca vs Madrid).
function mejorOferta(preciosReales, llave, origenes = null) {
  const reg = preciosReales?.[llave];
  if (!reg) return null;
  if (reg.precio) return reg;
  if (origenes) return mejorEntre(reg, origenes);
  return reg.mejor || null;
}

// Calcula qué destinos caben en el presupuesto (en USD) para N días y M personas.
// `preciosReales` (opcional): map del detector de vuelos. Cuando hay coincidencia,
// usa el precio REAL en vez del estimado y marca esReal=true en el resultado.
// `origen` (opcional, "BOG"|"MDE"): usa el precio desde ESE aeropuerto. Si no
// hay datos para ese origen, cae al "mejor" disponible.
export function calcularDestinos({ presupuestoUsd, dias, personas, region, preciosReales = {}, origen = null, origenes = null }) {
  const lista = DESTINOS_PRESUPUESTO.filter(
    (d) => region === "todas" || d.region === region
  );

  const resultados = lista.map((d) => {
    const llave = llaveCiudad(d);
    const real = ofertaPara(preciosReales, llave, origen, origenes);
    const mejor = mejorOferta(preciosReales, llave, origenes || (origen ? [origen] : null));
    // Recomendacion: si el usuario eligio origen X pero hay otro origen mas
    // barato, calcular el ahorro y exponerlo a la UI.
    let ahorroDesde = null;
    if (origen && real && mejor && mejor.origen && mejor.origen !== origen && mejor.precio < real.precio) {
      ahorroDesde = { origen: mejor.origen, precio: mejor.precio, ahorro: real.precio - mejor.precio };
    }
    const vueloUnit = real ? real.precio : d.vuelo;
    const vuelos = vueloUnit * personas;
    const estadia = d.dia * dias * personas;
    const total = vuelos + estadia;

    const desglose = {
      vuelo: vuelos,
      hospedaje: Math.round(d.dia * REPARTO_DIARIO.hospedaje * dias * personas),
      comida: Math.round(d.dia * REPARTO_DIARIO.comida * dias * personas),
      transporte: Math.round(d.dia * REPARTO_DIARIO.transporte * dias * personas),
      extras: Math.round(d.dia * REPARTO_DIARIO.extras * dias * personas),
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
      ahorroDesde,
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

// Recomienda cuántos días caben dada una región y presupuesto.
// El usuario primero elige a dónde y con cuánto; los días los DEDUCE la app
// (no los pide). Si el presupuesto es muy bajo, retorna advertencia + el monto
// mínimo sugerido para un viaje razonable (7 días).
//
// Estrategia: medianas (no promedios) por región para evitar que outliers como
// Nueva York o Zúrich distorsionen el cálculo. Más fiel a la realidad.
export function diasRecomendados({ presupuestoUsd, region, personas = 1 }) {
  const lista = ciudadesDeRegion(region);
  if (!lista.length || presupuestoUsd <= 0) {
    return { recomendado: 0, advertencia: "sin_datos", vueloMediana: 0, diaMediana: 0 };
  }
  const mediana = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const vueloMediana = mediana(lista.map((d) => d.vuelo));
  const diaMediana = mediana(lista.map((d) => d.dia));

  const costoVueloTotal = vueloMediana * personas;
  const restante = presupuestoUsd - costoVueloTotal;

  // Caso 1: ni el vuelo cabe.
  if (restante <= 0) {
    return {
      recomendado: 0,
      advertencia: "insuficiente_vuelo",
      vueloMediana,
      diaMediana,
      presupuestoMinSugerido: Math.ceil(costoVueloTotal + diaMediana * personas * 7),
    };
  }

  const diasRaw = restante / (diaMediana * personas);
  // Clamp entre 3 y 30. Viajes <3 días a otro continente no tienen sentido;
  // >30 días casi nadie los planea desde el inicio.
  const recomendado = Math.max(3, Math.min(30, Math.round(diasRaw)));

  // Bandera: si el cálculo crudo es muy corto, advertir.
  let advertencia = null;
  if (diasRaw < 4) advertencia = "muy_corto";
  else if (diasRaw > 25) advertencia = "muy_largo";

  return {
    recomendado,
    advertencia,
    vueloMediana,
    diaMediana,
    presupuestoMinSugerido: Math.ceil(costoVueloTotal + diaMediana * personas * 7),
    diasRaw: Math.round(diasRaw * 10) / 10, // para que la UI muestre "alcanza para ~7.3"
  };
}

// Dada una región, días deseados y personas, calcula el presupuesto MÍNIMO
// que cubriría el viaje. Útil para advertir al usuario si su monto se queda corto.
export function presupuestoMinimoPara({ region, dias, personas = 1 }) {
  const lista = ciudadesDeRegion(region);
  if (!lista.length) return 0;
  const mediana = (arr) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const vueloMediana = mediana(lista.map((d) => d.vuelo));
  const diaMediana = mediana(lista.map((d) => d.dia));
  return Math.ceil((vueloMediana + diaMediana * dias) * personas);
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
  origen = null,
  origenes = null, // aeropuertos del pais del usuario (p.ej. ["MDE","BOG"])
  ritmo = "normal", // "normal" (DIAS_MIN=2, mas ciudades) | "tranquilo" (DIAS_MIN=3, menos)
}) {
  const fuera = new Set(excluir);
  // Aplicamos precio real (si existe) sobre cada candidato ANTES de elegir la
  // entrada, así "la más barata" se basa en datos reales cuando los hay.
  // Si el usuario fijo un `origen` (BOG/MDE), se usa el precio desde ESE
  // aeropuerto; si no hay match exacto, cae al mas barato disponible.
  const cands = DESTINOS_PRESUPUESTO.filter(
    (d) =>
      (region === "todas" || d.region === region) && !fuera.has(llaveCiudad(d))
  ).map((d) => {
    const llave = llaveCiudad(d);
    const real = ofertaPara(preciosReales, llave, origen, origenes);
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

  // ritmo "normal" = 2 dias minimo por ciudad (max ciudades posibles).
  // ritmo "tranquilo" = 3 dias minimo (menos ciudades, mas tiempo en cada una).
  // Feedback del agente critico ronda 1: "2 dias/ciudad en rutas de 5 ciudades
  // se siente apretado". El usuario puede elegir el ritmo en la UI.
  const DIAS_MIN = ritmo === "tranquilo" ? 3 : 2;
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
    // Costo del tramo: tabla curada (AVE €60, Eurostar €120, etc) si el par
    // está cubierto; si no, fallback geométrico por km marcado como `aprox`.
    const tramo = costoTramoReal(last, elegido.c, elegido.km);
    const cand = {
      ...elegido.c,
      salto: tramo.precio,
      km: Math.round(elegido.km),
      medioTramo: tramo.medio,
      operadorTramo: tramo.operador,
      duracionTramoH: tramo.duracion_h,
      esTramoCurado: tramo.esCurado,
    };
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
    hospedaje: Math.round(totDia * REPARTO_DIARIO.hospedaje),
    comida: Math.round(totDia * REPARTO_DIARIO.comida),
    transporte: Math.round(totDia * REPARTO_DIARIO.transporte),
    extras: Math.round(totDia * REPARTO_DIARIO.extras),
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
