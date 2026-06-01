"use client";
import { useMemo, useState } from "react";
import { Boton, Tarjeta } from "./ui";
import { fmtMin, resumenDia } from "@/lib/itinerario";
import { estadoTiempo, textoEstado } from "@/lib/reloj";

// Emoji según el tipo de lugar (para identificar de un vistazo en la lista).
function emojiCat(cat = "") {
  const c = cat.toLowerCase();
  if (c.includes("muse") || c.includes("galer")) return "🖼️";
  if (c.includes("restaur")) return "🍽️";
  if (c.includes("caf")) return "☕";
  if (c.includes("bar") || c.includes("pub") || c.includes("disco")) return "🍸";
  if (c.includes("mirad") || c.includes("viewpoint")) return "🌅";
  if (c.includes("castil") || c.includes("castle") || c.includes("fort")) return "🏰";
  if (c.includes("monu") || c.includes("memor")) return "🗿";
  if (c.includes("igle") || c.includes("church") || c.includes("templ") || c.includes("mosq")) return "⛪";
  if (c.includes("parq") || c.includes("park")) return "🌳";
  return "📍";
}

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
  t = (k) => k,
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
      <Tarjeta style={{ marginBottom: 12, background: "linear-gradient(135deg,#eef2ff,#faf5ff)", border: "1px solid #e0e7ff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 19, color: "var(--azul-osc)", letterSpacing: "-0.02em" }}>
              {t("dia")} {numeroDia}
            </div>
            <div style={{ fontSize: 13, color: "var(--texto-sec)", marginTop: 2 }}>
              {r.paradas} {t("paradas")} · {r.totalTexto} {t("enTotal")}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={statBox}><div style={statNum}>{r.visitaTexto}</div><div style={statLbl}>👣 {t("visitas")}</div></div>
            <div style={statBox}><div style={statNum}>{r.trasladoTexto}</div><div style={statLbl}>🚇 {t("traslados")}</div></div>
          </div>
        </div>

        {/* Botón de seguimiento por GPS */}
        {dia.paradas.length > 0 && (
          <div style={{ marginTop: 12 }}>
            {!seguimiento ? (
              <Boton variante="verde" onClick={iniciar} style={{ width: "100%" }}>
                ▶️ {t("empezarGps")}
              </Boton>
            ) : (
              <PanelTiempo
                estado={estado}
                gps={gps}
                t={t}
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
          <p style={{ color: "#64748b", fontSize: 14 }}>{t("sinParadas")}</p>
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
              padding: 16,
              boxShadow: seguimiento && i === paradaActual
                ? "0 0 0 2px var(--verde), var(--sombra)"
                : "var(--sombra)",
            }}
          >
            <div style={{ display: "flex", gap: 13 }}>
              <div
                onClick={() => onVerLugar?.(p)}
                style={{
                  background: "linear-gradient(135deg,#6366f1,#4f46e5)",
                  color: "#fff",
                  minWidth: 34,
                  height: 34,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  flexShrink: 0,
                  cursor: "pointer",
                  boxShadow: "0 4px 10px rgba(79,70,229,.35)",
                }}
              >
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  onClick={() => onVerLugar?.(p)}
                  style={{ fontWeight: 700, fontSize: 16.5, cursor: "pointer", letterSpacing: "-0.01em" }}
                >
                  {p.nombre}
                </div>
                <div style={{ fontSize: 12.5, color: "var(--texto-sec)", marginTop: 3, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                  <span>{emojiCat(p.categoria)} {p.categoria}</span>
                  {p.cocina && <span>· {p.cocina}</span>}
                  <span style={pill}>⏱️ {fmtMin(p.minutos)}</span>
                  {p.notable && <span style={{ ...pill, background: "#fef3c7", color: "#92400e" }}>⭐ Top</span>}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                  <button style={{ ...mini, background: "#eef2ff", color: "var(--azul)" }}
                    onClick={() => onVerLugar?.(p)}>📷 {t("verFoto")}</button>
                  {alternativas?.length > 0 && (
                    <button style={mini} onClick={() => onCambiarParada(i)}>🔄 {t("cambiar")}</button>
                  )}
                  <button style={{ ...mini, background: "#fef2f2", color: "#dc2626" }} onClick={() => onQuitarParada(i)}>
                    ✕ {t("quitar")}
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
  padding: "9px 13px",
  borderRadius: 10,
  background: "var(--gris)",
  color: "var(--azul-osc)",
  fontWeight: 600,
  border: "none",
  cursor: "pointer",
};
const pill = {
  fontSize: 11.5,
  padding: "2px 8px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "var(--texto-sec)",
  fontWeight: 600,
};
const statBox = {
  background: "rgba(255,255,255,.7)",
  borderRadius: 12,
  padding: "8px 12px",
  textAlign: "center",
  minWidth: 64,
};
const statNum = { fontWeight: 800, fontSize: 14, color: "var(--azul-osc)" };
const statLbl = { fontSize: 10.5, color: "var(--texto-sec)", marginTop: 1 };

function PanelTiempo({ estado, paradaActual, total, onSiguiente, onParar, t = (k) => k }) {
  const est = estado ? textoEstado(estado, t) : null;
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: 12, border: "1px solid var(--borde)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontWeight: 700, color: est?.color }}>
          {est?.emoji} {est?.texto}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          {t("parada")} {paradaActual + 1}/{total}
        </div>
      </div>
      {estado && (
        <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
          {fmtMin(estado.planeado)} · {fmtMin(estado.transcurrido)}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <Boton onClick={onSiguiente} style={{ flex: 1 }}>
          ✓ {t("llegueSiguiente")}
        </Boton>
        <Boton variante="sec" onClick={onParar} style={{ flex: 1 }}>
          ⏹️ {t("terminar")}
        </Boton>
      </div>
    </div>
  );
}
