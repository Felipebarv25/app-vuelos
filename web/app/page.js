"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { geocodificar, traerLugares, CATEGORIAS } from "@/lib/osm";
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
import { useApp } from "@/lib/AppContext";

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
  const [momento, setMomento] = useState("diurno");
  const [categoria, setCategoria] = useState("imperdibles");

  // Datos
  const [lugaresBase, setLugaresBase] = useState([]);
  const [seleccion, setSeleccion] = useState([]);
  const [plan, setPlan] = useState([]);
  const [diaVisible, setDiaVisible] = useState(0);

  // Lugar abierto en detalle + ruta trazada en el mapa
  const [detalle, setDetalle] = useState(null);
  const [rutaTrazada, setRutaTrazada] = useState(null);
  const [mostrarPresupuesto, setMostrarPresupuesto] = useState(false);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // GPS
  const [gpsOn, setGpsOn] = useState(false);
  const { pos: gps } = useGeo(gpsOn);

  const debounce = useRef(null);

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

  function elegirCiudad(sug) {
    setConsulta(sug.etiqueta);
    setMostrarSug(false);
    setSugerencias([]);
    setError(null);
    // Mostramos el mapa y la ciudad de INMEDIATO (ya tenemos coords del autocompletado).
    const c = { nombre: sug.ciudad, pais: sug.pais, lat: sug.lat, lon: sug.lon };
    setCiudad(c);
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
      setCargando(false);
      cargarCategoria("imperdibles", c); // lugares en segundo plano
    } catch (err) {
      setError(err.message);
      setCiudad(null);
      setCargando(false);
    }
  }

  // Carga lugares SIN bloquear la pantalla: usa un indicador propio (cargandoLugares).
  async function cargarCategoria(cat, c = ciudad, mom = momento) {
    if (!c) return;
    setError(null);
    setCategoria(cat);
    setCargandoLugares(true);
    const catReal = mom === "nocturno" && cat === "imperdibles" ? "bares" : cat;
    try {
      const lugares = await traerLugares(catReal, c.lat, c.lon);
      setLugaresBase(lugares);
      // Tomamos hasta 5 lugares por día (con margen) para llenar bien cada día.
      const cupo = Math.max(dias * 5, 6);
      const sel = lugares.slice(0, cupo);
      setSeleccion(sel);
      reconstruir(sel, c);
    } catch (err) {
      setError("Tardó demasiado en cargar lugares. Toca una categoría para reintentar.");
    } finally {
      setCargandoLugares(false);
    }
  }

  function reconstruir(sel = seleccion, c = ciudad) {
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
    const p = construirItinerario(sel, { dias, horasPorDia: horas, inicio });
    setPlan(p);
    setDiaVisible(0);
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

  // Compartir/copiar el plan completo (texto plano para WhatsApp/notas).
  async function compartirPlan() {
    if (!ciudad) return;
    let txt = `🗺️ ${t("miViajeA")} ${ciudad.nombre}, ${ciudad.pais} — Viajero 360\n`;
    let n = 0;
    plan.forEach((d) => {
      if (!d.paradas.length) return;
      n += 1;
      txt += `\n${t("dia")} ${n}\n`;
      d.paradas.forEach((p, i) => {
        txt += `  ${i + 1}. ${p.nombre} (${fmtMin(p.minutos)})\n`;
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

  return (
    <div className="min-h-screen pb-10">
      {/* Cabecera: HERO con foto de viaje en el inicio; barra fina en la ciudad */}
      <header className={`relative z-[1000] text-white ${(!ciudad && !cargando) ? "" : "sticky top-0 bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 shadow-marca"}`}>
        {!ciudad && !cargando && (
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

        <div className={`relative mx-auto max-w-7xl px-4 lg:px-8 ${(!ciudad && !cargando) ? "pt-5 pb-16 lg:pb-24" : "pt-4 pb-5"}`}>
          {/* Barra de navegación superior */}
          <div className="flex items-center justify-between gap-4">
            <button type="button" onClick={irAlInicio} aria-label="Viajero 360 — inicio" className="cursor-pointer text-left">
              <div className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight drop-shadow lg:text-2xl">
                🌍 Viajero 360
              </div>
              <div className="hidden text-[13px] text-white/85 sm:block">{t("tagline")}</div>
            </button>
            <div className="flex items-center gap-3 lg:gap-5">
              <span className="hidden text-sm text-white/90 md:inline">
                👋 {t("hola")}, <b>{usuario.nombre}</b>
              </span>
              {ciudad && (
                <button onClick={irAlInicio} className="text-[13px] text-white/90 underline-offset-2 hover:underline">
                  🏠 {t("inicio")}
                </button>
              )}
              <button onClick={salir} className="text-[13px] text-white/90 underline-offset-2 hover:underline">
                {t("salir")}
              </button>
              <SelectorIdioma />
            </div>
          </div>

          {!ciudad && !cargando ? (
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
                    🔎 <span className="hidden sm:inline">{t("buscar")}</span>
                  </button>
                </form>
                {mostrarSug && sugerencias.length > 0 && (
                  <div className="animar-subir absolute inset-x-0 top-full z-[1100] mt-1.5 overflow-hidden rounded-2xl bg-white text-left shadow-xl">
                    {sugerencias.map((s, i) => (
                      <div key={i} className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-4 py-3 text-slate-800 hover:bg-marca-50" onClick={() => elegirCiudad(s)}>
                        <span className="text-lg">📍</span>
                        <div><div className="text-[15px] font-semibold">{s.ciudad}</div><div className="text-xs text-slate-500">{s.pais}</div></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Barra fina (vista de ciudad) */
            <div className="relative mt-4 max-w-2xl">
              <form onSubmit={buscarTexto} className="flex gap-2">
                <input
                  value={consulta}
                  onChange={(e) => setConsulta(e.target.value)}
                  onFocus={() => sugerencias.length && setMostrarSug(true)}
                  placeholder={t("buscarPlaceholder")}
                  list="ciudades-pop"
                  className="flex-1 rounded-2xl border-0 px-5 py-3.5 text-base text-slate-800 shadow-md outline-none"
                />
                <button type="submit" aria-label={t("buscar")} className="rounded-2xl bg-white px-5 text-lg font-bold text-marca-600 shadow-md transition hover:bg-marca-50">
                  🔎
                </button>
              </form>
              {mostrarSug && sugerencias.length > 0 && (
                <div className="animar-subir absolute inset-x-0 top-full z-[1100] mt-1.5 overflow-hidden rounded-2xl bg-white shadow-xl">
                  {sugerencias.map((s, i) => (
                    <div key={i} className="flex cursor-pointer items-center gap-2.5 border-b border-slate-100 px-4 py-3 text-slate-800 hover:bg-marca-50" onClick={() => elegirCiudad(s)}>
                      <span className="text-lg">📍</span>
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
        <div className="mx-auto mt-3.5 max-w-7xl px-4 lg:px-8">
          <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-red-800 shadow-suave">
            <span className="text-2xl">😕</span>
            <p className="flex-1 text-sm">{error}</p>
            <button onClick={reintentar} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:brightness-110">
              🔄 {t("recalcular")}
            </button>
          </div>
        </div>
      )}

      {!ciudad && !cargando && (
        <div className="relative z-10 -mt-8 rounded-t-[32px] bg-[#f6f7fb] pt-2 lg:-mt-12">
        <div className="animar-subir mx-auto max-w-7xl px-4 pb-4 pt-7 lg:px-8">
          {/* Banner presupuesto */}
          <button
            onClick={() => setMostrarPresupuesto(true)}
            className="group animar-pop relative mt-6 flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-700 px-5 py-5 text-left text-white shadow-[0_10px_30px_-6px_rgba(5,150,105,.45)] ring-1 ring-white/15 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_-8px_rgba(5,150,105,.6)] lg:max-w-2xl lg:px-7 lg:py-6"
          >
            {/* Destellos decorativos para dar profundidad */}
            <span className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-white/15 blur-2xl" />
            <span className="pointer-events-none absolute -bottom-14 left-12 h-28 w-28 rounded-full bg-teal-200/20 blur-2xl" />

            {/* Badge con icono */}
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl shadow-inner ring-1 ring-white/25 backdrop-blur-sm transition-transform duration-300 group-hover:scale-105 lg:h-14 lg:w-14">
              💰
            </span>

            {/* Texto */}
            <div className="relative min-w-0 flex-1">
              <div className="mb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.2em] text-white/75">
                {t("presupEyebrow")}
              </div>
              <div className="text-[17px] font-extrabold leading-tight tracking-tight lg:text-[21px]">
                {t("presupBoton")}
              </div>
              <div className="mt-0.5 text-[13px] text-white/90">{t("presupSub")}</div>
            </div>

            {/* Flecha en pastilla */}
            <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg font-bold ring-1 ring-white/30 transition-all duration-300 group-hover:translate-x-0.5 group-hover:bg-white group-hover:text-emerald-700">
              →
            </span>
          </button>

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
              ["📅", t("benDiaTitulo")],
              ["📍", t("benGpsTitulo")],
              ["🍽️", t("benComerTitulo")],
              ["🚇", t("benLlegarTitulo")],
            ].map(([ic, tit]) => (
              <div key={tit} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-slate-100 bg-white px-3.5 py-2 shadow-suave">
                <span className="text-base">{ic}</span>
                <span className="text-[12.5px] font-semibold text-marca-900">{tit}</span>
              </div>
            ))}
          </div>

          {/* Vuelos baratos desde Colombia (detector de precios) */}
          <Ofertas
            t={t}
            lang={lang}
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
        <div className="mx-auto max-w-7xl lg:flex lg:gap-6 lg:px-8 lg:py-6">
          {/* Panel izquierdo: planeación */}
          <div className="order-2 px-4 py-5 lg:order-1 lg:flex-1 lg:min-w-0 lg:px-0 lg:py-0">
            <div className="mb-4 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-marca-900 lg:text-3xl">{ciudad.nombre}</h1>
                <div className="text-[13px] text-slate-500">{ciudad.pais}</div>
              </div>
              <div className="flex items-center gap-3">
                {plan.some((d) => d.paradas.length > 0) && (
                  <button
                    onClick={compartirPlan}
                    className="rounded-xl border-[1.5px] border-marca-100 bg-white px-3 py-2 text-[13px] font-bold text-marca-600 transition hover:bg-marca-50"
                  >
                    {copiado ? "✓ " + t("copiado") : "📤 " + t("compartir")}
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

            {/* Configuración del viaje (colapsable: deja el itinerario más arriba) */}
            <details open className="mb-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-suave">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-marca-900">
                <span>⚙️ {t("ajustarViaje")}</span>
                <span className="text-slate-400">▾</span>
              </summary>
              <div className="px-4 pb-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-slate-600">
                  📅 {t("dias")}
                  <select value={dias} onChange={(e) => setDias(+e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[15px]">
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[13px] font-semibold text-slate-600">
                  ⏰ {t("horasDia")}
                  <select value={horas} onChange={(e) => setHoras(+e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[15px]">
                    {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <option key={n} value={n}>{n}h</option>)}
                  </select>
                </label>
                <button onClick={() => reconstruir()}
                  className="ml-auto rounded-xl border-[1.5px] border-marca-100 bg-white px-4 py-2.5 text-sm font-bold text-marca-600 transition hover:bg-marca-50">
                  🔄 {t("recalcular")}
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Chip activo={momento === "diurno"} onClick={() => cambiarMomento("diurno")}>☀️ {t("diurno")}</Chip>
                <Chip activo={momento === "nocturno"} onClick={() => cambiarMomento("nocturno")}>🌙 {t("nocturno")}</Chip>
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
                  {c.icono} {t("cat_" + k)}
                </Chip>
              ))}
            </div>

            {cargandoLugares && (
              <div className="flex items-center gap-2 px-0.5 py-2.5 text-sm text-slate-500">
                <span className="spin" /> {t("cargandoLugares")}
              </div>
            )}

            {!cargandoLugares && lugaresBase.length === 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-5 text-center text-slate-500 shadow-suave">
                <div className="text-3xl">🔍</div>
                <p className="mx-auto mt-1.5 max-w-xs text-sm">{t("sinResultados")}</p>
                <button
                  onClick={() => cargarCategoria("imperdibles")}
                  className="mt-3 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-4 py-2 text-sm font-bold text-white shadow-marca transition hover:brightness-105"
                >
                  🔄 {t("recalcular")}
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
                dia={plan[diaVisible]}
                numeroDia={diaVisible + 1}
                alternativas={lugaresBase}
                gps={gps}
                ciudad={ciudad?.nombre}
                t={t}
                onCambiarParada={(idx) => cambiarParada(diaVisible, idx)}
                onQuitarParada={(idx) => quitarParada(diaVisible, idx)}
                onVerLugar={(p) => { setRutaTrazada(null); setDetalle(p); }}
              />
            )}

            {/* Lista completa de lugares encontrados (radio amplio ~100 km) */}
            {lugaresBase.length > 0 && (
              <div className="mt-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-suave">
                <button
                  onClick={() => setMostrarTodos((v) => !v)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-bold text-marca-900">
                    📍 {t("todosLugares")} ({lugaresBase.length})
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
                              {l.notable && <span className="text-[11px]">⭐</span>}
                              <span className="truncate">{l.nombre}</span>
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
                            {enPlan ? "✓" : "＋ " + t("agregar")}
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
              <span className="text-sm">
                📍 {t("activarGps")}
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
          onCerrar={() => setDetalle(null)}
          onTrazarRuta={(r) => { setRutaTrazada(r); setDetalle(null); }}
          onAgregar={plan[diaVisible] ? (l) => { agregarParada(l); setDetalle(null); } : undefined}
        />
      )}

      {/* Asesor de viajes (guía gratis + IA opcional, chat flotante) */}
      <Asesor
        t={t}
        usuario={usuario}
        onPlanear={(q) => { setConsulta(q); setTimeout(() => buscarTexto(), 0); }}
        onAbrirPresupuesto={() => setMostrarPresupuesto(true)}
      />

      <footer className="mx-auto max-w-7xl px-4 py-6 text-center text-xs text-slate-400 lg:px-8">
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
      </footer>
    </div>
  );
}
