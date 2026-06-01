"use client";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { geocodificar, traerLugares, CATEGORIAS } from "@/lib/osm";
import { construirItinerario } from "@/lib/itinerario";
import { sugerirCiudades } from "@/lib/autocompletar";
import { useGeo } from "@/lib/useGeo";
import { Chip, Boton, Tarjeta } from "@/components/ui";
import Itinerario from "@/components/Itinerario";
import DetalleLugar from "@/components/DetalleLugar";
import Bienvenida from "@/components/Bienvenida";
import SelectorIdioma from "@/components/SelectorIdioma";
import Presupuesto from "@/components/Presupuesto";
import CardDestino from "@/components/CardDestino";
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
];

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
  const { t, usuario, salir, listo } = useApp();
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
    const alt = lugaresBase.find((l) => !usados.has(l.id));
    if (!alt) return;

    const vieja = plan[diaIdx].paradas[paradaIdx];
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

  const lugaresDelDia = plan[diaVisible]?.paradas || [];

  // Mientras carga el estado guardado, no parpadear.
  if (!listo) return null;
  // Primera vez: pantalla de bienvenida (idioma + nombre).
  if (!usuario) return <Bienvenida />;

  return (
    <div className="max-w-3xl mx-auto pb-12">
      {/* Cabecera */}
      <header className="sticky top-0 z-[1000] bg-gradient-to-br from-marca-500 via-marca-600 to-marca-900 text-white px-5 pt-5 pb-6 rounded-b-[28px] shadow-marca">
        <div className="flex justify-between items-start">
          <div onClick={irAlInicio} className="cursor-pointer">
            <div className="text-[22px] font-extrabold flex items-center gap-2 tracking-tight">
              🌍 Viajero 360
            </div>
            <div className="text-[13px] text-white/85">{t("tagline")}</div>
          </div>
          <SelectorIdioma />
        </div>

        {/* Saludo + acciones */}
        <div className="text-xs text-white/90 mt-2 flex gap-3 items-center">
          <span>👋 {t("hola")}, <b>{usuario.nombre}</b></span>
          {ciudad && (
            <button onClick={irAlInicio} className="text-marca-200 underline">🏠 {t("inicio")}</button>
          )}
          <button onClick={salir} className="text-marca-200 underline">{t("salir")}</button>
        </div>

        {/* Buscador */}
        <div className="relative mt-3">
          <form onSubmit={buscarTexto} className="flex gap-2">
            <input
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onFocus={() => sugerencias.length && setMostrarSug(true)}
              placeholder={t("buscarPlaceholder")}
              className="flex-1 px-4 py-3.5 rounded-2xl border-0 text-base outline-none shadow-md text-slate-800"
            />
            <button type="submit" className="bg-white text-marca-600 px-4 rounded-2xl font-bold text-lg shadow-md">🔎</button>
          </form>

          {mostrarSug && sugerencias.length > 0 && (
            <div className="absolute top-full inset-x-0 mt-1.5 bg-white rounded-2xl shadow-xl overflow-hidden z-[1100] animar-subir">
              {sugerencias.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5 px-4 py-3 cursor-pointer text-slate-800 border-b border-slate-100 hover:bg-marca-50"
                  onClick={() => elegirCiudad(s)}>
                  <span className="text-lg">📍</span>
                  <div>
                    <div className="font-semibold text-[15px]">{s.ciudad}</div>
                    <div className="text-xs text-slate-500">{s.pais}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {error && (
        <div className="m-3.5 bg-red-100 text-red-800 p-3.5 rounded-xl text-sm">{error}</div>
      )}

      {!ciudad && !cargando && (
        <div className="px-4 pt-5 pb-2 animar-subir">
          {/* Saludo */}
          <h1 className="text-[23px] font-extrabold text-marca-900 tracking-tight">
            {t(saludoClave())}, {usuario.nombre} {saludoEmoji()}
          </h1>
          <p className="text-[14.5px] text-slate-500 mt-1 leading-relaxed">{t("heroTexto")}</p>

          {/* Banner presupuesto */}
          <button onClick={() => setMostrarPresupuesto(true)}
            className="w-full mt-5 px-5 py-4 rounded-2xl border-0 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 text-white flex items-center justify-between cursor-pointer shadow-[0_8px_22px_rgba(5,150,105,.35)] animar-pop hover:brightness-105 transition">
            <div className="text-left">
              <div className="text-xs font-semibold opacity-90">💰 NUEVO</div>
              <div className="text-[17px] font-extrabold mt-0.5">{t("presupBoton")}</div>
            </div>
            <span className="text-2xl">→</span>
          </button>

          {/* Destinos con foto */}
          <h2 className="text-[17px] font-extrabold text-marca-900 mt-6 mb-3 px-0.5 tracking-tight">
            ✨ {t("pruebaPopular")}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {DESTINOS_DESTACADOS.map((d) => (
              <CardDestino key={d.q} nombre={d.nombre} pais={d.pais} hint={d.hint}
                onClick={() => { setConsulta(d.q); setTimeout(() => buscarTexto(), 0); }} />
            ))}
          </div>

          {/* Beneficios */}
          <div className="flex gap-2.5 overflow-x-auto mt-6 pb-1">
            {[
              ["📅", t("benDiaTitulo")],
              ["📍", t("benGpsTitulo")],
              ["🍽️", t("benComerTitulo")],
              ["🚇", t("benLlegarTitulo")],
            ].map(([ic, tit]) => (
              <div key={tit} className="flex items-center gap-1.5 bg-white border border-slate-100 rounded-full px-3.5 py-2 whitespace-nowrap shrink-0 shadow-suave">
                <span className="text-base">{ic}</span>
                <span className="text-[12.5px] font-semibold text-marca-900">{tit}</span>
              </div>
            ))}
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
        <div style={{ padding: 28, textAlign: "center", color: "#64748b" }}>
          <span className="spin" /> <span style={{ marginLeft: 8 }}>{t("cargando")}</span>
        </div>
      )}

      {ciudad && (
        <>
          <div style={{ height: "40vh", minHeight: 260 }}>
            <Mapa
              centro={[ciudad.lat, ciudad.lon]}
              lugares={lugaresDelDia}
              ubicacionUsuario={gps}
              rutaTrazada={rutaTrazada}
              onClicLugar={(l) => { setRutaTrazada(null); setDetalle(l); }}
            />
          </div>

          <div style={{ padding: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 14 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "var(--azul-osc)" }}>
                  {ciudad.nombre}
                </div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{ciudad.pais}</div>
              </div>
              {lugaresBase.length > 0 && (
                <div style={{ textAlign: "right", fontSize: 12, color: "#64748b" }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "var(--verde)" }}>
                    {lugaresBase.length}
                  </div>
                  {t("lugares")}
                </div>
              )}
            </div>

            {/* Configuración del viaje */}
            <Tarjeta style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <label style={lbl}>
                  📅 {t("dias")}
                  <select value={dias} onChange={(e) => setDias(+e.target.value)} style={sel}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label style={lbl}>
                  ⏰ {t("horasDia")}
                  <select value={horas} onChange={(e) => setHoras(+e.target.value)} style={sel}>
                    {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <option key={n} value={n}>{n}h</option>)}
                  </select>
                </label>
                <Boton onClick={() => reconstruir()} variante="sec" style={{ marginLeft: "auto" }}>
                  🔄 {t("recalcular")}
                </Boton>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <Chip activo={momento === "diurno"} onClick={() => cambiarMomento("diurno")}>☀️ {t("diurno")}</Chip>
                <Chip activo={momento === "nocturno"} onClick={() => cambiarMomento("nocturno")}>🌙 {t("nocturno")}</Chip>
                <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>
                  {momento === "nocturno" ? t("nocturnoDesc") : t("diurnoDesc")}
                </span>
              </div>
            </Tarjeta>

            {/* Categorías */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
              {Object.entries(CATEGORIAS).map(([k, c]) => (
                <Chip key={k} activo={categoria === k} onClick={() => cargarCategoria(k)}>
                  {c.icono} {t("cat_" + k)}
                </Chip>
              ))}
            </div>

            {/* Indicador sutil de carga de lugares (no bloquea la pantalla) */}
            {cargandoLugares && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 2px", color: "#64748b", fontSize: 14 }}>
                <span className="spin" /> {t("cargandoLugares")}
              </div>
            )}

            {/* Sin resultados en esta categoría (mensaje claro, no pantalla vacía) */}
            {!cargandoLugares && lugaresBase.length === 0 && (
              <Tarjeta style={{ textAlign: "center", color: "#64748b" }}>
                <div style={{ fontSize: 30 }}>🔍</div>
                <p style={{ fontSize: 14, marginTop: 6 }}>{t("sinResultados")}</p>
              </Tarjeta>
            )}

            {/* Pestañas de días (solo los que tienen paradas, sin días vacíos) */}
            {plan.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
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
                t={t}
                onCambiarParada={(idx) => cambiarParada(diaVisible, idx)}
                onQuitarParada={(idx) => quitarParada(diaVisible, idx)}
                onVerLugar={(p) => { setRutaTrazada(null); setDetalle(p); }}
              />
            )}

            {/* GPS toggle */}
            <Tarjeta style={{ marginTop: 14, background: gpsOn ? "#dcfce7" : "#fff" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={gpsOn} onChange={(e) => setGpsOn(e.target.checked)} />
                <span style={{ fontSize: 14 }}>
                  📍 {t("activarGps")}
                  {gpsOn && gps && <span style={{ color: "var(--verde)", fontWeight: 600 }}> · {t("activo")}</span>}
                </span>
              </label>
            </Tarjeta>
          </div>
        </>
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
        />
      )}

      <footer style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, padding: 20 }}>
        {t("footer")} · Viajero 360
      </footer>
    </div>
  );
}

const cab = {
  background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 55%,#312e81 100%)",
  color: "#fff",
  padding: "20px 18px 22px",
  position: "sticky",
  top: 0,
  zIndex: 1000,
  borderRadius: "0 0 26px 26px",
  boxShadow: "0 8px 28px rgba(79,70,229,.4)",
};
const btnLink = { background: "none", border: "none", color: "#c7d2fe", textDecoration: "underline", fontSize: 12, padding: 0, cursor: "pointer" };
const bannerPresup = {
  width: "100%",
  marginTop: 18,
  padding: "16px 18px",
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(120deg,#10b981 0%,#059669 60%,#047857 100%)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  boxShadow: "0 8px 22px rgba(5,150,105,.35)",
  position: "relative",
  overflow: "hidden",
};
const benChip = {
  display: "flex",
  alignItems: "center",
  gap: 7,
  background: "#fff",
  border: "1px solid var(--borde)",
  borderRadius: 999,
  padding: "8px 14px",
  whiteSpace: "nowrap",
  flexShrink: 0,
  boxShadow: "var(--sombra)",
};
const input = { flex: 1, padding: "13px 16px", borderRadius: 12, border: "none", fontSize: 16, outline: "none", boxShadow: "0 2px 8px rgba(0,0,0,.12)" };
const btnBuscar = { background: "#fff", color: "var(--azul)", border: "none", padding: "0 16px", borderRadius: 12, fontWeight: 700, fontSize: 18, boxShadow: "0 2px 8px rgba(0,0,0,.12)" };
const lista = { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: "#fff", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.18)", overflow: "hidden", zIndex: 1100 };
const item = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", color: "var(--texto)", borderBottom: "1px solid var(--borde)" };
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#475569", fontWeight: 600 };
const sel = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 15, background: "#fff" };
const btnPresup = {
  display: "block",
  width: "100%",
  maxWidth: 460,
  margin: "20px auto 0",
  padding: "15px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg,#16a34a,#15803d)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
  boxShadow: "0 6px 18px rgba(22,163,74,.35)",
};
