"use client";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { IDIOMAS } from "@/lib/idiomas";

// Botoncito de idioma + menú, para cambiar el idioma desde la cabecera.
export default function SelectorIdioma({ oscuro = true }) {
  const { lang, cambiarIdioma } = useApp();
  const [abierto, setAbierto] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setAbierto((v) => !v)} style={oscuro ? btn : btnClaro}>
        {lang?.toUpperCase()} ▾
      </button>
      {abierto && (
        <>
          <div style={tapa} onClick={() => setAbierto(false)} />
          <div style={menu} className="animar-subir">
            {Object.entries(IDIOMAS).map(([cod, info]) => (
              <button
                key={cod}
                onClick={() => {
                  cambiarIdioma(cod);
                  setAbierto(false);
                }}
                style={{
                  ...item,
                  background: lang === cod ? "#eff6ff" : "#fff",
                  fontWeight: lang === cod ? 700 : 500,
                }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, background: "#f1f5f9", color: "#475569", borderRadius: 4, padding: "2px 5px" }}>{cod.toUpperCase()}</span> {info.nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const btn = {
  background: "rgba(255,255,255,.2)",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 15,
};
// Variante para fondo claro (cinta blanca tipo tarjeta).
const btnClaro = {
  background: "#f1f5f9",
  color: "#4f46e5",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "6px 10px",
  fontSize: 15,
};
const tapa = { position: "fixed", inset: 0, zIndex: 1500 };
const menu = {
  position: "absolute",
  top: "110%",
  right: 0,
  background: "#fff",
  borderRadius: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,.2)",
  overflow: "hidden",
  zIndex: 1600,
  minWidth: 160,
};
const item = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  width: "100%",
  padding: "11px 14px",
  border: "none",
  fontSize: 14,
  color: "var(--texto)",
  textAlign: "left",
  cursor: "pointer",
};
