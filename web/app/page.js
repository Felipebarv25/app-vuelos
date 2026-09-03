"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { startTransition, useEffect, useRef, useState } from "react";
import { geocodificar, traerLugares, CATEGORIAS } from "@/lib/osm";
import { traducirLoteWD, nombreLocalizado } from "@/lib/nombres";
import { compartirEnlace } from "@/lib/compartir";
import { getDestinoPorSlug } from "@/lib/destinos";
import { DESTINOS_PRESUPUESTO } from "@/lib/presupuesto";
import { construirItinerario, agregarLugarADia, optimizarRutaDia, moverParadaADia, reordenarParada, fmtMin } from "@/lib/itinerario";
import { leerGustos, guardarGustos, categoriasDeGustos, intercalarLugares, HORAS_POR_RITMO } from "@/lib/gustos";
import { hitosParaCiudad, contarHitosEnLista } from "@/data/hitos-garantizados";
import { isoDesdeNombre, infoPais } from "@/lib/requisitos";
import { sugerirCiudades } from "@/lib/autocompletar";
import { useGeo } from "@/lib/useGeo";
import { Chip } from "@/components/ui";
import Itinerario from "@/components/Itinerario";
import Bienvenida from "@/components/Bienvenida";
import SelectorIdioma from "@/components/SelectorIdioma";
import SelectorMoneda from "@/components/SelectorMoneda";
import SelectorPais from "@/components/SelectorPais";
import { monedaDePais, simboloMoneda } from "@/lib/monedas";
import CardDestino from "@/components/CardDestino";
// MiniOfertas VUELVE al home (2026-09). Se habia quitado por redundante con
// el hero de presupuesto; ahora que ese hero se va — el presupuesto vive en
// /mis-viajes — las ofertas del dia son lo principal de la portada.
const MiniOfertas = dynamic(() => import("@/components/MiniOfertas"), { ssr: false });
import { AfiliadosCiudad } from "@/components/Afiliados";
import { listarViajesAsync, guardarViajeAsync, borrarViajeAsync } from "@/lib/viajes";
import { LogoMarca } from "@/components/Logo";
import { Icono } from "@/components/Icono";
import Toast from "@/components/Toast";
import { useApp } from "@/lib/AppContext";
import { track, trackVisita } from "@/lib/track";
import { registrarEvento, obtenerRecomendaciones } from "@/lib/perfil";
import { useBrowserBackClose } from "@/lib/useBrowserBack";
import MenuUsuario from "@/components/MenuUsuario";
import FooterAnduve from "@/components/FooterAnduve";
import { obtenerGeo } from "@/lib/geo";

const Mapa = dynamic(() => import("@/components/Mapa"), { ssr: false });
// Tab bar mobile cargado lazy (solo importa en mobile, pero igual no es
// critico para el primer paint).
const BottomTabBar = dynamic(() => import("@/components/BottomTabBar"), { ssr: false });
// Modales y bloques cargados sólo cuando el usuario los necesita. Salen del
// bundle inicial (que pagan TODOS los visitantes, incluido el pre-login).
// Cada uno se descarga al primer render condicional → mejora LCP/INP.
const Presupuesto = dynamic(() => import("@/components/Presupuesto"));
const DetalleLugar = dynamic(() => import("@/components/DetalleLugar"));
const RequisitosViaje = dynamic(() => import("@/components/RequisitosViaje"));
const Paywall = dynamic(() => import("@/components/Paywall"));
const Asesor = dynamic(() => import("@/components/Asesor"));
// Chip de alertas en el home post-login. Se dinamica para no engordar el
// bundle del pre-login (audit 2026-06-29: exponer alertas antes de entrar
// a una ciudad).
const AlertasChip = dynamic(() => import("@/components/AlertasChip"), { ssr: false });
// Banda sonora de la ciudad: solo se necesita dentro de una ciudad, fuera
// del bundle inicial.
const MusicaCiudad = dynamic(() => import("@/components/MusicaCiudad"));
// "Estás en {ciudad}": ruta de visita de la ciudad actual (geo IP).
const EstasEnCiudad = dynamic(() => import("@/components/EstasEnCiudad"), { ssr: false });
// Tira de fotos de la ciudad bajo el titulo de la vista de ruta.
const FotosCiudadHeader = dynamic(() => import("@/components/FotosCiudadHeader"), { ssr: false });
// Buscador del punto de partida (hotel/barrio) de la ruta.
const InicioRuta = dynamic(() => import("@/components/InicioRuta"), { ssr: false });
// Wizard "tu ruta a tu medida": 3 preguntas de filtro que ponderan el plan.
const PersonalizarRuta = dynamic(() => import("@/components/PersonalizarRuta"), { ssr: false });
// Anduve Live: agenda social de eventos de la ciudad (yo voy + chat).
const EventosCiudad = dynamic(() => import("@/components/EventosCiudad"), { ssr: false });
// Chat grupal de viajeros de la ciudad abierta (presencia + mensajes).
const ChatViajeros = dynamic(() => import("@/components/ChatViajeros"), { ssr: false });

// Destinos destacados con foto (fotos libres de Wikimedia Commons).
// visitantes: turistas internacionales/año (millones, datos publicos UNWTO,
// Euromonitor y oficinas de turismo locales 2022-2024). Sirve para el chip
// de prueba social sobre las tarjetas.
const DESTINOS_DESTACADOS = [
  { nombre: "París", pais: "Francia", q: "París, Francia", hint: "Torre Eiffel", visitantes: 30 },
  { nombre: "Roma", pais: "Italia", q: "Roma, Italia", hint: "Coliseo", visitantes: 10 },
  { nombre: "Tokio", pais: "Japón", q: "Tokio, Japón", hint: "Tokyo Tower", visitantes: 15 },
  { nombre: "Nueva York", pais: "EE. UU.", q: "Nueva York, Estados Unidos", hint: "Manhattan skyline", visitantes: 13 },
  { nombre: "Cartagena", pais: "Colombia", q: "Cartagena, Colombia", hint: "Cartagena de Indias", visitantes: 1.5 },
  { nombre: "Barcelona", pais: "España", q: "Barcelona, España", hint: "Sagrada Familia", visitantes: 12 },
  { nombre: "Londres", pais: "Reino Unido", q: "Londres, Reino Unido", hint: "Big Ben London", visitantes: 21 },
  { nombre: "Estambul", pais: "Turquía", q: "Estambul, Turquía", hint: "Hagia Sophia Istanbul", visitantes: 16 },
  { nombre: "Dubái", pais: "Emiratos Árabes", q: "Dubái, Emiratos Árabes Unidos", hint: "Burj Khalifa Dubai", visitantes: 17 },
  { nombre: "Río de Janeiro", pais: "Brasil", q: "Río de Janeiro, Brasil", hint: "Christ the Redeemer Rio de Janeiro", visitantes: 2.5 },
  { nombre: "Ámsterdam", pais: "Países Bajos", q: "Ámsterdam, Países Bajos", hint: "Amsterdam canals", visitantes: 9 },
  { nombre: "Buenos Aires", pais: "Argentina", q: "Buenos Aires, Argentina", hint: "Obelisco Buenos Aires", visitantes: 3 },
];

// Imagenes del hero del inicio agrupadas por TEMA (gusto principal del usuario).
// Si el perfil del usuario indica que le gustan las playas, mostramos playas;
// historia => ciudades historicas; etc. Si no hay perfil, usamos "general"
// que es una mezcla. Rotan cada ~10s con crossfade suave.
const HERO_IMGS_POR_TEMA = {
  playa: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70", // playa caribeña
    "https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1600&q=70", // playa con olas
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=70", // playa tropical aérea
    "https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?auto=format&fit=crop&w=1600&q=70", // playa palmeras
    "https://images.unsplash.com/photo-1493558103817-58b2924bce98?auto=format&fit=crop&w=1600&q=70", // Cancún
    "https://images.unsplash.com/photo-1499002238440-d264edd596ec?auto=format&fit=crop&w=1600&q=70", // Bali playa
    "https://images.unsplash.com/photo-1505881402582-c5bc11054f91?auto=format&fit=crop&w=1600&q=70", // Maldivas overwater
  ],
  ciudad: [
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=70", // París / Torre Eiffel
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1600&q=70", // NY noche
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=70", // ciudad europea
    "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?auto=format&fit=crop&w=1600&q=70", // NY skyline
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=70", // Tokio
  ],
  historia: [
    "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=70", // Coliseo Roma
    "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1600&q=70", // Acrópolis Atenas
    "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1600&q=70", // templo asiático
    "https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?auto=format&fit=crop&w=1600&q=70", // Marrakech
  ],
  naturaleza: [
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=70", // montañas lago
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=70", // bosque verde
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=70", // panorama natural
    "https://images.unsplash.com/photo-1426604966848-d7adac402bff?auto=format&fit=crop&w=1600&q=70", // sendero en el bosque
    "https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=1600&q=70", // bosque con rayos de luz
    "https://images.unsplash.com/photo-1500964757637-c85e8a162699?auto=format&fit=crop&w=1600&q=70", // cataratas / selva
  ],
  montana: [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=70", // Alpes amanecer
    "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1600&q=70", // sierra
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1600&q=70", // valle montañas
    "https://images.unsplash.com/photo-1483653364400-eedcfb9f1f88?auto=format&fit=crop&w=1600&q=70", // cabaña en la montaña
    "https://images.unsplash.com/photo-1495344517868-8ebaf0a2044a?auto=format&fit=crop&w=1600&q=70", // camping con vista
  ],
  gastronomia: [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=70", // restaurante cálido
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=70", // mesa con comida
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=70", // plato gourmet
  ],
  lujo: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=70", // piscina infinity
    "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1600&q=70", // resort lujo
    "https://images.unsplash.com/photo-1505881402582-c5bc11054f91?auto=format&fit=crop&w=1600&q=70", // Maldivas overwater
  ],
  nocturna: [
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=70", // bar cóctel
    "https://images.unsplash.com/photo-1535079859068-2f9b3fa4d4ca?auto=format&fit=crop&w=1600&q=70", // ciudad de noche
    "https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=1600&q=70", // skyline nocturno
    "https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=1600&q=70", // luces de ciudad
  ],
  romantico: [
    "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1600&q=70", // Santorini atardecer
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=70", // París romántico
    "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?auto=format&fit=crop&w=1600&q=70", // París atardecer
    "https://images.unsplash.com/photo-1473625247510-8ceb1760943f?auto=format&fit=crop&w=1600&q=70", // Mykonos
  ],
  // ==== TEMAS NUEVOS ====
  // Aventura: lo activan TAGS_POR_REGION (África y Oceanía empiezan con
  // "aventura"). Cubre safari, selva y deportes extremos.
  aventura: [
    "https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?auto=format&fit=crop&w=1600&q=70", // safari elefantes
    "https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=1600&q=70", // safari
    "https://images.unsplash.com/photo-1547036967-23d11aacaee0?auto=format&fit=crop&w=1600&q=70", // cebras África
    "https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=1600&q=70", // selva profunda
    "https://images.unsplash.com/photo-1469041797191-50ace28483c3?auto=format&fit=crop&w=1600&q=70", // camellos
  ],
  // Invierno / nieve. Para destinos fríos (Suiza, Noruega, Canadá, Japón
  // en invierno). Por ahora solo se activa si manualmente seteas tema o si
  // luego ampliamos destinosTags.js.
  invierno: [
    "https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?auto=format&fit=crop&w=1600&q=70", // montañas nevadas
    "https://images.unsplash.com/photo-1418985991508-e47386d96a71?auto=format&fit=crop&w=1600&q=70", // ski
    "https://images.unsplash.com/photo-1542401886-65d6c61db217?auto=format&fit=crop&w=1600&q=70", // ski montaña
    "https://images.unsplash.com/photo-1551524559-8af4e6624178?auto=format&fit=crop&w=1600&q=70", // bosque invierno
  ],
  // Desierto. Para Dubái, Marruecos, Egipto, etc.
  desierto: [
    "https://images.unsplash.com/photo-1473580044384-7ba9967e16a0?auto=format&fit=crop&w=1600&q=70", // Sáhara
    "https://images.unsplash.com/photo-1493514789931-586cb221d7a7?auto=format&fit=crop&w=1600&q=70", // dunas
    "https://images.unsplash.com/photo-1469041797191-50ace28483c3?auto=format&fit=crop&w=1600&q=70", // camellos
  ],
  // Asia / Oriente. Templos, ciudades asiáticas, naturaleza tropical.
  asia: [
    "https://images.unsplash.com/photo-1492571350019-22de08371fd3?auto=format&fit=crop&w=1600&q=70", // templo
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=70", // Tokio
    "https://images.unsplash.com/photo-1545569341-9eb8b30979d9?auto=format&fit=crop&w=1600&q=70", // Bali templo
    "https://images.unsplash.com/photo-1437846972679-9e6e537be46e?auto=format&fit=crop&w=1600&q=70", // cuevas tropicales
  ],
  general: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1503917988258-f87a78e3c995?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?auto=format&fit=crop&w=1600&q=70", // NY
    "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1600&q=70", // Tokio
    "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=70", // mapa vintage
  ],
};
const HERO_IMG = HERO_IMGS_POR_TEMA.general[0];

// Codigo ISO de pais -> nombre legible para el hero. Solo los que cubrimos en
// el catalogo de origenes mas algunos clave para mostrar el branding correcto.
// Si el pais detectado no esta aqui, cae al default ("Colombia") por compat.
const PAIS_GENTILICIO = {
  CO: "Colombia",
  MX: "México",
  EC: "Ecuador",
  PE: "Perú",
  CL: "Chile",
  AR: "Argentina",
  BR: "Brasil",
  VE: "Venezuela",
  ES: "España",
  US: "Estados Unidos",
  // Bonus (no estan en el detector pero cubren visitantes comunes):
  GB: "Reino Unido",
  FR: "Francia",
  DE: "Alemania",
  IT: "Italia",
  CA: "Canadá",
  PT: "Portugal",
  NL: "Países Bajos",
  CH: "Suiza",
};

// Mensaje rotatorio durante carga larga: en vez del spinner mudo, se le cuenta
// al usuario en que parte del proceso esta la app. Antes solo veia "Buscando los
// mejores lugares..." durante hasta 8s, lo que se sentia trabado.
// Cards de entrada del home (Opción A — 2026-06-24, refinada 2026-06-25 con
// foto de fondo). Cada card linkea a su sección. Diseño con altura fija +
// foto de fondo + overlay teal degradado de abajo hacia arriba para legibilidad
// del texto. Hover sube ligeramente la card y oscurece el overlay para feedback.
// `onClick` se usa cuando la card debe disparar una accion en el cliente
// (como abrir el modal de Presupuesto) en lugar de navegar. Si se pasa
// onClick, renderiza como <button>; si no, como <Link>.
function EntryCard({ href, onClick, icono, titulo, subtitulo, cta, bg }) {
  const claseBase = "group relative block aspect-[3/4] w-full overflow-hidden rounded-xl text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-modal sm:aspect-[5/6]";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={claseBase}>
        {renderEntryCardBody({ bg, icono, titulo, subtitulo, cta })}
      </button>
    );
  }
  return (
    <Link href={href} className={claseBase}>
      {renderEntryCardBody({ bg, icono, titulo, subtitulo, cta })}
    </Link>
  );
}

function renderEntryCardBody({ bg, icono, titulo, subtitulo, cta }) {
  return (
    <>
      {/* Foto de fondo */}
      <div
        className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
        style={{ backgroundImage: `url(${bg})` }}
      />
      {/* Overlay teal degradado: oscuro abajo (para legibilidad del título) y
          casi transparente arriba (para que la foto se vea). En hover el
          overlay se oscurece ligeramente. */}
      <div className="absolute inset-0 bg-gradient-to-t from-marca-950/95 via-marca-900/60 to-marca-900/10 transition group-hover:from-marca-950" />
      {/* Contenido */}
      <div className="relative flex h-full flex-col justify-between p-5">
        <div className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-white backdrop-blur-sm ring-1 ring-white/25">
          <EntryIcono nombre={icono} />
        </div>
        <div>
          <div className="text-[16.5px] font-extrabold leading-tight tracking-tight text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">
            {titulo}
          </div>
          <div className="mt-1 text-[12.5px] text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
            {subtitulo}
          </div>
          <div className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-white transition group-hover:translate-x-0.5">
            {cta}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </>
  );
}

function EntryIcono({ nombre }) {
  const p = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (nombre === "globe") return (<svg {...p}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>);
  if (nombre === "plane") return (<svg {...p}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>);
  if (nombre === "bookmark") return (<svg {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>);
  if (nombre === "compass") return (<svg {...p}><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-2.9 6.3-6.3 2.9 2.9-6.3z" /></svg>);
  return null;
}

function MensajeCargandoLugares({ t }) {
  const [fase, setFase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setFase(1), 800),
      setTimeout(() => setFase(2), 2000),
      setTimeout(() => setFase(3), 3500),
      setTimeout(() => setFase(4), 5200),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  const pasos = [
    { icono: "✨", clave: "loadCreando", sub: "loadCreandoSub" },
    { icono: "🎯", clave: "loadPreferencias", sub: "loadPreferenciasSub" },
    { icono: "🗺️", clave: "loadMapeando", sub: "loadMapeandoSub" },
    { icono: "📍", clave: "loadEnriqueciendo", sub: "loadEnriqueSub" },
    { icono: "⚡", clave: "loadOptimizando", sub: "loadOptimizandoSub" },
  ];

  return (
    <div className="rounded-2xl border border-marca-100 bg-gradient-to-br from-marca-50/50 to-violet-50/50 p-5 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
      <div className="mb-4 text-[17px] font-extrabold tracking-tight text-marca-900">
        {t("loadTitulo")}
      </div>
      <div className="space-y-2.5">
        {pasos.map((p, i) => {
          const done = i < fase;
          const active = i === fase;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 transition-all duration-500 ${
                done ? "bg-white shadow-sm dark:bg-slate-700" :
                active ? "bg-white shadow-md ring-1 ring-marca-200 dark:bg-slate-700 dark:ring-marca-800" :
                "opacity-40"
              }`}
            >
              <span className="text-lg">{p.icono}</span>
              <div className="min-w-0 flex-1">
                <div className={`text-[13.5px] font-bold ${done || active ? "text-slate-800 dark:text-slate-100" : "text-slate-400"}`}>
                  {t(p.clave)}
                </div>
                <div className={`text-[12px] ${done || active ? "text-slate-500 dark:text-slate-400" : "text-slate-300"}`}>
                  {t(p.sub)}
                </div>
              </div>
              {done && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
              )}
              {active && (
                <span className="spin" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Saludo según la hora del día (cálido y personalizado).
function saludoClave() {
  const h = new Date().getHours();
  if (h < 6) return "saludoNoche";
  if (h < 12) return "saludoManana";
  if (h < 19) return "saludoTarde";
  return "saludoNoche";
}
function saludoEmoji() {
  const h = new Date().getHours();
  if (h < 6) return "🌙";
  if (h < 12) return "☀️";
  if (h < 19) return "🌤️";
  return "🌆";
}

export default function Home() {
  const { t, lang, usuario, salir, listo, pro, paywall, abrirPaywall, cerrarPaywall, requierePro, darkMode, toggleDark } = useApp();

  // ResizeObserver: medimos la altura REAL del <header> y la exponemos como
  // CSS var `--v360-header-h`. Antes el mapa sticky usaba `top-[150px]` y
  // `calc(100vh-172px)` hardcoded — si el header cambiaba de alto (idioma
  // con texto mas largo, wrap en pantalla angosta, etc.) el mapa se
  // desalineaba. Ahora se ajusta solo. El +88 cubre el sub-header de ciudad
  // que va entre el header global y el mapa sticky.
  useEffect(() => {
    if (typeof window === "undefined" || typeof ResizeObserver === "undefined") return;
    const header = document.querySelector("header");
    if (!header) return;
    const aplicar = () => {
      const h = header.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--v360-header-h", `${Math.round(h + 88)}px`);
    };
    aplicar();
    const ro = new ResizeObserver(aplicar);
    ro.observe(header);
    window.addEventListener("resize", aplicar);
    return () => { ro.disconnect(); window.removeEventListener("resize", aplicar); };
  }, []);

  const [consulta, setConsulta] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [mostrarSug, setMostrarSug] = useState(false);
  const [ciudad, setCiudad] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [cargandoLugares, setCargandoLugares] = useState(false);
  const [error, setError] = useState(null);

  // Configuración del viaje
  const [dias, setDias] = useState(3);
  const [horas, setHoras] = useState(8);
  const [fechaInicio, setFechaInicio] = useState(""); // YYYY-MM-DD (opcional)
  const [fechaFin, setFechaFin] = useState("");
  const [nacionalidad, setNacionalidad] = useState("CO"); // pasaporte para requisitos
  const [momento, setMomento] = useState("diurno");
  const [categoria, setCategoria] = useState("imperdibles");

  // Datos
  const [lugaresBase, setLugaresBase] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [plan, setPlan] = useState([]);
  const [diaVisible, setDiaVisible] = useState(0);
  // Bump para forzar re-render cuando traducirLoteWD muta nombres en sitio.
  const [revTraduccion, setRevTraduccion] = useState(0);
  void revTraduccion;

  // Lugar abierto en detalle + ruta trazada en el mapa
  const [detalle, setDetalle] = useState(null);
  const [rutaTrazada, setRutaTrazada] = useState(null);
  const [mostrarPresupuesto, setMostrarPresupuesto] = useState(false);
  // Valores que el usuario tipea en el input de presupuesto del HERO. Si abre el
  // modal por ese camino, se le pasan como `inicial` y arranca ya con su monto.
  // Default 0 (audit 2026-07-01): el hero arranca vacio para que el usuario
  // escriba el monto que le nace, sin anclas. El input tiene placeholder "0".
  // Los chips (5M/10M/20M) siguen siendo atajos rapidos.
  const [montoHero, setMontoHero] = useState(0);
  const [monedaHero, setMonedaHero] = useState("COP");
  const [presupuestoInicial, setPresupuestoInicial] = useState(null);
  // Despliega/colapsa el bloque de busqueda por ciudad (secundario en el nuevo
  // HERO: la entrada por presupuesto es la principal).
  // Abierto por defecto. Era la opcion escondida detras de "o si ya sabes a
  // donde" cuando el hero lo ocupaba el presupuesto; ahora que arriba hay
  // ofertas, el buscador es la segunda entrada legitima y no un secreto.
  const [mostrarBuscarCiudad, setMostrarBuscarCiudad] = useState(true);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [viajesGuardados, setViajesGuardados] = useState([]);
  const [guardado, setGuardado] = useState(false);

  // Anduve Live: panel de eventos abierto para { ciudad, iso } o null.
  const [eventosDe, setEventosDe] = useState(null);

  // Hospedaje: punto de partida de la ruta ("mi hotel esta en X"). Cuando
  // esta seteado, el itinerario se optimiza desde ahi en vez del centro.
  const [hospedaje, setHospedaje] = useState(null); // { nombre, lat, lon } | null
  // Modo "elegir inicio en el mapa" (2026-07-13): el proximo clic/tap sobre
  // el mapa fija el punto de partida de la ruta.
  const [eligiendoEnMapa, setEligiendoEnMapa] = useState(false);
  const mapaBoxRef = useRef(null);
  // Gustos del viajero (wizard de 3 preguntas, 2026-07-13). Cargados de
  // localStorage al montar; cuando existen, el itinerario de toda ciudad se
  // arma mezclando SUS categorias en vez del bloque generico de imperdibles.
  const [gustos, setGustos] = useState(null);
  const [mostrarPersonalizar, setMostrarPersonalizar] = useState(false);
  useEffect(() => { setGustos(leerGustos()); }, []);
  // Primera ciudad que abre en su vida: ofrecer el wizard UNA sola vez.
  useEffect(() => {
    if (!ciudad) return;
    try {
      if (leerGustos() || localStorage.getItem("anduve_gustos_visto")) return;
      localStorage.setItem("anduve_gustos_visto", "1");
      setMostrarPersonalizar(true);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ciudad?.nombre]);

  // Vaivén suave de los chips de categorías (feedback 2026-07-11): al abrir
  // una ciudad, la fila se desliza lentamente ida-y-vuelta un par de ciclos
  // para ENSEÑAR que hay más tipos (Compras, Miradores...) sin que el
  // usuario tenga que descubrir el scroll. Se detiene para siempre al primer
  // toque/rueda/arrastre del usuario.
  const chipsRef = useRef(null);
  useEffect(() => {
    const el = chipsRef.current;
    if (!el || !ciudad) return;
    if (el.scrollWidth <= el.clientWidth + 8) return; // no hay overflow
    let raf, t0 = null, parado = false;
    // Recorrido COMPLETO: hasta el ultimo chip de la derecha (feedback
    // 2026-07-11: con amplitud capada solo se veia una parte). La duracion
    // escala con la distancia (~45 px/s) para que la velocidad se sienta
    // igual de calmada en filas cortas y largas.
    const amplitud = el.scrollWidth - el.clientWidth;
    const periodo = Math.max(11, (amplitud / 45) * 2); // ida+vuelta
    const parar = () => { parado = true; if (raf) cancelAnimationFrame(raf); };
    const paso = (ts) => {
      if (parado) return;
      if (t0 == null) t0 = ts;
      const t = (ts - t0) / 1000;
      if (t > periodo * 2) { el.scrollLeft = 0; return; } // 2 ciclos y descansa
      el.scrollLeft = amplitud * (0.5 - 0.5 * Math.cos((t / periodo) * 2 * Math.PI));
      raf = requestAnimationFrame(paso);
    };
    const arranque = setTimeout(() => { raf = requestAnimationFrame(paso); }, 1200);
    el.addEventListener("pointerdown", parar, { once: true });
    el.addEventListener("wheel", parar, { once: true, passive: true });
    el.addEventListener("touchstart", parar, { once: true, passive: true });
    return () => { parado = true; clearTimeout(arranque); if (raf) cancelAnimationFrame(raf); };
  }, [ciudad]);

  // GPS
  const [gpsOn, setGpsOn] = useState(false);
  const { pos: gps } = useGeo(gpsOn);

  const debounce = useRef(null);
  // Guarda el último texto elegido del autocompletado (o pre-cargado por la app).
  // Sirve para que el useEffect de sugerencias NO reabra el dropdown justo
  // despues de elegir una ciudad (porque setConsulta dispara el efecto y el
  // debounce reabria el menu con la misma sugerencia ya seleccionada).
  const ultimaConsultaElegida = useRef("");

  // Métrica: cuenta una visita por sesión (para el panel privado).
  useEffect(() => {
    trackVisita(lang);
  }, [lang]);

  // Pais del visitante. Prioridad:
  //   1) localStorage `anduve_pais_iso` — elección manual del usuario
  //      (override del selector "📍 Detectado: X ✎"). Persiste para
  //      siempre, recordada entre sesiones.
  //   2) sessionStorage cache de la detección IP previa.
  //   3) /api/geo (IP geolocation vía Vercel headers, ~95% acierto).
  //   4) Fallback "CO" / "Colombia".
  // Guardamos ISO-2 y derivamos nombre via PAIS_GENTILICIO.
  const [paisIso, setPaisIso] = useState("CO");
  const [paisVisitante, setPaisVisitante] = useState("Colombia");
  useEffect(() => {
    let vivo = true;
    try {
      const manual = localStorage.getItem("anduve_pais_iso");
      if (manual) {
        setPaisIso(manual);
        setPaisVisitante(PAIS_GENTILICIO[manual] || manual);
        return;
      }
      const cacheIso = sessionStorage.getItem("anduve_pais_iso_geo");
      const cacheNombre = sessionStorage.getItem("anduve_pais_nombre");
      const cacheMoneda = sessionStorage.getItem("anduve_moneda_geo");
      if (cacheIso) {
        setPaisIso(cacheIso);
        setPaisVisitante(cacheNombre || cacheIso);
        const yaTocada = sessionStorage.getItem("anduve_moneda_user_set");
        if (!yaTocada && cacheMoneda) setMonedaHero(cacheMoneda);
        return;
      }
    } catch {}
    obtenerGeo()
      .then((g) => {
        if (!vivo) return;
        const iso = g?.pais || "CO";
        const nombre = PAIS_GENTILICIO[iso] || "Colombia";
        setPaisIso(iso);
        setPaisVisitante(nombre);
        try {
          sessionStorage.setItem("anduve_pais_iso_geo", iso);
          sessionStorage.setItem("anduve_pais_nombre", nombre);
        } catch {}
        try {
          const yaTocada = sessionStorage.getItem("anduve_moneda_user_set");
          if (!yaTocada) {
            const code = monedaDePais(iso);
            if (code) {
              setMonedaHero(code);
              sessionStorage.setItem("anduve_moneda_geo", code);
            }
          }
        } catch {}
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Override manual del país: el usuario corrige cuando la IP da algo
  // raro (VPN, roaming). Persiste en localStorage entre sesiones. Si
  // no ha tocado la moneda manualmente, también la actualizamos a la
  // del nuevo país (sin marcarla como "user_set" — sigue siendo
  // sincronizable).
  function cambiarPaisManual(iso) {
    if (!iso) return;
    setPaisIso(iso);
    setPaisVisitante(PAIS_GENTILICIO[iso] || iso);
    try {
      localStorage.setItem("anduve_pais_iso", iso);
      const yaTocada = sessionStorage.getItem("anduve_moneda_user_set");
      if (!yaTocada) {
        const code = monedaDePais(iso);
        if (code) setMonedaHero(code);
      }
    } catch {}
  }

  // Tema personalizado del hero (playa, ciudad, historia...) — depende del
  // perfil del usuario logueado. Lo trae /api/profile/recomendar; mientras
  // carga usamos "general". Tambien guardamos las recomendaciones para
  // mostrar una seccion "Pensamos que te gustaria".
  const [tema, setTema] = useState("general");
  const [recomendados, setRecomendados] = useState([]);
  useEffect(() => {
    if (!usuario?.email_login) return;
    let vivo = true;
    obtenerRecomendaciones().then((r) => {
      if (!vivo) return;
      if (r.tema && HERO_IMGS_POR_TEMA[r.tema]) setTema(r.tema);
      setRecomendados(r.recomendaciones || []);
    });
    return () => { vivo = false; };
  }, [usuario?.email_login, usuario?.email]);

  // Indice del fondo del hero. Rota cada 10s con crossfade suave (CSS) entre
  // las imagenes del tema actual. Pausa cuando el usuario no esta en la home
  // (ciudad seleccionada) para no gastar CPU/memoria innecesario.
  const [iHero, setIHero] = useState(0);
  const heroImgs = HERO_IMGS_POR_TEMA[tema] || HERO_IMGS_POR_TEMA.general;
  useEffect(() => {
    if (ciudad) return;
    setIHero(0);
    // Precargar todas las imagenes del tema para evitar parpadeos en el cambio.
    heroImgs.forEach((src) => { const img = new Image(); img.src = src; });
    const id = setInterval(() => setIHero((n) => (n + 1) % heroImgs.length), 10000);
    return () => clearInterval(id);
  }, [ciudad, tema]);

  // Conteo de "viajeros en linea" (presencia en vivo) para el chip social del
  // HERO. Genera un sessionId por pestana y hace POST a /api/online cada 60s
  // mientras la home este abierta. La respuesta trae `online` = navegadores
  // con ping en los ultimos 90s. Si KV no esta listo el endpoint responde
  // ok:false y el chip queda oculto.
  const [viajerosVivos, setViajerosVivos] = useState(null);
  useEffect(() => {
    if (ciudad) return; // solo en la pantalla de inicio
    let activo = true;

    // sessionId persistente por pestana (no por dispositivo): si abres dos
    // ventanas son dos "viajeros" — fiel a la idea de "lo que esta abierto".
    let sid;
    try {
      sid = sessionStorage.getItem("anduve_sid");
      if (!sid) {
        sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem("anduve_sid", sid);
      }
    } catch {
      sid = `tmp-${Math.random().toString(36).slice(2, 10)}`;
    }

    const pingear = async () => {
      try {
        const r = await fetch("/api/online", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sid }),
          keepalive: true,
        });
        if (!r.ok) return;
        const d = await r.json();
        if (activo && d?.ok && typeof d.online === "number") setViajerosVivos(d.online);
      } catch {}
    };

    pingear();
    const id = setInterval(pingear, 60000);
    return () => { activo = false; clearInterval(id); };
  }, [ciudad]);

  // CTA desde páginas estáticas de SEO (/destino/<slug>): al cargar la app con
  // ?destino=madrid-espana, abrimos esa ciudad directamente (sin que el usuario
  // tenga que volver a buscarla). Solo dispara una vez por sesión.
  // Tambien lee `anduve_intent_q` de sessionStorage — set por el trial anonimo
  // de Bienvenida cuando el visitante elige una ciudad antes de registrarse.
  // Tras auth, la home lo lee y abre esa ciudad como si la hubiera buscado.
  useEffect(() => {
    if (!listo || ciudad) return;
    try {
      // 1) Intent del trial anonimo (audit B1 - 2026-06-25). Mas alta prioridad
      // que los query params porque el usuario YA mostro intencion de ir alli.
      let intentQ = "";
      try {
        intentQ = sessionStorage.getItem("anduve_intent_q") || "";
        if (intentQ) sessionStorage.removeItem("anduve_intent_q");
      } catch {}
      if (intentQ && usuario) {
        const q = intentQ.trim();
        setConsulta(q);
        (async () => {
          try {
            setCargando(true);
            await buscarTexto(q);
          } finally {
            setCargando(false);
          }
        })();
        return;
      }
      const sp = new URLSearchParams(window.location.search);
      // ?presupuesto=1 → abrir el modal de presupuesto (CTA desde /destino).
      if (sp.get("presupuesto") === "1") {
        setMostrarPresupuesto(true);
        return;
      }
      // ?q=texto → auto-buscar (CTA desde /viaje/<id> compartido).
      const qParam = sp.get("q");
      if (qParam) {
        const q = qParam.trim();
        if (!q) return;
        setConsulta(q);
        (async () => {
          try {
            setCargando(true);
            const c = await geocodificar(q);
            setCiudad(c);
            setCargando(false);
            track("seo_landing_q", { q });
            cargarCategoria("imperdibles", c);
          } catch {
            setCargando(false);
          }
        })();
        return;
      }
      const slug = sp.get("destino");
      if (!slug) return;
      const d = getDestinoPorSlug(slug);
      if (!d) return;
      const q = `${d.ciudad}, ${d.pais}`;
      setConsulta(q);
      // Geocodificamos en background y abrimos la ciudad. Si falla, queda el texto.
      (async () => {
        try {
          setCargando(true);
          const c = await geocodificar(q);
          setCiudad(c);
          setCargando(false);
          track("seo_landing", { slug });
          cargarCategoria("imperdibles", c);
        } catch {
          setCargando(false);
        }
      })();
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, usuario]); // usuario incluido para que el intent del trial anonimo
  //                       se dispare al autenticar (B1).

  // Traducir nombres de POIs cuando llegan datos nuevos o cambia el idioma.
  // Best-effort: muta lugar.nombres[lang] en sitio y bumpea el state para
  // forzar re-render. Si Wikidata no responde, la UI sigue con el nombre base.
  useEffect(() => {
    if (!lang || lugaresBase.length === 0) return;
    let vivo = true;
    const todos = [...lugaresBase, ...(seleccion || [])];
    traducirLoteWD(todos, lang).then((cambio) => {
      if (vivo && cambio) setRevTraduccion((n) => n + 1);
    });
    return () => { vivo = false; };
  }, [lugaresBase, seleccion, lang]);

  // Nacionalidad (pasaporte) para los requisitos de entrada: recordar la elección.
  useEffect(() => {
    try {
      const g = localStorage.getItem("anduve_nac");
      if (g) setNacionalidad(g);
    } catch {}
  }, []);
  function cambiarNacionalidad(cc) {
    setNacionalidad(cc);
    try { localStorage.setItem("anduve_nac", cc); } catch {}
  }

  // --- Mis viajes (guardado local o nube según usuario) ---
  // Recarga cuando cambia el estado de login (entrar/salir Google). Nota:
  // depende de usuario?.email para detectar el cambio sin loops infinitos.
  useEffect(() => {
    let vivo = true;
    listarViajesAsync(usuario).then((arr) => vivo && setViajesGuardados(arr));
    return () => { vivo = false; };
  }, [usuario?.email, usuario?.google]);

  async function guardarViajeActual() {
    if (!ciudad || !seleccion.length) return;
    const v = {
      ciudad,
      fechaInicio,
      fechaFin,
      dias,
      horas,
      momento,
      categoria,
      seleccion,
      hospedaje, // punto de partida (hotel) — se restaura al reabrir
    };
    const arr = await guardarViajeAsync(usuario, v);
    setViajesGuardados(arr);
    setGuardado(true);
    setTimeout(() => setGuardado(false), 2000);
  }

  function reabrirViaje(v) {
    setCiudad(v.ciudad);
    setFechaInicio(v.fechaInicio || "");
    setFechaFin(v.fechaFin || "");
    setDias(v.dias || 3);
    setHoras(v.horas || 8);
    setMomento(v.momento || "diurno");
    setCategoria(v.categoria || "imperdibles");
    setLugaresBase(v.seleccion || []);
    setSeleccion(v.seleccion || []);
    setError(null);
    setDetalle(null);
    setRutaTrazada(null);
    setHospedaje(v.hospedaje || null);
    reconstruir(v.seleccion || [], v.ciudad, v.dias, v.hospedaje || null);
    // Refrescar alternativas en segundo plano (sin alterar el plan restaurado).
    traerLugares(v.categoria || "imperdibles", v.ciudad.lat, v.ciudad.lon)
      .then((l) => l?.length && setLugaresBase(l))
      .catch(() => {});
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function eliminarViaje(id) {
    setViajesGuardados(await borrarViajeAsync(usuario, id));
  }

  // Volver al menú principal (sin cerrar sesión): limpia la ciudad y resultados.
  function irAlInicio() {
    setCiudad(null);
    setConsulta("");
    setLugaresBase([]);
    setSeleccion([]);
    setPlan([]);
    setDetalle(null);
    setRutaTrazada(null);
    setError(null);
  }

  // Flecha "atrás" del navegador cuando se está dentro de una ciudad: vuelve
  // al menú principal (post-login) en vez de sacar al usuario al pre-login.
  // El hook registra una entrada artificial en el history cuando hay ciudad
  // y la consume cuando el usuario aprieta ←.
  useBrowserBackClose(!!ciudad, irAlInicio);

  // Autocompletado con debounce (rápido, sin saturar la red)
  useEffect(() => {
    if (consulta.trim().length < 2) {
      setSugerencias([]);
      return;
    }
    // Si el texto fue puesto por elegirCiudad() o por una idea rápida, no
    // reabras el dropdown: ya tienes la ciudad seleccionada.
    if (consulta === ultimaConsultaElegida.current) {
      return;
    }
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      const s = await sugerirCiudades(consulta);
      setSugerencias(s);
      setMostrarSug(true);
    }, 250);
    return () => clearTimeout(debounce.current);
  }, [consulta]);

  // Convierte errores tecnicos ("Failed to fetch", "AbortError"...) en un
  // mensaje humano. Los mensajes propios (ya en español, p.ej. "No encontré
  // esa ciudad") pasan tal cual. Bug 2026-07-11: el usuario vio un banner
  // con texto tecnico crudo al fallar la creacion de una ruta.
  function mensajeError(err) {
    const m = err?.message || "";
    if (!m || /fetch|network|abort|timeout|load failed|NetworkError/i.test(m)) {
      return "No pudimos conectar para armar la ruta. Revisa tu internet e intenta de nuevo.";
    }
    return m;
  }

  // Limpia los resultados de la ciudad anterior para no mostrar marcadores ni
  // itinerario viejos mientras carga la nueva (evita ver "París en Medellín").
  function limpiarParaNuevaCiudad() {
    setLugaresBase([]);
    setSeleccion([]);
    setPlan([]);
    setRutaTrazada(null);
    setDetalle(null);
    setHospedaje(null); // el hotel es de LA ciudad anterior
  }

  function elegirCiudad(sug) {
    ultimaConsultaElegida.current = sug.etiqueta;
    clearTimeout(debounce.current);
    setConsulta(sug.etiqueta);
    setMostrarSug(false);
    setSugerencias([]);
    setError(null);
    // Mostramos el mapa y la ciudad de INMEDIATO (ya tenemos coords del autocompletado).
    const c = { nombre: sug.ciudad, pais: sug.pais, lat: sug.lat, lon: sug.lon };
    setCiudad(c);
    limpiarParaNuevaCiudad();
    track("busqueda", { ciudad: sug.ciudad, pais: sug.pais });
    cargarCategoria("imperdibles", c); // los lugares cargan en segundo plano
  }

  // Si se pasa qOverride se usa directamente (sin depender de leer `consulta`
  // del state, que con setTimeout(...,0) leeria el valor viejo y forzaba doble
  // clic en las tarjetas/CTA de destinos populares, ofertas y asesor).
  async function buscarTexto(eOrQ) {
    let q;
    if (typeof eOrQ === "string") {
      q = eOrQ.trim();
      setConsulta(q);
    } else {
      eOrQ?.preventDefault?.();
      q = consulta.trim();
    }
    if (!q) return;
    ultimaConsultaElegida.current = q;
    clearTimeout(debounce.current);
    setMostrarSug(false);
    setError(null);
    setCargando(true);
    try {
      const c = await geocodificar(q);
      setCiudad(c); // mapa visible ya
      limpiarParaNuevaCiudad();
      setCargando(false);
      track("busqueda", { ciudad: c.nombre, pais: c.pais });
      // Perfil de gustos: la busqueda revela una preferencia. Si el usuario
      // tiene sesion email, esto se acumula en KV; si es invitado no hace nada.
      registrarEvento({ tipo: "busqueda", ciudad: c.nombre, pais: c.pais });
      cargarCategoria("imperdibles", c); // lugares en segundo plano
    } catch (err) {
      setError(mensajeError(err));
      setCiudad(null);
      setCargando(false);
      track("busqueda_fallida", { q }); // demanda no resuelta (para el panel)
    }
  }

  // Carga lugares SIN bloquear la pantalla: usa un indicador propio (cargandoLugares).
  // diasOverride: para que los chips de "ideas para empezar" reciban su nº de días
  // ANTES de que React aplique el setDias (evita un re-render con el plan corto).
  // Mezcla de lugares segun los GUSTOS del wizard: una lista por categoria
  // elegida, intercaladas round-robin (variedad) y con imperdibles de relleno
  // si la mezcla queda corta (pueblos chicos).
  async function traerLugaresGustos(g, c, mom) {
    const cats = categoriasDeGustos(g, mom);
    if (!cats.length) {
      return traerLugares(mom === "nocturno" ? "bares" : "imperdibles", c.lat, c.lon);
    }
    const listas = await Promise.all(
      cats.map((k) => traerLugares(k, c.lat, c.lon).catch(() => []))
    );
    let lugares = intercalarLugares(listas);
    if (lugares.length < 12) {
      const relleno = await traerLugares("imperdibles", c.lat, c.lon).catch(() => []);
      lugares = intercalarLugares([lugares.concat(relleno)]); // concat + dedupe, gustos primero
    }
    return lugares;
  }

  async function cargarCategoria(cat, c = ciudad, mom = momento, diasOverride, horasOverride) {
    if (!c) return;
    setError(null);
    setCategoria(cat);
    setCargandoLugares(true);
    const nDias = diasOverride || dias;
    try {
      // "Imperdibles" es la vista default de toda ciudad: si hay gustos
      // guardados, ahi es donde se personaliza. Las demas categorias (chips)
      // siguen siendo puras.
      const g = cat === "imperdibles" ? leerGustos() : null;
      let lugares;
      if (g) {
        lugares = await traerLugaresGustos(g, c, mom);
      } else {
        const catReal = mom === "nocturno" && cat === "imperdibles" ? "bares" : cat;
        lugares = await traerLugares(catReal, c.lat, c.lon);
      }
      setLugaresBase(lugares);
      // Tomamos hasta 5 lugares por día (con margen) para llenar bien cada día.
      const cupo = Math.max(nDias * 5, 6);
      const sel = lugares.slice(0, cupo);
      setSeleccion(sel);
      reconstruir(sel, c, nDias, undefined, horasOverride);
    } catch (err) {
      setError("Tardó demasiado en cargar lugares. Toca una categoría para reintentar.");
    } finally {
      setCargandoLugares(false);
    }
  }

  // Abre el modal de Presupuesto pre-llenado con los valores que el usuario
  // tipeo o eligio en el HERO (chips rapidos o input grande). Es el CTA
  // principal de la pantalla de inicio.
  function abrirPresupuestoCon(monto, moneda) {
    setMontoHero(monto);
    setMonedaHero(moneda);
    setPresupuestoInicial({ monto, moneda });
    track("presupuesto_hero", { monto, moneda });
    registrarEvento({ tipo: "presupuesto" });
    startTransition(() => setMostrarPresupuesto(true));
  }

  // Disparador de las ideas rápidas del HERO: pre-fija ciudad, días y/o momento
  // y abre la búsqueda en un solo click. Maneja sus propios overrides para no
  // depender del orden de actualización de los setState de React.
  async function pruebaRapida({ q, dias: d, momento: m }) {
    ultimaConsultaElegida.current = q;
    clearTimeout(debounce.current);
    setConsulta(q);
    setMostrarSug(false);
    setError(null);
    setCargando(true);
    if (d) setDias(d);
    if (m) setMomento(m);
    try {
      const c = await geocodificar(q);
      setCiudad(c);
      limpiarParaNuevaCiudad();
      setCargando(false);
      track("prueba_rapida", { q, dias: d, momento: m });
      cargarCategoria("imperdibles", c, m || momento, d);
    } catch (err) {
      setError(mensajeError(err));
      setCargando(false);
      track("busqueda_fallida", { q });
    }
  }

  function reconstruir(sel = seleccion, c = ciudad, diasOverride, hospedajeOverride, horasOverride) {
    if (!c || !sel.length) {
      setPlan([]);
      return;
    }
    // Punto de partida, en orden de prioridad (2026-07-11):
    //  1. HOSPEDAJE elegido por el usuario ("mi hotel esta en X") — cada dia
    //     arranca y se optimiza desde ahi: menos traslados, ruta realista.
    //  2. GPS si YA esta fisicamente en esa ciudad (<~60 km).
    //  3. Centro de la ciudad (default). hospedajeOverride permite que
    //     reabrirViaje/los handlers pasen el valor sin esperar al state.
    const h = hospedajeOverride === undefined ? hospedaje : hospedajeOverride;
    const centro = [c.lat, c.lon];
    let inicio = centro;
    if (h?.lat != null) {
      inicio = [h.lat, h.lon];
    } else if (gps) {
      const cerca =
        Math.hypot(gps[0] - c.lat, gps[1] - c.lon) < 0.6; // ~60 km
      if (cerca) inicio = gps;
    }
    const nDias = diasOverride || dias;
    const p = construirItinerario(sel, { dias: nDias, horasPorDia: horasOverride || horas, inicio });
    setPlan(p);
    setDiaVisible(0);
  }

  // Nº de días entre dos fechas YYYY-MM-DD (inclusive), acotado a 1–14.
  function diasEntre(ini, fin) {
    if (!ini || !fin) return null;
    const d = Math.round((new Date(fin) - new Date(ini)) / 86400000) + 1;
    return Math.max(1, Math.min(14, d));
  }

  // Aplica un rango de fechas: deriva los días y rearma el itinerario para ESAS
  // fechas (de aquí salen el itinerario fechado, el presupuesto y los vuelos).
  function aplicarFechas(ini, fin) {
    setFechaInicio(ini);
    setFechaFin(fin);
    const n = diasEntre(ini, fin);
    if (n) {
      setDias(n);
      if (ciudad && seleccion.length) reconstruir(seleccion, ciudad, n);
    }
  }

  // Cambiar SOLO esa parada por una alternativa, SIN rearmar todo el itinerario.
  // Se reemplaza en el mismo lugar (mismo día, misma posición).
  function cambiarParada(diaIdx, paradaIdx) {
    const usados = new Set();
    plan.forEach((d) => d.paradas.forEach((p) => usados.add(p.id)));
    const vieja = plan[diaIdx].paradas[paradaIdx];
    // Preferir un reemplazo de la MISMA categoría; si no, uno notable; si no, el primero libre.
    const libres = lugaresBase.filter((l) => !usados.has(l.id));
    const alt =
      libres.find((l) => l.categoria === vieja.categoria) ||
      libres.find((l) => l.notable) ||
      libres[0];
    if (!alt) return;

    // Copia profunda mínima del plan, reemplazando solo esa parada.
    const nuevoPlan = plan.map((d) => ({ ...d, paradas: d.paradas.slice() }));
    nuevoPlan[diaIdx].paradas[paradaIdx] = {
      ...alt,
      traslado: vieja.traslado,
      metros: vieja.metros,
      transporte: vieja.transporte,
    };
    setPlan(nuevoPlan);
    // Mantener la selección coherente (por si se recalcula luego).
    setSeleccion((s) => s.map((x) => (x.id === vieja.id ? alt : x)));
  }

  // Quitar SOLO esa parada del día, sin rearmar el resto.
  function quitarParada(diaIdx, paradaIdx) {
    const vieja = plan[diaIdx].paradas[paradaIdx];
    const nuevoPlan = plan.map((d) => ({ ...d, paradas: d.paradas.slice() }));
    nuevoPlan[diaIdx].paradas.splice(paradaIdx, 1);
    setPlan(nuevoPlan);
    setSeleccion((s) => s.filter((x) => x.id !== vieja.id));
  }

  function cambiarMomento(mom) {
    setMomento(mom);
    cargarCategoria("imperdibles", ciudad, mom);
  }

  // Aplicar los gustos del wizard: guardar, ajustar momento + ritmo (horas)
  // y rearmar la ruta de la ciudad abierta con la mezcla personalizada.
  function aplicarGustos(g) {
    guardarGustos(g);
    setGustos(g);
    setMostrarPersonalizar(false);
    setMomento(g.momento);
    const h = HORAS_POR_RITMO[g.ritmo] || 8;
    setHoras(h);
    track("gustos_aplicar", { intereses: g.intereses.join(","), ritmo: g.ritmo, momento: g.momento });
    registrarEvento({ tipo: "gustos", intereses: g.intereses, ritmo: g.ritmo, momento: g.momento });
    if (ciudad) cargarCategoria("imperdibles", ciudad, g.momento, undefined, h);
  }

  // Agregar un lugar (de la lista completa) al día visible del itinerario.
  function agregarParada(lugar) {
    if (!plan[diaVisible]) return;
    setPlan((p) => agregarLugarADia(p, diaVisible, lugar));
    setSeleccion((s) => (s.some((x) => x.id === lugar.id) ? s : [...s, lugar]));
  }

  function obtenerInicio() {
    if (hospedaje?.lat != null) return [hospedaje.lat, hospedaje.lon];
    if (ciudad) return [ciudad.lat, ciudad.lon];
    return null;
  }

  function handleOptimizar() {
    setPlan((p) => optimizarRutaDia(p, diaVisible, obtenerInicio()));
    track("optimizar_ruta", { dia: diaVisible + 1 });
  }

  function handleMoverParada(paradaIdx, destinoDia) {
    setPlan((p) => moverParadaADia(p, diaVisible, paradaIdx, destinoDia));
    track("mover_parada", { desde: diaVisible + 1, hacia: destinoDia + 1 });
  }

  function handleReordenar(paradaIdx, delta) {
    setPlan((p) => reordenarParada(p, diaVisible, paradaIdx, delta));
  }

  // Reintentar tras un error (geocodificación o carga de lugares).
  function reintentar() {
    setError(null);
    if (ciudad) cargarCategoria(categoria);
    else if (consulta.trim()) buscarTexto();
  }

  // Descargar el plan como PDF usando el diálogo nativo de impresion del
  // navegador (sin dependencias). El CSS @media print de globals.css y el
  // bloque .solo-imprimir mas abajo hacen que salga limpio en papel/PDF.
  function descargarPDF() {
    if (!ciudad) return;
    track("descargar_pdf", { ciudad: ciudad.nombre });
    const titulo = `Anduve - ${ciudad.nombre}${ciudad.pais ? `, ${ciudad.pais}` : ""}`;
    const original = typeof document !== "undefined" ? document.title : "";
    if (typeof document !== "undefined") document.title = titulo;
    // Pequeño delay para que el navegador refleje el title antes de abrir el diálogo.
    setTimeout(() => {
      if (typeof window !== "undefined") window.print();
      if (typeof document !== "undefined") {
        setTimeout(() => { document.title = original; }, 800);
      }
    }, 60);
  }

  // Compartir el plan: primero intenta crear un enlace público (KV). Si lo
  // logra, comparte la URL bonita (el receptor abre /viaje/<id> y ve el plan
  // sin necesidad de cuenta). Si la nube falla, fallback al texto plano.
  async function compartirPlan() {
    if (!ciudad) return;

    // 1) Intentar enlace público.
    const viaje = {
      ciudad,
      fechaInicio,
      fechaFin,
      dias,
      horas,
      momento,
      categoria,
      seleccion,
    };
    const url = await compartirEnlace(viaje);

    if (url) {
      try {
        if (navigator.share) {
          await navigator.share({
            title: `Viaje a ${ciudad.nombre} · Anduve`,
            text: `${t("miViajeA")} ${ciudad.nombre}`,
            url,
          });
        } else {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2500);
        }
      } catch {}
      return;
    }

    // 2) Fallback: texto plano (sin KV configurado).
    let txt = `🗺️ ${t("miViajeA")} ${ciudad.nombre}, ${ciudad.pais} — Anduve\n`;
    let n = 0;
    plan.forEach((d) => {
      if (!d.paradas.length) return;
      n += 1;
      txt += `\n${t("dia")} ${n}\n`;
      d.paradas.forEach((p, i) => {
        txt += `  ${i + 1}. ${nombreLocalizado(p, lang)} (${fmtMin(p.minutos)})\n`;
      });
    });
    txt += `\n${t("hechoCon")} Anduve · https://anduve-app.vercel.app/`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Anduve", text: txt });
      } else {
        await navigator.clipboard.writeText(txt);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      }
    } catch {}
  }

  const lugaresDelDia = plan[diaVisible]?.paradas || [];

  // MIENTRAS NO SABEMOS QUIEN ERES, SE SIRVE EL LANDING (auditoria, P-04).
  //
  // Esto devolvia `null`, y `listo` depende de localStorage y de la sesion:
  // las dos cosas son de cliente, asi que en el servidor SIEMPRE era false.
  // Resultado: el HTML de la portada llegaba con cero caracteres de texto
  // — comprobado con curl —, sin nada que indexar y sin primer pintado hasta
  // que arrancaba el JavaScript. En la pagina principal de la app.
  //
  // La causa nunca fue el "use client": Next si renderiza en servidor los
  // componentes de cliente. Era este return.
  //
  // Y el `null` tenia su razon, que sigue valiendo: el comentario decia "no
  // parpadear", y es verdad — si el servidor pinta el landing, quien ya tiene
  // sesion lo veria un instante antes de que carguen sus datos.
  //
  // Se resuelve como ya se resolvia el modo oscuro en esta misma app: un
  // script en el layout que corre ANTES del primer pintado marca
  // data-sesion="1" en el <html> si encuentra rastro de sesion, y una regla
  // de CSS esconde este bloque en ese caso. El visitante nuevo — que es quien
  // importa para el SEO y para el primer pintado — ve el landing de
  // inmediato; el que vuelve no ve el parpadeo. El marcado es el MISMO en
  // servidor y en cliente, asi que no hay desajuste de hidratacion: solo CSS.
  if (!listo) {
    return (
      <div className="landing-previa">
        <Bienvenida />
      </div>
    );
  }
  // Primera vez: pantalla de bienvenida (idioma + nombre).
  if (!usuario) return <Bienvenida />;

  // Inicio = HERO con foto; tras buscar una ciudad = cinta blanca tipo tarjeta.
  const esHero = !ciudad && !cargando;

  return (
    <div className="min-h-screen pb-10 dark:bg-slate-900">
      {/* Cabecera: HERO con foto de viaje en el inicio; cinta blanca en la ciudad */}
      <header className={`relative z-[1000] print:hidden ${esHero ? "text-white" : "sticky top-0 border-b border-slate-200 bg-white/95 text-slate-700 shadow-suave backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"}`}>
        {esHero && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-marca-700 to-marca-900" />
            {/* Stack de imagenes con crossfade: la actual visible, las demas
                transparentes. CSS transition hace la mezcla sin librerias. */}
            {heroImgs.map((src, i) => (
              <div
                key={src + i}
                aria-hidden="true"
                className="absolute inset-0 bg-cover bg-center transition-opacity duration-[1500ms] ease-in-out"
                style={{ backgroundImage: `url(${src})`, opacity: i === iHero ? 1 : 0 }}
              />
            ))}
            <div className="absolute inset-0 bg-gradient-to-b from-marca-900/35 via-marca-900/55 to-marca-900/90" />
          </>
        )}

        {/* datalist nativo ELIMINADO (bug 2026-07-11): el navegador abria su
            propio dropdown blanco encima de nuestro autocompletado estilizado
            — dos listas a la vez. El autocompletado propio (sugerirCiudades)
            cubre lo mismo con nuestros colores. */}

        <div className={`relative mx-auto max-w-[1480px] px-3 lg:px-5 ${esHero ? "pt-3 pb-16 lg:pb-24" : "pt-2 pb-3"}`}>
          {/* Barra de navegación superior. max-w aumentado y px reducido para
              que el logo respire MAS hacia la izquierda y los controles a la
              derecha — el contenido centrado queda intacto (su propio max-w-2xl
              más abajo). Logo + nav links agrupados a la izquierda; cluster
              de usuario a la derecha. */}
          <div className="flex items-center justify-between gap-3 lg:gap-5">
            <div className="flex items-center gap-4 lg:gap-7">
            <button
              type="button"
              onClick={irAlInicio}
              aria-label="Anduve — inicio"
              className="cursor-pointer text-left"
            >
              {/* Pill backdrop blur SOLO alrededor del lockup (icon+wordmark)
                  — el tagline queda DEBAJO del pill, fuera. Asi el pill
                  abraza tight el lockup sin huecos visibles. */}
              <span
                className={`inline-flex items-center ${
                  esHero
                    ? "rounded-xl bg-marca-950/25 px-3 py-1.5 backdrop-blur-sm ring-1 ring-white/15"
                    : ""
                }`}
              >
                <LogoMarca
                  size={esHero ? 56 : 60}
                  animado
                  tono={esHero ? "claro" : "marca"}
                  className={esHero ? "[filter:drop-shadow(0_2px_4px_rgba(0,0,0,0.5))]" : ""}
                />
              </span>
              <div
                className={`mt-1.5 hidden text-[10px] font-bold uppercase tracking-[0.32em] sm:block ${
                  esHero
                    ? "pl-3 text-white/90 [text-shadow:0_1px_2px_rgba(0,0,0,0.7)]"
                    : "text-slate-500"
                }`}
              >
                {t("tagline")}
              </div>
            </button>
            {/* Nav links principales (Opción A — 2026-06-24). Solo visible en
                md+. En mobile el usuario navega desde las cards del cuerpo. */}
            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/destino"
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  esHero
                    ? "text-white/85 hover:bg-white/15 hover:text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Destinos
              </Link>
              <Link
                href="/ofertas"
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  esHero
                    ? "text-white/85 hover:bg-white/15 hover:text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Ofertas
              </Link>
              <Link
                href="/mis-viajes"
                className={`rounded-md px-3 py-1.5 text-[13px] font-medium transition ${
                  esHero
                    ? "text-white/85 hover:bg-white/15 hover:text-white"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                }`}
              >
                Mis viajes
              </Link>
            </nav>
            </div>
            {/* Cluster top-right. Ligeramente mas grande (h-9 vs h-8), gap mayor
                y empujado contra el borde derecho del max-w del header. */}
            <div className="flex items-center gap-2.5 lg:gap-3.5">
              {ciudad && (
                <button onClick={irAlInicio} className={`text-[13px] underline-offset-2 hover:underline ${esHero ? "text-white/90" : "text-slate-500"}`}>
                  <span className="inline-flex items-center gap-1"><Icono nombre="home" size={14} /> {t("inicio")}</span>
                </button>
              )}
              {!pro && (
                <a
                  href="/pro"
                  className={`hidden text-[13.5px] font-bold underline-offset-2 hover:underline sm:inline ${esHero ? "text-amber-200" : "text-amber-600"}`}
                >
                  ★ Hazte Pro
                </a>
              )}
              <MenuUsuario oscuro={esHero} />
              <button
                type="button"
                onClick={toggleDark}
                aria-label={darkMode ? "Modo claro" : "Modo oscuro"}
                title={darkMode ? "Modo claro" : "Modo oscuro"}
                className={`flex h-9 w-9 items-center justify-center rounded-full border text-[17px] transition ${
                  esHero
                    ? "border-white/30 bg-white/10 text-white hover:bg-white/20"
                    : "border-slate-200 bg-white text-slate-600 hover:border-marca-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {darkMode ? "☀️" : "🌙"}
              </button>
              <SelectorIdioma oscuro={esHero} />
            </div>
          </div>

          {esHero ? (
            /* HERO de inicio: REDISENO 2026-06-14. El feedback del viajero
               critico fue claro - la propuesta de valor de la app es
               "dime cuanto tienes y te digo a donde vas desde Colombia", no
               "busca una ciudad". El input de presupuesto pasa a ser el CTA
               principal; la busqueda por ciudad queda como opcion secundaria
               desplegable. */
            <div className="mx-auto mt-8 max-w-2xl text-center lg:mt-12">
              {/* Fila superior: viajeros en linea + saludo en MISMA linea separados
                  por un divisor. Antes ocupaban 2 lineas con mb-4 + mb-3 que se
                  sentia demasiado airy. Ahora una sola fila ligera. */}
              {/* Umbral 5: "1 viajero en linea" es anti-social-proof — grita
                  app vacia. Con pocos usuarios el chip simplemente no aparece
                  (lectura 360 2026-07-11). */}
              <div className="mb-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[12.5px] text-white/90">
                {viajerosVivos != null && viajerosVivos >= 5 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    <span className="font-medium">
                      {viajerosVivos.toLocaleString(lang)} {t("viajerosEnLinea")}
                    </span>
                  </span>
                )}
                {viajerosVivos != null && viajerosVivos >= 5 && (
                  <span className="text-white/30">·</span>
                )}
                {/* Saludo personalizado — primer nombre CAPITALIZADO ("felipe" ->
                    "Felipe"). El emoji 👋 se conserva como toque humano del saludo. */}
                <span className="font-medium">
                  {t(saludoClave())},{" "}
                  {(() => {
                    const p = (usuario.nombre || "").trim().split(/\s+/)[0] || "";
                    return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
                  })()}{" "}
                  <span aria-hidden="true">👋</span>
                </span>
              </div>
              {/* Eyebrow "PLAN TU VIAJE DESDE …" y subtítulo removidos
                  2026-06-23: el usuario reportó demasiada densidad de info
                  en el primer visual. El h1 ya es lo suficientemente claro. */}
              <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-tight drop-shadow-md lg:text-[48px]">
                {t("heroH1Ofertas")}
              </h1>

              {/* "Saliendo desde 🇨🇴 Colombia · cambiar" — movido aquí 2026-06-25
                  desde abajo de los chips. Establece el CONTEXTO del cálculo
                  (origen de los vuelos) ANTES de pedir el presupuesto, no
                  después. Sin esto Sofía no sabía que su país afectaba lo
                  que iba a ver, y Carlos pensaba que el campo era informativo. */}
              <div className="mx-auto mt-5 flex max-w-xl items-center justify-center">
                <SelectorPais value={paisIso} onChange={cambiarPaisManual} />
              </div>

              {/* LAS OFERTAS DE HOY, no una pregunta.
                  La portada preguntaba "¿Cuanto presupuesto tienes?" y no
                  ensenaba nada hasta que respondieras. Ese flujo ya vive
                  entero en /mis-viajes, asi que aqui era una pregunta que
                  solo estorbaba: el activo real de la app son los precios
                  detectados cada hora, y eso se puede ver sin escribir nada.
                  MiniOfertas ya existia y hace exactamente esto — se habia
                  quitado del home por redundante con el hero viejo. */}
              <div className="mx-auto mt-5 max-w-3xl rounded-2xl bg-white/95 p-4 text-left shadow-card ring-1 ring-white/40 backdrop-blur dark:bg-slate-800/95 lg:p-5">
                <MiniOfertas
                  onPlanear={(q) => buscarTexto(q)}
                  t={t}
                  lang={lang}
                />
              </div>

              {/* El presupuesto no desaparece: se va a donde vive ahora. */}
              <div className="mt-3">
                <Link
                  href="/mis-viajes"
                  className="text-[12.5px] font-semibold text-white/80 underline-offset-4 transition hover:text-white hover:underline"
                >
                  {t("heroOPresupuesto")} →
                </Link>
              </div>

              {/* Divisor + opcion secundaria: buscar por ciudad. Empieza
                  COLAPSADA — solo aparece el link "o busca por ciudad" para
                  los que ya saben a donde. Mantiene la entrada por ciudad
                  accesible sin competir con el CTA principal de presupuesto. */}
              <div className="mx-auto mt-6 flex max-w-xl items-center gap-3 text-[11px] text-white/55">
                <span className="h-px flex-1 bg-white/15" />
                <button
                  type="button"
                  onClick={() => setMostrarBuscarCiudad((v) => !v)}
                  className="flex items-center gap-1 font-semibold uppercase tracking-[0.2em] text-white/70 transition hover:text-white"
                >
                  {t("heroOSabesDestino")} <span className={`transition ${mostrarBuscarCiudad ? "rotate-180" : ""}`}>▾</span>
                </button>
                <span className="h-px flex-1 bg-white/25" />
              </div>

              {mostrarBuscarCiudad && (
                <div className="animar-subir relative mx-auto mt-3 max-w-xl">
                  <form onSubmit={buscarTexto} className="flex gap-2 rounded-2xl bg-white/95 p-1.5 shadow-xl ring-1 ring-white/40 backdrop-blur">
                    <div className="relative flex-1">
                      <input
                        value={consulta}
                        onChange={(e) => setConsulta(e.target.value)}
                        onFocus={() => sugerencias.length && setMostrarSug(true)}
                        placeholder={t("buscarPlaceholder")}
                        className="w-full rounded-xl border-0 bg-transparent px-4 py-2.5 pr-9 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
                      />
                      {consulta && (
                        <button type="button" onClick={() => { setConsulta(""); setSugerencias([]); setMostrarSug(false); }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-600" aria-label="Borrar búsqueda">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <button type="submit" aria-label={t("buscar")} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-4 text-[14px] font-bold text-white shadow-md transition hover:brightness-110">
                      <Icono nombre="search" size={16} /> <span className="hidden sm:inline">{t("buscar")}</span>
                    </button>
                  </form>
                  {mostrarSug && sugerencias.length > 0 && (
                    <div className="animar-subir absolute inset-x-0 top-full z-[1100] mt-1.5 overflow-hidden rounded-2xl bg-white text-left shadow-xl">
                      {sugerencias.map((s, i) => (
                        <div key={i} className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-4 py-3 text-slate-800 hover:bg-marca-50" onClick={() => elegirCiudad(s)}>
                          <Icono nombre="pin" size={18} className="text-marca-500" />
                          <div><div className="text-[15px] font-semibold">{s.ciudad}</div><div className="text-xs text-slate-500">{s.pais}</div></div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Ideas rapidas de ciudad - solo si el bloque secundario esta abierto.
                      Sin emojis (audit 2026-06-29): reemplazados por icono pin discreto para
                      mantener consistencia con el resto del rediseno "menos didactico". */}
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => pruebaRapida({ q: "Cartagena, Colombia", dias: 3 })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      <Icono nombre="pin" size={12} /> Cartagena
                    </button>
                    <button
                      type="button"
                      onClick={() => pruebaRapida({ q: "Tokio, Japón", dias: 5 })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      <Icono nombre="pin" size={12} /> Tokio
                    </button>
                    <button
                      type="button"
                      onClick={() => pruebaRapida({ q: "Madrid, España", momento: "nocturno" })}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      <Icono nombre="pin" size={12} /> Madrid
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Cinta de ciudad: buscador compacto sobre fondo blanco */
            <div className="relative mt-3 max-w-2xl">
              <form onSubmit={buscarTexto} className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                    onFocus={() => sugerencias.length && setMostrarSug(true)}
                    placeholder={t("buscarPlaceholder")}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 pr-10 text-base text-slate-800 outline-none transition focus:border-marca-400 focus:bg-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  {consulta && (
                    <button type="button" onClick={() => { setConsulta(""); setSugerencias([]); setMostrarSug(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300" aria-label="Borrar búsqueda">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
                    </button>
                  )}
                </div>
                <button type="submit" aria-label={t("buscar")} className="flex items-center justify-center rounded-2xl bg-gradient-to-r from-marca-500 to-marca-600 px-5 font-bold text-white shadow-marca transition hover:brightness-110">
                  <Icono nombre="search" size={20} />
                </button>
              </form>
              {mostrarSug && sugerencias.length > 0 && (
                <div className="animar-subir absolute inset-x-0 top-full z-[1100] mt-1.5 overflow-hidden rounded-2xl bg-white shadow-xl">
                  {sugerencias.map((s, i) => (
                    <div key={i} className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-4 py-3 text-slate-800 hover:bg-marca-50" onClick={() => elegirCiudad(s)}>
                      <Icono nombre="pin" size={18} className="text-marca-500" />
                      <div><div className="text-[15px] font-semibold">{s.ciudad}</div><div className="text-xs text-slate-500">{s.pais}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Banner de error. relative z-20: el panel del home tiene margen
          NEGATIVO (-mt-8/-mt-12) y sin stacking lo tapaba/cortaba (bug
          reportado 2026-07-11). Ademas ahora es descartable con ✕ — antes
          quedaba pegado en el home sin salida. */}
      {error && (
        <div className="relative z-20 mx-auto mt-3.5 max-w-7xl px-4 pb-4 print:hidden lg:px-8">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800 shadow-suave dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"><Icono nombre="alert" size={18} /></span>
            <p className="flex-1 text-sm">{error}</p>
            <button onClick={reintentar} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
              <span className="inline-flex items-center gap-1.5"><Icono nombre="refresh" size={15} /> {t("recalcular")}</span>
            </button>
            <button
              onClick={() => setError(null)}
              aria-label="Cerrar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-red-400 transition hover:bg-red-100 hover:text-red-700 dark:hover:bg-red-900/40"
            >
              <Icono nombre="x" size={15} />
            </button>
          </div>
        </div>
      )}

      {!ciudad && !cargando && (
        <div className="relative z-10 -mt-8 rounded-t-[32px] bg-[#f6f7fb] pt-2 print:hidden dark:bg-slate-900 lg:-mt-12">
        <div className="animar-subir mx-auto max-w-5xl px-4 pb-4 pt-8 lg:px-8 lg:pt-12">
          {/* Entry cards principales (Opción A — 2026-06-24): el home post-login
              ya no apila destinos/ofertas/fechas/viajes en scroll largo. En su
              lugar cards que llevan a cada sección con su propia URL.
              Recomendados se mantiene si hay perfil. */}
          {/* Ruta de la ciudad ACTUAL: "Estás en Medellín — crea tu ruta de
              hoy". Detecta por IP (sin permiso GPS) y dispara el motor de
              itinerarios con 1 dia. Restaurado por request del usuario
              (2026-07-11). */}
          <EstasEnCiudad
            t={t}
            onCrear={(q, momento) => pruebaRapida({ q, dias: 1, momento })}
            onEventos={(g) => setEventosDe(g)}
            onCorregir={() => {
              setMostrarBuscarCiudad(true);
              if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />

          {/* Panel Anduve Live (eventos + yo voy + chat) de la ciudad actual */}
          {eventosDe && (
            <EventosCiudad
              ciudad={eventosDe.ciudad}
              paisIso={eventosDe.iso}
              onCerrar={() => setEventosDe(null)}
              t={t}
            />
          )}

          {/* Wizard de gustos: 3 preguntas que ponderan la ruta (✨ A tu medida) */}
          {mostrarPersonalizar && (
            <PersonalizarRuta
              inicial={gustos}
              onAplicar={aplicarGustos}
              onCerrar={() => setMostrarPersonalizar(false)}
              t={t}
            />
          )}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <EntryCard
              href="/destino"
              icono="globe"
              titulo={t("cardDestinosTit")}
              subtitulo={t("cardDestinosSub").replace("{n}", DESTINOS_PRESUPUESTO.length)}
              cta={t("cardDestinosCta")}
              bg="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=800&q=70"
            />
            <EntryCard
              href="/ofertas"
              icono="plane"
              titulo={t("cardOfertasTit")}
              subtitulo={t("cardOfertasSub")}
              cta={t("cardOfertasCta")}
              bg="https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=800&q=70"
            />
            {/* Siempre navega a /mis-viajes, como las otras dos tarjetas.
                Antes, si no habias guardado ningun viaje, esta NO navegaba:
                abria el modal del planificador encima del home. Dos tarjetas
                iguales con comportamientos distintos, y el unico caso donde
                cambiaba era justo el del usuario nuevo. El planificador ahora
                vive dentro de /mis-viajes. */}
            <EntryCard
              href="/mis-viajes"
              icono="bookmark"
              titulo={t("cardViajesTit")}
              subtitulo={viajesGuardados.length > 0 ? `${viajesGuardados.length} guardado${viajesGuardados.length === 1 ? "" : "s"}` : t("cardViajesSubVacio")}
              cta={viajesGuardados.length > 0 ? t("cardViajesCtaVer") : t("cardViajesCta")}
              bg="https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=70"
            />
          </div>

          {/* Chip de alertas: expone la feature en el home post-login (antes
              cero visibilidad hasta entrar a una ciudad). Se dinamica y se
              auto-oculta si no hay usuario o mientras carga. */}
          <AlertasChip />

          {/* Recomendaciones personalizadas: solo si el usuario tiene perfil
              con datos. Ordenado por afinidad con los gustos acumulados. */}
          {recomendados.length > 0 && (
            <div className="mb-4 mt-10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-600">
                ✨ {t("recomendadoEyebrow")}
              </div>
              <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-marca-900 lg:text-[26px]">
                {t("recomendadoTitulo").replace("{nombre}", usuario?.nombre || "")}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-3 lg:gap-4">
                {recomendados.slice(0, 6).map((r) => (
                  <CardDestino
                    key={r.slug}
                    nombre={r.ciudad}
                    pais={r.pais}
                    hint={r.ciudad}
                    onClick={() => buscarTexto(`${r.ciudad}, ${r.pais}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* MiniOfertas removido del home (audit 2026-06-29): era redundante
              con la entry card "Vuelos baratos" ubicada arriba (misma funcion,
              mismo destino). El usuario que quiere ver ofertas ya tiene el
              CTA en la card, no necesita ver 3 preview cards duplicadas
              justo debajo. La ruta /ofertas conserva el dashboard completo. */}
        </div>
        </div>
      )}

      {/* Módulo de presupuesto */}
      {mostrarPresupuesto && (
        <Presupuesto
          t={t}
          inicial={presupuestoInicial}
          onCerrar={() => { setMostrarPresupuesto(false); setPresupuestoInicial(null); }}
          onElegirCiudad={(d) => {
            setMostrarPresupuesto(false);
            setPresupuestoInicial(null);
            buscarTexto(`${d.ciudad}, ${d.pais}`);
          }}
        />
      )}

      {cargando && (
        <div className="p-10 text-center text-slate-500">
          <span className="spin" /> <span className="ml-2">{t("cargando")}</span>
        </div>
      )}

      {/* Vista de ciudad: dos paneles en escritorio (itinerario + mapa fijo) */}
      {ciudad && (
        <div className="mx-auto max-w-7xl lg:flex lg:gap-6 lg:px-8 lg:py-6 print:hidden">
          {/* Panel izquierdo: planeación */}
          <div className="order-2 px-4 py-5 lg:order-1 lg:flex-1 lg:min-w-0 lg:px-0 lg:py-0">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-marca-900 lg:text-3xl">{ciudad.nombre}</h1>
                <div className="text-[13px] text-slate-500">{ciudad.pais}</div>
              </div>
              <div className="flex items-center gap-2.5">
                {plan.some((d) => d.paradas.length > 0) && (
                  <button
                    onClick={() => {
                      // Free tier: 1 viaje guardado. A partir del 2do, gate.
                      if (!pro && viajesGuardados.length >= 1) {
                        abrirPaywall("guardar");
                        return;
                      }
                      guardarViajeActual();
                    }}
                    className="rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-3 py-2 text-[13px] font-bold text-white shadow-marca transition hover:brightness-105"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icono nombre={guardado ? "check" : "bookmark"} size={15} />
                      {guardado ? t("guardado") : t("guardarViaje")}
                    </span>
                  </button>
                )}
                {plan.some((d) => d.paradas.length > 0) && (
                  <button
                    onClick={() => requierePro("compartir", compartirPlan)}
                    className="rounded-xl border-[1.5px] border-marca-100 bg-white px-3 py-2 text-[13px] font-bold text-marca-600 transition hover:bg-marca-50 dark:border-slate-700 dark:bg-slate-800 dark:text-marca-400 dark:hover:bg-slate-700"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icono nombre={copiado ? "check" : "share"} size={15} />
                      {copiado ? t("copiado") : t("compartir")}
                    </span>
                  </button>
                )}
                {plan.some((d) => d.paradas.length > 0) && (
                  <button
                    onClick={() => requierePro("pdf", descargarPDF)}
                    title={t("descargarPDF")}
                    className="rounded-xl border-[1.5px] border-marca-100 bg-white px-3 py-2 text-[13px] font-bold text-marca-600 transition hover:bg-marca-50 dark:border-slate-700 dark:bg-slate-800 dark:text-marca-400 dark:hover:bg-slate-700"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icono nombre="download" size={15} />
                      PDF
                    </span>
                  </button>
                )}
                {lugaresBase.length > 0 && (
                  <div className="text-right">
                    <div className="text-xl font-extrabold text-marca-600">{lugaresBase.length}</div>
                    <div className="text-xs text-slate-500">{t("lugares")}</div>
                  </div>
                )}
              </div>
            </div>

            {/* Fotos de la ciudad (Commons, todas las ciudades sin curar) */}
            <FotosCiudadHeader ciudad={ciudad.nombre} pais={ciudad.pais} />

            {/* Requisitos de entrada al país destino (visa, pasaporte, salud) */}
            <RequisitosViaje
              ciudad={ciudad}
              nacionalidad={nacionalidad}
              onNacionalidad={cambiarNacionalidad}
              t={t}
            />

            {/* Configuración del viaje (colapsable: deja el itinerario más arriba) */}
            <details open className="mb-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-suave dark:border-slate-700 dark:bg-slate-800">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-marca-900">
                <span className="inline-flex items-center gap-1.5"><Icono nombre="sliders" size={16} /> {t("ajustarViaje")}</span>
                <span className="text-slate-400">▾</span>
              </summary>
              <div className="px-4 pb-4">
              {/* Rango de fechas del viaje (opcional): de aquí salen los días, el
                  itinerario fechado y la búsqueda de vuelos para esas fechas. */}
              <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl bg-marca-50/60 p-3 dark:bg-slate-700/40">
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Icono nombre="planeTakeoff" size={15} /> {t("fechaIda")}</span>
                  <input type="date" value={fechaInicio} min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => aplicarFechas(e.target.value, fechaFin)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[14px]" />
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Icono nombre="planeLanding" size={15} /> {t("fechaVuelta")}</span>
                  <input type="date" value={fechaFin} min={fechaInicio || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => aplicarFechas(fechaInicio, e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[14px]" />
                </label>
                {fechaInicio && fechaFin && (
                  <span className="pb-2 text-[12.5px] font-semibold text-marca-600">
                    {diasEntre(fechaInicio, fechaFin)} {t("dias").toLowerCase()}
                  </span>
                )}
                {(fechaInicio || fechaFin) && (
                  <button onClick={() => { setFechaInicio(""); setFechaFin(""); }}
                    className="inline-flex items-center gap-1 pb-2 text-[12px] text-slate-400 hover:text-slate-600"><Icono nombre="x" size={13} /> {t("limpiar")}</button>
                )}
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Icono nombre="calendar" size={15} /> {t("dias")}</span>
                  {/* Cambiar los dias RECALCULA solo (feedback 2026-07-11):
                      nadie deberia tener que apretar "Recalcular" tras elegir
                      4 dias. El boton queda para re-barajar a voluntad. El
                      cupo de lugares crece con los dias (5/dia, como en
                      cargarCategoria) para que los dias nuevos no queden
                      vacios. */}
                  <select value={dias} onChange={(e) => {
                    const n = +e.target.value;
                    setDias(n);
                    const cupo = Math.max(n * 5, 6);
                    const sel = lugaresBase.length ? lugaresBase.slice(0, cupo) : seleccion;
                    if (lugaresBase.length) setSeleccion(sel);
                    reconstruir(sel, ciudad, n);
                  }} disabled={!!(fechaInicio && fechaFin)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[15px] disabled:bg-slate-100 disabled:text-slate-400">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Icono nombre="clock" size={15} /> {t("horasDia")}</span>
                  {/* Horas/dia tambien recalcula en vivo. reconstruir() lee
                      `horas` del state (aun viejo en este tick), asi que
                      pasamos el plan por el camino de siempre en el proximo
                      render usando setTimeout 0 con el valor ya aplicado. */}
                  <select value={horas} onChange={(e) => { setHoras(+e.target.value); setTimeout(() => reconstruir(), 0); }}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[15px]">
                    {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <option key={n} value={n}>{n}h</option>)}
                  </select>
                </label>
                <button onClick={() => reconstruir()}
                  className="ml-auto rounded-xl border-[1.5px] border-marca-100 bg-white px-4 py-2.5 text-sm font-bold text-marca-600 transition hover:bg-marca-50 dark:border-slate-700 dark:bg-slate-800 dark:text-marca-400 dark:hover:bg-slate-700">
                  <span className="inline-flex items-center gap-1.5"><Icono nombre="refresh" size={15} /> {t("recalcular")}</span>
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip activo={momento === "diurno"} onClick={() => cambiarMomento("diurno")}><span className="inline-flex items-center gap-1.5"><Icono nombre="sun" size={15} /> {t("diurno")}</span></Chip>
                <Chip activo={momento === "nocturno"} onClick={() => cambiarMomento("nocturno")}><span className="inline-flex items-center gap-1.5"><Icono nombre="moon" size={15} /> {t("nocturno")}</span></Chip>
                <span className="self-center text-xs text-slate-500">
                  {momento === "nocturno" ? t("nocturnoDesc") : t("diurnoDesc")}
                </span>
              </div>

              {/* Hospedaje: punto de partida de la ruta ("mi hotel esta en X").
                  Al elegirlo, la ruta se rearma optimizada desde ese punto. */}
              <div className="mt-3">
                <div className="mb-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-400">{t("hospedajeLabel")}</div>
                <InicioRuta
                  ciudad={ciudad}
                  hospedaje={hospedaje}
                  t={t}
                  onElegir={(h) => { setHospedaje(h); reconstruir(seleccion, ciudad, undefined, h); }}
                  onQuitar={() => { setHospedaje(null); reconstruir(seleccion, ciudad, undefined, null); }}
                  onElegirEnMapa={() => {
                    setEligiendoEnMapa(true);
                    // Llevar la vista al mapa (en movil queda arriba).
                    setTimeout(() => mapaBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
                  }}
                />
              </div>
              </div>
            </details>

            {/* Categorías (vaivén automático suave — ver efecto chipsRef).
                py-1: sin padding vertical el borde superior de los chips se
                CORTABA contra el overflow del contenedor (bug 2026-07-11). */}
            <div ref={chipsRef} className="sin-scrollbar mb-2 flex gap-2 overflow-x-auto px-0.5 py-1">
              {/* Chip del wizard de gustos: primero, y "activo" cuando la vista
                  imperdibles esta personalizada (indicador "ruta a tu medida"). */}
              <Chip activo={!!gustos && categoria === "imperdibles"} onClick={() => setMostrarPersonalizar(true)}>
                <span className="inline-flex items-center gap-1.5">✨ {t("gustos_chip")}</span>
              </Chip>
              {Object.entries(CATEGORIAS).map(([k, c]) => (
                <Chip key={k} activo={categoria === k} onClick={() => cargarCategoria(k)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icono nombre={c.icono} size={15} /> {t("cat_" + k)}
                  </span>
                </Chip>
              ))}
            </div>

            {/* Task 5: indicador de hitos garantizados incluidos */}
            {categoria === "imperdibles" && !cargandoLugares && lugaresBase.length > 0 && (() => {
              const hitos = ciudad ? hitosParaCiudad(ciudad.lat, ciudad.lon) : null;
              if (!hitos) return null;
              const info = contarHitosEnLista(hitos, lugaresBase);
              if (!info) return null;
              const pct = Math.round((info.incluidos / info.total) * 100);
              return (
                <div className="mb-2.5 flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50/60 px-3 py-2 dark:border-amber-800/40 dark:bg-amber-900/20">
                  <span className="text-amber-600 dark:text-amber-400">⭐</span>
                  <span className="text-[12.5px] font-semibold text-amber-900 dark:text-amber-200">
                    {info.incluidos} de {info.total} imperdibles de la ciudad
                  </span>
                  <div className="ml-auto h-1.5 w-16 overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-800/40">
                    <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })()}

            {cargandoLugares && (
              <div className="mt-1 space-y-2.5" aria-busy="true" aria-label={t("cargandoLugares")}>
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-suave"
                  >
                    <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-slate-100" />
                    <div className="min-w-0 flex-1">
                      <div className="h-3.5 w-2/3 animate-pulse rounded bg-slate-100" />
                      <div className="mt-2 h-2.5 w-1/3 animate-pulse rounded bg-slate-100" />
                    </div>
                    <div className="h-[60px] w-[60px] shrink-0 animate-pulse rounded-xl bg-slate-100" />
                  </div>
                ))}
                <MensajeCargandoLugares t={t} />
              </div>
            )}

            {!cargandoLugares && lugaresBase.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-slate-500 shadow-suave">
                <div className="flex justify-center text-slate-300"><Icono nombre="search" size={30} /></div>
                <p className="mx-auto mt-1.5 max-w-xs text-sm">{t("sinResultados")}</p>
                <button
                  onClick={() => cargarCategoria("imperdibles")}
                  className="mt-3 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-4 py-2 text-sm font-bold text-white shadow-marca transition hover:brightness-105"
                >
                  <span className="inline-flex items-center gap-1.5"><Icono nombre="refresh" size={15} /> {t("recalcular")}</span>
                </button>
              </div>
            )}

            {/* Pestañas de días + GPS (movido aqui desde el fondo de la
                pagina — feedback 2026-07-11: "parecia oculto"). Boton pill
                destacado a la derecha de los dias: verde pulsante cuando
                esta activo. */}
            {plan.length > 0 && (
              <div className="sin-scrollbar mb-3.5 flex items-center gap-2 overflow-x-auto">
                {plan.map((d, i) => (d.paradas.length > 0 ? (
                  <Chip key={i} activo={diaVisible === i} onClick={() => setDiaVisible(i)}>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ["#4f46e5","#ea580c","#7c3aed","#0d9488","#c026d3","#0284c7","#65a30d"][i % 7] }} />
                      {t("dia")} {i + 1}
                    </span>
                  </Chip>
                ) : null))}
                <button
                  type="button"
                  onClick={() => setGpsOn((v) => !v)}
                  title={t("activarGps")}
                  className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold shadow-suave transition ${
                    gpsOn
                      ? "bg-emerald-500 text-white"
                      : "border-[1.5px] border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:bg-slate-800 dark:text-emerald-300"
                  }`}
                >
                  {gpsOn ? (
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                    </span>
                  ) : (
                    <Icono nombre="pin" size={13} />
                  )}
                  GPS {gpsOn ? "ON" : "OFF"}
                </button>
              </div>
            )}

            {plan[diaVisible] && (
              <Itinerario
                key={diaVisible}
                dia={plan[diaVisible]}
                numeroDia={diaVisible + 1}
                totalDias={plan.length}
                alternativas={lugaresBase}
                gps={gps}
                ciudad={ciudad?.nombre}
                hospedaje={hospedaje}
                fechaInicio={fechaInicio}
                husoDestino={(() => {
                  const iso = isoDesdeNombre(ciudad?.pais);
                  return iso ? infoPais(iso)?.husos?.[0] : null;
                })()}
                t={t}
                lang={lang}
                onCambiarParada={(idx) => cambiarParada(diaVisible, idx)}
                onQuitarParada={(idx) => quitarParada(diaVisible, idx)}
                onVerLugar={(p) => { setRutaTrazada(null); setDetalle(p); }}
                onOptimizar={handleOptimizar}
                onMoverParada={handleMoverParada}
                onReordenar={handleReordenar}
              />
            )}

            {/* Reserva tu viaje (experiencias, hoteles y vuelos) */}
            <AfiliadosCiudad ciudad={ciudad} t={t} />

            {/* Banda sonora del viaje: artistas locales + Top 50 del pais +
                vibe de temporada. mesViaje sale de la fecha de inicio si el
                usuario la fijo; si no, el mes actual. */}
            <MusicaCiudad
              ciudad={ciudad.nombre}
              pais={ciudad.pais}
              mesViaje={fechaInicio ? Number(fechaInicio.slice(5, 7)) : null}
              t={t}
            />

            {/* Lista completa de lugares encontrados (radio amplio ~100 km) */}
            {lugaresBase.length > 0 && (
              <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-suave">
                <button
                  onClick={() => setMostrarTodos((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-bold text-marca-900">
                    <span className="inline-flex items-center gap-1.5"><Icono nombre="pin" size={15} /> {t("todosLugares")} ({lugaresBase.length})</span>
                  </span>
                  <span className="text-slate-400">{mostrarTodos ? "▲" : "▼"}</span>
                </button>
                {mostrarTodos && (
                  <div className="max-h-[420px] overflow-y-auto border-t border-slate-100">
                    {lugaresBase.map((l) => {
                      const enPlan = plan[diaVisible]?.paradas?.some((p) => p.id === l.id);
                      return (
                        <div key={l.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0 dark:border-slate-700/50">
                          <button
                            onClick={() => { setRutaTrazada(null); setDetalle(l); }}
                            className="min-w-0 flex-1 text-left"
                          >
                            <div className="flex items-center gap-1.5 truncate text-[14px] font-semibold text-slate-800">
                              {l.notable && <span className="text-amber-500"><Icono nombre="star" size={12} /></span>}
                              <span className="truncate">{nombreLocalizado(l, lang)}</span>
                            </div>
                            <div className="truncate text-[12px] text-slate-500">{l.categoria}</div>
                          </button>
                          <button
                            onClick={() => agregarParada(l)}
                            disabled={enPlan}
                            className={`shrink-0 rounded-lg px-2.5 py-1.5 text-[12px] font-bold transition ${
                              enPlan
                                ? "bg-slate-100 text-slate-400"
                                : "bg-marca-50 text-marca-600 hover:bg-marca-100"
                            }`}
                          >
                            {enPlan ? <Icono nombre="check" size={14} /> : <span className="inline-flex items-center gap-1"><Icono nombre="plus" size={13} /> {t("agregar")}</span>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* GPS: el toggle vive ahora arriba, junto a las pestañas de dias
                (boton "GPS ON/OFF") — antes era un checkbox perdido aqui al
                fondo (feedback 2026-07-11). */}
          </div>

          {/* Panel derecho: mapa (arriba en móvil, fijo a la derecha en escritorio) */}
          <div className="order-1 lg:order-2 lg:w-[44%] lg:shrink-0">
            <div className="lg:sticky lg:top-[var(--v360-header-h,150px)]">
              <div ref={mapaBoxRef} className="relative mx-auto aspect-square w-[82vw] max-w-[420px] overflow-hidden rounded-full shadow-[0_8px_32px_rgba(0,0,0,0.18)] ring-[3px] ring-white/80 dark:ring-slate-700/80 lg:mx-0 lg:w-full lg:max-w-none">
                <div className="pointer-events-none absolute inset-0 z-[2] rounded-full" style={{ background: "radial-gradient(circle, transparent 50%, rgba(0,0,0,0.06) 62%, rgba(0,0,0,0.18) 75%, rgba(0,0,0,0.38) 88%, rgba(0,0,0,0.55) 100%)" }} />
                {eligiendoEnMapa && (
                  <div className="absolute inset-x-2 top-2 z-[1000] flex items-center justify-between gap-2 rounded-xl bg-marca-800/95 px-3 py-2 text-white shadow-lg">
                    <span className="text-[12.5px] font-bold">👆 {t("hospedajeMapaBanner")}</span>
                    <button
                      onClick={() => setEligiendoEnMapa(false)}
                      className="shrink-0 rounded-full bg-white/20 px-2.5 py-1 text-[11.5px] font-bold hover:bg-white/30"
                    >
                      {t("cancelar")}
                    </button>
                  </div>
                )}
                <Mapa
                  centro={[ciudad.lat, ciudad.lon]}
                  lugares={lugaresDelDia}
                  ubicacionUsuario={gps}
                  hospedaje={hospedaje}
                  colorDia={diaVisible}
                  rutaTrazada={rutaTrazada}
                  onClicLugar={(l) => {
                    if (eligiendoEnMapa) return; // en modo elegir, el clic es para fijar el punto
                    setRutaTrazada(null); setDetalle(l);
                  }}
                  onClicMapa={eligiendoEnMapa ? (lat, lon) => {
                    const h = { nombre: t("hospedajePuntoMapa"), lat, lon, mapa: true };
                    setEligiendoEnMapa(false);
                    setHospedaje(h);
                    reconstruir(seleccion, ciudad, undefined, h);
                    track("hospedaje_set", { ciudad: ciudad?.nombre, lugar: "mapa", origen: "mapa" });
                  } : null}
                  lang={lang}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detalle del lugar (dentro de la app). Le pasamos el huso del país
          destino (cuando lo conocemos) para que el badge "Abierto ahora"
          calcule con la hora local correcta. */}
      {detalle && (
        <DetalleLugar
          lugar={detalle}
          ciudad={ciudad}
          origen={gps}
          husoDestino={(() => {
            const iso = isoDesdeNombre(ciudad?.pais);
            return iso ? infoPais(iso)?.husos?.[0] : null;
          })()}
          t={t}
          lang={lang}
          onCerrar={() => setDetalle(null)}
          onTrazarRuta={(r) => { setRutaTrazada(r); setDetalle(null); }}
          onAgregar={plan[diaVisible] ? (l) => { agregarParada(l); setDetalle(null); } : undefined}
        />
      )}

      {/* Chat de viajeros de la ciudad abierta (boton flotante 💬) */}
      {ciudad && (
        <div className="print:hidden">
          <ChatViajeros ciudad={ciudad.nombre} t={t} />
        </div>
      )}

      {/* Asesor de viajes (guía gratis + IA opcional, chat flotante) */}
      <div className="print:hidden">
        <Asesor
          t={t}
          usuario={usuario}
          onPlanear={(q) => { buscarTexto(q); }}
          onAbrirPresupuesto={() => setMostrarPresupuesto(true)}
        />
      </div>

      {/* Vista de impresión / PDF: oculta en pantalla, solo aparece al imprimir.
          Renderiza TODOS los dias del plan (no solo el visible) en formato sobrio. */}
      {ciudad && plan.length > 0 && (
        <div className="solo-imprimir hidden print:block px-8 py-6">
          <h1>Anduve — {ciudad.nombre}</h1>
          <div className="meta">
            {ciudad.pais}
            {fechaInicio && fechaFin
              ? ` · ${new Date(fechaInicio + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" })} – ${new Date(fechaFin + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" })}`
              : ` · ${dias} ${t("dias").toLowerCase()}`}
          </div>
          {plan.map((d, i) => (
            d.paradas.length > 0 ? (
              <section key={i}>
                <h2>{t("dia")} {i + 1}</h2>
                <ol>
                  {d.paradas.map((p, j) => (
                    <li key={j}>
                      <strong>{nombreLocalizado(p, lang)}</strong>
                      <div className="meta">{p.categoria}{p.minutos ? ` · ${fmtMin(p.minutos)}` : ""}</div>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null
          ))}
          <div className="meta" style={{ marginTop: "20pt" }}>
            Generado en Anduve · anduve-app.vercel.app
          </div>
        </div>
      )}

      {/* Footer compartido — extraido a FooterAnduve component para que
          /ofertas y /mis-viajes lo reusen sin duplicar markup. */}
      <FooterAnduve />

      {/* Bottom tab bar — SOLO en mobile (md:hidden interno). Patron nativo
          de navegacion para que el usuario movil no tenga que abrir el menu
          ni scrollear hasta arriba para cambiar de seccion. */}
      <BottomTabBar />

      {/* Spacer para que el footer no quede tapado por el tab bar en mobile. */}
      <div className="h-16 print:hidden md:hidden" aria-hidden="true" />

      {/* Toasts: confirmaciones rápidas para acciones del usuario */}
      <Toast mostrar={guardado} texto={t("guardado")} icono="check" />
      <Toast mostrar={copiado} texto={t("copiado")} icono="check" />

      {/* Paywall: se renderiza solo cuando alguna feature gateada lo dispara */}
      {paywall.abierto && (
        <Paywall
          motivo={paywall.motivo}
          emailUsuario={usuario?.email}
          onCerrar={cerrarPaywall}
          t={t}
        />
      )}
    </div>
  );
}
