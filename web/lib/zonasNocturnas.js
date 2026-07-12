// Zonas de rumba/ambiente CURADAS por ciudad (feedback 2026-07-11: "las
// discotecas que pones son muy regulares — lo popular en Medellin es
// Provenza, La 70, zona rosa de Buenos Aires, Manrique").
//
// OSM no sabe que es "la rumba real" — su scoring premia wikipedia/tags,
// no popularidad nocturna. Este catalogo es conocimiento local curado (como
// lib/musica.js) y se inyecta ARRIBA de los resultados de la categoria
// "bares" (que tambien es el modo Nocturno). Coordenadas = centro aproximado
// de la zona; el usuario llega a la zona y alli elige — asi funciona la
// rumba de verdad.
//
// Extensible: agregar ciudades/zonas aqui y listo (no toca logica).

const ZONAS = {
  "medellin": [
    { nombre: "Provenza", desc: "La zona más viva de El Poblado: bares, rooftops y restaurantes cuadra a cuadra.", coord: [6.2079, -75.5669] },
    { nombre: "Parque Lleras (Zona Rosa)", desc: "El clásico de la rumba paisa: discotecas y bares alrededor del parque.", coord: [6.2093, -75.5661] },
    { nombre: "La 70 (Estadio)", desc: "Rumba popular y crossover: la carrera 70 es fiesta de jueves a domingo.", coord: [6.2560, -75.5890] },
    { nombre: "Zona rosa de Buenos Aires", desc: "Ambiente de barrio con bares y salsa por la Avenida Ayacucho.", coord: [6.2409, -75.5537] },
    { nombre: "Manrique (La 45)", desc: "Tango, salsa y rumba tradicional en el corazón de Manrique.", coord: [6.2716, -75.5560] },
  ],
  "bogota": [
    { nombre: "Zona T (Zona Rosa)", desc: "El epicentro de la rumba bogotana: bares y discotecas peatonales.", coord: [4.6669, -74.0537] },
    { nombre: "Chapinero (Theatron y alrededores)", desc: "La zona más diversa: del club masivo al bar alternativo.", coord: [4.6486, -74.0628] },
    { nombre: "La Candelaria", desc: "Bares bohemios y música en vivo en el centro histórico.", coord: [4.5972, -74.0736] },
  ],
  "cali": [
    { nombre: "Menga", desc: "La milla de las discotecas: salsa y crossover hasta el amanecer.", coord: [3.4980, -76.5210] },
    { nombre: "Barrio Granada", desc: "Gastrobares y coctelería en la zona más chic de Cali.", coord: [3.4646, -76.5300] },
  ],
  "cartagena": [
    { nombre: "Getsemaní", desc: "La rumba bohemia: plaza de la Trinidad, salsa y bares de patio.", coord: [10.4213, -75.5473] },
    { nombre: "Centro amurallado", desc: "Rooftops y bares dentro de la ciudad vieja.", coord: [10.4236, -75.5503] },
  ],
  "ciudad de mexico": [
    { nombre: "Zona Rosa", desc: "Clubes y bares de todos los estilos alrededor de Reforma.", coord: [19.4260, -99.1620] },
    { nombre: "Condesa", desc: "Mezcalerías, terrazas y bares de barrio con onda.", coord: [19.4123, -99.1716] },
    { nombre: "Roma Norte", desc: "La escena más cool: speakeasies y cantinas renovadas.", coord: [19.4177, -99.1626] },
  ],
  "buenos aires": [
    { nombre: "Palermo Soho", desc: "Bares, cervecerías y boliches en la zona más viva de la ciudad.", coord: [-34.5889, -58.4300] },
    { nombre: "San Telmo", desc: "Tango, milongas y bares históricos.", coord: [-34.6210, -58.3720] },
  ],
  "lima": [
    { nombre: "Barranco", desc: "El barrio bohemio: peñas, bares y música en vivo.", coord: [-12.1493, -77.0217] },
    { nombre: "Miraflores (Calle de las Pizzas)", desc: "La zona clásica de bares para arrancar la noche.", coord: [-12.1216, -77.0301] },
  ],
  "madrid": [
    { nombre: "Malasaña", desc: "El barrio de la movida: bares indie y garitos hasta tarde.", coord: [40.4256, -3.7042] },
    { nombre: "La Latina", desc: "Tapas y cañas que se convierten en rumba al caer la noche.", coord: [40.4110, -3.7086] },
    { nombre: "Chueca", desc: "Ambiente diverso y terrazas llenas toda la semana.", coord: [40.4223, -3.6975] },
  ],
};

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

function distKm(a, b) {
  const dLat = (a[0] - b[0]) * 111;
  const dLon = (a[1] - b[1]) * 111 * Math.cos((a[0] * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLon * dLon);
}

// Zonas curadas a <=30 km del punto (independiente del nombre de la ciudad:
// funciona aunque el usuario busque "El Poblado" o un municipio vecino).
export function zonasCerca(lat, lon) {
  const out = [];
  for (const zonas of Object.values(ZONAS)) {
    for (const z of zonas) {
      if (distKm([lat, lon], z.coord) <= 30) out.push(z);
    }
  }
  return out;
}

// Convierte una zona al shape de "lugar" que usa toda la app (Itinerario,
// Mapa, DetalleLugar). Score alto para que queden ARRIBA de los bares OSM.
export function zonaComoLugar(z) {
  return {
    id: `zona/${norm(z.nombre).replace(/[^a-z0-9]+/g, "-")}`,
    nombre: z.nombre,
    nombres: {},
    wd: null,
    categoria: "Zona de rumba",
    coord: z.coord,
    notable: true,
    wiki: false,
    score: 100, // curado a mano > cualquier heuristica
    cocina: null,
    web: null,
    tel: null,
    precio: null,
    horario: null,
    minutos: 150,
    extracto: z.desc,
  };
}
