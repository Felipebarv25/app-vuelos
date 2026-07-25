// Hitos garantizados por ciudad: landmarks que DEBEN aparecer en "Imperdibles"
// sin importar el scoring automático. Curados a mano para las ciudades más
// visitadas. Si el motor no los trae, se inyectan con prioridad forzada.
//
// Formato: { n: nombre (español), q: QID Wikidata, c: [lat, lon] }
// El QID permite matching exacto contra datos de Wikidata/precálculo;
// el nombre es fallback (case-insensitive).

const C = [
  // ── Europa ──────────────────────────────────────────────────────────
  { lat: 48.8566, lon: 2.3522, hitos: [ // París
    { n: "Torre Eiffel", q: "Q243", c: [48.8584, 2.2945] },
    { n: "Museo del Louvre", q: "Q19675", c: [48.8606, 2.3376] },
    { n: "Catedral de Notre-Dame", q: "Q2981", c: [48.853, 2.3499] },
    { n: "Arco de Triunfo", q: "Q170475", c: [48.8738, 2.295] },
    { n: "Basílica del Sacré-Cœur", q: "Q182676", c: [48.8867, 2.3431] },
  ]},
  { lat: 51.5074, lon: -0.1278, hitos: [ // Londres
    { n: "Torre de Londres", q: "Q62378", c: [51.5081, -0.0759] },
    { n: "Tower Bridge", q: "Q202497", c: [51.5055, -0.0754] },
    { n: "Palacio de Buckingham", q: "Q42182", c: [51.5014, -0.1419] },
    { n: "British Museum", q: "Q6373", c: [51.5194, -0.127] },
    { n: "Big Ben", q: "Q165863", c: [51.5007, -0.1246] },
  ]},
  { lat: 41.9028, lon: 12.4964, hitos: [ // Roma
    { n: "Coliseo", q: "Q10285", c: [41.8902, 12.4922] },
    { n: "Fontana de Trevi", q: "Q185030", c: [41.9009, 12.4833] },
    { n: "Panteón de Agripa", q: "Q18326", c: [41.8986, 12.4769] },
    { n: "Basílica de San Pedro", q: "Q12512", c: [41.9022, 12.4539] },
    { n: "Foro Romano", q: "Q69560", c: [41.8925, 12.4853] },
    { n: "Capilla Sixtina", q: "Q48473", c: [41.9029, 12.4545] },
  ]},
  { lat: 41.3851, lon: 2.1734, hitos: [ // Barcelona
    { n: "Sagrada Familia", q: "Q48958", c: [41.4036, 2.1744] },
    { n: "Parque Güell", q: "Q260826", c: [41.4145, 2.1527] },
    { n: "Casa Batlló", q: "Q617652", c: [41.3916, 2.165] },
    { n: "La Rambla", q: "Q211757", c: [41.3809, 2.1734] },
    { n: "Camp Nou", q: "Q160897", c: [41.3809, 2.1228] },
  ]},
  { lat: 40.4168, lon: -3.7038, hitos: [ // Madrid
    { n: "Museo del Prado", q: "Q160112", c: [40.4138, -3.6921] },
    { n: "Palacio Real de Madrid", q: "Q183082", c: [40.4179, -3.7143] },
    { n: "Puerta del Sol", q: "Q214082", c: [40.4169, -3.7035] },
    { n: "Parque del Retiro", q: "Q585063", c: [40.4153, -3.6845] },
  ]},
  { lat: 41.0082, lon: 28.9784, hitos: [ // Estambul
    { n: "Santa Sofía", q: "Q12506", c: [41.0086, 28.9802] },
    { n: "Mezquita Azul", q: "Q202042", c: [41.0054, 28.9768] },
    { n: "Gran Bazar", q: "Q468402", c: [41.0107, 28.968] },
    { n: "Palacio de Topkapi", q: "Q131013", c: [41.0115, 28.9833] },
  ]},
  { lat: 37.9838, lon: 23.7275, hitos: [ // Atenas
    { n: "Partenón", q: "Q10288", c: [37.9715, 23.7267] },
    { n: "Acrópolis de Atenas", q: "Q131013", c: [37.9715, 23.7257] },
    { n: "Templo de Zeus Olímpico", q: "Q213380", c: [37.9693, 23.7331] },
    { n: "Ágora antigua de Atenas", q: "Q131478", c: [37.9747, 23.7227] },
  ]},
  { lat: 52.52, lon: 13.405, hitos: [ // Berlín
    { n: "Puerta de Brandeburgo", q: "Q82425", c: [52.5163, 13.3777] },
    { n: "Reichstag", q: "Q151898", c: [52.5186, 13.3762] },
    { n: "Muro de Berlín", q: "Q5765", c: [52.5076, 13.3904] },
    { n: "Isla de los Museos", q: "Q130597", c: [52.5169, 13.4019] },
  ]},
  { lat: 52.3676, lon: 4.9041, hitos: [ // Ámsterdam
    { n: "Rijksmuseum", q: "Q190804", c: [52.36, 4.8852] },
    { n: "Casa de Ana Frank", q: "Q213527", c: [52.3752, 4.884] },
    { n: "Museo Van Gogh", q: "Q224124", c: [52.3584, 4.881] },
  ]},
  { lat: 50.0755, lon: 14.4378, hitos: [ // Praga
    { n: "Puente de Carlos", q: "Q235018", c: [50.0865, 14.4113] },
    { n: "Reloj Astronómico de Praga", q: "Q389974", c: [50.087, 14.4209] },
    { n: "Castillo de Praga", q: "Q193849", c: [50.0909, 14.4014] },
  ]},
  { lat: 48.2082, lon: 16.3738, hitos: [ // Viena
    { n: "Palacio de Schönbrunn", q: "Q127596", c: [48.1845, 16.3122] },
    { n: "Catedral de San Esteban", q: "Q187904", c: [48.2084, 16.3731] },
    { n: "Ópera Estatal de Viena", q: "Q316668", c: [48.2035, 16.3691] },
  ]},
  { lat: 38.7223, lon: -9.1393, hitos: [ // Lisboa
    { n: "Torre de Belém", q: "Q207821", c: [38.6916, -9.216] },
    { n: "Monasterio de los Jerónimos", q: "Q170596", c: [38.6979, -9.2068] },
    { n: "Castillo de San Jorge", q: "Q190752", c: [38.7139, -9.1337] },
  ]},
  { lat: 43.7696, lon: 11.2558, hitos: [ // Florencia
    { n: "Catedral de Santa María del Fiore", q: "Q188847", c: [43.7731, 11.2561] },
    { n: "Ponte Vecchio", q: "Q184277", c: [43.768, 11.2531] },
    { n: "Galería Uffizi", q: "Q51252", c: [43.7687, 11.2554] },
  ]},
  { lat: 45.4408, lon: 12.3155, hitos: [ // Venecia
    { n: "Plaza de San Marcos", q: "Q132534", c: [45.4341, 12.3388] },
    { n: "Puente de Rialto", q: "Q459043", c: [45.438, 12.3359] },
    { n: "Basílica de San Marcos", q: "Q13365", c: [45.4345, 12.3396] },
    { n: "Palacio Ducal", q: "Q186651", c: [45.4335, 12.3404] },
  ]},
  { lat: 55.7558, lon: 37.6173, hitos: [ // Moscú
    { n: "Plaza Roja", q: "Q41240", c: [55.7539, 37.6208] },
    { n: "Kremlin de Moscú", q: "Q133067", c: [55.752, 37.6175] },
    { n: "Catedral de San Basilio", q: "Q178547", c: [55.7525, 37.6231] },
  ]},

  // ── Asia ─────────────────────────────────────────────────────────────
  { lat: 35.6762, lon: 139.6503, hitos: [ // Tokio
    { n: "Templo Senso-ji", q: "Q248469", c: [35.7148, 139.7967] },
    { n: "Torre de Tokio", q: "Q175035", c: [35.6586, 139.7454] },
    { n: "Santuario Meiji", q: "Q220927", c: [35.6764, 139.6993] },
    { n: "Palacio Imperial de Tokio", q: "Q180271", c: [35.6852, 139.7528] },
  ]},
  { lat: 13.7563, lon: 100.5018, hitos: [ // Bangkok
    { n: "Gran Palacio de Bangkok", q: "Q592419", c: [13.75, 100.4914] },
    { n: "Wat Arun", q: "Q495218", c: [13.7437, 100.4888] },
    { n: "Wat Pho", q: "Q464880", c: [13.7465, 100.4929] },
  ]},
  { lat: 37.5665, lon: 126.978, hitos: [ // Seúl
    { n: "Palacio Gyeongbokgung", q: "Q201549", c: [37.5796, 126.977] },
    { n: "Torre Namsan", q: "Q486464", c: [37.5512, 126.9882] },
    { n: "Bukchon Hanok Village", q: "Q485243", c: [37.5826, 126.9849] },
  ]},
  { lat: 39.9042, lon: 116.4074, hitos: [ // Pekín
    { n: "Ciudad Prohibida", q: "Q19845", c: [39.9163, 116.3972] },
    { n: "Gran Muralla China", q: "Q12501", c: [40.4319, 116.5704] },
    { n: "Templo del Cielo", q: "Q191105", c: [39.8822, 116.4066] },
    { n: "Plaza de Tiananmén", q: "Q174814", c: [39.9055, 116.3976] },
  ]},
  { lat: 25.2048, lon: 55.2708, hitos: [ // Dubái
    { n: "Burj Khalifa", q: "Q211413", c: [25.1972, 55.2744] },
    { n: "Burj Al Arab", q: "Q205960", c: [25.1412, 55.1854] },
  ]},
  { lat: 1.3521, lon: 103.8198, hitos: [ // Singapur
    { n: "Marina Bay Sands", q: "Q1035322", c: [1.2834, 103.8607] },
    { n: "Gardens by the Bay", q: "Q3098825", c: [1.2816, 103.8636] },
    { n: "Merlion", q: "Q697803", c: [1.2868, 103.8545] },
  ]},
  { lat: 22.3193, lon: 114.1694, hitos: [ // Hong Kong
    { n: "Victoria Peak", q: "Q1094315", c: [22.2759, 114.1455] },
    { n: "Tian Tan Buddha", q: "Q697448", c: [22.254, 113.905] },
  ]},

  // ── Medio Oriente y África ──────────────────────────────────────────
  { lat: 30.0444, lon: 31.2357, hitos: [ // El Cairo
    { n: "Pirámides de Guiza", q: "Q37200", c: [29.9792, 31.1342] },
    { n: "Gran Esfinge de Guiza", q: "Q130958", c: [29.9753, 31.1376] },
    { n: "Museo Egipcio", q: "Q213949", c: [30.048, 31.2336] },
  ]},
  { lat: 31.6295, lon: -7.9811, hitos: [ // Marrakech
    { n: "Plaza Jemaa el-Fna", q: "Q380037", c: [31.6259, -7.989] },
    { n: "Jardín Majorelle", q: "Q1269972", c: [31.6416, -8.0032] },
    { n: "Palacio de la Bahía", q: "Q661653", c: [31.622, -7.9825] },
  ]},

  // ── América del Norte ───────────────────────────────────────────────
  { lat: 40.7128, lon: -74.006, hitos: [ // Nueva York
    { n: "Estatua de la Libertad", q: "Q9202", c: [40.6892, -74.0445] },
    { n: "Empire State Building", q: "Q9188", c: [40.7484, -73.9856] },
    { n: "Central Park", q: "Q160409", c: [40.7829, -73.9654] },
    { n: "Times Square", q: "Q186117", c: [40.758, -73.9855] },
    { n: "Puente de Brooklyn", q: "Q3449467", c: [40.7061, -73.9969] },
  ]},
  { lat: 37.7749, lon: -122.4194, hitos: [ // San Francisco
    { n: "Golden Gate Bridge", q: "Q44440", c: [37.8199, -122.4783] },
    { n: "Alcatraz", q: "Q131818", c: [37.8267, -122.4233] },
  ]},
  { lat: 34.0522, lon: -118.2437, hitos: [ // Los Ángeles
    { n: "Letrero de Hollywood", q: "Q180326", c: [34.1341, -118.3215] },
    { n: "Paseo de la Fama", q: "Q107925", c: [34.1017, -118.3269] },
    { n: "Observatorio Griffith", q: "Q1406621", c: [34.1184, -118.3004] },
  ]},
  { lat: 38.9072, lon: -77.0369, hitos: [ // Washington DC
    { n: "Lincoln Memorial", q: "Q213559", c: [38.8893, -77.0502] },
    { n: "Monumento a Washington", q: "Q178114", c: [38.8895, -77.0353] },
    { n: "Capitolio de Estados Unidos", q: "Q176483", c: [38.8899, -77.009] },
    { n: "Casa Blanca", q: "Q35525", c: [38.8977, -77.0365] },
  ]},
  { lat: 19.4326, lon: -99.1332, hitos: [ // Ciudad de México
    { n: "Ángel de la Independencia", q: "Q1329898", c: [19.4271, -99.1677] },
    { n: "Palacio de Bellas Artes", q: "Q1128065", c: [19.4352, -99.1413] },
    { n: "Zócalo", q: "Q216753", c: [19.4326, -99.1332] },
    { n: "Teotihuacán", q: "Q170528", c: [19.6925, -98.8438] },
  ]},
  { lat: 21.1619, lon: -86.8515, hitos: [ // Cancún
    { n: "Chichén Itzá", q: "Q17118", c: [20.6843, -88.5678] },
    { n: "Zona Hotelera de Cancún", q: null, c: [21.1301, -86.7509] },
  ]},

  // ── América del Sur ─────────────────────────────────────────────────
  { lat: 4.711, lon: -74.0721, hitos: [ // Bogotá
    { n: "Cerro de Monserrate", q: "Q2604340", c: [4.6057, -74.0557] },
    { n: "Museo del Oro", q: "Q540744", c: [4.6021, -74.0719] },
    { n: "Plaza de Bolívar", q: "Q2577741", c: [4.598, -74.0758] },
    { n: "La Candelaria", q: "Q1656898", c: [4.5964, -74.0733] },
  ]},
  { lat: 6.2442, lon: -75.5812, hitos: [ // Medellín
    { n: "Plaza Botero", q: "Q3521262", c: [6.2518, -75.5686] },
    { n: "Comuna 13", q: "Q5156735", c: [6.2469, -75.6129] },
    { n: "Parque Explora", q: "Q3365055", c: [6.2707, -75.5656] },
    { n: "Jardín Botánico de Medellín", q: "Q2587317", c: [6.2709, -75.5636] },
  ]},
  { lat: 10.391, lon: -75.4794, hitos: [ // Cartagena
    { n: "Castillo de San Felipe de Barajas", q: "Q3296456", c: [10.4225, -75.5395] },
    { n: "Ciudad Amurallada", q: null, c: [10.4236, -75.5506] },
    { n: "Torre del Reloj", q: null, c: [10.4229, -75.5497] },
  ]},
  { lat: -22.9068, lon: -43.1729, hitos: [ // Río de Janeiro
    { n: "Cristo Redentor", q: "Q79961", c: [-22.9519, -43.2105] },
    { n: "Pan de Azúcar", q: "Q206534", c: [-22.9492, -43.1545] },
    { n: "Copacabana", q: "Q392479", c: [-22.9711, -43.1823] },
  ]},
  { lat: -34.6037, lon: -58.3816, hitos: [ // Buenos Aires
    { n: "Obelisco de Buenos Aires", q: "Q1361667", c: [-34.6037, -58.3816] },
    { n: "Teatro Colón", q: "Q524408", c: [-34.6011, -58.3831] },
    { n: "Casa Rosada", q: "Q380848", c: [-34.6083, -58.3702] },
    { n: "La Boca", q: "Q1747703", c: [-34.6345, -58.3631] },
  ]},
  { lat: -12.0464, lon: -77.0428, hitos: [ // Lima
    { n: "Plaza Mayor de Lima", q: "Q3296287", c: [-12.0464, -77.0306] },
    { n: "Huaca Pucllana", q: "Q1579736", c: [-12.1106, -77.0339] },
    { n: "Museo Larco", q: "Q1751399", c: [-12.0725, -77.0713] },
  ]},
  { lat: -13.5319, lon: -71.9675, hitos: [ // Cusco
    { n: "Machu Picchu", q: "Q42284", c: [-13.1631, -72.545] },
    { n: "Sacsayhuamán", q: "Q584267", c: [-13.5094, -71.982] },
    { n: "Plaza de Armas del Cusco", q: null, c: [-13.516, -71.9785] },
  ]},

  // ── Oceanía ─────────────────────────────────────────────────────────
  { lat: -33.8688, lon: 151.2093, hitos: [ // Sídney
    { n: "Ópera de Sídney", q: "Q152052", c: [-33.8568, 151.2153] },
    { n: "Harbour Bridge", q: "Q381159", c: [-33.8523, 151.2108] },
  ]},
];

export function hitosParaCiudad(lat, lon) {
  let mejor = null;
  let md = Infinity;
  for (const c of C) {
    const d = Math.hypot(c.lat - lat, c.lon - lon);
    if (d < md) { md = d; mejor = c; }
  }
  return mejor && md < 0.25 ? mejor.hitos : null;
}

export function contarHitosEnLista(hitos, lugares) {
  if (!hitos || !hitos.length) return null;
  const qids = new Set();
  const nombres = new Set();
  for (const l of lugares) {
    if (l.wd) qids.add(l.wd);
    if (l.nombre) nombres.add(l.nombre.toLowerCase());
  }
  let incluidos = 0;
  for (const h of hitos) {
    if ((h.q && qids.has(h.q)) || nombres.has(h.n.toLowerCase())) incluidos++;
  }
  return { incluidos, total: hitos.length };
}
