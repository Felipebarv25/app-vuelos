// Catalogo de paises que el modal de Presupuesto soporta como ORIGEN.
// Para cada pais: bandera, nombre legible, y 1-4 hubs aereos con su IATA y
// nombre de ciudad. Si `tieneDetector === true`, el flujo usa precios reales
// del detector de vuelos (ofertas.json). Si es false, la UI advierte que los
// precios son estimados y el sistema puede caer a una busqueda en vivo via
// Travelpayouts (cuando el endpoint /api/vuelo-vivo lo soporte por origen).
//
// Phase 1 (cubierto por detector): paises Latam (CO + amigos) + ES/US.
// Phase 2 (sin detector, depende de live search): resto del mundo —
// principales hubs internacionales que el viajero comun usaria.
export const PAISES_ORIGEN = {
  // ==== AMÉRICA LATINA ====
  CO: {
    bandera: "🇨🇴",
    nombre: "Colombia",
    hubs: [
      { iata: "BOG", ciudad: "Bogotá" },
      { iata: "MDE", ciudad: "Medellín" },
      { iata: "CLO", ciudad: "Cali" },
      { iata: "CTG", ciudad: "Cartagena" },
    ],
    tieneDetector: true,
  },
  MX: {
    bandera: "🇲🇽",
    nombre: "México",
    hubs: [
      { iata: "MEX", ciudad: "Ciudad de México" },
      { iata: "CUN", ciudad: "Cancún" },
      { iata: "GDL", ciudad: "Guadalajara" },
      { iata: "MTY", ciudad: "Monterrey" },
    ],
    tieneDetector: true,
  },
  EC: {
    bandera: "🇪🇨",
    nombre: "Ecuador",
    hubs: [
      { iata: "UIO", ciudad: "Quito" },
      { iata: "GYE", ciudad: "Guayaquil" },
    ],
    tieneDetector: true,
  },
  PE: {
    bandera: "🇵🇪",
    nombre: "Perú",
    hubs: [
      { iata: "LIM", ciudad: "Lima" },
      { iata: "CUZ", ciudad: "Cusco" },
    ],
    tieneDetector: true,
  },
  CL: {
    bandera: "🇨🇱",
    nombre: "Chile",
    hubs: [
      { iata: "SCL", ciudad: "Santiago" },
    ],
    tieneDetector: true,
  },
  AR: {
    bandera: "🇦🇷",
    nombre: "Argentina",
    hubs: [
      { iata: "EZE", ciudad: "Buenos Aires (Ezeiza)" },
      { iata: "COR", ciudad: "Córdoba" },
      { iata: "MDZ", ciudad: "Mendoza" },
    ],
    tieneDetector: true,
  },
  BR: {
    bandera: "🇧🇷",
    nombre: "Brasil",
    hubs: [
      { iata: "GRU", ciudad: "São Paulo (Guarulhos)" },
      { iata: "GIG", ciudad: "Río de Janeiro" },
      { iata: "BSB", ciudad: "Brasilia" },
      { iata: "REC", ciudad: "Recife" },
    ],
    tieneDetector: true,
  },
  VE: {
    bandera: "🇻🇪",
    nombre: "Venezuela",
    hubs: [
      { iata: "CCS", ciudad: "Caracas" },
    ],
    tieneDetector: true,
  },
  UY: {
    bandera: "🇺🇾",
    nombre: "Uruguay",
    hubs: [{ iata: "MVD", ciudad: "Montevideo" }],
    tieneDetector: false,
  },
  PY: {
    bandera: "🇵🇾",
    nombre: "Paraguay",
    hubs: [{ iata: "ASU", ciudad: "Asunción" }],
    tieneDetector: false,
  },
  BO: {
    bandera: "🇧🇴",
    nombre: "Bolivia",
    hubs: [
      { iata: "VVI", ciudad: "Santa Cruz" },
      { iata: "LPB", ciudad: "La Paz" },
    ],
    tieneDetector: false,
  },

  // ==== NORTE Y CENTROAMÉRICA / CARIBE ====
  US: {
    bandera: "🇺🇸",
    nombre: "Estados Unidos",
    hubs: [
      { iata: "JFK", ciudad: "Nueva York (JFK)" },
      { iata: "MIA", ciudad: "Miami" },
      { iata: "LAX", ciudad: "Los Ángeles" },
      { iata: "ORD", ciudad: "Chicago" },
    ],
    tieneDetector: true,
  },
  CA: {
    bandera: "🇨🇦",
    nombre: "Canadá",
    hubs: [
      { iata: "YYZ", ciudad: "Toronto" },
      { iata: "YVR", ciudad: "Vancouver" },
      { iata: "YUL", ciudad: "Montreal" },
    ],
    tieneDetector: false,
  },
  CR: {
    bandera: "🇨🇷",
    nombre: "Costa Rica",
    hubs: [{ iata: "SJO", ciudad: "San José" }],
    tieneDetector: false,
  },
  PA: {
    bandera: "🇵🇦",
    nombre: "Panamá",
    hubs: [{ iata: "PTY", ciudad: "Ciudad de Panamá" }],
    tieneDetector: false,
  },
  GT: {
    bandera: "🇬🇹",
    nombre: "Guatemala",
    hubs: [{ iata: "GUA", ciudad: "Ciudad de Guatemala" }],
    tieneDetector: false,
  },
  DO: {
    bandera: "🇩🇴",
    nombre: "República Dominicana",
    hubs: [
      { iata: "SDQ", ciudad: "Santo Domingo" },
      { iata: "PUJ", ciudad: "Punta Cana" },
    ],
    tieneDetector: false,
  },
  PR: {
    bandera: "🇵🇷",
    nombre: "Puerto Rico",
    hubs: [{ iata: "SJU", ciudad: "San Juan" }],
    tieneDetector: false,
  },
  CU: {
    bandera: "🇨🇺",
    nombre: "Cuba",
    hubs: [{ iata: "HAV", ciudad: "La Habana" }],
    tieneDetector: false,
  },
  JM: {
    bandera: "🇯🇲",
    nombre: "Jamaica",
    hubs: [{ iata: "KIN", ciudad: "Kingston" }],
    tieneDetector: false,
  },

  // ==== EUROPA ====
  ES: {
    bandera: "🇪🇸",
    nombre: "España",
    hubs: [
      { iata: "MAD", ciudad: "Madrid" },
      { iata: "BCN", ciudad: "Barcelona" },
      { iata: "AGP", ciudad: "Málaga" },
      { iata: "VLC", ciudad: "Valencia" },
    ],
    tieneDetector: true,
  },
  FR: {
    bandera: "🇫🇷",
    nombre: "Francia",
    hubs: [
      { iata: "CDG", ciudad: "París (CDG)" },
      { iata: "ORY", ciudad: "París (Orly)" },
      { iata: "NCE", ciudad: "Niza" },
    ],
    tieneDetector: false,
  },
  IT: {
    bandera: "🇮🇹",
    nombre: "Italia",
    hubs: [
      { iata: "FCO", ciudad: "Roma" },
      { iata: "MXP", ciudad: "Milán" },
      { iata: "VCE", ciudad: "Venecia" },
    ],
    tieneDetector: false,
  },
  DE: {
    bandera: "🇩🇪",
    nombre: "Alemania",
    hubs: [
      { iata: "FRA", ciudad: "Frankfurt" },
      { iata: "MUC", ciudad: "Múnich" },
      { iata: "BER", ciudad: "Berlín" },
    ],
    tieneDetector: false,
  },
  GB: {
    bandera: "🇬🇧",
    nombre: "Reino Unido",
    hubs: [
      { iata: "LHR", ciudad: "Londres (Heathrow)" },
      { iata: "LGW", ciudad: "Londres (Gatwick)" },
      { iata: "MAN", ciudad: "Mánchester" },
    ],
    tieneDetector: false,
  },
  PT: {
    bandera: "🇵🇹",
    nombre: "Portugal",
    hubs: [
      { iata: "LIS", ciudad: "Lisboa" },
      { iata: "OPO", ciudad: "Oporto" },
    ],
    tieneDetector: false,
  },
  NL: {
    bandera: "🇳🇱",
    nombre: "Países Bajos",
    hubs: [{ iata: "AMS", ciudad: "Ámsterdam" }],
    tieneDetector: false,
  },
  BE: {
    bandera: "🇧🇪",
    nombre: "Bélgica",
    hubs: [{ iata: "BRU", ciudad: "Bruselas" }],
    tieneDetector: false,
  },
  CH: {
    bandera: "🇨🇭",
    nombre: "Suiza",
    hubs: [
      { iata: "ZRH", ciudad: "Zúrich" },
      { iata: "GVA", ciudad: "Ginebra" },
    ],
    tieneDetector: false,
  },
  AT: {
    bandera: "🇦🇹",
    nombre: "Austria",
    hubs: [{ iata: "VIE", ciudad: "Viena" }],
    tieneDetector: false,
  },
  IE: {
    bandera: "🇮🇪",
    nombre: "Irlanda",
    hubs: [{ iata: "DUB", ciudad: "Dublín" }],
    tieneDetector: false,
  },
  SE: {
    bandera: "🇸🇪",
    nombre: "Suecia",
    hubs: [{ iata: "ARN", ciudad: "Estocolmo" }],
    tieneDetector: false,
  },
  NO: {
    bandera: "🇳🇴",
    nombre: "Noruega",
    hubs: [{ iata: "OSL", ciudad: "Oslo" }],
    tieneDetector: false,
  },
  DK: {
    bandera: "🇩🇰",
    nombre: "Dinamarca",
    hubs: [{ iata: "CPH", ciudad: "Copenhague" }],
    tieneDetector: false,
  },
  PL: {
    bandera: "🇵🇱",
    nombre: "Polonia",
    hubs: [{ iata: "WAW", ciudad: "Varsovia" }],
    tieneDetector: false,
  },
  CZ: {
    bandera: "🇨🇿",
    nombre: "República Checa",
    hubs: [{ iata: "PRG", ciudad: "Praga" }],
    tieneDetector: false,
  },
  GR: {
    bandera: "🇬🇷",
    nombre: "Grecia",
    hubs: [{ iata: "ATH", ciudad: "Atenas" }],
    tieneDetector: false,
  },
  TR: {
    bandera: "🇹🇷",
    nombre: "Turquía",
    hubs: [{ iata: "IST", ciudad: "Estambul" }],
    tieneDetector: false,
  },

  // ==== ASIA / OCEANÍA ====
  JP: {
    bandera: "🇯🇵",
    nombre: "Japón",
    hubs: [
      { iata: "NRT", ciudad: "Tokio (Narita)" },
      { iata: "HND", ciudad: "Tokio (Haneda)" },
      { iata: "KIX", ciudad: "Osaka" },
    ],
    tieneDetector: false,
  },
  CN: {
    bandera: "🇨🇳",
    nombre: "China",
    hubs: [
      { iata: "PEK", ciudad: "Pekín" },
      { iata: "PVG", ciudad: "Shanghái" },
      { iata: "CAN", ciudad: "Cantón" },
    ],
    tieneDetector: false,
  },
  KR: {
    bandera: "🇰🇷",
    nombre: "Corea del Sur",
    hubs: [{ iata: "ICN", ciudad: "Seúl (Incheon)" }],
    tieneDetector: false,
  },
  IN: {
    bandera: "🇮🇳",
    nombre: "India",
    hubs: [
      { iata: "DEL", ciudad: "Nueva Delhi" },
      { iata: "BOM", ciudad: "Bombay" },
    ],
    tieneDetector: false,
  },
  TH: {
    bandera: "🇹🇭",
    nombre: "Tailandia",
    hubs: [{ iata: "BKK", ciudad: "Bangkok" }],
    tieneDetector: false,
  },
  SG: {
    bandera: "🇸🇬",
    nombre: "Singapur",
    hubs: [{ iata: "SIN", ciudad: "Singapur" }],
    tieneDetector: false,
  },
  ID: {
    bandera: "🇮🇩",
    nombre: "Indonesia",
    hubs: [
      { iata: "CGK", ciudad: "Yakarta" },
      { iata: "DPS", ciudad: "Denpasar (Bali)" },
    ],
    tieneDetector: false,
  },
  MY: {
    bandera: "🇲🇾",
    nombre: "Malasia",
    hubs: [{ iata: "KUL", ciudad: "Kuala Lumpur" }],
    tieneDetector: false,
  },
  PH: {
    bandera: "🇵🇭",
    nombre: "Filipinas",
    hubs: [{ iata: "MNL", ciudad: "Manila" }],
    tieneDetector: false,
  },
  VN: {
    bandera: "🇻🇳",
    nombre: "Vietnam",
    hubs: [
      { iata: "SGN", ciudad: "Ho Chi Minh" },
      { iata: "HAN", ciudad: "Hanói" },
    ],
    tieneDetector: false,
  },
  AE: {
    bandera: "🇦🇪",
    nombre: "Emiratos Árabes",
    hubs: [
      { iata: "DXB", ciudad: "Dubái" },
      { iata: "AUH", ciudad: "Abu Dabi" },
    ],
    tieneDetector: false,
  },
  IL: {
    bandera: "🇮🇱",
    nombre: "Israel",
    hubs: [{ iata: "TLV", ciudad: "Tel Aviv" }],
    tieneDetector: false,
  },
  AU: {
    bandera: "🇦🇺",
    nombre: "Australia",
    hubs: [
      { iata: "SYD", ciudad: "Sídney" },
      { iata: "MEL", ciudad: "Melbourne" },
      { iata: "BNE", ciudad: "Brisbane" },
    ],
    tieneDetector: false,
  },
  NZ: {
    bandera: "🇳🇿",
    nombre: "Nueva Zelanda",
    hubs: [{ iata: "AKL", ciudad: "Auckland" }],
    tieneDetector: false,
  },

  // ==== ÁFRICA ====
  MA: {
    bandera: "🇲🇦",
    nombre: "Marruecos",
    hubs: [{ iata: "CMN", ciudad: "Casablanca" }],
    tieneDetector: false,
  },
  ZA: {
    bandera: "🇿🇦",
    nombre: "Sudáfrica",
    hubs: [
      { iata: "JNB", ciudad: "Johannesburgo" },
      { iata: "CPT", ciudad: "Ciudad del Cabo" },
    ],
    tieneDetector: false,
  },
  EG: {
    bandera: "🇪🇬",
    nombre: "Egipto",
    hubs: [{ iata: "CAI", ciudad: "El Cairo" }],
    tieneDetector: false,
  },
};

// Pais por defecto cuando no se puede detectar geolocalizacion.
export const PAIS_DEFAULT = "CO";

// Lista ordenada para el selector. Latam primero (mercado principal), luego
// Norte/Centro/Caribe, Europa, Asia/Oceanía y África.
export const PAISES_ORDEN = [
  // Latam
  "CO", "MX", "EC", "PE", "CL", "AR", "BR", "VE", "UY", "PY", "BO",
  // Norte y Centro / Caribe
  "US", "CA", "CR", "PA", "GT", "DO", "PR", "CU", "JM",
  // Europa
  "ES", "FR", "IT", "DE", "GB", "PT", "NL", "BE", "CH", "AT", "IE", "SE",
  "NO", "DK", "PL", "CZ", "GR", "TR",
  // Asia / Oceanía
  "JP", "CN", "KR", "IN", "TH", "SG", "ID", "MY", "PH", "VN", "AE", "IL",
  "AU", "NZ",
  // África
  "MA", "ZA", "EG",
];

export function paisValido(codigo) {
  return !!PAISES_ORIGEN[codigo];
}

export function hubsDe(codigo) {
  return PAISES_ORIGEN[codigo]?.hubs || PAISES_ORIGEN[PAIS_DEFAULT].hubs;
}

// Devuelve el nombre humano para un IATA dado (para chips tipo
// "💡 Desde Bogota ahorras..."). Si no se conoce, cae al IATA.
export function nombreDeIATA(iata) {
  for (const cod of Object.keys(PAISES_ORIGEN)) {
    const h = PAISES_ORIGEN[cod].hubs.find((x) => x.iata === iata);
    if (h) return h.ciudad;
  }
  return iata;
}
