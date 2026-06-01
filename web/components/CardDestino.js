"use client";
import { useEffect, useState } from "react";
import { fotoDeLugar } from "@/lib/imagenes";

// Tarjeta de destino con foto cargada dinámicamente (nunca queda rota:
// si no hay foto, muestra un degradado con el nombre). Estilo Airbnb/Booking.
export default function CardDestino({ nombre, pais, consulta, hint, onClick }) {
  const [img, setImg] = useState(null);

  useEffect(() => {
    let vivo = true;
    // hint = término de búsqueda de foto más icónico que el nombre de ciudad.
    fotoDeLugar(hint || nombre, pais).then((f) => {
      if (vivo && f?.url) setImg(f.url);
    });
    return () => {
      vivo = false;
    };
  }, [nombre, pais, hint]);

  return (
    <button onClick={onClick} style={card} className="card-destino">
      {img ? (
        <img src={img} alt={nombre} style={imgEstilo} loading="lazy" />
      ) : (
        <div style={placeholder} />
      )}
      <div style={overlay} />
      <div style={texto}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>{nombre}</div>
        <div style={{ fontSize: 12, opacity: 0.92 }}>{pais}</div>
      </div>
    </button>
  );
}

const card = {
  position: "relative",
  height: 130,
  borderRadius: 16,
  overflow: "hidden",
  border: "none",
  padding: 0,
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(15,23,42,.08)",
};
const imgEstilo = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const placeholder = {
  width: "100%",
  height: "100%",
  background: "linear-gradient(135deg,#6366f1,#312e81)",
};
const overlay = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(to top, rgba(0,0,0,.72) 0%, rgba(0,0,0,.05) 58%)",
};
const texto = { position: "absolute", left: 12, bottom: 10, color: "#fff", textAlign: "left" };
