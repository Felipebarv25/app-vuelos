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
    // Escalonamos la ráfaga (12 tarjetas a la vez saturaban Wikipedia y algunas
    // quedaban grises) y reintentamos una vez si la primera no trajo foto.
    function cargar(intento = 0) {
      fotoDeLugar(hint || nombre, pais).then((f) => {
        if (!vivo) return;
        if (f?.url) setImg(f.url);
        else if (intento < 1) setTimeout(() => cargar(intento + 1), 1500 + Math.random() * 1500);
      });
    }
    const t = setTimeout(() => cargar(), Math.random() * 1200);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [nombre, pais, hint]);

  return (
    <button
      onClick={onClick}
      className="card-destino relative block h-[140px] w-full cursor-pointer overflow-hidden rounded-2xl border-0 p-0 shadow-suave sm:h-[170px] lg:h-[230px]"
    >
      {img ? (
        <img
          src={img}
          alt={nombre}
          loading="lazy"
          onError={() => setImg(null)}
          className="block h-full w-full object-cover"
        />
      ) : (
        <div className="h-full w-full bg-gradient-to-br from-marca-400 to-marca-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
      <div className="absolute bottom-3 left-3.5 text-left text-white">
        <div className="text-[17px] font-extrabold leading-tight drop-shadow lg:text-xl">{nombre}</div>
        <div className="text-xs opacity-95 lg:text-[13px]">{pais}</div>
      </div>
    </button>
  );
}
