// Códigos IATA (aeropuerto principal) para los destinos del catálogo del
// presupuesto. Necesarios para consultar Travelpayouts en vivo. La clave es la
// llave "Ciudad|País" igual que llaveCiudad() de presupuesto.js.

export const IATA_CIUDAD = {
  // Sudamérica
  "Lima|Perú": "LIM",
  "Cusco|Perú": "CUZ",
  "Arequipa|Perú": "AQP",
  "Quito|Ecuador": "UIO",
  "Guayaquil|Ecuador": "GYE",
  "Santiago|Chile": "SCL",
  "Buenos Aires|Argentina": "BUE",
  "Mendoza|Argentina": "MDZ",
  "Bariloche|Argentina": "BRC",
  "Río de Janeiro|Brasil": "RIO",
  "São Paulo|Brasil": "SAO",
  "Florianópolis|Brasil": "FLN",
  "Montevideo|Uruguay": "MVD",
  "La Paz|Bolivia": "LPB",
  "Asunción|Paraguay": "ASU",

  // Norte y Centroamérica
  "Ciudad de México|México": "MEX",
  "Cancún|México": "CUN",
  "Guadalajara|México": "GDL",
  "Playa del Carmen|México": "CUN", // Cancún es la base aérea de Playa
  "Ciudad de Panamá|Panamá": "PTY",
  "San José|Costa Rica": "SJO",
  "Miami|Estados Unidos": "MIA",
  "Nueva York|Estados Unidos": "NYC",
  "Los Ángeles|Estados Unidos": "LAX",
  "San Francisco|Estados Unidos": "SFO",
  "Las Vegas|Estados Unidos": "LAS",
  "Chicago|Estados Unidos": "CHI",
  "Orlando|Estados Unidos": "MCO",
  "Toronto|Canadá": "YTO",
  "Montreal|Canadá": "YMQ",
  "La Habana|Cuba": "HAV",
  "Ciudad de Guatemala|Guatemala": "GUA",

  // Europa
  "Madrid|España": "MAD",
  "Barcelona|España": "BCN",
  "Sevilla|España": "SVQ",
  "Valencia|España": "VLC",
  "Lisboa|Portugal": "LIS",
  "Oporto|Portugal": "OPO",
  "París|Francia": "PAR",
  "Niza|Francia": "NCE",
  "Roma|Italia": "ROM",
  "Florencia|Italia": "FLR",
  "Venecia|Italia": "VCE",
  "Milán|Italia": "MIL",
  "Nápoles|Italia": "NAP",
  "Londres|Reino Unido": "LON",
  "Edimburgo|Reino Unido": "EDI",
  "Ámsterdam|Países Bajos": "AMS",
  "Bruselas|Bélgica": "BRU",
  "Berlín|Alemania": "BER",
  "Múnich|Alemania": "MUC",
  "Viena|Austria": "VIE",
  "Praga|Chequia": "PRG",
  "Budapest|Hungría": "BUD",
  "Atenas|Grecia": "ATH",
  "Estambul|Turquía": "IST",
  "Dublín|Irlanda": "DUB",
  "Copenhague|Dinamarca": "CPH",
  "Estocolmo|Suecia": "STO",
  "Zúrich|Suiza": "ZRH",
  "Varsovia|Polonia": "WAW",

  // Asia
  "Tokio|Japón": "TYO",
  "Osaka|Japón": "OSA",
  "Kioto|Japón": "UKY", // sin aeropuerto propio: Osaka KIX cubre Kioto
  "Seúl|Corea del Sur": "SEL",
  "Bangkok|Tailandia": "BKK",
  "Phuket|Tailandia": "HKT",
  "Bali|Indonesia": "DPS",
  "Singapur|Singapur": "SIN",
  "Dubái|Emiratos Árabes": "DXB",
  "Abu Dabi|Emiratos Árabes": "AUH",
  "Pekín|China": "BJS",
  "Shanghái|China": "SHA",
  "Hong Kong|China": "HKG",
  "Bombay|India": "BOM",

  // África
  "El Cairo|Egipto": "CAI",
  "Marrakech|Marruecos": "RAK",
  "Ciudad del Cabo|Sudáfrica": "CPT",

  // Oceanía
  "Sídney|Australia": "SYD",
  "Melbourne|Australia": "MEL",
  "Auckland|Nueva Zelanda": "AKL",
};

export function iataDe(ciudad, pais) {
  return IATA_CIUDAD[`${ciudad}|${pais}`] || null;
}
