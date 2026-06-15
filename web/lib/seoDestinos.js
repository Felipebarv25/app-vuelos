// Datos enriquecidos por destino para las landing pages /destino/<slug>.
// Lo que rankea bien en Google: contenido único + largo + responde preguntas.
// Aquí ponemos descripción extendida, mejor época, idioma/moneda, dato curioso
// y FAQs. Las ciudades sin entrada usan una plantilla genérica por región.
//
// 2026-06-14: Refactor a multi-idioma para SEO global con hreflang.
// - DATOS_POR_LANG[lang] tiene las traducciones por destino.
// - datosSeoDe(d, lang) y faqsDe(d, lang) devuelven la version localizada.
// - lang default = "es" (mercado principal).

// Mejores meses por región para volar barato/clima ok desde Colombia.
const TEMPORADA_REGION = {
  es: {
    sudamerica: { mejor: "marzo a junio y septiembre a noviembre", evitar: "diciembre a febrero (verano austral, alta temporada en Argentina/Chile)" },
    norteamerica: { mejor: "abril a junio y septiembre a noviembre", evitar: "diciembre a enero (caro) y julio-agosto (caro en EE.UU.)" },
    europa: { mejor: "abril, mayo, septiembre, octubre", evitar: "junio a agosto (alta temporada, todo más caro)" },
    asia: { mejor: "noviembre a marzo (temporada seca)", evitar: "junio a octubre (monzones en muchos países)" },
    africa: { mejor: "octubre a abril (clima más seco en el norte y el sur)", evitar: "junio a agosto (lluvias y calor extremo en algunas zonas)" },
    oceania: { mejor: "septiembre a noviembre (primavera austral) y marzo a mayo (otoño)", evitar: "diciembre a febrero (verano caro)" },
  },
  en: {
    sudamerica: { mejor: "March to June and September to November", evitar: "December to February (austral summer, high season in Argentina/Chile)" },
    norteamerica: { mejor: "April to June and September to November", evitar: "December to January (expensive) and July-August (peak US summer)" },
    europa: { mejor: "April, May, September, October", evitar: "June to August (high season, everything is more expensive)" },
    asia: { mejor: "November to March (dry season)", evitar: "June to October (monsoons across much of Asia)" },
    africa: { mejor: "October to April (drier season north and south)", evitar: "June to August (rains and extreme heat in some areas)" },
    oceania: { mejor: "September to November (austral spring) and March to May (autumn)", evitar: "December to February (peak summer)" },
  },
};

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
      intro: "CDMX es una megaurbe vibrante: ruinas aztecas en el centro, los murales de Diego Rivera, mercados, mezcalerías de barrio y una de las gastronomías más reconocidas por la UNESCO. Vuelos baratísimos desde Colombia.",
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
      intro: "Miami es Latinoamérica con poder adquisitivo gringo: playas de South Beach, vida nocturna en Wynwood, compras en Aventura y el portal a Cuba/Bahamas. Hay vuelos directos baratos desde Colombia.",
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
};

// Plantilla genérica por región para destinos sin datos específicos.
function generico(d, lang) {
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
      idioma: "Check local language",
      moneda: "Check local currency",
      dato: null,
      platos: [],
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
      `experiencias únicas. Es alcanzable desde Colombia con vuelos i/v aproximados de ` +
      `US$${d.vuelo} desde Bogotá o Medellín, y el presupuesto diario para un turista de ` +
      `gama media ronda los US$${d.dia} por persona (hospedaje, comida, transporte y actividades).`,
    idioma: "Consulta el idioma local",
    moneda: "Consulta la moneda local",
    dato: null,
    platos: [],
  };
}

// Devuelve los datos SEO de un destino en el idioma pedido. Por defecto ES
// (mantiene compatibilidad con el codigo viejo que no pasaba lang).
export function datosSeoDe(d, lang = "es") {
  if (!d) return null;
  const langOk = DATOS_POR_LANG[lang] ? lang : "es";
  const base = DATOS_POR_LANG[langOk][d.slug] || generico(d, langOk);
  const tempLang = TEMPORADA_REGION[langOk] || TEMPORADA_REGION.es;
  const temp = tempLang[d.region] || {};
  return {
    ...base,
    mejorEpoca: base.mejorEpoca || temp.mejor || (langOk === "en" ? "year-round" : "todo el año"),
    evitarEpoca: temp.evitar || null,
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
        a: `A week in ${d.ciudad} costs about US$${presupSemana} per person (US$${d.vuelo} round-trip flight + US$${d.dia * 7} for stay). Two weeks rise to US$${presupDosSem}. These are guideline values for a mid-range traveler; with Viajero 360 you can see the live flight price.`,
      },
      {
        q: `When is the best time to visit ${d.ciudad}?`,
        a: `The best season to visit ${d.ciudad} is ${datos.mejorEpoca}. ${datos.evitarEpoca ? `It is advisable to avoid ${datos.evitarEpoca}.` : ""}`.trim(),
      },
      {
        q: `How many days are recommended to visit ${d.ciudad}?`,
        a: `To explore ${d.ciudad} without rushing, we recommend between 5 and 10 days. The main sights can be seen in 4-5 days; with 7-10 you can include nearby excursions. With Viajero 360 you build a day-by-day itinerary based on your time available.`,
      },
    ];
  }

  return [
    {
      q: `¿Cuánto cuesta un viaje a ${d.ciudad} desde Colombia?`,
      a: `Una semana en ${d.ciudad} cuesta aproximadamente US$${presupSemana} por persona (US$${d.vuelo} de vuelo ida y vuelta + US$${d.dia * 7} de estadía). Dos semanas suben a US$${presupDosSem}. Estos valores son orientativos para un turista de gama media; con Viajero 360 puedes ver el precio real del vuelo en vivo.`,
    },
    {
      q: `¿Cuándo es la mejor época para viajar a ${d.ciudad}?`,
      a: `La mejor temporada para viajar a ${d.ciudad} desde Colombia es ${datos.mejorEpoca}. ${datos.evitarEpoca ? `Es recomendable evitar ${datos.evitarEpoca}.` : ""}`.trim(),
    },
    {
      q: `¿Cuántos días recomendables para visitar ${d.ciudad}?`,
      a: `Para conocer ${d.ciudad} sin correr, recomendamos entre 5 y 10 días. Los principales lugares se pueden ver en 4-5 días; con 7-10 días puedes incluir excursiones cercanas. Con Viajero 360 armas un itinerario día por día según el tiempo que tengas.`,
    },
  ];
}
