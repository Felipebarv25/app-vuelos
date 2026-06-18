"use client";
// Botón corazón para marcar/desmarcar un destino como favorito. Pasa al hook
// useFavoritos a través de las props (estado controlado para que el padre
// pueda mantener una sola lista). Animación pop al togglear.
import { Icono } from "./Icono";

export default function BotonFav({ activo, onClick, size = 18, etiqueta = "Favorito" }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(); }}
      aria-pressed={activo}
      aria-label={etiqueta}
      title={etiqueta}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full transition active:scale-90 ${
        activo
          ? "bg-rose-500 text-white shadow-[0_4px_12px_rgba(244,63,94,.5)]"
          : "bg-white text-slate-400 ring-1 ring-slate-200 hover:text-rose-500 hover:ring-rose-200 dark:ring-slate-700 dark:hover:ring-rose-700"
      }`}
    >
      <span className={activo ? "animar-pop" : ""}>
        <Icono nombre="heart" size={size} />
      </span>
    </button>
  );
}
