"use client";
import { useMemo, useState } from "react";
import { Boton, Tarjeta } from "./ui";
import { fmtMin, resumenDia } from "@/lib/itinerario";
import { estadoTiempo, textoEstado } from "@/lib/reloj";

// Muestra el itinerario de UN día: paradas, traslados, transporte, tiempos,
// y el seguimiento por GPS (si está activo).
export default function Itinerario({
  dia,
  numeroDia,
  alternativas,
  onCambiarParada,
  onQuitarParada,
  onVerLugar,
  gps,
}) {
  const r = resumenDia(dia);
  const [seguimiento, setSeguimiento] = useState(false);
  const [inicioMs, setInicioMs] = useState(null);
  const [paradaActual, setParadaActual] = useState(0);

  const estado = useMemo(() => {
    if (!seguimiento || inicioMs == null) return null;
    return estadoTiempo(dia, paradaActual, inicioMs, Date.now());
  }, [seguimiento, inicioMs, paradaActual, dia, gps]);

  function iniciar() {
    setInicioMs(Date.now());
    setParadaActual(0);
    setSeguimiento(true);
  }

  return (
    <div>
      {/* Resumen del día */}
      <Tarjeta style={{ marginBottom: 12, background: "#eff6ff", borderColor: "#bfdbfe" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "var(--azul-osc)" }}>
              Día {numeroDia}
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              {r.paradas} paradas · {r.totalTexto} en total
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#475569" }}>
            <div>👣 Visitas: {r.visitaTexto}</div>
            <div>🚇 Traslados: {r.trasladoTexto}</div>
          </div>
        </div>

        {/* Botón de seguimiento por GPS */}
        {dia.paradas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {!seguimiento ? (
              <Boton variante="verde" onClick={iniciar} style={{ width: "100%" }}>
                ▶️ Empezar día con seguimiento GPS
              </Boton>
            ) : (
              <PanelTiempo
                estado={estado}
                gps={gps}
                paradaActual={paradaActual}
                total={dia.paradas.length}
                onSiguiente={() => setParadaActual((x) => Math.min(x + 1, dia.paradas.length - 1))}
                onParar={() => setSeguimiento(false)}
              />
            )}
          </div>
        )}
      </Tarjeta>

      {dia.paradas.length === 0 && (
        <Tarjeta>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            No hay paradas para este día con el tiempo configurado. Sube las horas
            por día o reduce el número de días.
          </p>
        </Tarjeta>
      )}

      {/* Lista de paradas */}
      {dia.paradas.map((p, i) => (
        <div key={p.id || i}>
          {i > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 0 8px 14px", fontSize: 13, color: "#475569" }}>
              <span style={{ fontSize: 16 }}>{p.transporte.icono}</span>
              <span>
                {p.transporte.texto} · {fmtMin(p.traslado)} ·{" "}
                {p.metros < 1000 ? `${p.metros} m` : `${(p.metros / 1000).toFixed(1)} km`}
              </span>
            </div>
          )}

          <Tarjeta
            style={{
              marginBottom: 4,
              borderColor: seguimiento && i === paradaActual ? "var(--verde)" : "var(--borde)",
              borderWidth: seguimiento && i === paradaActual ? 2 : 1,
            }}
          >
            <div style={{ display: "flex", gap: 10 }}>
              <div
                onClick={() => onVerLugar?.(p)}
                style={{
                  background: "var(--azul)",
                  color: "#fff",
                  minWidth: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 14,
                  flexShrink: 0,
                  cursor: "pointer",
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  onClick={() => onVerLugar?.(p)}
                  style={{ fontWeight: 700, fontSize: 16, cursor: "pointer" }}
                >
                  {p.nombre}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {p.categoria}
                  {p.cocina ? ` · ${p.cocina}` : ""} · ⏱️ {fmtMin(p.minutos)}
                  {p.notable ? " · ⭐ destacado" : ""}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button style={{ ...mini, background: "#eff6ff", color: "var(--azul)" }}
                    onClick={() => onVerLugar?.(p)}>📷 Ver foto y cómo llegar</button>
                  {alternativas?.length > 0 && (
                    <button style={mini} onClick={() => onCambiarParada(i)}>🔄 Cambiar</button>
                  )}
                  <button style={{ ...mini, color: "#dc2626" }} onClick={() => onQuitarParada(i)}>
                    ✕ Quitar
                  </button>
                </div>
              </div>
            </div>
          </Tarjeta>
        </div>
      ))}
    </div>
  );
}

const mini = {
  fontSize: 13,
  padding: "8px 12px",
  borderRadius: 8,
  background: "var(--gris)",
  color: "var(--azul-osc)",
  fontWeight: 600,
  border: "none",
};

function PanelTiempo({ estado, paradaActual, total, onSiguiente, onParar }) {
  const t = estado ? textoEstado(estado) : null;
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 12, border: "1px solid var(--borde)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, color: t?.color }}>
          {t?.emoji} {t?.texto}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Parada {paradaActual + 1}/{total}
        </div>
      </div>
      {estado && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          Planeado: {fmtMin(estado.planeado)} · Real: {fmtMin(estado.transcurrido)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Boton onClick={onSiguiente} style={{ flex: 1 }}>
          ✓ Llegué a la siguiente
        </Boton>
        <Boton variante="sec" onClick={onParar} style={{ flex: 1 }}>
          ⏹️ Terminar
        </Boton>
      </div>
    </div>
  );
}
