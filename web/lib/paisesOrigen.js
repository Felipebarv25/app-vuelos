// Catalogo de paises que el modal de Presupuesto soporta como ORIGEN.
// Para cada pais: bandera, nombre legible, y 1-3 hubs aereos con su IATA y
// nombre de ciudad. Si `tieneDetector === true`, el flujo usa precios reales
// del detector de vuelos (ofertas.json). Si es false, la UI advierte que los
// precios son estimados y el sistema puede caer a una busqueda en vivo via
// Travelpayouts (cuando el endpoint /api/vuelo-vivo lo soporte por origen).
//
// Phase 1 (hoy): la UI esta lista para los ~10 paises de mayor mercado para
// la app. Si tu pais no aparece en la lista, se cae a Colombia por defecto
// (es la base actual del detector).
//
// Phase 2 (futuro): agregar mas paises requiere o (a) extender el detector
// Python para escanear desde sus hubs, o (b) confiar en Travelpayouts live.
export const PAISES_ORIGEN = {
  CO: {
    bandera: "🇨🇴",
    nombre: "Colombia",
    hubs: [
      { iata: "BOG", ciudad: "Bogotá" },
      { iata: "MDE", ciudad: "Medellín" },
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
      { iata: "EZE", ciudad: "Buenos Aires" },
    ],
    tieneDetector: true,
  },
  BR: {
    bandera: "🇧🇷",
    nombre: "Brasil",
    hubs: [
      { iata: "GRU", ciudad: "São Paulo" },
      { iata: "GIG", ciudad: "Río de Janeiro" },
    ],
    tieneDetector: true,
  },
  ES: {
    bandera: "🇪🇸",
    nombre: "España",
    hubs: [
      { iata: "MAD", ciudad: "Madrid" },
      { iata: "BCN", ciudad: "Barcelona" },
    ],
    tieneDetector: true,
  },
  US: {
    bandera: "🇺🇸",
    nombre: "Estados Unidos",
    hubs: [
      { iata: "JFK", ciudad: "Nueva York" },
      { iata: "MIA", ciudad: "Miami" },
      { iata: "LAX", ciudad: "Los Ángeles" },
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
};

// Pais por defecto cuando no se puede detectar geolocalizacion.
export const PAIS_DEFAULT = "CO";

// Lista ordenada para el selector (Colombia primero como mercado principal,
// luego Latam y al final el resto). Mantiene la jerarquia del producto.
export const PAISES_ORDEN = ["CO", "MX", "EC", "PE", "CL", "AR", "BR", "VE", "ES", "US"];

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
