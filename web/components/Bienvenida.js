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
  background: "linear-gradient(135deg,#2563eb,#1e3a8a)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 18,
  zIndex: 5000,
};
const tarjeta = {
  background: "#fff",
  borderRadius: 20,
  padding: 26,
  width: "100%",
  maxWidth: 400,
  boxShadow: "0 20px 50px rgba(0,0,0,.35)",
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
  padding: "14px",
  borderRadius: 12,
  border: "none",
  background: "var(--azul)",
  color: "#fff",
  fontSize: 16,
  fontWeight: 700,
};
