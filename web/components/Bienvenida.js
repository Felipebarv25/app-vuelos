"use client";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { IDIOMAS } from "@/lib/idiomas";

// Pantalla de bienvenida: el usuario elige idioma y pone su nombre (login ligero).
// Se muestra solo la primera vez (luego se recuerda en el dispositivo).
export default function Bienvenida() {
  const { t, lang, cambiarIdioma, entrar } = useApp();
  const [nombre, setNombre] = useState("");

  return (
    <div style={fondo}>
      <div style={tarjeta} className="animar-subir">
        <div style={{ fontSize: 52, textAlign: "center" }}>🌍</div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: "var(--azul-osc)", textAlign: "center" }}>
          Viajero 360
        </h1>
        <p style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginTop: 4 }}>
          {t("tagline")}
        </p>

        {/* Selector de idioma */}
        <div style={{ marginTop: 22 }}>
          <div style={etiqueta}>🌐 {t("idioma")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {Object.entries(IDIOMAS).map(([cod, info]) => (
              <button
                key={cod}
                onClick={() => cambiarIdioma(cod)}
                style={{
                  ...idiomaBtn,
                  borderColor: lang === cod ? "var(--azul)" : "var(--borde)",
                  background: lang === cod ? "#eff6ff" : "#fff",
                  fontWeight: lang === cod ? 700 : 500,
                }}
              >
                <span style={{ fontSize: 20 }}>{info.bandera}</span> {info.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre (login ligero) */}
        <div style={{ marginTop: 20 }}>
          <div style={etiqueta}>{t("tuNombre")}</div>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar(nombre)}
            placeholder="Felipe…"
            style={input}
            autoFocus
          />
        </div>

        <button onClick={() => entrar(nombre)} style={boton}>
          {t("comenzar")} →
        </button>
      </div>
    </div>
  );
}

const fondo = {
  position: "fixed",
  inset: 0,
  background: "linear-gradient(135deg,#6366f1 0%,#4f46e5 55%,#312e81 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  zIndex: 5000,
};
const tarjeta = {
  background: "#fff",
  borderRadius: 24,
  padding: 28,
  width: "100%",
  maxWidth: 400,
  boxShadow: "0 24px 60px rgba(49,46,129,.45)",
};
const etiqueta = { fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 8 };
const idiomaBtn = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid var(--borde)",
  fontSize: 14,
  color: "var(--texto)",
};
const input = {
  width: "100%",
  padding: "13px 14px",
  borderRadius: 10,
  border: "1px solid var(--borde)",
  fontSize: 16,
  outline: "none",
};
const boton = {
  width: "100%",
  marginTop: 22,
  padding: "15px",
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg,#6366f1,#4f46e5)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
  boxShadow: "0 6px 16px rgba(79,70,229,.4)",
  cursor: "pointer",
};
