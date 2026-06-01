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
      <Tarjeta style={{ marginBottom: 12, background: "#eff6ff", borderColor: "#bfdbfe" }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "var(--azul-osc)" }}>
              {t("dia")} {numeroDia}
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              {r.paradas} {t("paradas")} · {r.totalTexto} {t("enTotal")}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#475569" }}>
            <div>👣 {t("visitas")}: {r.visitaTexto}</div>
            <div>🚇 {t("traslados")}: {r.trasladoTexto}</div>
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
                  {emojiCat(p.categoria)} {p.categoria}
                  {p.cocina ? ` · ${p.cocina}` : ""} · ⏱️ {fmtMin(p.minutos)}
                  {p.notable ? " · ⭐" : ""}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <button style={{ ...mini, background: "#eff6ff", color: "var(--azul)" }}
                    onClick={() => onVerLugar?.(p)}>📷 {t("verFoto")}</button>
                  {alternativas?.length > 0 && (
                    <button style={mini} onClick={() => onCambiarParada(i)}>🔄 {t("cambiar")}</button>
                  )}
                  <button style={{ ...mini, color: "#dc2626" }} onClick={() => onQuitarParada(i)}>
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
  padding: "8px 12px",
  borderRadius: 8,
  background: "var(--gris)",
  color: "var(--azul-osc)",
  fontWeight: 600,
  border: "none",
};

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
