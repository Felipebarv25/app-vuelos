// Datos enriquecidos por destino para las landing pages /destino/<slug>.
// Lo que rankea bien en Google: contenido único + largo + responde preguntas.
// Aquí ponemos descripción extendida, mejor época, idioma/moneda, dato curioso
// y FAQs. Las ciudades sin entrada usan una plantilla genérica por región.

// Mejores meses por región para volar barato/clima ok desde Colombia.
const TEMPORADA_REGION = {
  sudamerica: { mejor: "marzo a junio y septiembre a noviembre", evitar: "diciembre a febrero (verano austral, alta temporada en Argentina/Chile)" },
  norteamerica: { mejor: "abril a junio y septiembre a noviembre", evitar: "diciembre a enero (caro) y julio-agosto (caro en EE.UU.)" },
  europa: { mejor: "abril, mayo, septiembre, octubre", evitar: "junio a agosto (alta temporada, todo más caro)" },
  asia: { mejor: "noviembre a marzo (temporada seca)", evitar: "junio a octubre (monzones en muchos países)" },
  africa: { mejor: "octubre a abril (clima más seco en el norte y el sur)", evitar: "junio a agosto (lluvias y calor extremo en algunas zonas)" },
  oceania: { mejor: "septiembre a noviembre (primavera austral) y marzo a mayo (otoño)", evitar: "diciembre a febrero (verano caro)" },
};

// Datos específicos (top destinos). El resto usa plantilla genérica por región.
// Estructura: { intro, idioma, moneda, dato, comida, mejorEpoca? (sobreescribe la
// de la región si aplica), platos:[], faqs?:[{q,a}] }
const DATOS = {
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
};

// Plantilla genérica por región para destinos sin datos específicos.
function generico(d) {
  const intro =
    `Un destino fascinante en ${d.region === "sudamerica" ? "Sudamérica"
      : d.region === "norteamerica" ? "Norte y Centroamérica"
      : d.region === "europa" ? "Europa"
      : d.region === "asia" ? "Asia"
      : d.region === "africa" ? "África"
      : "Oceanía"}. ${d.ciudad} combina cultura, gastronomía y experiencias únicas. ` +
    `Es alcanzable desde Colombia con vuelos i/v aproximados de US$${d.vuelo} desde Bogotá o Medellín, ` +
    `y el presupuesto diario para un turista de gama media ronda los US$${d.dia} por persona (hospedaje, comida, transporte y actividades).`;
  return {
    intro,
    idioma: "Consulta el idioma local",
    moneda: "Consulta la moneda local",
    dato: null,
    platos: [],
  };
}

export function datosSeoDe(d) {
  if (!d) return null;
  const base = DATOS[d.slug] || generico(d);
  const temp = TEMPORADA_REGION[d.region] || {};
  return {
    ...base,
    mejorEpoca: base.mejorEpoca || temp.mejor || "todo el año",
    evitarEpoca: temp.evitar || null,
  };
}

// FAQs genéricas que responden búsquedas frecuentes en Google.
// "¿Cuánto cuesta...?" y "¿Cuándo viajar...?" son palabras clave de oro.
export function faqsDe(d) {
  const presupSemana = d.vuelo + d.dia * 7;
  const presupDosSem = d.vuelo + d.dia * 14;
  return [
    {
      q: `¿Cuánto cuesta un viaje a ${d.ciudad} desde Colombia?`,
      a: `Una semana en ${d.ciudad} cuesta aproximadamente US$${presupSemana} por persona (US$${d.vuelo} de vuelo ida y vuelta + US$${d.dia * 7} de estadía). Dos semanas suben a US$${presupDosSem}. Estos valores son orientativos para un turista de gama media; con Viajero 360 puedes ver el precio real del vuelo en vivo.`,
    },
    {
      q: `¿Cuándo es la mejor época para viajar a ${d.ciudad}?`,
      a: `La mejor temporada para viajar a ${d.ciudad} desde Colombia es ${datosSeoDe(d).mejorEpoca}. ${datosSeoDe(d).evitarEpoca ? `Es recomendable evitar ${datosSeoDe(d).evitarEpoca}.` : ""}`.trim(),
    },
    {
      q: `¿Cuántos días recomendables para visitar ${d.ciudad}?`,
      a: `Para conocer ${d.ciudad} sin correr, recomendamos entre 5 y 10 días. Los principales lugares se pueden ver en 4-5 días; con 7-10 días puedes incluir excursiones cercanas. Con Viajero 360 armas un itinerario día por día según el tiempo que tengas.`,
    },
  ];
}
