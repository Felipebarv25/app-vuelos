// "La banda sonora de tu viaje" — catalogo curado de musica por ciudad/pais
// (feature 2026-07-11, idea del usuario).
//
// TRES capas por ciudad:
//   1. LOCALES: artistas originales de la ciudad (override) o del pais (base).
//   2. TENDENCIA: deep link al Top 50 del pais en Spotify (lo curan ellos a
//      diario — cero mantenimiento nuestro, siempre actual).
//   3. TEMPORADA/VIBE: sugerencia segun los tags de la ciudad (playa,
//      romantico, nocturna...) y la estacion del año EN EL DESTINO durante
//      las fechas del viaje (hemisferio sur invierte estaciones).
//
// SIN APIs: todo son deep links a Spotify/YouTube (gratis, sin key, sin
// cuota, legalmente limpio — nunca reproducimos audio, solo enlazamos).
// Los links de busqueda de Spotify (open.spotify.com/search/...) abren la
// app si esta instalada y el primer resultado es el artista/playlist.

import { isoDesdeNombre } from "./requisitos";
import { tagsDe } from "./destinosTags";

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export function linkSpotify(q) {
  return `https://open.spotify.com/search/${encodeURIComponent(q)}`;
}
export function linkYouTube(q) {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// ============ PAISES (base) — keyed por ISO-2 ============
// artistas: 4-6 nombres icónicos ORIGINALES del pais (mezcla de clasicos y
// actuales). emblema: LA cancion que suena a ese pais. genero: etiqueta local.
export const MUSICA_PAISES = {
  ES: {
    nombre: "España",
    genero: "Flamenco y pop español",
    artistas: ["Héroes del Silencio", "La Oreja de Van Gogh", "Rosalía", "Joaquín Sabina", "Paco de Lucía", "Mecano"],
    emblema: { c: "Entre dos aguas", a: "Paco de Lucía" },
  },
  FR: {
    nombre: "Francia",
    genero: "Chanson y electro francés",
    artistas: ["Édith Piaf", "Daft Punk", "Zaz", "Charles Aznavour", "Aya Nakamura", "Phoenix"],
    emblema: { c: "La Vie en Rose", a: "Édith Piaf" },
  },
  IT: {
    nombre: "Italia",
    genero: "Cantautori e ópera",
    artistas: ["Måneskin", "Eros Ramazzotti", "Laura Pausini", "Luciano Pavarotti", "Ennio Morricone", "Andrea Bocelli"],
    emblema: { c: "Nel blu dipinto di blu (Volare)", a: "Domenico Modugno" },
  },
  PT: {
    nombre: "Portugal",
    genero: "Fado",
    artistas: ["Amália Rodrigues", "Madredeus", "Ana Moura", "Mariza", "Salvador Sobral"],
    emblema: { c: "Uma Casa Portuguesa", a: "Amália Rodrigues" },
  },
  GB: {
    nombre: "Reino Unido",
    genero: "Rock y pop británico",
    artistas: ["The Beatles", "Queen", "Adele", "The Rolling Stones", "Dua Lipa", "Coldplay"],
    emblema: { c: "Bohemian Rhapsody", a: "Queen" },
  },
  IE: {
    nombre: "Irlanda",
    genero: "Folk irlandés y rock",
    artistas: ["U2", "The Cranberries", "Hozier", "The Dubliners", "Sinéad O'Connor"],
    emblema: { c: "Zombie", a: "The Cranberries" },
  },
  DE: {
    nombre: "Alemania",
    genero: "Rock, electrónica y clásicos",
    artistas: ["Rammstein", "Kraftwerk", "Nena", "Beethoven", "Paul Kalkbrenner"],
    emblema: { c: "99 Luftballons", a: "Nena" },
  },
  NL: {
    nombre: "Países Bajos",
    genero: "Dance y EDM",
    artistas: ["Tiësto", "Martin Garrix", "Armin van Buuren", "André Hazes"],
    emblema: { c: "Animals", a: "Martin Garrix" },
  },
  BE: {
    nombre: "Bélgica",
    genero: "Pop belga",
    artistas: ["Stromae", "Jacques Brel", "Angèle", "Lost Frequencies"],
    emblema: { c: "Alors on danse", a: "Stromae" },
  },
  CH: {
    nombre: "Suiza",
    genero: "Pop alpino y electrónica",
    artistas: ["DJ BoBo", "Yello", "Patent Ochsner"],
    emblema: { c: "Oh Yeah", a: "Yello" },
  },
  AT: {
    nombre: "Austria",
    genero: "Clásica vienesa",
    artistas: ["Mozart", "Johann Strauss II", "Falco", "Franz Schubert"],
    emblema: { c: "Rock Me Amadeus", a: "Falco" },
  },
  CZ: {
    nombre: "Chequia",
    genero: "Clásica bohemia",
    artistas: ["Bedřich Smetana", "Antonín Dvořák", "Karel Gott"],
    emblema: { c: "Vltava (El Moldava)", a: "Bedřich Smetana" },
  },
  HU: {
    nombre: "Hungría",
    genero: "Rock húngaro y clásica",
    artistas: ["Omega", "Franz Liszt", "Béla Bartók"],
    emblema: { c: "Gyöngyhajú lány", a: "Omega" },
  },
  PL: {
    nombre: "Polonia",
    genero: "Clásica y pop polaco",
    artistas: ["Frédéric Chopin", "Dawid Podsiadło", "Sanah"],
    emblema: { c: "Nocturne Op. 9 No. 2", a: "Chopin" },
  },
  GR: {
    nombre: "Grecia",
    genero: "Música griega",
    artistas: ["Mikis Theodorakis", "Nana Mouskouri", "Vangelis", "Eleni Foureira"],
    emblema: { c: "Zorba's Dance", a: "Mikis Theodorakis" },
  },
  TR: {
    nombre: "Turquía",
    genero: "Pop turco",
    artistas: ["Tarkan", "Sezen Aksu", "Mabel Matiz"],
    emblema: { c: "Şımarık", a: "Tarkan" },
  },
  DK: {
    nombre: "Dinamarca",
    genero: "Pop nórdico",
    artistas: ["MØ", "Lukas Graham", "Aqua"],
    emblema: { c: "7 Years", a: "Lukas Graham" },
  },
  SE: {
    nombre: "Suecia",
    genero: "Pop sueco",
    artistas: ["ABBA", "Avicii", "Roxette", "Zara Larsson"],
    emblema: { c: "Dancing Queen", a: "ABBA" },
  },
  NO: {
    nombre: "Noruega",
    genero: "Pop y electrónica nórdica",
    artistas: ["a-ha", "Kygo", "Edvard Grieg", "AURORA"],
    emblema: { c: "Take On Me", a: "a-ha" },
  },
  IS: {
    nombre: "Islandia",
    genero: "Indie islandés",
    artistas: ["Björk", "Sigur Rós", "Of Monsters and Men", "Kaleo"],
    emblema: { c: "Little Talks", a: "Of Monsters and Men" },
  },
  // ==== LATAM ====
  CO: {
    nombre: "Colombia",
    genero: "Vallenato, cumbia y reggaetón",
    artistas: ["Shakira", "Juanes", "Carlos Vives", "Karol G", "Aterciopelados", "Grupo Niche"],
    emblema: { c: "La Tierra del Olvido", a: "Carlos Vives" },
  },
  MX: {
    nombre: "México",
    genero: "Mariachi, ranchera y rock mexicano",
    artistas: ["Vicente Fernández", "Café Tacvba", "Natalia Lafourcade", "Luis Miguel", "Maná", "Peso Pluma"],
    emblema: { c: "México Lindo y Querido", a: "Jorge Negrete" },
  },
  AR: {
    nombre: "Argentina",
    genero: "Tango y rock nacional",
    artistas: ["Carlos Gardel", "Soda Stereo", "Charly García", "Fito Páez", "Astor Piazzolla", "Bizarrap"],
    emblema: { c: "Por una Cabeza", a: "Carlos Gardel" },
  },
  BR: {
    nombre: "Brasil",
    genero: "Bossa nova, samba y funk",
    artistas: ["Tom Jobim", "Caetano Veloso", "Anitta", "Gilberto Gil", "Seu Jorge", "Jorge Ben Jor"],
    emblema: { c: "Garota de Ipanema", a: "Tom Jobim & Vinícius" },
  },
  PE: {
    nombre: "Perú",
    genero: "Vals criollo y cumbia peruana",
    artistas: ["Chabuca Granda", "Eva Ayllón", "Los Mirlos", "Gian Marco", "Susana Baca"],
    emblema: { c: "La Flor de la Canela", a: "Chabuca Granda" },
  },
  CL: {
    nombre: "Chile",
    genero: "Nueva canción y pop chileno",
    artistas: ["Los Prisioneros", "Violeta Parra", "Mon Laferte", "Víctor Jara", "Los Bunkers"],
    emblema: { c: "Tren al Sur", a: "Los Prisioneros" },
  },
  EC: {
    nombre: "Ecuador",
    genero: "Pasillo ecuatoriano",
    artistas: ["Julio Jaramillo", "Juan Fernando Velasco", "Mirella Cesa"],
    emblema: { c: "Nuestro Juramento", a: "Julio Jaramillo" },
  },
  UY: {
    nombre: "Uruguay",
    genero: "Candombe y rock uruguayo",
    artistas: ["Jorge Drexler", "La Vela Puerca", "No Te Va Gustar", "Rubén Rada"],
    emblema: { c: "Al Otro Lado del Río", a: "Jorge Drexler" },
  },
  PY: {
    nombre: "Paraguay",
    genero: "Guarania y polca paraguaya",
    artistas: ["Luis Alberto del Paraná", "Berta Rojas", "Tierra Adentro"],
    emblema: { c: "Recuerdos de Ypacaraí", a: "Luis Alberto del Paraná" },
  },
  BO: {
    nombre: "Bolivia",
    genero: "Folklore andino",
    artistas: ["Los Kjarkas", "Savia Andina", "Luzmila Carpio"],
    emblema: { c: "Llorando se fue", a: "Los Kjarkas" },
  },
  VE: {
    nombre: "Venezuela",
    genero: "Salsa, joropo y pop venezolano",
    artistas: ["Oscar D'León", "Franco de Vita", "Simón Díaz", "Danny Ocean", "Ricardo Montaner"],
    emblema: { c: "Caballo Viejo", a: "Simón Díaz" },
  },
  CU: {
    nombre: "Cuba",
    genero: "Son cubano y salsa",
    artistas: ["Buena Vista Social Club", "Celia Cruz", "Compay Segundo", "Gente de Zona", "Silvio Rodríguez"],
    emblema: { c: "Chan Chan", a: "Compay Segundo" },
  },
  DO: {
    nombre: "República Dominicana",
    genero: "Merengue y bachata",
    artistas: ["Juan Luis Guerra", "Romeo Santos", "Johnny Ventura"],
    emblema: { c: "Ojalá Que Llueva Café", a: "Juan Luis Guerra" },
  },
  CR: {
    nombre: "Costa Rica",
    genero: "Pop y calipso tico",
    artistas: ["Debi Nova", "Percance", "Walter Ferguson"],
    emblema: { c: "Cabo Blanco", a: "Walter Ferguson" },
  },
  PA: {
    nombre: "Panamá",
    genero: "Salsa y reggae en español",
    artistas: ["Rubén Blades", "Danilo Pérez", "Sech", "El General"],
    emblema: { c: "Pedro Navaja", a: "Rubén Blades" },
  },
  GT: {
    nombre: "Guatemala",
    genero: "Marimba y pop chapín",
    artistas: ["Ricardo Arjona", "Gaby Moreno", "Malacates Trébol Shop"],
    emblema: { c: "Luna de Xelajú", a: "Paco Pérez" },
  },
  // ==== NORTEAMERICA ====
  US: {
    nombre: "Estados Unidos",
    genero: "Pop, rock, jazz y hip-hop",
    artistas: ["Frank Sinatra", "Beyoncé", "Bruce Springsteen", "Taylor Swift", "Kendrick Lamar", "Miles Davis"],
    emblema: { c: "New York, New York", a: "Frank Sinatra" },
  },
  CA: {
    nombre: "Canadá",
    genero: "Pop e indie canadiense",
    artistas: ["The Weeknd", "Drake", "Céline Dion", "Leonard Cohen", "Arcade Fire"],
    emblema: { c: "Hallelujah", a: "Leonard Cohen" },
  },
  // ==== ASIA / MEDIO ORIENTE ====
  JP: {
    nombre: "Japón",
    genero: "J-pop y city pop",
    artistas: ["YOASOBI", "Hikaru Utada", "RADWIMPS", "Mariya Takeuchi", "Joe Hisaishi"],
    emblema: { c: "Plastic Love", a: "Mariya Takeuchi" },
  },
  KR: {
    nombre: "Corea del Sur",
    genero: "K-pop",
    artistas: ["BTS", "BLACKPINK", "IU", "NewJeans", "PSY"],
    emblema: { c: "Gangnam Style", a: "PSY" },
  },
  CN: {
    nombre: "China",
    genero: "Mandopop y tradicional",
    artistas: ["Jay Chou", "Faye Wong", "Teresa Teng"],
    emblema: { c: "月亮代表我的心 (The Moon Represents My Heart)", a: "Teresa Teng" },
  },
  TH: {
    nombre: "Tailandia",
    genero: "T-pop y luk thung",
    artistas: ["LISA", "Bird Thongchai", "Phum Viphurit"],
    emblema: { c: "Lover Boy", a: "Phum Viphurit" },
  },
  ID: {
    nombre: "Indonesia",
    genero: "Pop indonesio y gamelan",
    artistas: ["Rich Brian", "NIKI", "Anggun", "Tulus"],
    emblema: { c: "Every Summertime", a: "NIKI" },
  },
  SG: {
    nombre: "Singapur",
    genero: "Pop del sudeste asiático",
    artistas: ["JJ Lin", "Stefanie Sun", "The Sam Willows"],
    emblema: { c: "江南 (Jiang Nan)", a: "JJ Lin" },
  },
  IN: {
    nombre: "India",
    genero: "Bollywood y clásica india",
    artistas: ["A.R. Rahman", "Lata Mangeshkar", "Ravi Shankar", "Arijit Singh"],
    emblema: { c: "Jai Ho", a: "A.R. Rahman" },
  },
  AE: {
    nombre: "Emiratos Árabes",
    genero: "Pop árabe y khaleeji",
    artistas: ["Hussain Al Jassmi", "Ahlam", "Balqees"],
    emblema: { c: "Boshret Kheir", a: "Hussain Al Jassmi" },
  },
  HK: {
    nombre: "Hong Kong",
    genero: "Cantopop",
    artistas: ["Leslie Cheung", "Anita Mui", "Eason Chan", "Beyond"],
    emblema: { c: "海闊天空 (Boundless Oceans, Vast Skies)", a: "Beyond" },
  },
  // ==== AFRICA / OCEANIA ====
  MA: {
    nombre: "Marruecos",
    genero: "Gnawa y chaabi",
    artistas: ["Nass El Ghiwane", "Saad Lamjarred", "Oum"],
    emblema: { c: "LM3ALLEM", a: "Saad Lamjarred" },
  },
  EG: {
    nombre: "Egipto",
    genero: "Clásica árabe y pop egipcio",
    artistas: ["Umm Kulthum", "Amr Diab", "Mohamed Ramadan"],
    emblema: { c: "Enta Omri", a: "Umm Kulthum" },
  },
  ZA: {
    nombre: "Sudáfrica",
    genero: "Amapiano y afro-pop",
    artistas: ["Miriam Makeba", "Tyla", "Ladysmith Black Mambazo", "Master KG"],
    emblema: { c: "Jerusalema", a: "Master KG" },
  },
  AU: {
    nombre: "Australia",
    genero: "Rock e indie australiano",
    artistas: ["AC/DC", "Tame Impala", "Kylie Minogue", "INXS", "Sia"],
    emblema: { c: "Down Under", a: "Men at Work" },
  },
  NZ: {
    nombre: "Nueva Zelanda",
    genero: "Indie y pop kiwi",
    artistas: ["Lorde", "Crowded House", "Six60"],
    emblema: { c: "Royals", a: "Lorde" },
  },
};

// ============ CIUDADES (override/refuerzo) — keyed por nombre normalizado ===
// Solo ciudades con identidad musical PROPIA fuerte. Los artistas listados
// son de esa ciudad especificamente; el emblema es "la cancion de la ciudad".
export const MUSICA_CIUDADES = {
  "madrid": {
    artistas: ["Mecano", "C. Tangana", "Leiva", "Rosendo"],
    emblema: { c: "Pongamos que hablo de Madrid", a: "Joaquín Sabina" },
    genero: "Pop madrileño y movida",
  },
  "barcelona": {
    artistas: ["Rosalía", "Estopa", "Joan Manuel Serrat", "Aitana"],
    emblema: { c: "Barcelona", a: "Freddie Mercury & Montserrat Caballé" },
    genero: "Pop catalán y rumba",
  },
  "sevilla": {
    artistas: ["Triana", "Los del Río", "María Peláe"],
    emblema: { c: "Sevilla tiene un color especial", a: "Los del Río" },
    genero: "Flamenco y sevillanas",
  },
  "paris": {
    artistas: ["Édith Piaf", "Daft Punk", "Serge Gainsbourg", "Aya Nakamura"],
    emblema: { c: "La Vie en Rose", a: "Édith Piaf" },
    genero: "Chanson parisina",
  },
  "roma": {
    artistas: ["Måneskin", "Antonello Venditti", "Ennio Morricone"],
    emblema: { c: "Roma Capoccia", a: "Antonello Venditti" },
    genero: "Cantautori romani",
  },
  "napoles": {
    artistas: ["Pino Daniele", "Liberato", "Geolier"],
    emblema: { c: "O Sole Mio", a: "Luciano Pavarotti" },
    genero: "Canción napolitana",
  },
  "londres": {
    artistas: ["The Rolling Stones", "Adele", "The Clash", "Amy Winehouse"],
    emblema: { c: "London Calling", a: "The Clash" },
    genero: "Rock y soul londinense",
  },
  "liverpool": {
    artistas: ["The Beatles"],
    emblema: { c: "Penny Lane", a: "The Beatles" },
    genero: "Merseybeat",
  },
  "edimburgo": {
    artistas: ["The Proclaimers", "KT Tunstall"],
    emblema: { c: "I'm Gonna Be (500 Miles)", a: "The Proclaimers" },
    genero: "Folk escocés",
  },
  "dublin": {
    artistas: ["U2", "The Dubliners", "Thin Lizzy"],
    emblema: { c: "Whiskey in the Jar", a: "The Dubliners" },
    genero: "Folk irlandés",
  },
  "berlin": {
    artistas: ["Rammstein", "Paul Kalkbrenner", "Seeed"],
    emblema: { c: "Sky and Sand", a: "Paul Kalkbrenner" },
    genero: "Techno berlinés",
  },
  "viena": {
    artistas: ["Mozart", "Johann Strauss II", "Falco"],
    emblema: { c: "El Danubio Azul", a: "Johann Strauss II" },
    genero: "Clásica vienesa",
  },
  "lisboa": {
    artistas: ["Amália Rodrigues", "Madredeus", "Carminho"],
    emblema: { c: "Uma Casa Portuguesa", a: "Amália Rodrigues" },
    genero: "Fado lisboeta",
  },
  "nueva york": {
    artistas: ["Jay-Z", "Alicia Keys", "The Strokes", "Billy Joel"],
    emblema: { c: "Empire State of Mind", a: "Jay-Z & Alicia Keys" },
    genero: "Hip-hop y rock neoyorquino",
  },
  "los angeles": {
    artistas: ["Red Hot Chili Peppers", "Kendrick Lamar", "The Doors", "Billie Eilish"],
    emblema: { c: "Californication", a: "Red Hot Chili Peppers" },
    genero: "West coast",
  },
  "chicago": {
    artistas: ["Kanye West", "Chance the Rapper", "Muddy Waters", "Frankie Knuckles"],
    emblema: { c: "Sweet Home Chicago", a: "Robert Johnson" },
    genero: "Blues y house",
  },
  "miami": {
    artistas: ["Gloria Estefan", "Pitbull", "DJ Khaled"],
    emblema: { c: "Conga", a: "Gloria Estefan" },
    genero: "Latin pop",
  },
  "buenos aires": {
    artistas: ["Soda Stereo", "Charly García", "Astor Piazzolla", "Tan Biónica"],
    emblema: { c: "Mi Buenos Aires querido", a: "Carlos Gardel" },
    genero: "Tango y rock porteño",
  },
  "medellin": {
    artistas: ["Karol G", "J Balvin", "Maluma", "Juanes"],
    emblema: { c: "La Camisa Negra", a: "Juanes" },
    genero: "Reggaetón paisa",
  },
  "bogota": {
    artistas: ["Aterciopelados", "Andrés Cepeda", "Morat", "Monsieur Periné"],
    emblema: { c: "Bogotá", a: "Andrés Cepeda" },
    genero: "Rock y pop bogotano",
  },
  "cali": {
    artistas: ["Grupo Niche", "Guayacán Orquesta", "Jairo Varela"],
    emblema: { c: "Cali Pachanguero", a: "Grupo Niche" },
    genero: "Salsa caleña",
  },
  "cartagena": {
    artistas: ["Carlos Vives", "Kevin Flórez", "Mr Black"],
    emblema: { c: "La Fantástica", a: "Carlos Vives" },
    genero: "Champeta y vallenato",
  },
  "ciudad de mexico": {
    artistas: ["Café Tacvba", "Zoé", "Molotov", "Los Ángeles Azules"],
    emblema: { c: "Eres", a: "Café Tacvba" },
    genero: "Rock y cumbia chilanga",
  },
  "guadalajara": {
    artistas: ["Vicente Fernández", "Maná", "Alejandro Fernández"],
    emblema: { c: "Guadalajara", a: "Pepe Guízar" },
    genero: "Mariachi",
  },
  "rio de janeiro": {
    artistas: ["Tom Jobim", "Jorge Ben Jor", "Anitta", "Seu Jorge"],
    emblema: { c: "Garota de Ipanema", a: "Tom Jobim & Vinícius" },
    genero: "Bossa nova y funk carioca",
  },
  "sao paulo": {
    artistas: ["Racionais MC's", "Criolo", "Emicida"],
    emblema: { c: "Sampa", a: "Caetano Veloso" },
    genero: "Rap paulista y MPB",
  },
  "lima": {
    artistas: ["Chabuca Granda", "Eva Ayllón", "Susana Baca"],
    emblema: { c: "La Flor de la Canela", a: "Chabuca Granda" },
    genero: "Vals criollo",
  },
  "santiago": {
    artistas: ["Los Prisioneros", "Víctor Jara", "Los Bunkers"],
    emblema: { c: "Tren al Sur", a: "Los Prisioneros" },
    genero: "Rock chileno",
  },
  "montevideo": {
    artistas: ["Jorge Drexler", "La Vela Puerca", "Rubén Rada"],
    emblema: { c: "Al Otro Lado del Río", a: "Jorge Drexler" },
    genero: "Candombe",
  },
  "guayaquil": {
    artistas: ["Julio Jaramillo", "Daniel Betancourth"],
    emblema: { c: "Nuestro Juramento", a: "Julio Jaramillo" },
    genero: "Pasillo",
  },
  "la habana": {
    artistas: ["Buena Vista Social Club", "Celia Cruz", "Gente de Zona"],
    emblema: { c: "Chan Chan", a: "Compay Segundo" },
    genero: "Son cubano",
  },
  "tokio": {
    artistas: ["YOASOBI", "Hikaru Utada", "Mariya Takeuchi"],
    emblema: { c: "Plastic Love", a: "Mariya Takeuchi" },
    genero: "City pop",
  },
  "seul": {
    artistas: ["BTS", "BLACKPINK", "IU"],
    emblema: { c: "Gangnam Style", a: "PSY" },
    genero: "K-pop",
  },
  "hong kong": {
    artistas: ["Beyond", "Eason Chan", "Anita Mui"],
    emblema: { c: "海闊天空 (Boundless Oceans, Vast Skies)", a: "Beyond" },
    genero: "Cantopop",
  },
  "sidney": {
    artistas: ["AC/DC", "INXS", "Flume"],
    emblema: { c: "Down Under", a: "Men at Work" },
    genero: "Rock australiano",
  },
  "estambul": {
    artistas: ["Tarkan", "Sezen Aksu", "Barış Manço"],
    emblema: { c: "Şımarık", a: "Tarkan" },
    genero: "Pop turco y anatolian rock",
  },
  "atenas": {
    artistas: ["Mikis Theodorakis", "Nana Mouskouri"],
    emblema: { c: "Zorba's Dance", a: "Mikis Theodorakis" },
    genero: "Rebétiko",
  },
  "praga": {
    artistas: ["Bedřich Smetana", "Karel Gott"],
    emblema: { c: "Vltava (El Moldava)", a: "Bedřich Smetana" },
    genero: "Clásica bohemia",
  },
  "amsterdam": {
    artistas: ["Tiësto", "André Hazes", "Martin Garrix"],
    emblema: { c: "Tulpen uit Amsterdam", a: "Herman Emmink" },
    genero: "Dance holandés",
  },
  "nueva orleans": {
    artistas: ["Louis Armstrong", "Dr. John", "Trombone Shorty"],
    emblema: { c: "What a Wonderful World", a: "Louis Armstrong" },
    genero: "Jazz de Nueva Orleans",
  },
};

// ============ VIBES por temporada/tags ============
// La sugerencia extra: playlist de busqueda en Spotify que combina con los
// TAGS de la ciudad y la ESTACION del viaje. q = query de busqueda.
const VIBES = {
  playaVerano: { icono: "🏖️", q: "verano hits playa", labelKey: "musicaVibePlaya" },
  invierno: { icono: "❄️", q: "cozy winter acoustic", labelKey: "musicaVibeInvierno" },
  romantico: { icono: "💐", q: "romantic dinner jazz", labelKey: "musicaVibeRomantico" },
  nocturna: { icono: "🌙", q: "party hits fiesta", labelKey: "musicaVibeNocturna" },
  historia: { icono: "🏛️", q: "classical essentials", labelKey: "musicaVibeHistoria" },
  naturaleza: { icono: "🌿", q: "acoustic chill nature", labelKey: "musicaVibeNaturaleza" },
};

// Hemisferio sur: la estacion se invierte respecto al norte.
const PAISES_HEMISFERIO_SUR = new Set(["AR", "CL", "UY", "PY", "BO", "PE", "AU", "NZ", "ZA", "BR"]);

function estacionEn(iso, mes /* 1-12 */) {
  const sur = PAISES_HEMISFERIO_SUR.has(iso);
  const m = sur ? ((mes + 5) % 12) + 1 : mes; // desfase 6 meses en el sur
  if (m >= 6 && m <= 8) return "verano";
  if (m === 12 || m <= 2) return "invierno";
  return "media"; // primavera/otoño: sin vibe estacional fuerte
}

// ============ API principal ============
// ciudad, pais: strings como vienen del itinerario/destino.
// mesViaje: 1-12 (opcional; default mes actual).
// Devuelve null si no hay datos ni de ciudad ni de pais (no renderizar nada).
export function musicaPara(ciudad, pais, mesViaje = null) {
  const iso = isoDesdeNombre(pais) || "";
  const base = MUSICA_PAISES[iso] || null;
  const local = MUSICA_CIUDADES[norm(ciudad)] || null;
  if (!base && !local) return null;

  const genero = local?.genero || base?.genero || "";
  // Artistas: los de la ciudad primero, completados con los del pais (sin
  // duplicar), maximo 6.
  const vistos = new Set();
  const artistas = [];
  for (const a of [...(local?.artistas || []), ...(base?.artistas || [])]) {
    const k = norm(a);
    if (vistos.has(k)) continue;
    vistos.add(k);
    artistas.push(a);
    if (artistas.length >= 6) break;
  }
  const emblema = local?.emblema || base?.emblema || null;

  // Tendencia: Top 50 del pais en Spotify (playlist editorial que Spotify
  // actualiza a diario). El deep link de busqueda la trae de primera.
  const nombrePais = base?.nombre || pais || "";
  const top = nombrePais
    ? { label: nombrePais, url: linkSpotify(`Top 50 ${nombrePais}`) }
    : null;

  // Vibe de temporada: tags de la ciudad + estacion en el destino.
  const mes = mesViaje || new Date().getMonth() + 1;
  const estacion = estacionEn(iso, mes);
  const tags = tagsDe({ ciudad, pais }) || [];
  let vibe = null;
  if (tags.includes("playa") && estacion !== "invierno") vibe = VIBES.playaVerano;
  else if (estacion === "invierno" || tags.includes("invierno")) vibe = VIBES.invierno;
  else if (tags.includes("nocturna")) vibe = VIBES.nocturna;
  else if (tags.includes("romantico")) vibe = VIBES.romantico;
  else if (tags.includes("historia")) vibe = VIBES.historia;
  else if (tags.includes("naturaleza")) vibe = VIBES.naturaleza;

  return { genero, artistas, emblema, top, vibe, iso };
}
