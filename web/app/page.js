"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { geocodificar, traerLugares, CATEGORIAS } from "@/lib/osm";
import { traducirLoteWD, nombreLocalizado } from "@/lib/nombres";
import { compartirEnlace } from "@/lib/compartir";
import { getDestinoPorSlug } from "@/lib/destinos";
import { construirItinerario, agregarLugarADia, fmtMin } from "@/lib/itinerario";
import { CIUDADES_POPULARES } from "@/lib/ciudadesPopulares";
import { sugerirCiudades } from "@/lib/autocompletar";
import { useGeo } from "@/lib/useGeo";
import { Chip } from "@/components/ui";
import Itinerario from "@/components/Itinerario";
import DetalleLugar from "@/components/DetalleLugar";
import Bienvenida from "@/components/Bienvenida";
import SelectorIdioma from "@/components/SelectorIdioma";
import Presupuesto from "@/components/Presupuesto";
import CardDestino from "@/components/CardDestino";
import Ofertas from "@/components/Ofertas";
import Asesor from "@/components/Asesor";
import { AfiliadosCiudad } from "@/components/Afiliados";
import RequisitosViaje from "@/components/RequisitosViaje";
import { listarViajesAsync, guardarViajeAsync, borrarViajeAsync } from "@/lib/viajes";
import { LogoMarca } from "@/components/Logo";
import { Icono } from "@/components/Icono";
import Toast from "@/components/Toast";
import { useApp } from "@/lib/AppContext";
import { track, trackVisita } from "@/lib/track";
import { registrarEvento, obtenerRecomendaciones } from "@/lib/perfil";
import Paywall from "@/components/Paywall";
import MenuUsuario from "@/components/MenuUsuario";

const Mapa = dynamic(() => import("@/components/Mapa"), { ssr: false });

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
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70", // playa caribena
    "https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1600&q=70", // playa con olas
    "https://images.unsplash.com/photo-1519046904884-53103b34b206?auto=format&fit=crop&w=1600&q=70", // playa tropical aerea
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70",
  ],
  ciudad: [
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=70", // Paris/Torre Eiffel
    "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1600&q=70", // ciudad NY noche
    "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1600&q=70", // ciudad europea
  ],
  historia: [
    "https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1600&q=70", // Coliseo Roma
    "https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1600&q=70", // Acropolis Atenas
    "https://images.unsplash.com/photo-1543589077-47d81606c1bf?auto=format&fit=crop&w=1600&q=70", // arquitectura clasica
  ],
  naturaleza: [
    "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=1600&q=70", // montanas lago
    "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1600&q=70", // bosque verde
    "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1600&q=70", // panorama natural
  ],
  montana: [
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1600&q=70", // alpes amanecer
    "https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?auto=format&fit=crop&w=1600&q=70", // sierra
    "https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1600&q=70", // valle montanas
  ],
  gastronomia: [
    "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1600&q=70", // restaurante calido
    "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=70", // mesa con comida
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1600&q=70", // plato gourmet
  ],
  lujo: [
    "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1600&q=70", // piscina infinity
    "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1600&q=70", // resort lujo
  ],
  nocturna: [
    "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1600&q=70", // bar coctel
    "https://images.unsplash.com/photo-1535079859068-2f9b3fa4d4ca?auto=format&fit=crop&w=1600&q=70", // ciudad de noche
  ],
  romantico: [
    "https://images.unsplash.com/photo-1518684079-3c830dcef090?auto=format&fit=crop&w=1600&q=70", // Santorini atardecer
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=70", // Paris romantico
  ],
  general: [
    "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1503917988258-f87a78e3c995?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1480796927426-f609979314bd?auto=format&fit=crop&w=1600&q=70",
    "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1600&q=70",
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
function MensajeCargandoLugares({ t }) {
  const [fase, setFase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setFase(1), 2500);
    const t2 = setTimeout(() => setFase(2), 5500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  const msgs = [t("cargandoFase1"), t("cargandoFase2"), t("cargandoFase3")];
  return (
    <div className="px-0.5">
      <div className="text-[12.5px] font-semibold text-slate-500 transition-all">
        {msgs[fase]}
      </div>
      {/* Barra de progreso indeterminada (avanza suave para sensacion de vida). */}
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-marca-500 transition-all duration-700"
          style={{ width: fase === 0 ? "30%" : fase === 1 ? "65%" : "90%" }}
        />
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
  const [montoHero, setMontoHero] = useState(10000000);
  const [monedaHero, setMonedaHero] = useState("COP");
  const [presupuestoInicial, setPresupuestoInicial] = useState(null);
  // Despliega/colapsa el bloque de busqueda por ciudad (secundario en el nuevo
  // HERO: la entrada por presupuesto es la principal).
  const [mostrarBuscarCiudad, setMostrarBuscarCiudad] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [viajesGuardados, setViajesGuardados] = useState([]);
  const [guardado, setGuardado] = useState(false);

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

  // Pais del visitante (de /api/geo). Sirve para personalizar el hero:
  // "Plan tu viaje desde {pais}". Cae a "Colombia" si no se puede detectar.
  // Detecta una sola vez por sesion (cacheado en sessionStorage).
  const [paisVisitante, setPaisVisitante] = useState("Colombia");
  useEffect(() => {
    let vivo = true;
    try {
      const cache = sessionStorage.getItem("v360_pais_nombre");
      if (cache) { setPaisVisitante(cache); return; }
    } catch {}
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!vivo) return;
        const nombre = (g?.pais && PAIS_GENTILICIO[g.pais]) || "Colombia";
        setPaisVisitante(nombre);
        try { sessionStorage.setItem("v360_pais_nombre", nombre); } catch {}
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

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
      sid = sessionStorage.getItem("v360_sid");
      if (!sid) {
        sid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        sessionStorage.setItem("v360_sid", sid);
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
  useEffect(() => {
    if (!listo || ciudad) return;
    try {
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
  }, [listo]);

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
      const g = localStorage.getItem("v360_nac");
      if (g) setNacionalidad(g);
    } catch {}
  }, []);
  function cambiarNacionalidad(cc) {
    setNacionalidad(cc);
    try { localStorage.setItem("v360_nac", cc); } catch {}
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
    reconstruir(v.seleccion || [], v.ciudad, v.dias);
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

  // Limpia los resultados de la ciudad anterior para no mostrar marcadores ni
  // itinerario viejos mientras carga la nueva (evita ver "París en Medellín").
  function limpiarParaNuevaCiudad() {
    setLugaresBase([]);
    setSeleccion([]);
    setPlan([]);
    setRutaTrazada(null);
    setDetalle(null);
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
      setError(err.message);
      setCiudad(null);
      setCargando(false);
      track("busqueda_fallida", { q }); // demanda no resuelta (para el panel)
    }
  }

  // Carga lugares SIN bloquear la pantalla: usa un indicador propio (cargandoLugares).
  // diasOverride: para que los chips de "ideas para empezar" reciban su nº de días
  // ANTES de que React aplique el setDias (evita un re-render con el plan corto).
  async function cargarCategoria(cat, c = ciudad, mom = momento, diasOverride) {
    if (!c) return;
    setError(null);
    setCategoria(cat);
    setCargandoLugares(true);
    const catReal = mom === "nocturno" && cat === "imperdibles" ? "bares" : cat;
    const nDias = diasOverride || dias;
    try {
      const lugares = await traerLugares(catReal, c.lat, c.lon);
      setLugaresBase(lugares);
      // Tomamos hasta 5 lugares por día (con margen) para llenar bien cada día.
      const cupo = Math.max(nDias * 5, 6);
      const sel = lugares.slice(0, cupo);
      setSeleccion(sel);
      reconstruir(sel, c, nDias);
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
    setMostrarPresupuesto(true);
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
      setError(err.message);
      setCargando(false);
      track("busqueda_fallida", { q });
    }
  }

  function reconstruir(sel = seleccion, c = ciudad, diasOverride) {
    if (!c || !sel.length) {
      setPlan([]);
      return;
    }
    // Punto de partida: el centro de la ciudad destino.
    // Solo usamos el GPS si el usuario YA está físicamente en esa ciudad
    // (a menos de ~60 km). Así, planear NY desde Colombia no rompe el día.
    const centro = [c.lat, c.lon];
    let inicio = centro;
    if (gps) {
      const cerca =
        Math.hypot(gps[0] - c.lat, gps[1] - c.lon) < 0.6; // ~60 km
      if (cerca) inicio = gps;
    }
    const nDias = diasOverride || dias;
    const p = construirItinerario(sel, { dias: nDias, horasPorDia: horas, inicio });
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

  // Agregar un lugar (de la lista completa) al día visible del itinerario.
  function agregarParada(lugar) {
    if (!plan[diaVisible]) return;
    setPlan((p) => agregarLugarADia(p, diaVisible, lugar));
    setSeleccion((s) => (s.some((x) => x.id === lugar.id) ? s : [...s, lugar]));
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
    const titulo = `Viajero 360 - ${ciudad.nombre}${ciudad.pais ? `, ${ciudad.pais}` : ""}`;
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
            title: `Viaje a ${ciudad.nombre} · Viajero 360`,
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
    let txt = `🗺️ ${t("miViajeA")} ${ciudad.nombre}, ${ciudad.pais} — Viajero 360\n`;
    let n = 0;
    plan.forEach((d) => {
      if (!d.paradas.length) return;
      n += 1;
      txt += `\n${t("dia")} ${n}\n`;
      d.paradas.forEach((p, i) => {
        txt += `  ${i + 1}. ${nombreLocalizado(p, lang)} (${fmtMin(p.minutos)})\n`;
      });
    });
    txt += `\n${t("hechoCon")} Viajero 360 · https://app-vuelos-mfos.vercel.app/`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Viajero 360", text: txt });
      } else {
        await navigator.clipboard.writeText(txt);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2500);
      }
    } catch {}
  }

  const lugaresDelDia = plan[diaVisible]?.paradas || [];

  // Mientras carga el estado guardado, no parpadear.
  if (!listo) return null;
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

        {/* Lista de ciudades compartida por ambos buscadores */}
        <datalist id="ciudades-pop">
          {CIUDADES_POPULARES.map((c) => (<option key={c} value={c} />))}
        </datalist>

        <div className={`relative mx-auto max-w-7xl px-4 lg:px-8 ${esHero ? "pt-5 pb-16 lg:pb-24" : "pt-3 pb-3"}`}>
          {/* Barra de navegación superior */}
          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={irAlInicio} aria-label="Viajero 360 — inicio" className="cursor-pointer text-left">
              <LogoMarca size={esHero ? 56 : 48} animado tono={esHero ? "claro" : "marca"} className={esHero ? "drop-shadow" : ""} />
              <div className={`mt-0.5 hidden text-[11px] font-bold uppercase tracking-[0.28em] sm:block sm:text-[12px] ${esHero ? "text-white/85" : "text-slate-500"}`}>{t("tagline")}</div>
            </button>
            <div className="flex items-center gap-3 lg:gap-4">
              {ciudad && (
                <button onClick={irAlInicio} className={`text-[13px] underline-offset-2 hover:underline ${esHero ? "text-white/90" : "text-slate-500"}`}>
                  <span className="inline-flex items-center gap-1"><Icono nombre="home" size={14} /> {t("inicio")}</span>
                </button>
              )}
              {!pro && (
                <a
                  href="/pro"
                  className={`hidden text-[13px] font-bold underline-offset-2 hover:underline sm:inline ${esHero ? "text-amber-200" : "text-amber-600"}`}
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
                className={`flex h-8 w-8 items-center justify-center rounded-full border text-[16px] transition ${
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
            <div className="mx-auto mt-10 max-w-2xl text-center lg:mt-16">
              {viajerosVivos != null && viajerosVivos > 0 && (
                <div className="mb-4 flex justify-center">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                    </span>
                    {viajerosVivos.toLocaleString(lang)} {viajerosVivos === 1 ? t("viajeroEnLinea") : t("viajerosEnLinea")}
                  </span>
                </div>
              )}
              <div className="mb-2 text-[14px] font-semibold text-white/85">
                {t(saludoClave())}, {usuario.nombre} 👋
              </div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/85">
                {t("heroEyebrowBudget").replace("{pais}", paisVisitante)}
              </div>
              <h1 className="text-[28px] font-extrabold leading-[1.05] tracking-tight drop-shadow-md lg:text-[48px]">
                {t("heroH1Budget")}
              </h1>
              <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-white/90 lg:text-[17px]">
                {t("heroSubBudget")}
              </p>

              {/* Form principal: presupuesto + moneda + CTA. Al enviar abre
                  el modal de Presupuesto pre-llenado con esos valores. */}
              <form
                onSubmit={(e) => { e.preventDefault(); abrirPresupuestoCon(montoHero, monedaHero); }}
                className="mx-auto mt-6 max-w-xl rounded-2xl bg-white/95 p-2 shadow-2xl ring-1 ring-white/40 backdrop-blur"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex flex-1 items-center gap-2 rounded-xl bg-white px-3.5 py-2.5 ring-1 ring-slate-200 focus-within:ring-marca-400">
                    <span className="text-2xl">💰</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={montoHero > 0 ? montoHero.toLocaleString(lang === "es" || lang === "pt" ? "es-CO" : "en-US") : ""}
                      onChange={(e) => {
                        const raw = (e.target.value || "").replace(/\D/g, "");
                        if (raw === "") { setMontoHero(0); return; }
                        const n = parseInt(raw, 10);
                        if (!Number.isNaN(n)) setMontoHero(n);
                      }}
                      onFocus={(e) => { try { e.target.select(); } catch {} }}
                      placeholder="0"
                      aria-label={t("heroH1Budget")}
                      className="w-full border-0 bg-transparent text-left text-[20px] font-extrabold text-marca-900 outline-none placeholder:text-slate-300 lg:text-[24px]"
                    />
                    <select
                      value={monedaHero}
                      onChange={(e) => setMonedaHero(e.target.value)}
                      aria-label="Moneda"
                      className="rounded-lg border-0 bg-slate-100 px-2 py-1 text-[13px] font-bold text-slate-700 outline-none"
                    >
                      <option value="COP">COP</option>
                      <option value="USD">USD</option>
                      <option value="MXN">MXN</option>
                      <option value="EUR">EUR</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-3 text-[15px] font-bold text-white shadow-md transition hover:brightness-110"
                  >
                    {t("heroVerOpciones")} <Icono nombre="arrowRight" size={18} />
                  </button>
                </div>
              </form>

              {/* Chips de montos sugeridos: clicar fija el monto+moneda y abre
                  el modal directo (atajo para el usuario que no quiere tipear). */}
              <div className="mx-auto mt-3 flex max-w-xl flex-wrap justify-center gap-2">
                {[
                  { monto: 5000000, moneda: "COP", label: "$5M COP" },
                  { monto: 10000000, moneda: "COP", label: "$10M COP" },
                  { monto: 20000000, moneda: "COP", label: "$20M COP" },
                  { monto: 1500, moneda: "USD", label: "US$ 1.500" },
                  { monto: 3000, moneda: "USD", label: "US$ 3.000" },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => abrirPresupuestoCon(opt.monto, opt.moneda)}
                    className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12.5px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Divisor + opcion secundaria: buscar por ciudad. Empieza
                  COLAPSADA — solo aparece el link "o busca por ciudad" para
                  los que ya saben a donde. Mantiene la entrada por ciudad
                  accesible sin competir con el CTA principal de presupuesto. */}
              <div className="mx-auto mt-7 flex max-w-xl items-center gap-3 text-[12px] text-white/70">
                <span className="h-px flex-1 bg-white/25" />
                <button
                  type="button"
                  onClick={() => setMostrarBuscarCiudad((v) => !v)}
                  className="flex items-center gap-1 font-semibold uppercase tracking-[0.18em] text-white/80 transition hover:text-white"
                >
                  {t("heroOSabesDestino")} <span className={`transition ${mostrarBuscarCiudad ? "rotate-180" : ""}`}>▾</span>
                </button>
                <span className="h-px flex-1 bg-white/25" />
              </div>

              {mostrarBuscarCiudad && (
                <div className="animar-subir relative mx-auto mt-3 max-w-xl">
                  <form onSubmit={buscarTexto} className="flex gap-2 rounded-2xl bg-white/95 p-1.5 shadow-xl ring-1 ring-white/40 backdrop-blur">
                    <input
                      value={consulta}
                      onChange={(e) => setConsulta(e.target.value)}
                      onFocus={() => sugerencias.length && setMostrarSug(true)}
                      placeholder={t("buscarPlaceholder")}
                      list="ciudades-pop"
                      className="flex-1 rounded-xl border-0 bg-transparent px-4 py-2.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
                    />
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

                  {/* Ideas rapidas de ciudad - solo si el bloque secundario esta abierto */}
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => pruebaRapida({ q: "Cartagena, Colombia", dias: 3 })}
                      className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      🏖️ Cartagena
                    </button>
                    <button
                      type="button"
                      onClick={() => pruebaRapida({ q: "Tokio, Japón", dias: 5 })}
                      className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      🗼 Tokio
                    </button>
                    <button
                      type="button"
                      onClick={() => pruebaRapida({ q: "Madrid, España", momento: "nocturno" })}
                      className="rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                    >
                      🌃 Madrid
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Cinta de ciudad: buscador compacto sobre fondo blanco */
            <div className="relative mt-3 max-w-2xl">
              <form onSubmit={buscarTexto} className="flex gap-2">
                <input
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  onFocus={() => sugerencias.length && setMostrarSug(true)}
                  placeholder={t("buscarPlaceholder")}
                  list="ciudades-pop"
                  className="flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3 text-base text-slate-800 outline-none transition focus:border-marca-400 focus:bg-white"
                />
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

      {error && (
        <div className="mx-auto mt-3.5 max-w-7xl px-4 print:hidden lg:px-8">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800 shadow-suave dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
            <span className="text-2xl">😕</span>
            <p className="flex-1 text-sm">{error}</p>
            <button onClick={reintentar} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
              <span className="inline-flex items-center gap-1.5"><Icono nombre="refresh" size={15} /> {t("recalcular")}</span>
            </button>
          </div>
        </div>
      )}

      {!ciudad && !cargando && (
        <div className="relative z-10 -mt-8 rounded-t-[32px] bg-[#f6f7fb] pt-2 print:hidden dark:bg-slate-900 lg:-mt-12">
        <div className="animar-subir mx-auto max-w-7xl px-4 pb-4 pt-7 lg:px-8">
          {/* Mis viajes guardados (en este dispositivo) */}
          {viajesGuardados.length > 0 && (
            <div className="mt-10">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-marca-500">
                {t("misViajesEyebrow")}
              </div>
              <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-marca-900 lg:text-[26px]">
                {t("misViajesTitulo")}
                {usuario?.google && (
                  <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                    <Icono nombre="check" size={12} /> {t("misViajesSync")}
                  </span>
                )}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {viajesGuardados.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-suave dark:border-slate-700 dark:bg-slate-800">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-extrabold text-marca-900">{v.ciudad?.nombre}</div>
                      <div className="truncate text-[12.5px] text-slate-500">
                        {v.ciudad?.pais}
                        {v.fechaInicio && v.fechaFin
                          ? ` · ${new Date(v.fechaInicio + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" })}–${new Date(v.fechaFin + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" })}`
                          : ` · ${v.dias} ${t("dias").toLowerCase()}`}
                      </div>
                    </div>
                    <button
                      onClick={() => reabrirViaje(v)}
                      className="shrink-0 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-3 py-2 text-[12.5px] font-bold text-white shadow-marca transition hover:brightness-105"
                    >
                      {t("misViajesReabrir")}
                    </button>
                    <button
                      onClick={() => eliminarViaje(v.id)}
                      aria-label={t("misViajesEliminar")}
                      title={t("misViajesEliminar")}
                      className="flex shrink-0 items-center rounded-lg px-2 py-2 text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                    >
                      <Icono nombre="x" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Destinos con foto */}
          <div className="mb-4 mt-10">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-marca-500">
              {t("destinosEyebrow")}
            </div>
            <h2 className="mt-1 text-[20px] font-extrabold tracking-tight text-marca-900 lg:text-[26px]">
              {t("pruebaPopular")}
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 lg:gap-4">
            {DESTINOS_DESTACADOS.map((d) => (
              <CardDestino key={d.q} nombre={d.nombre} pais={d.pais} hint={d.hint}
                visitantes={d.visitantes}
                onClick={() => buscarTexto(d.q)} />
            ))}
          </div>

          {/* Beneficios */}
          <div className="mt-9 flex flex-wrap gap-2.5">
            {[
              ["calendar", t("benDiaTitulo")],
              ["pin", t("benGpsTitulo")],
              ["utensils", t("benComerTitulo")],
              ["route", t("benLlegarTitulo")],
            ].map(([ic, tit]) => (
              <div key={tit} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-100 bg-white px-3.5 py-2 shadow-suave">
                <span className="text-marca-600"><Icono nombre={ic} size={16} /></span>
                <span className="text-[12.5px] font-semibold text-marca-900">{tit}</span>
              </div>
            ))}
          </div>

          {/* ¿Cuándo viajas? Rango de fechas que alimenta vuelos + itinerario. */}
          <div className="mt-10 rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
            <div className="flex flex-wrap items-end gap-3">
              <div className="mr-auto">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-marca-500">
                  {t("cuandoEyebrow")}
                </div>
                <div className="mt-0.5 text-[15px] font-extrabold text-marca-900">{t("cuandoTitulo")}</div>
              </div>
              <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5"><Icono nombre="planeTakeoff" size={15} /> {t("fechaIda")}</span>
                <input type="date" value={fechaInicio} min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => aplicarFechas(e.target.value, fechaFin)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[14px]" />
              </label>
              <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-slate-600">
                <span className="inline-flex items-center gap-1.5"><Icono nombre="planeLanding" size={15} /> {t("fechaVuelta")}</span>
                <input type="date" value={fechaFin} min={fechaInicio || new Date().toISOString().slice(0, 10)}
                  onChange={(e) => aplicarFechas(fechaInicio, e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[14px]" />
              </label>
              {fechaInicio && fechaFin && (
                <span className="pb-2 text-[12.5px] font-semibold text-emerald-600">
                  ✓ {diasEntre(fechaInicio, fechaFin)} {t("dias").toLowerCase()}
                </span>
              )}
            </div>
          </div>

          {/* Vuelos baratos desde Colombia (detector de precios) */}
          <Ofertas
            t={t}
            lang={lang}
            rango={fechaInicio && fechaFin ? { inicio: fechaInicio, fin: fechaFin } : null}
            onPlanear={(q) => { buscarTexto(q); }}
          />
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
                  <select value={dias} onChange={(e) => setDias(+e.target.value)} disabled={!!(fechaInicio && fechaFin)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[15px] disabled:bg-slate-100 disabled:text-slate-400">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-slate-600">
                  <span className="inline-flex items-center gap-1.5"><Icono nombre="clock" size={15} /> {t("horasDia")}</span>
                  <select value={horas} onChange={(e) => setHoras(+e.target.value)}
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
              </div>
            </details>

            {/* Categorías */}
            <div className="mb-2 flex gap-2 overflow-x-auto pb-2">
              {Object.entries(CATEGORIAS).map(([k, c]) => (
                <Chip key={k} activo={categoria === k} onClick={() => cargarCategoria(k)}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icono nombre={c.icono} size={15} /> {t("cat_" + k)}
                  </span>
                </Chip>
              ))}
            </div>

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

            {/* Pestañas de días */}
            {plan.length > 0 && (
              <div className="mb-3.5 flex gap-2 overflow-x-auto">
                {plan.map((d, i) => (d.paradas.length > 0 ? (
                  <Chip key={i} activo={diaVisible === i} onClick={() => setDiaVisible(i)}>{t("dia")} {i + 1}</Chip>
                ) : null))}
              </div>
            )}

            {plan[diaVisible] && (
              <Itinerario
                key={diaVisible}
                dia={plan[diaVisible]}
                numeroDia={diaVisible + 1}
                alternativas={lugaresBase}
                gps={gps}
                ciudad={ciudad?.nombre}
                fechaInicio={fechaInicio}
                t={t}
                lang={lang}
                onCambiarParada={(idx) => cambiarParada(diaVisible, idx)}
                onQuitarParada={(idx) => quitarParada(diaVisible, idx)}
                onVerLugar={(p) => { setRutaTrazada(null); setDetalle(p); }}
              />
            )}

            {/* Reserva tu viaje (experiencias, hoteles y vuelos) */}
            <AfiliadosCiudad ciudad={ciudad} t={t} />

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

            {/* GPS toggle */}
            <label className={`mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-100 p-4 shadow-suave transition dark:border-slate-700 ${gpsOn ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-white dark:bg-slate-800"}`}>
              <input type="checkbox" checked={gpsOn} onChange={(e) => setGpsOn(e.target.checked)} />
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Icono nombre="pin" size={15} className="text-marca-600" /> {t("activarGps")}
                {gpsOn && gps && <span className="font-semibold text-emerald-600"> · {t("activo")}</span>}
              </span>
            </label>
          </div>

          {/* Panel derecho: mapa (arriba en móvil, fijo a la derecha en escritorio) */}
          <div className="order-1 lg:order-2 lg:w-[44%] lg:shrink-0">
            <div className="lg:sticky lg:top-[var(--v360-header-h,150px)]">
              <div className="h-[42vh] min-h-[260px] overflow-hidden lg:h-[calc(100vh-var(--v360-header-h,150px)-22px)] lg:rounded-2xl lg:shadow-media">
                <Mapa
                  centro={[ciudad.lat, ciudad.lon]}
                  lugares={lugaresDelDia}
                  ubicacionUsuario={gps}
                  rutaTrazada={rutaTrazada}
                  onClicLugar={(l) => { setRutaTrazada(null); setDetalle(l); }}
                  lang={lang}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detalle del lugar (dentro de la app) */}
      {detalle && (
        <DetalleLugar
          lugar={detalle}
          ciudad={ciudad}
          origen={gps}
          t={t}
          lang={lang}
          onCerrar={() => setDetalle(null)}
          onTrazarRuta={(r) => { setRutaTrazada(r); setDetalle(null); }}
          onAgregar={plan[diaVisible] ? (l) => { agregarParada(l); setDetalle(null); } : undefined}
        />
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
          <h1>Viajero 360 — {ciudad.nombre}</h1>
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
            Generado en Viajero 360 · app-vuelos-mfos.vercel.app
          </div>
        </div>
      )}

      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-400 print:hidden dark:text-slate-500 lg:px-8">
        {/* Enlaces a las landing pages SEO desde la home */}
        <div className="mb-3 flex flex-wrap justify-center gap-3 text-[12.5px] font-semibold text-slate-500">
          <a href="/destino" className="hover:text-marca-600 hover:underline">
            Ver 80 destinos
          </a>
          <span className="text-slate-300">·</span>
          <a href="/comparar" className="hover:text-marca-600 hover:underline">
            Comparar destinos
          </a>
        </div>
        <div>{t("footer")} · Viajero 360</div>
        <div className="mt-1 text-[11px] text-slate-400">
          Datos de lugares: ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" className="underline hover:text-marca-600">
            OpenStreetMap
          </a>{" "}
          (ODbL) ·{" "}
          <a href="https://es.wikivoyage.org/" target="_blank" rel="noopener" className="underline hover:text-marca-600">
            Wikivoyage
          </a>
          /{" "}
          <a href="https://www.wikidata.org/" target="_blank" rel="noopener" className="underline hover:text-marca-600">
            Wikidata
          </a>{" "}
          (CC BY-SA) · Popularidad: Amadeus
        </div>
        <div className="mt-1 text-[11px] text-slate-400">
          Requisitos de visa:{" "}
          <a href="https://github.com/ilyankou/passport-index-dataset" target="_blank" rel="noopener" className="underline hover:text-marca-600">
            Passport Index
          </a>{" "}
          · Países:{" "}
          <a href="https://restcountries.com/" target="_blank" rel="noopener" className="underline hover:text-marca-600">
            REST Countries
          </a>
          {" "}· Información referencial, verifica en fuentes oficiales.
        </div>
      </footer>

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
