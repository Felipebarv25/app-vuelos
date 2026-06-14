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

const Mapa = dynamic(() => import("@/components/Mapa"), { ssr: false });

// Destinos destacados con foto (fotos libres de Wikimedia Commons).
const DESTINOS_DESTACADOS = [
  { nombre: "París", pais: "Francia", q: "París, Francia", hint: "Torre Eiffel" },
  { nombre: "Roma", pais: "Italia", q: "Roma, Italia", hint: "Coliseo" },
  { nombre: "Tokio", pais: "Japón", q: "Tokio, Japón", hint: "Tokyo Tower" },
  { nombre: "Nueva York", pais: "EE. UU.", q: "Nueva York, Estados Unidos", hint: "Manhattan skyline" },
  { nombre: "Cartagena", pais: "Colombia", q: "Cartagena, Colombia", hint: "Cartagena de Indias" },
  { nombre: "Barcelona", pais: "España", q: "Barcelona, España", hint: "Sagrada Familia" },
  { nombre: "Londres", pais: "Reino Unido", q: "Londres, Reino Unido", hint: "Big Ben London" },
  { nombre: "Estambul", pais: "Turquía", q: "Estambul, Turquía", hint: "Hagia Sophia Istanbul" },
  { nombre: "Dubái", pais: "Emiratos Árabes", q: "Dubái, Emiratos Árabes Unidos", hint: "Burj Khalifa Dubai" },
  { nombre: "Río de Janeiro", pais: "Brasil", q: "Río de Janeiro, Brasil", hint: "Christ the Redeemer Rio de Janeiro" },
  { nombre: "Ámsterdam", pais: "Países Bajos", q: "Ámsterdam, Países Bajos", hint: "Amsterdam canals" },
  { nombre: "Buenos Aires", pais: "Argentina", q: "Buenos Aires, Argentina", hint: "Obelisco Buenos Aires" },
];

// Imagen del hero del inicio (foto de viaje, CDN de Unsplash). Si fallara, queda
// el degradado de marca debajo como respaldo.
const HERO_IMG =
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=70";

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
  const { t, lang, usuario, salir, listo } = useApp();
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
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [viajesGuardados, setViajesGuardados] = useState([]);
  const [guardado, setGuardado] = useState(false);

  // GPS
  const [gpsOn, setGpsOn] = useState(false);
  const { pos: gps } = useGeo(gpsOn);

  const debounce = useRef(null);

  // Métrica: cuenta una visita por sesión (para el panel privado).
  useEffect(() => {
    trackVisita(lang);
  }, [lang]);

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

  async function buscarTexto(e) {
    e?.preventDefault();
    const q = consulta.trim();
    if (!q) return;
    setMostrarSug(false);
    setError(null);
    setCargando(true);
    try {
      const c = await geocodificar(q);
      setCiudad(c); // mapa visible ya
      limpiarParaNuevaCiudad();
      setCargando(false);
      track("busqueda", { ciudad: c.nombre, pais: c.pais });
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

  // Disparador de las ideas rápidas del HERO: pre-fija ciudad, días y/o momento
  // y abre la búsqueda en un solo click. Maneja sus propios overrides para no
  // depender del orden de actualización de los setState de React.
  async function pruebaRapida({ q, dias: d, momento: m }) {
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
    <div className="min-h-screen pb-10">
      {/* Cabecera: HERO con foto de viaje en el inicio; cinta blanca en la ciudad */}
      <header className={`relative z-[1000] print:hidden ${esHero ? "text-white" : "sticky top-0 border-b border-slate-200 bg-white/95 text-slate-700 shadow-suave backdrop-blur"}`}>
        {esHero && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-marca-700 to-marca-900" />
            <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${HERO_IMG})` }} />
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
              <LogoMarca tono={esHero ? "claro" : "marca"} className={esHero ? "drop-shadow" : ""} />
              <div className={`mt-0.5 hidden text-[13px] sm:block ${esHero ? "text-white/85" : "text-slate-400"}`}>{t("tagline")}</div>
            </button>
            <div className="flex items-center gap-3 lg:gap-5">
              <span className={`hidden items-center gap-2 text-sm md:inline-flex ${esHero ? "text-white/90" : "text-slate-500"}`}>
                {usuario.foto && (
                  <img
                    src={usuario.foto}
                    alt=""
                    className="h-7 w-7 rounded-full border border-white/30 object-cover"
                    referrerPolicy="no-referrer"
                  />
                )}
                {t("hola")}, <b className={esHero ? "" : "text-marca-700"}>{usuario.nombre}</b>
              </span>
              {ciudad && (
                <button onClick={irAlInicio} className={`text-[13px] underline-offset-2 hover:underline ${esHero ? "text-white/90" : "text-slate-500"}`}>
                  <span className="inline-flex items-center gap-1"><Icono nombre="home" size={14} /> {t("inicio")}</span>
                </button>
              )}
              <button onClick={salir} className={`text-[13px] underline-offset-2 hover:underline ${esHero ? "text-white/90" : "text-slate-500"}`}>
                {t("salir")}
              </button>
              <SelectorIdioma oscuro={esHero} />
            </div>
          </div>

          {esHero ? (
            /* HERO de inicio */
            <div className="mx-auto mt-12 max-w-2xl text-center lg:mt-20">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/85">
                {t("heroEyebrow")}
              </div>
              <h1 className="text-[34px] font-extrabold leading-[1.05] tracking-tight drop-shadow-md lg:text-[58px]">
                {t(saludoClave())}, {usuario.nombre}
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-white/90 lg:text-[19px]">
                {t("heroTexto")}
              </p>

              <div className="relative mx-auto mt-7 max-w-xl">
                <form onSubmit={buscarTexto} className="flex gap-2 rounded-2xl bg-white/95 p-1.5 shadow-2xl ring-1 ring-white/40 backdrop-blur">
                  <input
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                    onFocus={() => sugerencias.length && setMostrarSug(true)}
                    placeholder={t("buscarPlaceholder")}
                    list="ciudades-pop"
                    className="flex-1 rounded-xl border-0 bg-transparent px-4 py-3 text-base text-slate-800 outline-none placeholder:text-slate-400"
                  />
                  <button type="submit" aria-label={t("buscar")} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-5 text-base font-bold text-white shadow-md transition hover:brightness-110">
                    <Icono nombre="search" size={18} /> <span className="hidden sm:inline">{t("buscar")}</span>
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
              </div>

              {/* Ideas rápidas: pistas para el usuario que aterriza sin saber por dónde empezar. */}
              <div className="mx-auto mt-5 max-w-xl">
                <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-white/70">
                  {t("ideasEyebrow")}
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => pruebaRapida({ q: "Cartagena, Colombia", dias: 3 })}
                    className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    🏖️ Cartagena · 3 {t("dias").toLowerCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => pruebaRapida({ q: "Tokio, Japón", dias: 5 })}
                    className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    🗼 Tokio · 5 {t("dias").toLowerCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => pruebaRapida({ q: "Madrid, España", momento: "nocturno" })}
                    className="rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    🌃 Madrid · {t("nocturno").toLowerCase()}
                  </button>
                  <button
                    type="button"
                    onClick={() => { track("prueba_rapida", { presupuesto: 1 }); setMostrarPresupuesto(true); }}
                    className="rounded-full border border-emerald-300/60 bg-emerald-400/20 px-3.5 py-1.5 text-[13px] font-semibold text-white backdrop-blur transition hover:bg-emerald-400/30"
                  >
                    💰 {t("ideaPresupuesto")}
                  </button>
                </div>
              </div>
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
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800 shadow-suave">
            <span className="text-2xl">😕</span>
            <p className="flex-1 text-sm">{error}</p>
            <button onClick={reintentar} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
              <span className="inline-flex items-center gap-1.5"><Icono nombre="refresh" size={15} /> {t("recalcular")}</span>
            </button>
          </div>
        </div>
      )}

      {!ciudad && !cargando && (
        <div className="relative z-10 -mt-8 rounded-t-[32px] bg-[#f6f7fb] pt-2 print:hidden lg:-mt-12">
        <div className="animar-subir mx-auto max-w-7xl px-4 pb-4 pt-7 lg:px-8">
          {/* Banner presupuesto: tarjeta blanca con acento verde (a juego con el
              resto de tarjetas de la página; el verde es el acento de "dinero"). */}
          <button
            onClick={() => setMostrarPresupuesto(true)}
            className="group animar-pop relative mt-6 flex w-full items-center gap-4 overflow-hidden rounded-2xl border border-slate-100 bg-white px-4 py-4 text-left shadow-suave transition-all duration-300 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-media lg:max-w-2xl lg:px-5 lg:py-5"
          >
            {/* Acento de color a la izquierda */}
            <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-emerald-400 to-emerald-600" />

            {/* Tile con icono */}
            <span className="relative ml-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-[0_6px_16px_-4px_rgba(5,150,105,.55)] transition-transform duration-300 group-hover:scale-105 lg:h-14 lg:w-14">
              <Icono nombre="wallet" size={26} strokeWidth={2.2} />
            </span>

            {/* Texto */}
            <div className="min-w-0 flex-1">
              <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-emerald-600">
                {t("presupEyebrow")}
              </div>
              <div className="text-[16.5px] font-extrabold leading-tight tracking-tight text-marca-900 lg:text-[20px]">
                {t("presupBoton")}
              </div>
              <div className="mt-0.5 text-[13px] text-slate-500">{t("presupSub")}</div>
            </div>

            {/* Flecha */}
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 transition-all duration-300 group-hover:translate-x-0.5 group-hover:bg-emerald-600 group-hover:text-white">
              <Icono nombre="arrowRight" size={18} />
            </span>
          </button>

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
                  <div key={v.id} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-suave">
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
                onClick={() => { setConsulta(d.q); setTimeout(() => buscarTexto(), 0); }} />
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
            onPlanear={(q) => { setConsulta(q); setTimeout(() => buscarTexto(), 0); }}
          />
        </div>
        </div>
      )}

      {/* Módulo de presupuesto */}
      {mostrarPresupuesto && (
        <Presupuesto
          t={t}
          onCerrar={() => setMostrarPresupuesto(false)}
          onElegirCiudad={(d) => {
            setMostrarPresupuesto(false);
            const q = `${d.ciudad}, ${d.pais}`;
            setConsulta(q);
            setTimeout(() => buscarTexto(), 0);
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
                    onClick={guardarViajeActual}
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
                    onClick={compartirPlan}
                    className="rounded-xl border-[1.5px] border-marca-100 bg-white px-3 py-2 text-[13px] font-bold text-marca-600 transition hover:bg-marca-50"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Icono nombre={copiado ? "check" : "share"} size={15} />
                      {copiado ? t("copiado") : t("compartir")}
                    </span>
                  </button>
                )}
                {plan.some((d) => d.paradas.length > 0) && (
                  <button
                    onClick={descargarPDF}
                    title={t("descargarPDF")}
                    className="rounded-xl border-[1.5px] border-marca-100 bg-white px-3 py-2 text-[13px] font-bold text-marca-600 transition hover:bg-marca-50"
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
            <details open className="mb-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-suave">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-marca-900">
                <span className="inline-flex items-center gap-1.5"><Icono nombre="sliders" size={16} /> {t("ajustarViaje")}</span>
                <span className="text-slate-400">▾</span>
              </summary>
              <div className="px-4 pb-4">
              {/* Rango de fechas del viaje (opcional): de aquí salen los días, el
                  itinerario fechado y la búsqueda de vuelos para esas fechas. */}
              <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl bg-marca-50/60 p-3">
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
                  className="ml-auto rounded-xl border-[1.5px] border-marca-100 bg-white px-4 py-2.5 text-sm font-bold text-marca-600 transition hover:bg-marca-50">
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
                <div className="px-0.5 text-[12px] text-slate-400">{t("cargandoLugares")}</div>
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
                        <div key={l.id} className="flex items-center gap-2 border-b border-slate-50 px-3 py-2.5 last:border-0">
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
            <label className={`mt-3.5 flex cursor-pointer items-center gap-2.5 rounded-2xl border border-slate-100 p-4 shadow-suave transition ${gpsOn ? "bg-emerald-50" : "bg-white"}`}>
              <input type="checkbox" checked={gpsOn} onChange={(e) => setGpsOn(e.target.checked)} />
              <span className="inline-flex items-center gap-1.5 text-sm">
                <Icono nombre="pin" size={15} className="text-marca-600" /> {t("activarGps")}
                {gpsOn && gps && <span className="font-semibold text-emerald-600"> · {t("activo")}</span>}
              </span>
            </label>
          </div>

          {/* Panel derecho: mapa (arriba en móvil, fijo a la derecha en escritorio) */}
          <div className="order-1 lg:order-2 lg:w-[44%] lg:shrink-0">
            <div className="lg:sticky lg:top-[150px]">
              <div className="h-[42vh] min-h-[260px] overflow-hidden lg:h-[calc(100vh-172px)] lg:rounded-2xl lg:shadow-media">
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
          onPlanear={(q) => { setConsulta(q); setTimeout(() => buscarTexto(), 0); }}
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

      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-400 print:hidden lg:px-8">
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
    </div>
  );
}
