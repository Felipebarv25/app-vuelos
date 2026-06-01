"use client";
import dynamic from "next/dynamic";
import { useState } from "react";
import { geocodificar, traerLugares, CATEGORIAS } from "@/lib/osm";
import { construirItinerario } from "@/lib/itinerario";
import { useGeo } from "@/lib/useGeo";
import { Chip, Boton, Tarjeta } from "@/components/ui";
import Itinerario from "@/components/Itinerario";

const Mapa = dynamic(() => import("@/components/Mapa"), { ssr: false });

export default function Home() {
  const [consulta, setConsulta] = useState("");
  const [ciudad, setCiudad] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // Configuración del viaje
  const [dias, setDias] = useState(3);
  const [horas, setHoras] = useState(8);
  const [momento, setMomento] = useState("diurno"); // diurno | nocturno
  const [categoria, setCategoria] = useState("imperdibles");

  // Datos
  const [lugaresBase, setLugaresBase] = useState([]); // todos los traídos
  const [seleccion, setSeleccion] = useState([]); // los que entran al plan
  const [plan, setPlan] = useState([]);
  const [diaVisible, setDiaVisible] = useState(0);

  // GPS
  const [gpsOn, setGpsOn] = useState(false);
  const { pos: gps } = useGeo(gpsOn);

  async function buscar(e) {
    e?.preventDefault();
    const q = consulta.trim();
    if (!q) return;
    setCargando(true);
    setError(null);
    try {
      const c = await geocodificar(q);
      setCiudad(c);
      await cargarCategoria("imperdibles", c);
    } catch (err) {
      setError(err.message);
      setCiudad(null);
    } finally {
      setCargando(false);
    }
  }

  async function cargarCategoria(cat, c = ciudad) {
    if (!c) return;
    setCargando(true);
    setError(null);
    setCategoria(cat);
    // En modo nocturno, priorizar bares para "imperdibles"
    const catReal =
      momento === "nocturno" && cat === "imperdibles" ? "bares" : cat;
    try {
      const lugares = await traerLugares(catReal, c.lat, c.lon);
      setLugaresBase(lugares);
      // Selección por defecto: para construir el itinerario tomamos
      // los primeros (más notables) según cuántos quepan (dias*~4).
      const cupo = Math.max(dias * 4, 6);
      const sel = lugares.slice(0, cupo);
      setSeleccion(sel);
      reconstruir(sel, c);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
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

  // Cambiar una parada por una alternativa no usada
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

  const lugaresDelDia = plan[diaVisible]?.paradas || [];

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 40 }}>
      {/* Cabecera */}
      <header
        style={{
          background: "linear-gradient(135deg,#2563eb,#1e3a8a)",
          color: "#fff",
          padding: "18px 18px 16px",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          boxShadow: "0 2px 12px rgba(0,0,0,.2)",
        }}
      >
        <div style={{ fontSize: 21, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
          🌍 Viajero 360
        </div>
        <div style={{ fontSize: 13, opacity: 0.9 }}>
          Tu itinerario perfecto en cualquier ciudad del mundo
        </div>
        <form onSubmit={buscar} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <input
            value={consulta}
            onChange={(e) => setConsulta(e.target.value)}
            placeholder="¿A qué ciudad viajas? (ej. Madrid, Tokio, Cusco…)"
            style={{
              flex: 1,
              padding: "12px 14px",
              borderRadius: 10,
              border: "none",
              fontSize: 16,
              outline: "none",
            }}
          />
          <button
            type="submit"
            style={{
              background: "#fff",
              color: "var(--azul)",
              border: "none",
              padding: "0 18px",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            Buscar
          </button>
        </form>
      </header>

      {error && (
        <div style={{ margin: 14, background: "#fee2e2", color: "#991b1b", padding: 14, borderRadius: 10, fontSize: 14 }}>
          {error}
        </div>
      )}

      {!ciudad && !cargando && (
        <div style={{ padding: 28, textAlign: "center", color: "#64748b" }}>
          <div style={{ fontSize: 54 }}>🗺️</div>
          <p style={{ marginTop: 8, fontSize: 15 }}>
            Escribe una ciudad y te armo un itinerario día a día con los mejores
            lugares, restaurantes y cómo moverte entre ellos.
          </p>
        </div>
      )}

      {cargando && (
        <div style={{ padding: 28, textAlign: "center", color: "#64748b" }}>
          <span className="spin" /> <span style={{ marginLeft: 8 }}>Cargando…</span>
        </div>
      )}

      {ciudad && (
        <>
          {/* Mapa */}
          <div style={{ height: "40vh", minHeight: 260 }}>
            <Mapa
              centro={[ciudad.lat, ciudad.lon]}
              lugares={lugaresDelDia}
              ubicacionUsuario={gps}
            />
          </div>

          <div style={{ padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--azul-osc)" }}>
              {ciudad.nombre}
            </div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
              {ciudad.pais}
            </div>

            {/* Configuración del viaje */}
            <Tarjeta style={{ marginBottom: 14 }}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                <label style={lbl}>
                  📅 Días
                  <select value={dias} onChange={(e) => setDias(+e.target.value)} style={sel}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <label style={lbl}>
                  ⏰ Horas/día
                  <select value={horas} onChange={(e) => setHoras(+e.target.value)} style={sel}>
                    {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => (
                      <option key={n} value={n}>{n}h</option>
                    ))}
                  </select>
                </label>
                <Boton onClick={() => reconstruir()} variante="sec" style={{ marginLeft: "auto" }}>
                  🔄 Recalcular
                </Boton>
              </div>

              {/* Día / Noche */}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Chip activo={momento === "diurno"} onClick={() => { setMomento("diurno"); }}>
                  ☀️ Diurno
                </Chip>
                <Chip activo={momento === "nocturno"} onClick={() => { setMomento("nocturno"); }}>
                  🌙 Nocturno
                </Chip>
                <span style={{ fontSize: 12, color: "#64748b", alignSelf: "center" }}>
                  {momento === "nocturno" ? "Bares, miradores y vida nocturna" : "Monumentos, museos y paseos"}
                </span>
              </div>
            </Tarjeta>

            {/* Categorías de lugares */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, marginBottom: 8 }}>
              {Object.entries(CATEGORIAS).map(([k, c]) => (
                <Chip key={k} activo={categoria === k} onClick={() => cargarCategoria(k)}>
                  {c.icono} {c.nombre}
                </Chip>
              ))}
            </div>

            {/* Pestañas de días */}
            {plan.length > 0 && (
              <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
                {plan.map((d, i) => (
                  <Chip key={i} activo={diaVisible === i} onClick={() => setDiaVisible(i)}>
                    Día {i + 1}
                  </Chip>
                ))}
              </div>
            )}

            {/* Itinerario del día visible */}
            {plan[diaVisible] && (
              <Itinerario
                dia={plan[diaVisible]}
                numeroDia={diaVisible + 1}
                alternativas={lugaresBase}
                gps={gps}
                onCambiarParada={(idx) => cambiarParada(diaVisible, idx)}
                onQuitarParada={(idx) => quitarParada(diaVisible, idx)}
              />
            )}

            {/* GPS toggle */}
            <Tarjeta style={{ marginTop: 14, background: gpsOn ? "#dcfce7" : "#fff" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={gpsOn} onChange={(e) => setGpsOn(e.target.checked)} />
                <span style={{ fontSize: 14 }}>
                  📍 Activar GPS para verme en el mapa y calcular tiempos en vivo
                  {gpsOn && gps && <span style={{ color: "var(--verde)", fontWeight: 600 }}> · ubicación activa</span>}
                </span>
              </label>
            </Tarjeta>
          </div>
        </>
      )}

      <footer style={{ textAlign: "center", color: "#94a3b8", fontSize: 12, padding: 20 }}>
        Datos de OpenStreetMap · Rutas vía Google Maps · Viajero 360
      </footer>
    </div>
  );
}

const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#475569", fontWeight: 600 };
const sel = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--borde)", fontSize: 15, background: "#fff" };
