// Datos enriquecidos por destino para las landing pages /destino/<slug>.
// Lo que rankea bien en Google: contenido único + largo + responde preguntas.
// Aquí ponemos descripción extendida, mejor época, idioma/moneda, dato curioso
// y FAQs. Las ciudades sin entrada usan una plantilla genérica por región.
//
// 2026-06-14: Refactor a multi-idioma para SEO global con hreflang.
// - DATOS_POR_LANG[lang] tiene las traducciones por destino.
// - datosSeoDe(d, lang) y faqsDe(d, lang) devuelven la version localizada.
// - lang default = "es" (mercado principal).

// Temporada por BANDA CLIMATICA, no por continente.
//
// Esto era TEMPORADA_REGION, con una entrada por continente, y el resultado
// era grave: "sudamerica" decia evitar "diciembre a febrero (verano austral,
// alta temporada en Argentina/Chile)" y eso se le pintaba a los 31 destinos
// tropicales del continente. En Cartagena diciembre-febrero es justo la
// temporada SECA, la mejor epoca del ano. Lo mismo en Bogota, Medellin, Cali,
// Santa Marta, San Andres o Cusco.
//
// El continente no dice nada del clima: Cartagena (10 N) y Ushuaia (55 S)
// estaban en el mismo cajon. Lo que manda es la latitud, asi que las bandas
// son cuatro y salen de `lat`, que todos los destinos ya traen:
//
//   |lat| <= 23.5 y lat >= 0  -> tropical_norte  (46 destinos)
//   |lat| <= 23.5 y lat <  0  -> tropical_sur    (24)
//   lat >  23.5               -> norte           (114)
//   lat < -23.5               -> sur             (23)
//
// En el tropico no hay cuatro estaciones: lo que se evita es la temporada de
// lluvias, y esa se invierte con el hemisferio. Por eso tropical_norte y
// tropical_sur dicen cosas opuestas y las dos son correctas.
//
// TODO ESTO ES ORIENTATIVO y se dice asi en la interfaz. Una banda de
// latitud no captura microclimas: la costa de Peru va al reves que el resto
// de su banda (garua de mayo a noviembre, sol de diciembre a abril), y por
// eso PE esta en TEMPORADA_PAIS, que pisa la banda. Ese es el sitio para
// afinar un pais concreto sin volver a atarlo al continente.
const TEMPORADA_BANDA = {
  es: {
    tropical_norte: { mejor: "diciembre a abril (temporada seca)", evitar: "mayo a noviembre (lluvias)" },
    tropical_norte_caribe: { mejor: "diciembre a abril (temporada seca)", evitar: "mayo a noviembre (lluvias; huracanes en el Caribe de junio a noviembre)" },
    tropical_sur: { mejor: "mayo a septiembre (temporada seca)", evitar: "diciembre a marzo (lluvias y calor humedo)" },
    norte: { mejor: "abril a junio y septiembre a octubre", evitar: "junio a agosto (alta temporada, todo mas caro)" },
    sur: { mejor: "marzo a mayo y septiembre a noviembre", evitar: "diciembre a febrero (verano austral, alta temporada)" },
  },
  en: {
    tropical_norte: { mejor: "December to April (dry season)", evitar: "May to November (rains)" },
    tropical_norte_caribe: { mejor: "December to April (dry season)", evitar: "May to November (rains; Caribbean hurricane season June to November)" },
    tropical_sur: { mejor: "May to September (dry season)", evitar: "December to March (rains and humid heat)" },
    norte: { mejor: "April to June and September to October", evitar: "June to August (high season, everything is more expensive)" },
    sur: { mejor: "March to May and September to November", evitar: "December to February (austral summer, high season)" },
  },
  pt: {
    tropical_norte: { mejor: "dezembro a abril (estacao seca)", evitar: "maio a novembro (chuvas)" },
    tropical_norte_caribe: { mejor: "dezembro a abril (estacao seca)", evitar: "maio a novembro (chuvas; furacoes no Caribe de junho a novembro)" },
    tropical_sur: { mejor: "maio a setembro (estacao seca)", evitar: "dezembro a marco (chuvas e calor umido)" },
    norte: { mejor: "abril a junho e setembro a outubro", evitar: "junho a agosto (alta temporada, tudo mais caro)" },
    sur: { mejor: "marco a maio e setembro a novembro", evitar: "dezembro a fevereiro (verao austral, alta temporada)" },
  },
  fr: {
    tropical_norte: { mejor: "de decembre a avril (saison seche)", evitar: "de mai a novembre (pluies)" },
    tropical_norte_caribe: { mejor: "de decembre a avril (saison seche)", evitar: "de mai a novembre (pluies ; ouragans aux Caraibes de juin a novembre)" },
    tropical_sur: { mejor: "de mai a septembre (saison seche)", evitar: "de decembre a mars (pluies et chaleur humide)" },
    norte: { mejor: "d'avril a juin et de septembre a octobre", evitar: "de juin a aout (haute saison, tout est plus cher)" },
    sur: { mejor: "de mars a mai et de septembre a novembre", evitar: "de decembre a fevrier (ete austral, haute saison)" },
  },
};

// Destinos cuyo clima NO sigue el de su banda. Pisa a TEMPORADA_BANDA.
//
// Va por SLUG y no por pais: el primer intento fue por pais y metia a Cusco
// —que esta a 3.400 m en la sierra, con su temporada seca de mayo a
// septiembre— en el consejo de la costa, que dice justo lo contrario. Un pais
// puede tener dos climas opuestos; un destino, no.
//
// Se anaden solo con motivo escrito: esto no es un cajon de sastre.
const TEMPORADA_DESTINO = {
  // La costa peruana va al reves que su banda: la garua cubre Lima de mayo a
  // noviembre y el sol sale de diciembre a abril, justo cuando el resto del
  // tropico sur esta en lluvias. Aplica a la costa, no a la sierra ni a la
  // selva.
  "lima-peru": {
    es: { mejor: "diciembre a abril (sol en la costa)", evitar: "mayo a noviembre (garua y cielo gris casi permanente)" },
    en: { mejor: "December to April (sunny on the coast)", evitar: "May to November (near-permanent coastal fog and grey skies)" },
    pt: { mejor: "dezembro a abril (sol no litoral)", evitar: "maio a novembro (neblina e ceu cinza quase permanente)" },
    fr: { mejor: "de decembre a avril (soleil sur la cote)", evitar: "de mai a novembre (crachin et ciel gris quasi permanent)" },
  },
};
// Paracas y Trujillo son la misma costa desertica que Lima.
TEMPORADA_DESTINO["paracas-peru"] = TEMPORADA_DESTINO["lima-peru"];
TEMPORADA_DESTINO["trujillo-peru"] = TEMPORADA_DESTINO["lima-peru"];

/**
 * Banda climatica de un destino a partir de su latitud.
 *
 * La region solo entra para una cosa: la temporada de huracanes es del
 * Atlantico/Caribe, y meterla en la banda tropical global hacia que Bangkok
 * avisara de huracanes caribenos.
 */
function bandaClima(lat, region) {
  if (lat == null || Number.isNaN(Number(lat))) return "norte";
  const l = Number(lat);
  if (Math.abs(l) <= 23.5) {
    if (l < 0) return "tropical_sur";
    return region === "sudamerica" || region === "norteamerica"
      ? "tropical_norte_caribe"
      : "tropical_norte";
  }
  return l > 0 ? "norte" : "sur";
}


// Datos específicos por idioma. La estructura es la misma; cuando agregues una
// nueva traduccion (PT, FR) solo copia el bloque y traduce los campos textuales.
const DATOS_POR_LANG = {
  es: {
    "madrid-espana": {
      intro: "Madrid es la capital y corazón cultural de España: museos de nivel mundial, palacios, vida nocturna intensa y una gastronomía donde las tapas son religión. Es además uno de los hubs aéreos más conectados con Colombia, con vuelos directos desde Bogotá.",
      idioma: "Español",
      moneda: "Euro (EUR)",
      dato: "El Museo del Prado tiene una de las colecciones de pintura europea más importantes del mundo (Velázquez, Goya, El Bosco).",
      platos: ["Cocido madrileño", "Bocadillo de calamares", "Churros con chocolate", "Tortilla española"],
    },
    "barcelona-espana": {
      intro: "Barcelona combina playas, arquitectura modernista de Gaudí (Sagrada Familia, Park Güell), barrios históricos como el Gótico y una vida nocturna inagotable. Es una de las ciudades más visitadas de Europa.",
      idioma: "Español y catalán",
      moneda: "Euro (EUR)",
      dato: "La Sagrada Familia lleva en construcción desde 1882 y se estima que estará terminada en 2026.",
      platos: ["Paella", "Pan con tomate", "Crema catalana", "Bombas"],
    },
    "paris-francia": {
      intro: "París es sinónimo de romance, arte y elegancia: la Torre Eiffel, el Louvre, los Campos Elíseos, Montmartre y la gastronomía más influyente del mundo. Una visita obligada en la vida.",
      idioma: "Francés (el inglés se entiende en zonas turísticas)",
      moneda: "Euro (EUR)",
      dato: "El Louvre es el museo más visitado del mundo con casi 10 millones de visitantes al año.",
      platos: ["Croissants", "Escargots", "Crème brûlée", "Macarons", "Steak frites"],
    },
    "roma-italia": {
      intro: "Roma es un museo al aire libre: el Coliseo, el Vaticano, el Foro Romano, las fuentes barrocas. Cada esquina tiene 2.000 años de historia y la comida es de las mejores del mundo.",
      idioma: "Italiano",
      moneda: "Euro (EUR)",
      dato: "La Ciudad del Vaticano dentro de Roma es el país más pequeño del mundo (0,49 km²).",
      platos: ["Cacio e pepe", "Carbonara", "Pizza romana", "Saltimbocca", "Tiramisú"],
    },
    "londres-reino-unido": {
      intro: "Londres es una de las ciudades más cosmopolitas del planeta: el Big Ben, el British Museum, Camden, los pubs históricos y los musicales del West End. Multicultural, moderna y con historia milenaria al mismo tiempo.",
      idioma: "Inglés",
      moneda: "Libra esterlina (GBP)",
      dato: "El metro de Londres ('the Tube') es el más antiguo del mundo, abrió en 1863.",
      platos: ["Fish and chips", "Sunday roast", "Pie and mash", "Afternoon tea"],
    },
    "tokio-japon": {
      intro: "Tokio es el contraste perfecto entre tradición y futuro: templos centenarios al lado de rascacielos, cruces caóticos como Shibuya, izakayas escondidas y el mejor sushi del mundo.",
      idioma: "Japonés (poco inglés)",
      moneda: "Yen japonés (JPY)",
      dato: "El cruce de Shibuya es el más transitado del mundo: hasta 3.000 personas cruzan en cada cambio de semáforo.",
      platos: ["Sushi", "Ramen", "Tempura", "Wagyu", "Takoyaki"],
    },
    "bali-indonesia": {
      intro: "Bali es paraíso tropical accesible: playas para surfear, templos hindúes, terrazas de arroz en Ubud, una espiritualidad que se siente en el aire y precios muy bajos. Excelente para mochileros y luna de miel.",
      idioma: "Indonesio (inglés común en zonas turísticas)",
      moneda: "Rupia indonesia (IDR)",
      dato: "Bali es de mayoría hindú aunque está en Indonesia (que es de mayoría musulmana).",
      platos: ["Nasi goreng", "Babi guling", "Sate", "Gado-gado"],
    },
    "bangkok-tailandia": {
      intro: "Bangkok es el portal a Asia para viajeros con presupuesto: templos dorados, mercados flotantes, comida callejera fenomenal y vida nocturna 24/7. Conexión clave para Vietnam, Camboya y las islas tailandesas.",
      idioma: "Tailandés (inglés en turismo)",
      moneda: "Baht tailandés (THB)",
      dato: "Bangkok es la ciudad más visitada del mundo por turistas internacionales según Mastercard.",
      platos: ["Pad thai", "Tom yum", "Massaman curry", "Som tam", "Mango sticky rice"],
    },
    "nueva-york-estados-unidos": {
      intro: "Nueva York es la ciudad que nunca duerme: Times Square, Central Park, los musicales de Broadway, los rascacielos icónicos. La capital cultural y financiera de Estados Unidos.",
      idioma: "Inglés",
      moneda: "Dólar estadounidense (USD)",
      dato: "El metro de Nueva York funciona 24/7, uno de los pocos del mundo que no cierra de noche.",
      platos: ["NY pizza slice", "Bagels", "Cheesecake", "Pastrami sandwich"],
    },
    "ciudad-de-mexico-mexico": {
      intro: "CDMX es una megaurbe vibrante: ruinas aztecas en el centro, los murales de Diego Rivera, mercados, mezcalerías de barrio y una de las gastronomías más reconocidas por la UNESCO. Hub de conexión barato para casi toda Latinoamérica.",
      idioma: "Español",
      moneda: "Peso mexicano (MXN)",
      dato: "CDMX está construida sobre un lago: por eso se hunde cerca de 40 cm al año en algunas zonas.",
      platos: ["Tacos al pastor", "Tlayuda", "Mole", "Chiles en nogada", "Pozole"],
    },
    "lima-peru": {
      intro: "Lima es la capital gastronómica de Sudamérica: 3 restaurantes en el top 50 mundial. Mezcla mar y desierto, con barrios bohemios como Barranco y vista al Pacífico desde Miraflores.",
      idioma: "Español",
      moneda: "Sol peruano (PEN)",
      dato: "Lima es la única capital del mundo con un río que cruza un desierto y termina en el Pacífico.",
      platos: ["Ceviche", "Lomo saltado", "Anticuchos", "Ají de gallina", "Causa limeña"],
    },
    "cusco-peru": {
      intro: "Cusco fue capital del imperio inca y es la puerta a Machu Picchu. Sus calles empedradas, las ruinas de Sacsayhuamán y el Valle Sagrado hacen un viaje inolvidable. Altitud: 3.400m.",
      idioma: "Español y quechua",
      moneda: "Sol peruano (PEN)",
      dato: "Sacsayhuamán tiene piedras de hasta 200 toneladas encajadas sin mortero y nadie sabe cómo lo hicieron.",
      platos: ["Cuy", "Alpaca a la parrilla", "Chicha morada", "Choclo con queso"],
    },
    "buenos-aires-argentina": {
      intro: "Buenos Aires es la capital del tango, la carne y el fútbol. Barrios con personalidad propia (Palermo, San Telmo, La Boca), librerías icónicas y la vida nocturna más larga de Sudamérica.",
      idioma: "Español",
      moneda: "Peso argentino (ARS)",
      dato: "El Obelisco fue construido en solo 31 días en 1936 para celebrar los 400 años de la ciudad.",
      platos: ["Asado", "Empanadas", "Milanesa napolitana", "Choripán", "Dulce de leche"],
    },
    "rio-de-janeiro-brasil": {
      intro: "Río es naturaleza y fiesta: el Cristo Redentor, el Pan de Azúcar, Copacabana, Ipanema, samba y el carnaval más famoso del mundo. La ciudad maravillosa.",
      idioma: "Portugués",
      moneda: "Real brasileño (BRL)",
      dato: "El Cristo Redentor mide 38m (incluyendo el pedestal) y fue inaugurado en 1931.",
      platos: ["Feijoada", "Coxinha", "Açaí", "Brigadeiro", "Picanha"],
    },
    "estambul-turquia": {
      intro: "Estambul es la única ciudad que está en dos continentes: Europa y Asia separados por el Bósforo. Hagia Sophia, la Mezquita Azul, el Gran Bazar y mil años de imperio bizantino y otomano.",
      idioma: "Turco (inglés en turismo)",
      moneda: "Lira turca (TRY)",
      dato: "El Gran Bazar de Estambul tiene 4.000 tiendas y es uno de los mercados cubiertos más antiguos del mundo (1455).",
      platos: ["Kebab", "Baklava", "Köfte", "Lahmacun", "Turkish delight"],
    },
    "amsterdam-paises-bajos": {
      intro: "Ámsterdam es canales, bicicletas, museos clase mundial (Van Gogh, Rijksmuseum) y la casa de Ana Frank. Una ciudad compacta, liberal y perfecta para recorrer en 3-4 días.",
      idioma: "Neerlandés (inglés universal)",
      moneda: "Euro (EUR)",
      dato: "Hay más bicicletas que habitantes en Ámsterdam (881.000 bicis vs 821.000 personas).",
      platos: ["Stroopwafels", "Bitterballen", "Herring", "Patatas con mayonesa", "Pannenkoeken"],
    },
    "lisboa-portugal": {
      intro: "Lisboa es luz, azulejos, tranvías amarillos y miradores con vista al Tajo. Más barata que el resto de Europa occidental, con una vida nocturna sin igual en Bairro Alto.",
      idioma: "Portugués",
      moneda: "Euro (EUR)",
      dato: "Lisboa es la segunda capital más antigua de Europa, solo Atenas es más antigua.",
      platos: ["Pastel de nata", "Bacalhau", "Bifana", "Caldo verde", "Polvo à lagareiro"],
    },
    "praga-chequia": {
      intro: "Praga es un cuento de hadas en piedra: el reloj astronómico, el Puente de Carlos, el castillo más grande del mundo y cerveza al mejor precio de Europa.",
      idioma: "Checo (inglés en zonas turísticas)",
      moneda: "Corona checa (CZK)",
      dato: "Los checos son los mayores consumidores de cerveza per cápita del mundo: 188L por persona al año.",
      platos: ["Goulash", "Knedlíky", "Svíčková", "Trdelník", "Pilsner"],
    },
    "miami-estados-unidos": {
      intro: "Miami es Latinoamérica con poder adquisitivo gringo: playas de South Beach, vida nocturna en Wynwood, compras en Aventura y el portal a Cuba/Bahamas. Hub de conexión barato y directo desde gran parte del continente.",
      idioma: "Inglés y español",
      moneda: "Dólar estadounidense (USD)",
      dato: "Miami es la única gran ciudad de EE.UU. donde más del 70% de la población habla español en casa.",
      platos: ["Cuban sandwich", "Stone crab", "Pastelitos", "Key lime pie"],
    },
    "cartagena-colombia": {
      intro: "Cartagena es la joya colonial del Caribe colombiano: murallas, balcones floridos, playas a 20 minutos en lancha y atardeceres en Café del Mar. Imperdible si vienes de visita o si quieres vacacionar dentro del país.",
      idioma: "Español",
      moneda: "Peso colombiano (COP)",
      dato: "Las murallas de Cartagena fueron declaradas Patrimonio de la Humanidad por la UNESCO en 1984.",
      platos: ["Arepa de huevo", "Ceviche de camarón", "Arroz con coco", "Patacones"],
    },
  },
  en: {
    "madrid-espana": {
      intro: "Madrid is Spain's capital and cultural heart: world-class museums, royal palaces, intense nightlife and a food scene where tapas are religion. It's also one of the best-connected hubs to Latin America, with direct flights from Colombia.",
      idioma: "Spanish",
      moneda: "Euro (EUR)",
      dato: "The Prado Museum has one of the most important European painting collections in the world (Velázquez, Goya, Bosch).",
      platos: ["Cocido madrileño", "Calamari sandwich", "Churros with chocolate", "Spanish omelette"],
    },
    "barcelona-espana": {
      intro: "Barcelona combines beaches, Gaudí's modernist architecture (Sagrada Familia, Park Güell), historic neighborhoods like the Gothic Quarter and an endless nightlife. It's one of Europe's most visited cities.",
      idioma: "Spanish and Catalan",
      moneda: "Euro (EUR)",
      dato: "The Sagrada Familia has been under construction since 1882 and is expected to be completed in 2026.",
      platos: ["Paella", "Pan con tomate", "Catalan cream", "Bombas"],
    },
    "paris-francia": {
      intro: "Paris is synonymous with romance, art and elegance: the Eiffel Tower, the Louvre, the Champs-Élysées, Montmartre and the most influential cuisine in the world. A must-visit in a lifetime.",
      idioma: "French (English understood in tourist areas)",
      moneda: "Euro (EUR)",
      dato: "The Louvre is the most visited museum in the world with nearly 10 million visitors per year.",
      platos: ["Croissants", "Escargots", "Crème brûlée", "Macarons", "Steak frites"],
    },
    "roma-italia": {
      intro: "Rome is an open-air museum: the Colosseum, Vatican City, the Roman Forum, the baroque fountains. Every corner holds 2,000 years of history and the food is among the world's best.",
      idioma: "Italian",
      moneda: "Euro (EUR)",
      dato: "Vatican City inside Rome is the smallest country in the world (0.49 km²).",
      platos: ["Cacio e pepe", "Carbonara", "Roman pizza", "Saltimbocca", "Tiramisu"],
    },
    "londres-reino-unido": {
      intro: "London is one of the planet's most cosmopolitan cities: Big Ben, the British Museum, Camden, historic pubs and the West End musicals. Multicultural, modern and with thousand-year history at the same time.",
      idioma: "English",
      moneda: "Pound sterling (GBP)",
      dato: "The London Underground ('the Tube') is the oldest in the world, opened in 1863.",
      platos: ["Fish and chips", "Sunday roast", "Pie and mash", "Afternoon tea"],
    },
    "tokio-japon": {
      intro: "Tokyo is the perfect contrast between tradition and future: centuries-old temples next to skyscrapers, chaotic crossings like Shibuya, hidden izakayas and the best sushi in the world.",
      idioma: "Japanese (limited English)",
      moneda: "Japanese yen (JPY)",
      dato: "Shibuya crossing is the busiest in the world: up to 3,000 people cross at every light change.",
      platos: ["Sushi", "Ramen", "Tempura", "Wagyu", "Takoyaki"],
    },
    "bali-indonesia": {
      intro: "Bali is accessible tropical paradise: surf beaches, Hindu temples, rice terraces in Ubud, a spirituality you can feel in the air and very low prices. Excellent for backpackers and honeymoons.",
      idioma: "Indonesian (English common in tourist areas)",
      moneda: "Indonesian rupiah (IDR)",
      dato: "Bali is majority Hindu even though Indonesia is mostly Muslim.",
      platos: ["Nasi goreng", "Babi guling", "Sate", "Gado-gado"],
    },
    "bangkok-tailandia": {
      intro: "Bangkok is the gateway to Asia for budget travelers: golden temples, floating markets, phenomenal street food and 24/7 nightlife. Key connection to Vietnam, Cambodia and the Thai islands.",
      idioma: "Thai (English in tourism)",
      moneda: "Thai baht (THB)",
      dato: "Bangkok is the most visited city in the world by international tourists according to Mastercard.",
      platos: ["Pad thai", "Tom yum", "Massaman curry", "Som tam", "Mango sticky rice"],
    },
    "nueva-york-estados-unidos": {
      intro: "New York is the city that never sleeps: Times Square, Central Park, Broadway musicals, iconic skyscrapers. The cultural and financial capital of the United States.",
      idioma: "English",
      moneda: "US dollar (USD)",
      dato: "The New York subway runs 24/7, one of the few in the world that doesn't close at night.",
      platos: ["NY pizza slice", "Bagels", "Cheesecake", "Pastrami sandwich"],
    },
    "ciudad-de-mexico-mexico": {
      intro: "Mexico City is a vibrant megacity: Aztec ruins downtown, Diego Rivera murals, markets, neighborhood mezcalerías and one of UNESCO's most recognized cuisines. Very cheap flights from Latin America.",
      idioma: "Spanish",
      moneda: "Mexican peso (MXN)",
      dato: "Mexico City is built on top of a lake: that's why it sinks about 40 cm per year in some areas.",
      platos: ["Tacos al pastor", "Tlayuda", "Mole", "Chiles en nogada", "Pozole"],
    },
    "lima-peru": {
      intro: "Lima is South America's gastronomic capital: 3 restaurants in the world's top 50. It mixes sea and desert, with bohemian neighborhoods like Barranco and Pacific views from Miraflores.",
      idioma: "Spanish",
      moneda: "Peruvian sol (PEN)",
      dato: "Lima is the only world capital with a river that crosses a desert and ends in the Pacific.",
      platos: ["Ceviche", "Lomo saltado", "Anticuchos", "Ají de gallina", "Causa limeña"],
    },
    "cusco-peru": {
      intro: "Cusco was the capital of the Inca Empire and is the gateway to Machu Picchu. Its cobblestone streets, Sacsayhuamán ruins and Sacred Valley make for an unforgettable trip. Altitude: 3,400m.",
      idioma: "Spanish and Quechua",
      moneda: "Peruvian sol (PEN)",
      dato: "Sacsayhuamán has stones up to 200 tons fitted without mortar and nobody knows how they did it.",
      platos: ["Cuy (guinea pig)", "Grilled alpaca", "Chicha morada", "Choclo with cheese"],
    },
    "buenos-aires-argentina": {
      intro: "Buenos Aires is the capital of tango, steak and football. Neighborhoods with unique character (Palermo, San Telmo, La Boca), iconic bookstores and South America's longest nightlife.",
      idioma: "Spanish",
      moneda: "Argentine peso (ARS)",
      dato: "The Obelisk was built in just 31 days in 1936 to celebrate the city's 400 years.",
      platos: ["Asado", "Empanadas", "Milanesa napolitana", "Choripán", "Dulce de leche"],
    },
    "rio-de-janeiro-brasil": {
      intro: "Rio is nature and party: Christ the Redeemer, Sugarloaf Mountain, Copacabana, Ipanema, samba and the world's most famous carnival. The marvelous city.",
      idioma: "Portuguese",
      moneda: "Brazilian real (BRL)",
      dato: "Christ the Redeemer is 38m tall (including the pedestal) and was inaugurated in 1931.",
      platos: ["Feijoada", "Coxinha", "Açaí", "Brigadeiro", "Picanha"],
    },
    "estambul-turquia": {
      intro: "Istanbul is the only city straddling two continents: Europe and Asia separated by the Bosphorus. Hagia Sophia, the Blue Mosque, the Grand Bazaar and a thousand years of Byzantine and Ottoman empires.",
      idioma: "Turkish (English in tourism)",
      moneda: "Turkish lira (TRY)",
      dato: "Istanbul's Grand Bazaar has 4,000 shops and is one of the oldest covered markets in the world (1455).",
      platos: ["Kebab", "Baklava", "Köfte", "Lahmacun", "Turkish delight"],
    },
    "amsterdam-paises-bajos": {
      intro: "Amsterdam is canals, bicycles, world-class museums (Van Gogh, Rijksmuseum) and Anne Frank's house. A compact, liberal city perfect for a 3-4 day trip.",
      idioma: "Dutch (English everywhere)",
      moneda: "Euro (EUR)",
      dato: "There are more bicycles than residents in Amsterdam (881,000 bikes vs 821,000 people).",
      platos: ["Stroopwafels", "Bitterballen", "Herring", "Fries with mayo", "Pannenkoeken"],
    },
    "lisboa-portugal": {
      intro: "Lisbon is light, tiles, yellow trams and viewpoints over the Tagus. Cheaper than the rest of Western Europe, with unmatched nightlife in Bairro Alto.",
      idioma: "Portuguese",
      moneda: "Euro (EUR)",
      dato: "Lisbon is the second oldest capital in Europe, only Athens is older.",
      platos: ["Pastel de nata", "Bacalhau", "Bifana", "Caldo verde", "Polvo à lagareiro"],
    },
    "praga-chequia": {
      intro: "Prague is a fairytale in stone: the astronomical clock, Charles Bridge, the largest castle in the world and the best-priced beer in Europe.",
      idioma: "Czech (English in tourist areas)",
      moneda: "Czech koruna (CZK)",
      dato: "Czechs are the world's biggest beer consumers per capita: 188L per person per year.",
      platos: ["Goulash", "Knedlíky", "Svíčková", "Trdelník", "Pilsner"],
    },
    "miami-estados-unidos": {
      intro: "Miami is Latin America with US purchasing power: South Beach, Wynwood nightlife, shopping in Aventura and the gateway to Cuba and the Bahamas. Cheap direct flights from Latin America.",
      idioma: "English and Spanish",
      moneda: "US dollar (USD)",
      dato: "Miami is the only major US city where over 70% of the population speaks Spanish at home.",
      platos: ["Cuban sandwich", "Stone crab", "Pastelitos", "Key lime pie"],
    },
    "cartagena-colombia": {
      intro: "Cartagena is the colonial jewel of the Colombian Caribbean: stone walls, balconies full of flowers, beaches 20 minutes away by boat and sunsets at Café del Mar. A must-see in South America.",
      idioma: "Spanish",
      moneda: "Colombian peso (COP)",
      dato: "Cartagena's walls were declared a UNESCO World Heritage Site in 1984.",
      platos: ["Arepa de huevo", "Shrimp ceviche", "Coconut rice", "Patacones"],
    },
  },
  pt: {
    "madrid-espana": {
      intro: "Madri é a capital e coração cultural da Espanha: museus de classe mundial, palácios, vida noturna intensa e uma gastronomia onde as tapas são religião. É também um dos hubs aéreos mais conectados com a América Latina, com voos diretos.",
      idioma: "Espanhol",
      moneda: "Euro (EUR)",
      dato: "O Museu do Prado tem uma das mais importantes coleções de pintura europeia do mundo (Velázquez, Goya, Bosco).",
      platos: ["Cozido madrilenho", "Sanduíche de lula", "Churros com chocolate", "Tortilha espanhola"],
    },
    "barcelona-espana": {
      intro: "Barcelona combina praias, arquitetura modernista de Gaudí (Sagrada Família, Park Güell), bairros históricos como o Gótico e uma vida noturna inesgotável. Uma das cidades mais visitadas da Europa.",
      idioma: "Espanhol e catalão",
      moneda: "Euro (EUR)",
      dato: "A Sagrada Família está em construção desde 1882 e a previsão é terminar em 2026.",
      platos: ["Paella", "Pão com tomate", "Crema catalana", "Bombas"],
    },
    "paris-francia": {
      intro: "Paris é sinônimo de romance, arte e elegância: Torre Eiffel, Louvre, Champs-Élysées, Montmartre e a gastronomia mais influente do mundo. Visita obrigatória na vida.",
      idioma: "Francês (inglês nas zonas turísticas)",
      moneda: "Euro (EUR)",
      dato: "O Louvre é o museu mais visitado do mundo, com quase 10 milhões de visitantes por ano.",
      platos: ["Croissants", "Escargots", "Crème brûlée", "Macarons", "Steak frites"],
    },
    "roma-italia": {
      intro: "Roma é um museu a céu aberto: Coliseu, Vaticano, Fórum Romano, fontes barrocas. Cada esquina tem 2.000 anos de história e a comida está entre as melhores do mundo.",
      idioma: "Italiano",
      moneda: "Euro (EUR)",
      dato: "A Cidade do Vaticano dentro de Roma é o menor país do mundo (0,49 km²).",
      platos: ["Cacio e pepe", "Carbonara", "Pizza romana", "Saltimbocca", "Tiramisù"],
    },
    "londres-reino-unido": {
      intro: "Londres é uma das cidades mais cosmopolitas do planeta: Big Ben, British Museum, Camden, pubs históricos e os musicais do West End. Multicultural, moderna e com história milenar.",
      idioma: "Inglês",
      moneda: "Libra esterlina (GBP)",
      dato: "O metrô de Londres ('the Tube') é o mais antigo do mundo, aberto em 1863.",
      platos: ["Fish and chips", "Sunday roast", "Pie and mash", "Afternoon tea"],
    },
    "tokio-japon": {
      intro: "Tóquio é o contraste perfeito entre tradição e futuro: templos centenários ao lado de arranha-céus, cruzamentos caóticos como Shibuya, izakayas escondidas e o melhor sushi do mundo.",
      idioma: "Japonês (pouco inglês)",
      moneda: "Iene japonês (JPY)",
      dato: "O cruzamento de Shibuya é o mais movimentado do mundo: até 3.000 pessoas atravessam a cada semáforo.",
      platos: ["Sushi", "Ramen", "Tempura", "Wagyu", "Takoyaki"],
    },
    "bali-indonesia": {
      intro: "Bali é paraíso tropical acessível: praias para surfar, templos hindus, terraços de arroz em Ubud, espiritualidade que se sente no ar e preços muito baixos. Excelente para mochileiros e lua de mel.",
      idioma: "Indonésio (inglês comum em áreas turísticas)",
      moneda: "Rupia indonésia (IDR)",
      dato: "Bali é majoritariamente hindu, mesmo a Indonésia sendo um país de maioria muçulmana.",
      platos: ["Nasi goreng", "Babi guling", "Sate", "Gado-gado"],
    },
    "bangkok-tailandia": {
      intro: "Bangkok é o portal para a Ásia para viajantes com orçamento: templos dourados, mercados flutuantes, comida de rua fenomenal e vida noturna 24/7. Conexão chave para Vietnã, Camboja e ilhas tailandesas.",
      idioma: "Tailandês (inglês no turismo)",
      moneda: "Baht tailandês (THB)",
      dato: "Bangkok é a cidade mais visitada do mundo por turistas internacionais segundo a Mastercard.",
      platos: ["Pad thai", "Tom yum", "Massaman curry", "Som tam", "Mango sticky rice"],
    },
    "nueva-york-estados-unidos": {
      intro: "Nova York é a cidade que nunca dorme: Times Square, Central Park, musicais da Broadway, arranha-céus icônicos. A capital cultural e financeira dos EUA.",
      idioma: "Inglês",
      moneda: "Dólar americano (USD)",
      dato: "O metrô de NY funciona 24/7, um dos poucos do mundo que não fecha à noite.",
      platos: ["NY pizza slice", "Bagels", "Cheesecake", "Pastrami sandwich"],
    },
    "ciudad-de-mexico-mexico": {
      intro: "CDMX é uma megacidade vibrante: ruínas astecas no centro, murais de Diego Rivera, mercados, mezcalerias de bairro e uma das gastronomias mais reconhecidas pela UNESCO. Voos muito baratos.",
      idioma: "Espanhol",
      moneda: "Peso mexicano (MXN)",
      dato: "CDMX foi construída sobre um lago: por isso afunda cerca de 40 cm/ano em algumas áreas.",
      platos: ["Tacos al pastor", "Tlayuda", "Mole", "Chiles en nogada", "Pozole"],
    },
    "lima-peru": {
      intro: "Lima é a capital gastronômica da América do Sul: 3 restaurantes no top 50 mundial. Mistura mar e deserto, com bairros boêmios como Barranco e vista do Pacífico desde Miraflores.",
      idioma: "Espanhol",
      moneda: "Sol peruano (PEN)",
      dato: "Lima é a única capital do mundo com um rio que cruza um deserto e desemboca no Pacífico.",
      platos: ["Ceviche", "Lomo saltado", "Anticuchos", "Ají de gallina", "Causa limeña"],
    },
    "cusco-peru": {
      intro: "Cusco foi capital do Império Inca e é a porta para Machu Picchu. Ruas de pedra, ruínas de Sacsayhuamán e o Vale Sagrado fazem uma viagem inesquecível. Altitude: 3.400 m.",
      idioma: "Espanhol e quéchua",
      moneda: "Sol peruano (PEN)",
      dato: "Sacsayhuamán tem pedras de até 200 toneladas encaixadas sem argamassa, e ninguém sabe como fizeram.",
      platos: ["Cuy (porquinho da Índia)", "Alpaca grelhada", "Chicha morada", "Choclo com queijo"],
    },
    "buenos-aires-argentina": {
      intro: "Buenos Aires é a capital do tango, da carne e do futebol. Bairros com personalidade própria (Palermo, San Telmo, La Boca), livrarias icônicas e a vida noturna mais longa da América do Sul.",
      idioma: "Espanhol",
      moneda: "Peso argentino (ARS)",
      dato: "O Obelisco foi construído em apenas 31 dias em 1936 para celebrar os 400 anos da cidade.",
      platos: ["Asado", "Empanadas", "Milanesa napolitana", "Choripán", "Doce de leite"],
    },
    "rio-de-janeiro-brasil": {
      intro: "Rio é natureza e festa: Cristo Redentor, Pão de Açúcar, Copacabana, Ipanema, samba e o carnaval mais famoso do mundo. A cidade maravilhosa.",
      idioma: "Português",
      moneda: "Real brasileiro (BRL)",
      dato: "O Cristo Redentor mede 38 m (incluindo o pedestal) e foi inaugurado em 1931.",
      platos: ["Feijoada", "Coxinha", "Açaí", "Brigadeiro", "Picanha"],
    },
    "estambul-turquia": {
      intro: "Istambul é a única cidade em dois continentes: Europa e Ásia separadas pelo Bósforo. Hagia Sophia, Mesquita Azul, Grande Bazar e mil anos de impérios bizantino e otomano.",
      idioma: "Turco (inglês no turismo)",
      moneda: "Lira turca (TRY)",
      dato: "O Grande Bazar de Istambul tem 4.000 lojas e é um dos mercados cobertos mais antigos do mundo (1455).",
      platos: ["Kebab", "Baklava", "Köfte", "Lahmacun", "Turkish delight"],
    },
    "amsterdam-paises-bajos": {
      intro: "Amsterdã é canais, bicicletas, museus de classe mundial (Van Gogh, Rijksmuseum) e a casa de Anne Frank. Cidade compacta, liberal e perfeita para 3-4 dias.",
      idioma: "Holandês (inglês universal)",
      moneda: "Euro (EUR)",
      dato: "Há mais bicicletas que habitantes em Amsterdã (881.000 bikes vs 821.000 pessoas).",
      platos: ["Stroopwafels", "Bitterballen", "Arenque", "Batatas com maionese", "Pannenkoeken"],
    },
    "lisboa-portugal": {
      intro: "Lisboa é luz, azulejos, bondes amarelos e mirantes com vista para o Tejo. Mais barata que o resto da Europa ocidental, com vida noturna sem igual no Bairro Alto.",
      idioma: "Português",
      moneda: "Euro (EUR)",
      dato: "Lisboa é a segunda capital mais antiga da Europa, apenas Atenas é mais velha.",
      platos: ["Pastel de nata", "Bacalhau", "Bifana", "Caldo verde", "Polvo à lagareiro"],
    },
    "praga-chequia": {
      intro: "Praga é um conto de fadas em pedra: o relógio astronômico, a Ponte Carlos, o maior castelo do mundo e cerveja ao melhor preço da Europa.",
      idioma: "Tcheco (inglês nas áreas turísticas)",
      moneda: "Coroa tcheca (CZK)",
      dato: "Os tchecos são os maiores consumidores de cerveja per capita do mundo: 188 L por pessoa ao ano.",
      platos: ["Goulash", "Knedlíky", "Svíčková", "Trdelník", "Pilsner"],
    },
    "miami-estados-unidos": {
      intro: "Miami é América Latina com poder de compra americano: praias de South Beach, vida noturna em Wynwood, compras em Aventura e portal para Cuba/Bahamas. Voos diretos baratos da América Latina.",
      idioma: "Inglês e espanhol",
      moneda: "Dólar americano (USD)",
      dato: "Miami é a única grande cidade dos EUA onde mais de 70% da população fala espanhol em casa.",
      platos: ["Cuban sandwich", "Stone crab", "Pastelitos", "Key lime pie"],
    },
    "cartagena-colombia": {
      intro: "Cartagena é a joia colonial do Caribe colombiano: muralhas, varandas floridas, praias a 20 minutos de barco e pôr do sol no Café del Mar. Imperdível na América do Sul.",
      idioma: "Espanhol",
      moneda: "Peso colombiano (COP)",
      dato: "As muralhas de Cartagena foram declaradas Patrimônio da Humanidade pela UNESCO em 1984.",
      platos: ["Arepa de huevo", "Ceviche de camarão", "Arroz com coco", "Patacones"],
    },
  },
  fr: {
    "madrid-espana": {
      intro: "Madrid est la capitale et le cœur culturel de l'Espagne : musées de classe mondiale, palais royaux, vie nocturne intense et une gastronomie où les tapas sont une religion. C'est aussi l'un des hubs les mieux connectés à l'Amérique latine, avec des vols directs.",
      idioma: "Espagnol",
      moneda: "Euro (EUR)",
      dato: "Le Musée du Prado abrite l'une des plus importantes collections de peinture européenne au monde (Velázquez, Goya, Bosch).",
      platos: ["Cocido madrilène", "Sandwich aux calamars", "Churros au chocolat", "Tortilla espagnole"],
    },
    "barcelona-espana": {
      intro: "Barcelone combine plages, architecture moderniste de Gaudí (Sagrada Família, Park Güell), quartiers historiques comme le Gothique et une vie nocturne sans fin. L'une des villes les plus visitées d'Europe.",
      idioma: "Espagnol et catalan",
      moneda: "Euro (EUR)",
      dato: "La Sagrada Família est en construction depuis 1882 et devrait être achevée en 2026.",
      platos: ["Paella", "Pain à la tomate", "Crème catalane", "Bombas"],
    },
    "paris-francia": {
      intro: "Paris est synonyme de romance, d'art et d'élégance : la tour Eiffel, le Louvre, les Champs-Élysées, Montmartre et la cuisine la plus influente au monde. Une visite incontournable dans une vie.",
      idioma: "Français (l'anglais se comprend dans les zones touristiques)",
      moneda: "Euro (EUR)",
      dato: "Le Louvre est le musée le plus visité au monde avec près de 10 millions de visiteurs par an.",
      platos: ["Croissants", "Escargots", "Crème brûlée", "Macarons", "Steak frites"],
    },
    "roma-italia": {
      intro: "Rome est un musée à ciel ouvert : le Colisée, le Vatican, le Forum romain, les fontaines baroques. Chaque coin de rue compte 2 000 ans d'histoire et la cuisine compte parmi les meilleures au monde.",
      idioma: "Italien",
      moneda: "Euro (EUR)",
      dato: "La Cité du Vatican à Rome est le plus petit pays au monde (0,49 km²).",
      platos: ["Cacio e pepe", "Carbonara", "Pizza romaine", "Saltimbocca", "Tiramisu"],
    },
    "londres-reino-unido": {
      intro: "Londres est l'une des villes les plus cosmopolites de la planète : Big Ben, British Museum, Camden, pubs historiques et comédies musicales du West End. Multiculturelle, moderne et avec une histoire millénaire.",
      idioma: "Anglais",
      moneda: "Livre sterling (GBP)",
      dato: "Le métro de Londres ('the Tube') est le plus ancien au monde, ouvert en 1863.",
      platos: ["Fish and chips", "Sunday roast", "Pie and mash", "Afternoon tea"],
    },
    "tokio-japon": {
      intro: "Tokyo est le contraste parfait entre tradition et futur : temples centenaires aux côtés de gratte-ciels, carrefours chaotiques comme Shibuya, izakayas cachés et les meilleurs sushis du monde.",
      idioma: "Japonais (peu d'anglais)",
      moneda: "Yen japonais (JPY)",
      dato: "Le carrefour de Shibuya est le plus fréquenté du monde : jusqu'à 3 000 personnes traversent à chaque feu.",
      platos: ["Sushi", "Ramen", "Tempura", "Wagyu", "Takoyaki"],
    },
    "bali-indonesia": {
      intro: "Bali est un paradis tropical accessible : plages de surf, temples hindous, rizières en terrasse à Ubud, une spiritualité palpable et des prix très bas. Excellent pour les backpackers et les lunes de miel.",
      idioma: "Indonésien (anglais courant en zone touristique)",
      moneda: "Roupie indonésienne (IDR)",
      dato: "Bali est à majorité hindoue alors que l'Indonésie est à majorité musulmane.",
      platos: ["Nasi goreng", "Babi guling", "Sate", "Gado-gado"],
    },
    "bangkok-tailandia": {
      intro: "Bangkok est la porte d'entrée de l'Asie pour les voyageurs au budget serré : temples dorés, marchés flottants, street food phénoménale et vie nocturne 24/7. Connexion clé vers le Vietnam, le Cambodge et les îles thaïlandaises.",
      idioma: "Thaï (anglais dans le tourisme)",
      moneda: "Baht thaïlandais (THB)",
      dato: "Bangkok est la ville la plus visitée au monde par les touristes internationaux selon Mastercard.",
      platos: ["Pad thaï", "Tom yum", "Curry Massaman", "Som tam", "Mango sticky rice"],
    },
    "nueva-york-estados-unidos": {
      intro: "New York est la ville qui ne dort jamais : Times Square, Central Park, les comédies musicales de Broadway, les gratte-ciels iconiques. La capitale culturelle et financière des États-Unis.",
      idioma: "Anglais",
      moneda: "Dollar américain (USD)",
      dato: "Le métro de New York fonctionne 24/7, l'un des rares au monde à ne pas fermer la nuit.",
      platos: ["NY pizza slice", "Bagels", "Cheesecake", "Sandwich pastrami"],
    },
    "ciudad-de-mexico-mexico": {
      intro: "Mexico City est une mégalopole vibrante : ruines aztèques au centre, fresques de Diego Rivera, marchés, mezcalerías de quartier et une cuisine reconnue par l'UNESCO. Vols très bon marché.",
      idioma: "Espagnol",
      moneda: "Peso mexicain (MXN)",
      dato: "Mexico City est construite sur un lac : elle s'enfonce d'environ 40 cm par an à certains endroits.",
      platos: ["Tacos al pastor", "Tlayuda", "Mole", "Chiles en nogada", "Pozole"],
    },
    "lima-peru": {
      intro: "Lima est la capitale gastronomique de l'Amérique du Sud : 3 restaurants dans le top 50 mondial. Elle mêle mer et désert, avec des quartiers bohèmes comme Barranco et vue sur le Pacifique depuis Miraflores.",
      idioma: "Espagnol",
      moneda: "Sol péruvien (PEN)",
      dato: "Lima est la seule capitale au monde dont un fleuve traverse un désert et se jette dans le Pacifique.",
      platos: ["Ceviche", "Lomo saltado", "Anticuchos", "Ají de gallina", "Causa limeña"],
    },
    "cusco-peru": {
      intro: "Cusco fut la capitale de l'Empire inca et c'est la porte d'entrée vers le Machu Picchu. Ses rues pavées, les ruines de Sacsayhuamán et la Vallée Sacrée font un voyage inoubliable. Altitude : 3 400 m.",
      idioma: "Espagnol et quechua",
      moneda: "Sol péruvien (PEN)",
      dato: "Sacsayhuamán comporte des pierres jusqu'à 200 tonnes assemblées sans mortier, et personne ne sait comment.",
      platos: ["Cuy (cochon d'Inde)", "Alpaga grillé", "Chicha morada", "Choclo au fromage"],
    },
    "buenos-aires-argentina": {
      intro: "Buenos Aires est la capitale du tango, de la viande et du football. Quartiers à forte personnalité (Palermo, San Telmo, La Boca), librairies iconiques et la vie nocturne la plus longue d'Amérique du Sud.",
      idioma: "Espagnol",
      moneda: "Peso argentin (ARS)",
      dato: "L'Obélisque a été construit en seulement 31 jours en 1936 pour célébrer les 400 ans de la ville.",
      platos: ["Asado", "Empanadas", "Milanesa napolitaine", "Choripán", "Dulce de leche"],
    },
    "rio-de-janeiro-brasil": {
      intro: "Rio, c'est la nature et la fête : Christ Rédempteur, Pain de Sucre, Copacabana, Ipanema, samba et le carnaval le plus célèbre du monde. La ville merveilleuse.",
      idioma: "Portugais",
      moneda: "Real brésilien (BRL)",
      dato: "Le Christ Rédempteur mesure 38 m (avec le socle) et a été inauguré en 1931.",
      platos: ["Feijoada", "Coxinha", "Açaí", "Brigadeiro", "Picanha"],
    },
    "estambul-turquia": {
      intro: "Istanbul est la seule ville à cheval sur deux continents : Europe et Asie séparées par le Bosphore. Sainte-Sophie, la Mosquée bleue, le Grand Bazar et mille ans d'empires byzantin et ottoman.",
      idioma: "Turc (anglais dans le tourisme)",
      moneda: "Livre turque (TRY)",
      dato: "Le Grand Bazar d'Istanbul compte 4 000 boutiques et c'est l'un des marchés couverts les plus anciens au monde (1455).",
      platos: ["Kebab", "Baklava", "Köfte", "Lahmacun", "Turkish delight"],
    },
    "amsterdam-paises-bajos": {
      intro: "Amsterdam, ce sont les canaux, les vélos, les musées de classe mondiale (Van Gogh, Rijksmuseum) et la maison d'Anne Frank. Une ville compacte, libérale, parfaite pour 3-4 jours.",
      idioma: "Néerlandais (anglais universel)",
      moneda: "Euro (EUR)",
      dato: "Il y a plus de vélos que d'habitants à Amsterdam (881 000 vélos vs 821 000 personnes).",
      platos: ["Stroopwafels", "Bitterballen", "Hareng", "Frites mayo", "Pannenkoeken"],
    },
    "lisboa-portugal": {
      intro: "Lisbonne, c'est la lumière, les azulejos, les tramways jaunes et les belvédères sur le Tage. Moins chère que le reste de l'Europe occidentale, avec une vie nocturne sans égale au Bairro Alto.",
      idioma: "Portugais",
      moneda: "Euro (EUR)",
      dato: "Lisbonne est la deuxième capitale la plus ancienne d'Europe, seule Athènes est plus vieille.",
      platos: ["Pastel de nata", "Bacalhau", "Bifana", "Caldo verde", "Polvo à lagareiro"],
    },
    "praga-chequia": {
      intro: "Prague est un conte de fées en pierre : l'horloge astronomique, le pont Charles, le plus grand château au monde et la bière au meilleur prix d'Europe.",
      idioma: "Tchèque (anglais dans les zones touristiques)",
      moneda: "Couronne tchèque (CZK)",
      dato: "Les Tchèques sont les plus gros consommateurs de bière par habitant au monde : 188 L par personne et par an.",
      platos: ["Goulash", "Knedlíky", "Svíčková", "Trdelník", "Pilsner"],
    },
    "miami-estados-unidos": {
      intro: "Miami, c'est l'Amérique latine avec le pouvoir d'achat américain : plages de South Beach, vie nocturne à Wynwood, shopping à Aventura et porte d'entrée vers Cuba et les Bahamas. Vols directs bon marché.",
      idioma: "Anglais et espagnol",
      moneda: "Dollar américain (USD)",
      dato: "Miami est la seule grande ville des États-Unis où plus de 70 % de la population parle espagnol à la maison.",
      platos: ["Cuban sandwich", "Stone crab", "Pastelitos", "Key lime pie"],
    },
    "cartagena-colombia": {
      intro: "Carthagène est le joyau colonial des Caraïbes colombiennes : remparts en pierre, balcons fleuris, plages à 20 min en bateau et couchers de soleil au Café del Mar. Incontournable en Amérique du Sud.",
      idioma: "Espagnol",
      moneda: "Peso colombien (COP)",
      dato: "Les remparts de Carthagène ont été inscrits au Patrimoine mondial de l'UNESCO en 1984.",
      platos: ["Arepa de huevo", "Ceviche de crevettes", "Riz à la noix de coco", "Patacones"],
    },
  },
};

// Datos deterministas por país: idioma, moneda y platos típicos.
// Se usan como fallback en generico() para las ciudades sin entrada específica.
// El idioma/moneda es objetivo; los platos son los más representativos del país.
const DATOS_PAIS = {
  // Colombia
  "Colombia":       { idioma: "Español", moneda: "Peso colombiano (COP)", platos: ["Bandeja paisa", "Ajiaco", "Arepa", "Sancocho"] },
  // Sudamérica
  "Perú":           { idioma: "Español", moneda: "Sol peruano (PEN)", platos: ["Ceviche", "Lomo saltado", "Ají de gallina", "Anticuchos"] },
  "Ecuador":        { idioma: "Español", moneda: "Dólar estadounidense (USD)", platos: ["Encebollado", "Llapingachos", "Seco de pollo", "Ceviche de camarones"] },
  "Chile":          { idioma: "Español", moneda: "Peso chileno (CLP)", platos: ["Empanada de pino", "Chupe de mariscos", "Asado", "Completo"] },
  "Argentina":      { idioma: "Español", moneda: "Peso argentino (ARS)", platos: ["Asado", "Empanadas", "Milanesa napolitana", "Dulce de leche"] },
  "Brasil":         { idioma: "Portugués", moneda: "Real brasileño (BRL)", platos: ["Feijoada", "Churrasco", "Coxinha", "Brigadeiro"] },
  "Uruguay":        { idioma: "Español", moneda: "Peso uruguayo (UYU)", platos: ["Chivito", "Asado uruguayo", "Milanesa", "Medialunas"] },
  "Bolivia":        { idioma: "Español y lenguas indígenas", moneda: "Boliviano (BOB)", platos: ["Salteñas", "Silpancho", "Anticuchos", "Sopa de maní"] },
  "Paraguay":       { idioma: "Español y guaraní", moneda: "Guaraní paraguayo (PYG)", platos: ["Sopa paraguaya", "Chipa", "Mbejú", "Asado"] },
  // Norte y Centroamérica
  "México":         { idioma: "Español", moneda: "Peso mexicano (MXN)", platos: ["Tacos al pastor", "Enchiladas", "Mole", "Pozole"] },
  "Panamá":         { idioma: "Español", moneda: "Dólar estadounidense (USD)", platos: ["Sancocho panameño", "Arroz con pollo", "Ceviche", "Tamales"] },
  "Costa Rica":     { idioma: "Español", moneda: "Colón costarricense (CRC)", platos: ["Gallo pinto", "Casado", "Chifrijo", "Ceviche"] },
  "Estados Unidos": { idioma: "Inglés", moneda: "Dólar estadounidense (USD)", platos: ["Hamburguesa", "BBQ ribs", "Clam chowder", "Cheesecake"] },
  "Canadá":         { idioma: "Inglés y francés", moneda: "Dólar canadiense (CAD)", platos: ["Poutine", "Smoked meat", "Butter tart", "Nanaimo bar"] },
  "Cuba":           { idioma: "Español", moneda: "Peso cubano (CUP)", platos: ["Ropa vieja", "Arroz moros y cristianos", "Lechón asado", "Croquetas"] },
  "Guatemala":      { idioma: "Español", moneda: "Quetzal guatemalteco (GTQ)", platos: ["Pepián", "Jocon", "Kak'ik", "Tamales colorados"] },
  "República Dominicana": { idioma: "Español", moneda: "Peso dominicano (DOP)", platos: ["La bandera", "Mangú", "Sancocho", "Tostones"] },
  "Puerto Rico":    { idioma: "Español e inglés", moneda: "Dólar estadounidense (USD)", platos: ["Mofongo", "Arroz con gandules", "Lechón asado", "Alcapurria"] },
  "Jamaica":        { idioma: "Inglés y patois jamaicano", moneda: "Dólar jamaicano (JMD)", platos: ["Jerk chicken", "Ackee and saltfish", "Patty", "Festival"] },
  "Aruba":          { idioma: "Neerlandés y papiamento", moneda: "Florín arubeño (AWG)", platos: ["Keshi yena", "Pan bati", "Funchi", "Stoba"] },
  "Curazao":        { idioma: "Neerlandés y papiamento", moneda: "Florín antillano (ANG)", platos: ["Keshi yena", "Stoba di kabritu", "Funchi", "Sòpi di piska"] },
  // Europa
  "España":         { idioma: "Español", moneda: "Euro (EUR)", platos: ["Paella", "Jamón ibérico", "Tortilla española", "Gazpacho"] },
  "Portugal":       { idioma: "Portugués", moneda: "Euro (EUR)", platos: ["Bacalhau", "Pastel de nata", "Caldo verde", "Francesinha"] },
  "Francia":        { idioma: "Francés", moneda: "Euro (EUR)", platos: ["Croissant", "Crème brûlée", "Soupe à l'oignon", "Ratatouille"] },
  "Italia":         { idioma: "Italiano", moneda: "Euro (EUR)", platos: ["Pizza napolitana", "Pasta al ragú", "Risotto", "Tiramisú"] },
  "Reino Unido":    { idioma: "Inglés", moneda: "Libra esterlina (GBP)", platos: ["Fish and chips", "Sunday roast", "Pie and mash", "Afternoon tea"] },
  "Países Bajos":   { idioma: "Neerlandés (inglés universal)", moneda: "Euro (EUR)", platos: ["Stroopwafels", "Bitterballen", "Herring", "Stamppot"] },
  "Bélgica":        { idioma: "Francés y neerlandés", moneda: "Euro (EUR)", platos: ["Moules-frites", "Gaufres", "Chocolates belgas", "Carbonade flamande"] },
  "Alemania":       { idioma: "Alemán", moneda: "Euro (EUR)", platos: ["Bratwurst", "Schnitzel", "Currywurst", "Sauerkraut"] },
  "Austria":        { idioma: "Alemán", moneda: "Euro (EUR)", platos: ["Wiener Schnitzel", "Apfelstrudel", "Tafelspitz", "Sachertorte"] },
  "Chequia":        { idioma: "Checo (inglés en zonas turísticas)", moneda: "Corona checa (CZK)", platos: ["Goulash", "Knedlíky", "Svíčková", "Pilsner"] },
  "Hungría":        { idioma: "Húngaro", moneda: "Forinto húngaro (HUF)", platos: ["Goulash húngaro", "Lángos", "Halászlé", "Kürtőskalács"] },
  "Grecia":         { idioma: "Griego", moneda: "Euro (EUR)", platos: ["Moussaka", "Souvlaki", "Spanakopita", "Tzatziki"] },
  "Turquía":        { idioma: "Turco (inglés en turismo)", moneda: "Lira turca (TRY)", platos: ["Kebab", "Baklava", "Lahmacun", "Köfte"] },
  "Irlanda":        { idioma: "Inglés e irlandés", moneda: "Euro (EUR)", platos: ["Irish stew", "Boxty", "Coddle", "Soda bread"] },
  "Dinamarca":      { idioma: "Danés", moneda: "Corona danesa (DKK)", platos: ["Smørrebrød", "Frikadeller", "Æbleskiver", "Rugbrød"] },
  "Suecia":         { idioma: "Sueco", moneda: "Corona sueca (SEK)", platos: ["Köttbullar", "Gravlax", "Smörgåsbord", "Semla"] },
  "Suiza":          { idioma: "Alemán, francés e italiano", moneda: "Franco suizo (CHF)", platos: ["Fondue", "Raclette", "Rösti", "Zürcher Geschnetzeltes"] },
  "Polonia":        { idioma: "Polaco", moneda: "Esloti polaco (PLN)", platos: ["Pierogi", "Bigos", "Żurek", "Kielbasa"] },
  "Croacia":        { idioma: "Croata", moneda: "Euro (EUR)", platos: ["Peka", "Ćevapi", "Crni rižot", "Štrukli"] },
  "Eslovenia":      { idioma: "Esloveno", moneda: "Euro (EUR)", platos: ["Potica", "Štruklji", "Jota", "Kremna rezina"] },
  "Islandia":       { idioma: "Islandés (inglés muy extendido)", moneda: "Corona islandesa (ISK)", platos: ["Plokkfiskur", "Hangikjöt", "Pylsur", "Skyr"] },
  "Finlandia":      { idioma: "Finés y sueco", moneda: "Euro (EUR)", platos: ["Karjalanpiirakka", "Kalakukko", "Poronkäristys", "Korvapuusti"] },
  "Noruega":        { idioma: "Noruego", moneda: "Corona noruega (NOK)", platos: ["Brunost", "Fårikål", "Lutefisk", "Rakfisk"] },
  "Estonia":        { idioma: "Estonio", moneda: "Euro (EUR)", platos: ["Mulgikapsas", "Verivorst", "Kiluvõileib", "Kama"] },
  "Letonia":        { idioma: "Letón", moneda: "Euro (EUR)", platos: ["Pelēkie zirņi", "Pirāgi", "Sklandrausis", "Rupjmaize"] },
  // Asia
  "Japón":          { idioma: "Japonés (poco inglés)", moneda: "Yen japonés (JPY)", platos: ["Ramen", "Sushi", "Tempura", "Yakitori"] },
  "Corea del Sur":  { idioma: "Coreano", moneda: "Won surcoreano (KRW)", platos: ["Bibimbap", "Bulgogi", "Samgyeopsal", "Kimchi"] },
  "Tailandia":      { idioma: "Tailandés (inglés en turismo)", moneda: "Baht tailandés (THB)", platos: ["Pad thai", "Tom yum", "Massaman curry", "Som tam"] },
  "Indonesia":      { idioma: "Indonesio (inglés en zonas turísticas)", moneda: "Rupia indonesia (IDR)", platos: ["Nasi goreng", "Satay", "Gado-gado", "Rendang"] },
  "Singapur":       { idioma: "Inglés, malayo, chino y tamil", moneda: "Dólar de Singapur (SGD)", platos: ["Hainanese chicken rice", "Laksa", "Chili crab", "Char kway teow"] },
  "Emiratos Árabes":{ idioma: "Árabe (inglés muy extendido)", moneda: "Dírham emiratí (AED)", platos: ["Shawarma", "Hummus", "Harees", "Machboos"] },
  "China":          { idioma: "Mandarín", moneda: "Yuan chino (CNY)", platos: ["Dim sum", "Pato a la pekinesa", "Xiaolongbao", "Mapo tofu"] },
  "India":          { idioma: "Hindi e inglés", moneda: "Rupia india (INR)", platos: ["Biryani", "Butter chicken", "Samosa", "Dosa"] },
  "Vietnam":        { idioma: "Vietnamita (inglés en turismo)", moneda: "Dong vietnamita (VND)", platos: ["Phở", "Bánh mì", "Bún chả", "Gỏi cuốn"] },
  "Camboya":        { idioma: "Jemer (inglés en turismo)", moneda: "Riel camboyano (KHR)", platos: ["Amok", "Lok lak", "Nom banh chok", "Bai sach chrouk"] },
  "Malasia":        { idioma: "Malayo (inglés extendido)", moneda: "Ringgit malayo (MYR)", platos: ["Nasi lemak", "Roti canai", "Laksa", "Satay"] },
  "Filipinas":      { idioma: "Filipino e inglés", moneda: "Peso filipino (PHP)", platos: ["Adobo", "Sinigang", "Lechón", "Lumpia"] },
  "Taiwán":         { idioma: "Mandarín", moneda: "Dólar taiwanés (TWD)", platos: ["Beef noodle soup", "Bubble tea", "Gua bao", "Oyster omelette"] },
  "Nepal":          { idioma: "Nepalí (inglés en turismo)", moneda: "Rupia nepalí (NPR)", platos: ["Dal bhat", "Momo", "Chatamari", "Sel roti"] },
  "Sri Lanka":      { idioma: "Cingalés y tamil", moneda: "Rupia de Sri Lanka (LKR)", platos: ["Rice and curry", "Kottu roti", "Hoppers", "Pol sambol"] },
  "Israel":         { idioma: "Hebreo y árabe", moneda: "Nuevo séquel israelí (ILS)", platos: ["Falafel", "Shakshuka", "Hummus", "Sabich"] },
  "Jordania":       { idioma: "Árabe", moneda: "Dinar jordano (JOD)", platos: ["Mansaf", "Falafel", "Maqluba", "Kunafeh"] },
  "Catar":          { idioma: "Árabe (inglés extendido)", moneda: "Riyal catarí (QAR)", platos: ["Machboos", "Harees", "Luqaimat", "Balaleet"] },
  "Omán":           { idioma: "Árabe", moneda: "Rial omaní (OMR)", platos: ["Shuwa", "Harees", "Mashuai", "Halwa omaní"] },
  // África
  "Egipto":         { idioma: "Árabe", moneda: "Libra egipcia (EGP)", platos: ["Koshari", "Ful medames", "Taameya", "Molokhia"] },
  "Marruecos":      { idioma: "Árabe y francés", moneda: "Dírham marroquí (MAD)", platos: ["Tajín de cordero", "Cuscús", "Pastilla", "Harira"] },
  "Sudáfrica":      { idioma: "Inglés y otros 10 idiomas oficiales", moneda: "Rand sudafricano (ZAR)", platos: ["Braai", "Bobotie", "Boerewors", "Bunny chow"] },
  "Túnez":          { idioma: "Árabe y francés", moneda: "Dinar tunecino (TND)", platos: ["Couscous", "Brik", "Lablabi", "Ojja"] },
  "Kenia":          { idioma: "Suajili e inglés", moneda: "Chelín keniano (KES)", platos: ["Nyama choma", "Ugali", "Chapati", "Sukuma wiki"] },
  "Tanzania":       { idioma: "Suajili e inglés", moneda: "Chelín tanzano (TZS)", platos: ["Ugali", "Nyama choma", "Pilau", "Chipsi mayai"] },
  // Oceanía
  "Australia":      { idioma: "Inglés", moneda: "Dólar australiano (AUD)", platos: ["Meat pie", "Barramundi", "Tim Tams", "Vegemite toast"] },
  "Nueva Zelanda":  { idioma: "Inglés y māori", moneda: "Dólar neozelandés (NZD)", platos: ["Hāngi", "Pavlova", "Whitebait fritters", "Lamb rack"] },
};

// Plantilla genérica por región para destinos sin datos específicos.
// Usa DATOS_PAIS para idioma, moneda y platos (deterministas por país);
// solo el intro y la mejorEpoca se generan a partir de la región.
function generico(d, lang) {
  const pais = DATOS_PAIS[d.pais] || {};
  if (lang === "en") {
    const regionEn = d.region === "sudamerica" ? "South America"
      : d.region === "norteamerica" ? "North & Central America"
      : d.region === "europa" ? "Europe"
      : d.region === "asia" ? "Asia"
      : d.region === "africa" ? "Africa"
      : "Oceania";
    return {
      intro:
        `A fascinating destination in ${regionEn}. ${d.ciudad} combines culture, ` +
        `cuisine and unique experiences. Round-trip flights cost approximately ` +
        `US$${d.vuelo} from major hubs, and a mid-range daily budget is around ` +
        `US$${d.dia} per person (lodging, food, transport and activities).`,
      idioma: pais.idioma || "Check local language",
      moneda: pais.moneda || "Check local currency",
      dato: null,
      platos: pais.platos || [],
    };
  }
  if (lang === "pt") {
    const regionPt = d.region === "sudamerica" ? "América do Sul"
      : d.region === "norteamerica" ? "América do Norte e Central"
      : d.region === "europa" ? "Europa"
      : d.region === "asia" ? "Ásia"
      : d.region === "africa" ? "África"
      : "Oceania";
    return {
      intro:
        `Um destino fascinante na ${regionPt}. ${d.ciudad} combina cultura, ` +
        `gastronomia e experiências únicas. Voos ida e volta custam cerca de ` +
        `US$${d.vuelo} desde os principais hubs, e o orçamento diário para um turista ` +
        `de médio porte gira em torno de US$${d.dia} por pessoa (hospedagem, comida, ` +
        `transporte e atividades).`,
      idioma: pais.idioma || "Consulte o idioma local",
      moneda: pais.moneda || "Consulte a moeda local",
      dato: null,
      platos: pais.platos || [],
    };
  }
  if (lang === "fr") {
    const regionFr = d.region === "sudamerica" ? "Amérique du Sud"
      : d.region === "norteamerica" ? "Amérique du Nord et centrale"
      : d.region === "europa" ? "Europe"
      : d.region === "asia" ? "Asie"
      : d.region === "africa" ? "Afrique"
      : "Océanie";
    return {
      intro:
        `Une destination fascinante en ${regionFr}. ${d.ciudad} combine culture, ` +
        `gastronomie et expériences uniques. Les vols A/R coûtent environ ` +
        `US$${d.vuelo} depuis les principaux hubs, et le budget quotidien pour un voyageur ` +
        `de gamme moyenne tourne autour de US$${d.dia} par personne (hébergement, ` +
        `nourriture, transport et activités).`,
      idioma: pais.idioma || "Vérifiez la langue locale",
      moneda: pais.moneda || "Vérifiez la monnaie locale",
      dato: null,
      platos: pais.platos || [],
    };
  }
  const region = d.region === "sudamerica" ? "Sudamérica"
    : d.region === "norteamerica" ? "Norte y Centroamérica"
    : d.region === "europa" ? "Europa"
    : d.region === "asia" ? "Asia"
    : d.region === "africa" ? "África"
    : "Oceanía";
  return {
    intro:
      `Un destino fascinante en ${region}. ${d.ciudad} combina cultura, gastronomía y ` +
      `experiencias únicas. El vuelo i/v ronda los US$${d.vuelo} (referencial; varía según ` +
      `tu aeropuerto de origen y la temporada), y el presupuesto diario para un turista de ` +
      `gama media es de US$${d.dia} por persona (hospedaje, comida, transporte y actividades).`,
    idioma: pais.idioma || "Consulta el idioma local",
    moneda: pais.moneda || "Consulta la moneda local",
    dato: null,
    platos: pais.platos || [],
  };
}

// Devuelve los datos SEO de un destino en el idioma pedido. Por defecto ES
// (mantiene compatibilidad con el codigo viejo que no pasaba lang).
export function datosSeoDe(d, lang = "es") {
  if (!d) return null;
  const langOk = DATOS_POR_LANG[lang] ? lang : "es";
  const base = DATOS_POR_LANG[langOk][d.slug] || generico(d, langOk);
  // Tres capas, gana la mas especifica: lo curado a mano para ESTE destino,
  // luego la excepcion de su pais, y por ultimo su banda climatica. Antes
  // solo existia la ultima y encima iba por continente.
  const propio = TEMPORADA_DESTINO[d.slug];
  const temp =
    (propio && (propio[langOk] || propio.es)) ||
    (TEMPORADA_BANDA[langOk] || TEMPORADA_BANDA.es)[bandaClima(d.lat, d.region)] ||
    {};
  const fallbackEpoca = {
    es: "todo el año",
    en: "year-round",
    pt: "o ano todo",
    fr: "toute l'année",
  }[langOk] || "todo el año";
  return {
    ...base,
    mejorEpoca: base.mejorEpoca || temp.mejor || fallbackEpoca,
    // `base.evitarEpoca` faltaba en esta linea mientras que `mejorEpoca` si
    // lo miraba: una entrada curada podia fijar su mejor epoca pero no la que
    // hay que evitar, y se le colaba la de la plantilla.
    evitarEpoca: base.evitarEpoca || temp.evitar || null,
  };
}

// FAQs genéricas que responden búsquedas frecuentes en Google.
// "¿Cuánto cuesta...?" y "¿Cuándo viajar...?" son palabras clave de oro.
export function faqsDe(d, lang = "es") {
  const presupSemana = d.vuelo + d.dia * 7;
  const presupDosSem = d.vuelo + d.dia * 14;
  const datos = datosSeoDe(d, lang);

  if (lang === "en") {
    return [
      {
        q: `How much does a trip to ${d.ciudad} cost?`,
        a: `A week in ${d.ciudad} costs about US$${presupSemana} per person (US$${d.vuelo} round-trip flight + US$${d.dia * 7} for stay). Two weeks rise to US$${presupDosSem}. These are guideline values for a mid-range traveler; with Anduve you can see the live flight price.`,
      },
      {
        q: `When is the best time to visit ${d.ciudad}?`,
        a: `The best season to visit ${d.ciudad} is ${datos.mejorEpoca}. ${datos.evitarEpoca ? `It is advisable to avoid ${datos.evitarEpoca}.` : ""}`.trim(),
      },
      {
        q: `How many days are recommended to visit ${d.ciudad}?`,
        a: `To explore ${d.ciudad} without rushing, we recommend between 5 and 10 days. The main sights can be seen in 4-5 days; with 7-10 you can include nearby excursions. With Anduve you build a day-by-day itinerary based on your time available.`,
      },
    ];
  }

  if (lang === "pt") {
    return [
      {
        q: `Quanto custa uma viagem para ${d.ciudad}?`,
        a: `Uma semana em ${d.ciudad} custa aproximadamente US$${presupSemana} por pessoa (US$${d.vuelo} de voo ida e volta + US$${d.dia * 7} de estadia). Duas semanas sobem para US$${presupDosSem}. Valores orientativos para um turista de médio porte; com o Anduve você vê o preço ao vivo.`,
      },
      {
        q: `Quando é a melhor época para visitar ${d.ciudad}?`,
        a: `A melhor temporada para ${d.ciudad} é ${datos.mejorEpoca}. ${datos.evitarEpoca ? `É recomendável evitar ${datos.evitarEpoca}.` : ""}`.trim(),
      },
      {
        q: `Quantos dias são recomendados para visitar ${d.ciudad}?`,
        a: `Para conhecer ${d.ciudad} sem correria, recomendamos entre 5 e 10 dias. Os principais pontos podem ser vistos em 4-5 dias; com 7-10 dias você inclui excursões próximas. Com o Anduve você monta um roteiro dia a dia.`,
      },
    ];
  }

  if (lang === "fr") {
    return [
      {
        q: `Combien coûte un voyage à ${d.ciudad} ?`,
        a: `Une semaine à ${d.ciudad} coûte environ US$${presupSemana} par personne (US$${d.vuelo} de vol A/R + US$${d.dia * 7} de séjour). Deux semaines montent à US$${presupDosSem}. Valeurs indicatives pour un voyageur de gamme moyenne ; avec Anduve vous voyez le prix en direct.`,
      },
      {
        q: `Quelle est la meilleure période pour visiter ${d.ciudad} ?`,
        a: `La meilleure saison pour ${d.ciudad} est ${datos.mejorEpoca}. ${datos.evitarEpoca ? `Il est conseillé d'éviter ${datos.evitarEpoca}.` : ""}`.trim(),
      },
      {
        q: `Combien de jours sont recommandés pour ${d.ciudad} ?`,
        a: `Pour découvrir ${d.ciudad} sans courir, nous recommandons entre 5 et 10 jours. Les principaux sites se voient en 4-5 jours ; avec 7-10 vous ajoutez des excursions. Avec Anduve vous bâtissez un itinéraire jour par jour.`,
      },
    ];
  }

  return [
    {
      q: `¿Cuánto cuesta un viaje a ${d.ciudad}?`,
      a: `Una semana en ${d.ciudad} cuesta aproximadamente US$${presupSemana} por persona (US$${d.vuelo} de vuelo ida y vuelta + US$${d.dia * 7} de estadía). Dos semanas suben a US$${presupDosSem}. Estos valores son orientativos para un turista de gama media y el vuelo varía según tu aeropuerto de origen; con Anduve puedes ver el precio real en vivo según el aeropuerto que elijas.`,
    },
    {
      q: `¿Cuándo es la mejor época para viajar a ${d.ciudad}?`,
      a: `La mejor temporada para visitar ${d.ciudad} es ${datos.mejorEpoca}. ${datos.evitarEpoca ? `Es recomendable evitar ${datos.evitarEpoca}.` : ""}`.trim(),
    },
    {
      q: `¿Cuántos días recomendables para visitar ${d.ciudad}?`,
      a: `Para conocer ${d.ciudad} sin correr, recomendamos entre 5 y 10 días. Los principales lugares se pueden ver en 4-5 días; con 7-10 días puedes incluir excursiones cercanas. Con Anduve armas un itinerario día por día según el tiempo que tengas.`,
    },
  ];
}
