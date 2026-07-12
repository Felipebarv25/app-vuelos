"use client";
// Tira de fotos de la ciudad bajo el titulo de la vista de ruta (feedback
// 2026-07-11: "al lado de Medellin se generen imagenes atractivas alusivas
// a la ciudad"). Usa galeriaDeLugar (Wikimedia Commons, cache 30 dias) —
// funciona para TODAS las ciudades sin curar nada a mano. Si no hay 2+
// fotos, no renderiza (cero huecos grises).

import { useEffect, useState } from "react";
import { galeriaDeLugar } from "@/lib/imagenes";

export default function FotosCiudadHeader({ ciudad, pais = "" }) {
  const [fotos, setFotos] = useState([]);

  useEffect(() => {
    let vivo = true;
    setFotos([]);
    galeriaDeLugar(ciudad, pais, 4).then((g) => {
      if (vivo) setFotos((g?.urls || []).slice(0, 4));
    }).catch(() => {});
    return () => { vivo = false; };
  }, [ciudad, pais]);

  if (fotos.length < 2) return null;

  return (
    <div className="sin-scrollbar mb-4 flex gap-2 overflow-x-auto">
      {fotos.map((url, i) => (
        <img
          key={url}
          src={url}
          alt={`${ciudad} ${i + 1}`}
          loading="lazy"
          className={`h-20 rounded-xl object-cover shadow-suave ${i === 0 ? "w-40" : "w-28"} shrink-0`}
        />
      ))}
    </div>
  );
}
