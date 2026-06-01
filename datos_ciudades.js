// Datos curados de itinerarios por ciudad.
// Para AÑADIR una ciudad, copia un bloque y cambia los datos.
// Precios = aproximados (verifica los actuales). Las rutas reales las da Google Maps.
const CIUDADES = {

  "MAD": {
    nombre:"Madrid", pais:"España", bandera:"🇪🇸", centro:[40.4168,-3.7038], zoom:13,
    transporte:{
      billetes:[
        {t:"Metro billete sencillo", p:"€1,50–2,00", nota:"según estaciones"},
        {t:"Suplemento aeropuerto", p:"+€3,00", nota:"Metro al/desde Barajas"},
        {t:"Tarjeta Multi 10 viajes", p:"≈€12,20", nota:"+€2,50 la tarjeta"},
        {t:"Abono Turístico (1 día, zona A)", p:"≈€8,40", nota:"ilimitado"},
        {t:"Bus EMT", p:"€1,50", nota:""},
        {t:"Taxi aeropuerto–centro", p:"≈€33 fijo", nota:""},
      ],
      consejos:[
        "El centro histórico es muy caminable: del Sol al Palacio Real son 15 min a pie.",
        "El Metro es rápido y frecuente; compra la tarjeta Multi si harás varios viajes.",
        "Museos Prado/Reina Sofía tienen franjas gratis al final del día.",
      ],
    },
    lugares:[
      {n:"Puerta del Sol", cat:"Plaza · km 0 de España", coord:[40.4169,-3.7035], horas:"30 min", desc:"El corazón de Madrid y punto de partida ideal. Aquí está el oso y el madroño."},
      {n:"Plaza Mayor", cat:"Plaza histórica", coord:[40.4155,-3.7074], horas:"30 min", desc:"Plaza porticada del s. XVII, perfecta para un café y fotos."},
      {n:"Mercado de San Miguel", cat:"Gastronomía", coord:[40.4154,-3.7090], horas:"45 min", desc:"Mercado gourmet para probar tapas, jamón y vinos."},
      {n:"Palacio Real", cat:"Monumento", coord:[40.4180,-3.7143], horas:"1,5 h", desc:"El palacio más grande de Europa occidental; jardines y cambio de guardia."},
      {n:"Catedral de la Almudena", cat:"Catedral", coord:[40.4159,-3.7144], horas:"30 min", desc:"Justo frente al Palacio; sube a la cúpula por buenas vistas."},
      {n:"Gran Vía", cat:"Avenida · compras", coord:[40.4203,-3.7058], horas:"1 h", desc:"La avenida más icónica: teatros, tiendas y edificios espectaculares."},
      {n:"Museo del Prado", cat:"Arte", coord:[40.4138,-3.6921], horas:"2–3 h", desc:"Una de las mejores pinacotecas del mundo: Velázquez, Goya, El Bosco."},
      {n:"Parque del Retiro", cat:"Parque", coord:[40.4153,-3.6844], horas:"1,5 h", desc:"Pulmón verde de Madrid: el Palacio de Cristal y barcas en el estanque."},
      {n:"Templo de Debod", cat:"Mirador · atardecer", coord:[40.4240,-3.7176], horas:"45 min", desc:"Templo egipcio real; el mejor sitio para ver el atardecer madrileño."},
    ],
  },

  "BCN": {
    nombre:"Barcelona", pais:"España", bandera:"🇪🇸", centro:[41.3954,2.1620], zoom:13,
    transporte:{
      billetes:[
        {t:"Billete sencillo (metro/bus)", p:"≈€2,65", nota:""},
        {t:"T-casual 10 viajes (zona 1)", p:"≈€12,55", nota:"personal, no compartible"},
        {t:"Hola Barcelona 48 h", p:"≈€18,50", nota:"incluye metro al aeropuerto"},
        {t:"Hola Barcelona 72 h", p:"≈€27,00", nota:""},
        {t:"Aerobús aeropuerto–centro", p:"≈€7,25", nota:""},
      ],
      consejos:[
        "Compra entradas ONLINE para Sagrada Família y Park Güell: vuelan.",
        "La T-casual es personal; si viajan 2, cada uno necesita la suya.",
        "Cuidado con carteristas en La Rambla y el metro: lleva todo al frente.",
      ],
    },
    lugares:[
      {n:"Sagrada Família", cat:"Basílica de Gaudí", coord:[41.4036,2.1744], horas:"1,5 h", desc:"La obra maestra de Gaudí, aún en construcción. Imperdible; reserva online."},
      {n:"Casa Batlló", cat:"Modernismo", coord:[41.3917,2.1649], horas:"1 h", desc:"Fachada ondulante de Gaudí en el Paseo de Gracia."},
      {n:"La Pedrera (Casa Milà)", cat:"Modernismo", coord:[41.3953,2.1619], horas:"1 h", desc:"Otra joya de Gaudí; su azotea es de otro planeta."},
      {n:"Park Güell", cat:"Parque · mosaicos", coord:[41.4145,2.1527], horas:"1,5 h", desc:"Jardines con mosaicos y vistas de toda la ciudad. Reserva entrada."},
      {n:"Barrio Gótico y Catedral", cat:"Casco antiguo", coord:[41.3839,2.1762], horas:"1,5 h", desc:"Callejuelas medievales, la Catedral y plazas con encanto."},
      {n:"La Rambla", cat:"Paseo", coord:[41.3797,2.1746], horas:"45 min", desc:"El paseo más famoso; visita el Mercado de la Boquería."},
      {n:"Playa de la Barceloneta", cat:"Playa", coord:[41.3784,2.1925], horas:"1,5 h", desc:"Arena, mar y chiringuitos a pasos del centro."},
      {n:"Montjuïc", cat:"Mirador · castillo", coord:[41.3596,2.1660], horas:"2 h", desc:"Castillo, fuentes mágicas y vistas. Sube en teleférico."},
    ],
  },

  "ROM": {
    nombre:"Roma", pais:"Italia", bandera:"🇮🇹", centro:[41.8960,12.4823], zoom:13,
    transporte:{
      billetes:[
        {t:"Billete BIT (100 min)", p:"€1,50", nota:"metro/bus/tranvía"},
        {t:"Roma 24 h", p:"€7,00", nota:"ilimitado"},
        {t:"Roma 48 h / 72 h", p:"€12,50 / €18,00", nota:""},
        {t:"Leonardo Express (tren aeropuerto)", p:"€14,00", nota:"Fiumicino–Termini"},
      ],
      consejos:[
        "El centro es para caminar: la mayoría de lugares están cerca entre sí.",
        "Reserva el Coliseo y Museos Vaticanos online para evitar filas enormes.",
        "Lleva botella: hay fuentes (nasoni) con agua potable gratis por todos lados.",
      ],
    },
    lugares:[
      {n:"Coliseo", cat:"Anfiteatro romano", coord:[41.8902,12.4922], horas:"1,5 h", desc:"El símbolo de Roma. Entrada combinada con Foro y Palatino."},
      {n:"Foro Romano", cat:"Ruinas", coord:[41.8925,12.4853], horas:"1,5 h", desc:"El centro de la antigua Roma; camina entre templos y arcos."},
      {n:"Fontana di Trevi", cat:"Fuente", coord:[41.9009,12.4833], horas:"30 min", desc:"Lanza una moneda para volver a Roma. Mejor temprano o de noche."},
      {n:"Panteón", cat:"Templo romano", coord:[41.8986,12.4769], horas:"45 min", desc:"El edificio antiguo mejor conservado; su cúpula es asombrosa."},
      {n:"Piazza Navona", cat:"Plaza barroca", coord:[41.8992,12.4731], horas:"30 min", desc:"Plaza con fuentes de Bernini, artistas y cafés."},
      {n:"Castel Sant'Angelo", cat:"Castillo", coord:[41.9031,12.4663], horas:"1 h", desc:"Antiguo mausoleo con vistas al Vaticano desde la terraza."},
      {n:"Basílica de San Pedro (Vaticano)", cat:"Basílica", coord:[41.9022,12.4539], horas:"1,5 h", desc:"La basílica más grande; sube a la cúpula. Código de vestimenta."},
      {n:"Museos Vaticanos y Capilla Sixtina", cat:"Arte", coord:[41.9065,12.4536], horas:"2–3 h", desc:"Colección inmensa que culmina en la Capilla Sixtina de Miguel Ángel."},
    ],
  },

  "PAR": {
    nombre:"París", pais:"Francia", bandera:"🇫🇷", centro:[48.8606,2.3376], zoom:12,
    transporte:{
      billetes:[
        {t:"Ticket t+ (metro/bus)", p:"≈€2,15", nota:""},
        {t:"Navigo Easy (recargable)", p:"€2 tarjeta + viajes", nota:"más barato por viaje"},
        {t:"Paris Visite 1 día", p:"≈€13,95", nota:"transporte ilimitado"},
        {t:"RER B al aeropuerto CDG", p:"≈€11,45", nota:""},
      ],
      consejos:[
        "Compra entradas a Torre Eiffel y Louvre con antelación: las filas son larguísimas.",
        "El metro es densísimo y eficiente; guarda el ticket hasta salir.",
        "Muchos museos son gratis el primer domingo de mes (van llenos).",
      ],
    },
    lugares:[
      {n:"Torre Eiffel", cat:"Monumento", coord:[48.8584,2.2945], horas:"1,5 h", desc:"El ícono de París. De noche brilla cada hora. Reserva subida."},
      {n:"Campo de Marte / Trocadéro", cat:"Mirador", coord:[48.8617,2.2895], horas:"45 min", desc:"Las mejores fotos de la torre son desde Trocadéro."},
      {n:"Arco del Triunfo", cat:"Monumento", coord:[48.8738,2.2950], horas:"45 min", desc:"Sube a la terraza para ver las 12 avenidas en estrella."},
      {n:"Campos Elíseos", cat:"Avenida · compras", coord:[48.8698,2.3079], horas:"1 h", desc:"La avenida más famosa, del Arco a la Concordia."},
      {n:"Museo del Louvre", cat:"Arte", coord:[48.8606,2.3376], horas:"2–3 h", desc:"El museo más visitado del mundo: la Gioconda y la pirámide."},
      {n:"Catedral de Notre-Dame", cat:"Catedral", coord:[48.8530,2.3499], horas:"45 min", desc:"Joya gótica en la Île de la Cité, reabierta tras su restauración."},
      {n:"Museo de Orsay", cat:"Arte impresionista", coord:[48.8600,2.3266], horas:"2 h", desc:"Monet, Van Gogh y Renoir en una antigua estación de tren."},
      {n:"Montmartre y Sacré-Cœur", cat:"Barrio · mirador", coord:[48.8867,2.3431], horas:"2 h", desc:"Barrio bohemio en la colina con la basílica blanca y vistas."},
    ],
  },

  "LON": {
    nombre:"Londres", pais:"Reino Unido", bandera:"🇬🇧", centro:[51.5074,-0.1180], zoom:12,
    transporte:{
      billetes:[
        {t:"Metro/bus con contactless o Oyster", p:"≈£2,80 zona 1", nota:"por viaje"},
        {t:"Tope diario (zona 1–2)", p:"≈£8,50", nota:"no pagas de más"},
        {t:"Autobús (bus)", p:"£1,75", nota:"tope diario £5,25"},
        {t:"Heathrow: línea Piccadilly", p:"≈£5,60", nota:"opción barata desde aeropuerto"},
      ],
      consejos:[
        "Paga con tarjeta contactless del celular: es lo más barato y NO compres billete de papel.",
        "Mira a la DERECHA al cruzar: los autos van por la izquierda.",
        "Muchísimos museos top son GRATIS (British Museum, National Gallery, Tate).",
      ],
    },
    lugares:[
      {n:"Big Ben y Parlamento", cat:"Monumento", coord:[51.5007,-0.1246], horas:"45 min", desc:"El reloj más famoso del mundo junto al Támesis."},
      {n:"London Eye", cat:"Noria · vistas", coord:[51.5033,-0.1196], horas:"45 min", desc:"Vistas de 360° de la ciudad; reserva para evitar fila."},
      {n:"Abadía de Westminster", cat:"Iglesia histórica", coord:[51.4994,-0.1273], horas:"1 h", desc:"Donde se coronan los reyes británicos."},
      {n:"Palacio de Buckingham", cat:"Palacio", coord:[51.5014,-0.1419], horas:"45 min", desc:"Residencia real; mira el cambio de guardia (revisa horarios)."},
      {n:"British Museum", cat:"Museo · gratis", coord:[51.5194,-0.1270], horas:"2 h", desc:"La Piedra Rosetta y tesoros del mundo. Entrada gratuita."},
      {n:"Catedral de San Pablo", cat:"Catedral", coord:[51.5138,-0.0984], horas:"1 h", desc:"Su cúpula domina el skyline; sube a la galería."},
      {n:"Torre de Londres", cat:"Fortaleza", coord:[51.5081,-0.0759], horas:"1,5 h", desc:"Fortaleza milenaria con las Joyas de la Corona."},
      {n:"Tower Bridge", cat:"Puente icónico", coord:[51.5055,-0.0754], horas:"30 min", desc:"El puente levadizo más famoso; pasarela de cristal opcional."},
    ],
  },

  "LIM": {
    nombre:"Lima", pais:"Perú", bandera:"🇵🇪", centro:[-12.0850,-77.0300], zoom:12,
    transporte:{
      billetes:[
        {t:"Metropolitano / bus", p:"≈ S/ 2,50–3,20", nota:"tarjeta recargable"},
        {t:"Taxi por app (Uber/Cabify/Didi)", p:"≈ S/ 10–25", nota:"recomendado por seguridad"},
        {t:"Airport Express (aeropuerto–Miraflores)", p:"≈ S/ 25–30", nota:"bus turístico seguro"},
      ],
      consejos:[
        "Usa apps de taxi (Uber/Cabify), NO taxis informales en la calle.",
        "Hospédate en Miraflores o Barranco: zonas seguras y bonitas.",
        "No te pierdas la gastronomía: ceviche y la mejor cocina de Sudamérica.",
      ],
    },
    lugares:[
      {n:"Plaza Mayor y Catedral", cat:"Centro histórico", coord:[-12.0464,-77.0303], horas:"1,5 h", desc:"Corazón colonial de Lima, Patrimonio de la Humanidad."},
      {n:"Parque Kennedy (Miraflores)", cat:"Parque · gatos", coord:[-12.1219,-77.0297], horas:"1 h", desc:"Plaza animada de Miraflores, famosa por sus gatitos."},
      {n:"Malecón y Larcomar", cat:"Costa · vistas", coord:[-12.1320,-77.0306], horas:"1,5 h", desc:"Acantilados sobre el Pacífico; centro comercial con vista al mar."},
      {n:"Barranco y Puente de los Suspiros", cat:"Barrio bohemio", coord:[-12.1490,-77.0210], horas:"2 h", desc:"Arte urbano, bares y el romántico puente. Ideal al atardecer."},
      {n:"Huaca Pucllana", cat:"Ruina preinca", coord:[-12.1109,-77.0339], horas:"1 h", desc:"Pirámide de adobe en plena ciudad; bonita de noche iluminada."},
      {n:"Circuito Mágico del Agua", cat:"Fuentes · show", coord:[-12.0700,-77.0339], horas:"1,5 h", desc:"Parque de fuentes con espectáculo de luces (récord Guinness)."},
    ],
  },

  "MEX": {
    nombre:"Ciudad de México", pais:"México", bandera:"🇲🇽", centro:[19.4326,-99.1332], zoom:12,
    transporte:{
      billetes:[
        {t:"Metro", p:"≈ MX$ 5", nota:"con tarjeta recargable"},
        {t:"Metrobús", p:"≈ MX$ 6", nota:"línea 4 va al aeropuerto"},
        {t:"Taxi por app (Uber/Didi)", p:"≈ MX$ 60–150", nota:"recomendado"},
      ],
      consejos:[
        "Usa Uber/Didi para mayor seguridad, sobre todo de noche.",
        "El Metrobús línea 4 conecta el aeropuerto con el Centro muy barato.",
        "Teotihuacán y Xochimilco son excursiones de medio día imperdibles.",
      ],
    },
    lugares:[
      {n:"Zócalo y Catedral Metropolitana", cat:"Plaza mayor", coord:[19.4326,-99.1332], horas:"1,5 h", desc:"Una de las plazas más grandes del mundo, con la catedral colonial."},
      {n:"Templo Mayor", cat:"Ruina azteca", coord:[19.4350,-99.1313], horas:"1 h", desc:"Restos del gran templo mexica de Tenochtitlán, con museo."},
      {n:"Palacio de Bellas Artes", cat:"Cultura · arte", coord:[19.4352,-99.1412], horas:"1 h", desc:"Joya art déco con murales de Diego Rivera."},
      {n:"Bosque y Castillo de Chapultepec", cat:"Parque · castillo", coord:[19.4204,-99.1819], horas:"2 h", desc:"Enorme parque urbano con el castillo y vistas de la ciudad."},
      {n:"Museo Nacional de Antropología", cat:"Museo top", coord:[19.4260,-99.1863], horas:"2–3 h", desc:"Uno de los mejores museos del mundo: la Piedra del Sol azteca."},
      {n:"Coyoacán y Casa de Frida Kahlo", cat:"Barrio · museo", coord:[19.3551,-99.1626], horas:"2 h", desc:"Barrio colonial encantador y la Casa Azul de Frida (reserva)."},
      {n:"Xochimilco", cat:"Canales · trajineras", coord:[19.2575,-99.1030], horas:"3 h", desc:"Paseo en coloridas trajineras por canales con música. Muy festivo."},
      {n:"Teotihuacán (excursión)", cat:"Pirámides", coord:[19.6925,-98.8438], horas:"medio día", desc:"Las imponentes pirámides del Sol y la Luna, a 1 h de la ciudad."},
    ],
  },

  "BUE": {
    nombre:"Buenos Aires", pais:"Argentina", bandera:"🇦🇷", centro:[-34.6037,-58.3816], zoom:12,
    transporte:{
      billetes:[
        {t:"Subte (metro) con tarjeta SUBE", p:"tarifa variable*", nota:"*cambia seguido"},
        {t:"Colectivo (bus) con SUBE", p:"tarifa variable*", nota:"imprescindible la SUBE"},
        {t:"Taxi / Cabify", p:"según trayecto", nota:""},
      ],
      consejos:[
        "Compra y carga la tarjeta SUBE: la necesitas para subte, bus y tren.",
        "Por la inflación, los precios cambian rápido: verifica al llegar.",
        "Lleva efectivo en pesos; conviene cambiar en casas de cambio confiables.",
      ],
    },
    lugares:[
      {n:"Obelisco y Av. 9 de Julio", cat:"Ícono", coord:[-34.6037,-58.3816], horas:"30 min", desc:"El monumento símbolo, en la avenida más ancha del mundo."},
      {n:"Plaza de Mayo y Casa Rosada", cat:"Histórico", coord:[-34.6083,-58.3712], horas:"1 h", desc:"El centro político: la Casa Rosada y la Catedral."},
      {n:"Caminito (La Boca)", cat:"Barrio colorido", coord:[-34.6395,-58.3625], horas:"1,5 h", desc:"Callejón de casas multicolores, tango y arte. Ve de día."},
      {n:"Puerto Madero", cat:"Paseo moderno", coord:[-34.6118,-58.3625], horas:"1,5 h", desc:"Diques renovados, el Puente de la Mujer y buenos restaurantes."},
      {n:"Recoleta (Cementerio)", cat:"Histórico · arte", coord:[-34.5875,-58.3927], horas:"1,5 h", desc:"Cementerio monumental donde descansa Evita; barrio elegante."},
      {n:"Teatro Colón", cat:"Cultura", coord:[-34.6010,-58.3835], horas:"1 h", desc:"Uno de los mejores teatros líricos del mundo; visita guiada."},
      {n:"Palermo", cat:"Bosques · vida nocturna", coord:[-34.5711,-58.4173], horas:"2 h", desc:"Parques, bares de moda y los mejores restaurantes de la ciudad."},
    ],
  },

};
