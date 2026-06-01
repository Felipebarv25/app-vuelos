"use client";
import { useEffect, useState } from "react";
import { fotoDeLugar } from "@/lib/imagenes";
import { planTransporte, trazarRuta, perfilDeModo } from "@/lib/rutaReal";
import { distanciaMetros } from "@/lib/rutas";
import { fmtMin } from "@/lib/itinerario";

// Emoji representativo según el tipo de lugar (para cuando no hay foto).
function emojiCategoria(cat = "") {
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

// Panel/modal que muestra TODO sobre un lugar SIN salir de la app:
// foto, descripción, y cómo llegar desde la ubicación del usuario
// (transporte, tiempo, costo y ruta dibujada en nuestro mapa).
export default function DetalleLugar({ lugar, ciudad, origen, onCerrar, onTrazarRuta, t = (k) => k }) {
  const [foto, setFoto] = useState(null);
  const [cargandoFoto, setCargandoFoto] = useState(true);
  const [modoSel, setModoSel] = useState(null);

  const metros = origen ? distanciaMetros(origen, lugar.coord) : null;
  const transportes = metros != null ? planTransporte(metros) : [];

  useEffect(() => {
    let vivo = true;
    setCargandoFoto(true);
    setFoto(null);
    fotoDeLugar(lugar.nombre, ciudad?.nombre).then((f) => {
      if (vivo) {
        setFoto(f);
        setCargandoFoto(false);
      }
    });
    return () => {
      vivo = false;
    };
  }, [lugar, ciudad]);

  async function elegirTransporte(t) {
    setModoSel(t.modo);
    if (!origen) return;
    const ruta = await trazarRuta(origen, lugar.coord, perfilDeModo(t.modo));
    onTrazarRuta?.({ ...ruta, modo: t.modo, lugar });
  }

  return (
    <div style={fondo} onClick={onCerrar}>
      <div style={hoja} onClick={(e) => e.stopPropagation()}>
        {/* Asa para arrastrar (estética móvil) */}
        <div style={asa} />

        {/* Foto del lugar */}
        <div style={fotoCaja}>
          {cargandoFoto ? (
            <div style={fotoPlaceholder}>
              <span className="spin" />
            </div>
          ) : foto?.url ? (
            <img src={foto.url} alt={lugar.nombre} style={fotoImg} />
          ) : (
            <div style={fotoSinImg}>
              <span style={{ fontSize: 58 }}>{emojiCategoria(lugar.categoria)}</span>
            </div>
          )}
          <button style={cerrar} onClick={onCerrar}>
            ✕
          </button>
          <div style={fotoTexto}>
            <div style={{ fontSize: 22, fontWeight: 800 }}>{lugar.nombre}</div>
            <div style={{ fontSize: 13, opacity: 0.95 }}>
              {lugar.categoria}
              {lugar.cocina ? ` · ${lugar.cocina}` : ""}
              {lugar.notable ? " · ⭐ Destacado" : ""}
            </div>
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* Descripción (de Wikipedia) */}
          {foto?.extracto && (
            <p style={{ fontSize: 14, color: "#334155", lineHeight: 1.5, marginBottom: 14 }}>
              {foto.extracto.length > 240
                ? foto.extracto.slice(0, 240) + "…"
                : foto.extracto}
            </p>
          )}

          {/* Cómo llegar desde tu ubicación */}
          <div style={{ fontWeight: 700, color: "var(--azul-osc)", marginBottom: 8 }}>
            🧭 {t("comoLlegar")} {origen ? t("desdeTuUbicacion") : ""}
          </div>

          {!origen && <div style={avisoGps}>📍 {t("activaGps")}</div>}

          {origen && (
            <>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                {t("estasA")}{" "}
                <b>
                  {metros < 1000
                    ? `${Math.round(metros)} m`
                    : `${(metros / 1000).toFixed(1)} km`}
                </b>{" "}
                {t("deAqui")}
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {transportes.map((tr) => (
                  <button
                    key={tr.modo}
                    onClick={() => elegirTransporte(tr)}
                    style={{
                      ...opcion,
                      borderColor: modoSel === tr.modo ? "var(--azul)" : "var(--borde)",
                      background:
                        modoSel === tr.modo ? "#eff6ff" : tr.recomendado ? "#f0fdf4" : "#fff",
                    }}
                  >
                    <span style={{ fontSize: 22 }}>{tr.icono}</span>
                    <div style={{ flex: 1, textAlign: "left" }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>
                        {tr.nombre}
                        {tr.recomendado && <span style={recom}>{t("recomendado")}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        ⏱️ {fmtMin(tr.minutos)} · 💵 {tr.costo}
                      </div>
                    </div>
                    <span style={{ color: "var(--azul)", fontWeight: 700, fontSize: 13 }}>
                      {t("verRuta")} →
                    </span>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
                {t("aproxAviso")}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const fondo = {
  position: "fixed",
  inset: 0,
  background: "rgba(15,23,42,.55)",
  zIndex: 3000,
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  animation: "aparece .2s ease",
};
const hoja = {
  background: "#fff",
  width: "100%",
  maxWidth: 560,
  maxHeight: "92vh",
  overflowY: "auto",
  borderRadius: "20px 20px 0 0",
  boxShadow: "0 -8px 30px rgba(0,0,0,.3)",
};
const asa = {
  width: 42,
  height: 5,
  background: "#cbd5e1",
  borderRadius: 999,
  margin: "10px auto 4px",
};
const fotoCaja = { position: "relative", height: 220, background: "#e2e8f0", overflow: "hidden" };
const fotoImg = { width: "100%", height: "100%", objectFit: "cover" };
const fotoPlaceholder = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#94a3b8",
};
// Cuando no hay foto: degradado agradable + emoji de la categoría.
const fotoSinImg = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "linear-gradient(135deg,#6366f1,#312e81)",
};
const fotoTexto = {
  position: "absolute",
  bottom: 0,
  left: 0,
  right: 0,
  padding: "30px 16px 14px",
  background: "linear-gradient(transparent, rgba(0,0,0,.78))",
  color: "#fff",
};
const cerrar = {
  position: "absolute",
  top: 12,
  right: 12,
  width: 34,
  height: 34,
  borderRadius: "50%",
  border: "none",
  background: "rgba(0,0,0,.5)",
  color: "#fff",
  fontSize: 16,
};
const opcion = {
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: 12,
  borderRadius: 12,
  border: "1px solid var(--borde)",
  background: "#fff",
};
const recom = {
  marginLeft: 8,
  fontSize: 10,
  background: "var(--verde)",
  color: "#fff",
  padding: "2px 7px",
  borderRadius: 999,
  fontWeight: 700,
  verticalAlign: "middle",
};
const avisoGps = {
  fontSize: 13,
  background: "#fef3c7",
  color: "#92400e",
  padding: 12,
  borderRadius: 10,
  lineHeight: 1.4,
};
