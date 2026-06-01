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

const Mapa = dynamic(() => import("@/components/Mapa"), { ssr: false });

export default function Home() {
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

  // GPS
  const [gpsOn, setGpsOn] = useState(false);
  const { pos: gps } = useGeo(gpsOn);

  const debounce = useRef(null);

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
      const cupo = Math.max(dias * 4, 6);
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
    const p = construirItinerario(sel, {
      dias,
      horasPorDia: horas,
      inicio: gps || [c.lat, c.lon],
    });
    setPlan(p);
    setDiaVisible(0);
  }

  function cambiarParada(diaIdx, paradaIdx) {
    const usados = new Set();
    plan.forEach((d) => d.paradas.forEach((p) => usados.add(p.id)));
    const alt = lugaresBase.find((l) => !usados.has(l.id));
    if (!alt) return;
    const quitar = plan[diaIdx].paradas[paradaIdx];
    const nuevaSel = seleccion.map((s) => (s.id === quitar.id ? alt : s));
    setSeleccion(nuevaSel);
    reconstruir(nuevaSel);
  }

  function quitarParada(diaIdx, paradaIdx) {
    const quitar = plan[diaIdx].paradas[paradaIdx];
    const nuevaSel = seleccion.filter((s) => s.id !== quitar.id);
    setSeleccion(nuevaSel);
    reconstruir(nuevaSel);
  }

  function cambiarMomento(mom) {
    setMomento(mom);
    cargarCategoria("imperdibles", ciudad, mom);
  }

  const lugaresDelDia = plan[diaVisible]?.paradas || [];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 40 }}>
      {/* Cabecera */}
      <header style={cab}>
        <div style={{ fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          🌍 Viajero 360
        </div>
        <div style={{ fontSize: 13, opacity: 0.92 }}>
          Tu itinerario perfecto en cualquier ciudad del mundo
        </div>

        {/* Buscador con autocompletado */}
        <div style={{ position: "relative", marginTop: 12 }}>
          <form onSubmit={buscarTexto} style={{ display: "flex", gap: 8 }}>
            <input
              value={consulta}
              onChange={(e) => setConsulta(e.target.value)}
              onFocus={() => sugerencias.length && setMostrarSug(true)}
              placeholder="Ciudad, País (ej. Madrid, España)"
              style={input}
            />
            <button type="submit" style={btnBuscar}>🔎</button>
          </form>

          {mostrarSug && sugerencias.length > 0 && (
            <div style={lista} className="animar-subir">
              {sugerencias.map((s, i) => (
                <div key={i} style={item} onClick={() => elegirCiudad(s)}>
                  <span style={{ fontSize: 18 }}>📍</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{s.ciudad}</div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{s.pais}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </header>

      {error && (
        <div style={{ margin: 14, background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 10, fontSize: 14 }}>
          {error}
        </div>
      )}

      {!ciudad && !cargando && (
        <div style={{ padding: 28, textAlign: "center", color: "#64748b" }} className="animar-subir">
          <div style={{ fontSize: 56 }}>🗺️</div>
          <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.5 }}>
            Escribe una ciudad y te armo un itinerario día a día con los mejores
            lugares, fotos, restaurantes y cómo moverte entre ellos —{" "}
            <b>todo aquí, sin salir de la app</b>.
          </p>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginTop: 14 }}>
            {["Madrid, España", "Tokio, Japón", "Cusco, Perú", "Roma, Italia"].map((c) => (
              <Chip key={c} onClick={() => { setConsulta(c); setTimeout(() => buscarTexto(), 0); }}>
                {c}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {cargando && (
        <div style={{ padding: 28, textAlign: "center", color: "#64748b" }}>
          <span className="spin" /> <span style={{ marginLeft: 8 }}>Cargando…</span>
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
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--azul-osc)" }}>
              {ciudad.nombre}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>{ciudad.pais}</div>

            {/* Configuración del viaje */}
            <Tarjeta style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <label style={lbl}>
                  📅 Días
                  <select value={dias} onChange={(e) => setDias(+e.target.value)} style={sel}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label style={lbl}>
                  ⏰ Horas/día
                  <select value={horas} onChange={(e) => setHoras(+e.target.value)} style={sel}>
                    {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => <option key={n} value={n}>{n}h</option>)}
                  </select>
                </label>
                <Boton onClick={() => reconstruir()} variante="sec" style={{ marginLeft: "auto" }}>
                  🔄 Recalcular
                </Boton>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                <Chip activo={momento === "diurno"} onClick={() => cambiarMomento("diurno")}>☀️ Diurno</Chip>
                <Chip activo={momento === "nocturno"} onClick={() => cambiarMomento("nocturno")}>🌙 Nocturno</Chip>
                <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>
                  {momento === "nocturno" ? "Bares, miradores y vida nocturna" : "Monumentos, museos y paseos"}
                </span>
              </div>
            </Tarjeta>

            {/* Categorías */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
              {Object.entries(CATEGORIAS).map(([k, c]) => (
                <Chip key={k} activo={categoria === k} onClick={() => cargarCategoria(k)}>
                  {c.icono} {c.nombre}
                </Chip>
              ))}
            </div>

            {/* Indicador sutil de carga de lugares (no bloquea la pantalla) */}
            {cargandoLugares && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 2px", color: "#64748b", fontSize: 14 }}>
                <span className="spin" /> Buscando los mejores lugares…
              </div>
            )}

            {/* Sin resultados en esta categoría (mensaje claro, no pantalla vacía) */}
            {!cargandoLugares && lugaresBase.length === 0 && (
              <Tarjeta style={{ textAlign: "center", color: "#64748b" }}>
                <div style={{ fontSize: 30 }}>🔍</div>
                <p style={{ fontSize: 14, marginTop: 6 }}>
                  No encontramos lugares de esta categoría cerca del centro.
                  Prueba otra categoría o toca <b>Recalcular</b>.
                </p>
              </Tarjeta>
            )}

            {/* Pestañas de días */}
            {plan.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
                {plan.map((d, i) => (
                  <Chip key={i} activo={diaVisible === i} onClick={() => setDiaVisible(i)}>Día {i + 1}</Chip>
                ))}
              </div>
            )}

            {plan[diaVisible] && (
              <Itinerario
                dia={plan[diaVisible]}
                numeroDia={diaVisible + 1}
                alternativas={lugaresBase}
                gps={gps}
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
                  📍 Activar GPS para verme en el mapa y calcular tiempos en vivo
                  {gpsOn && gps && <span style={{ color: "var(--verde)", fontWeight: 600 }}> · activo</span>}
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
          onCerrar={() => setDetalle(null)}
          onTrazarRuta={(r) => { setRutaTrazada(r); setDetalle(null); }}
        />
      )}

      <footer style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, padding: 20 }}>
        Datos de OpenStreetMap y Wikipedia · Viajero 360
      </footer>
    </div>
  );
}

const cab = {
  background: "linear-gradient(135deg,#2563eb,#1e3a8a)",
  color: "#fff",
  padding: "18px 18px 16px",
  position: "sticky",
  top: 0,
  zIndex: 1000,
  boxShadow: "0 2px 12px rgba(0,0,0,.2)",
};
const input = { flex: 1, padding: "12px 14px", borderRadius: 10, border: "none", fontSize: 16, outline: "none" };
const btnBuscar = { background: "#fff", color: "var(--azul)", border: "none", padding: "0 16px", borderRadius: 10, fontWeight: 700, fontSize: 18 };
const lista = { position: "absolute", top: "100%", left: 0, right: 0, marginTop: 6, background: "#fff", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,.18)", overflow: "hidden", zIndex: 1100 };
const item = { display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer", color: "var(--texto)", borderBottom: "1px solid var(--borde)" };
const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#475569", fontWeight: 600 };
const sel = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 15, background: "#fff" };
