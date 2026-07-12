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
    galeriaDeLugar(ciudad, pais, 8).then((g) => {
      if (!vivo) return;
      // Solo JPG/JPEG: los PNG de Commons suelen ser logos, planos y
      // diagramas (bug 2026-07-11: salia el logo del "Plan de Ordenamiento
      // Territorial" y un mapa antiguo). Ademas blocklist de palabras que
      // delatan no-fotos.
      const malas = /logo|escudo|plan[_ %]de[_ %]ordenamiento|diagrama|plano|croquis|chart|emblem|seal|bandera|flag/i;
      const buenas = (g?.urls || [])
        .filter((u) => /\.jpe?g(\?|$)/i.test(u))
        .filter((u) => { try { return !malas.test(decodeURIComponent(u)); } catch { return !malas.test(u); } })
        .slice(0, 3);
      setFotos(buenas);
    }).catch(() => {});
    return () => { vivo = false; };
  }, [ciudad, pais]);

  if (fotos.length < 2) return null;

  return (
    <div className="sin-scrollbar mb-4 flex gap-2.5 overflow-x-auto">
      {fotos.map((url, i) => (
        <img
          key={url}
          src={url}
          alt={`${ciudad} ${i + 1}`}
          loading="lazy"
          className={`h-28 rounded-2xl object-cover shadow-suave sm:h-36 ${i === 0 ? "w-56 sm:w-72" : "w-40 sm:w-52"} shrink-0`}
        />
      ))}
    </div>
  );
}
