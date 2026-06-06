"use client";
// Toast flotante simple: aparece arriba a la derecha, dura ~2.5s y se desliza
// hacia arriba al salir. Para confirmaciones cortas (Guardado, Copiado, etc.).
// API minimalista: <Toast mostrar={bool} texto="..." icono="check" />.
import { Icono } from "./Icono";

export default function Toast({ mostrar, texto, icono = "check", tono = "exito" }) {
  if (!mostrar) return null;
  const colores =
    tono === "exito"
      ? "bg-emerald-600 text-white"
      : tono === "error"
      ? "bg-red-600 text-white"
      : "bg-marca-700 text-white";
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-[6000] flex justify-center px-4"
    >
      <div
        className={`animar-toast flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold shadow-[0_8px_24px_rgba(0,0,0,.25)] ${colores}`}
      >
        <Icono nombre={icono} size={16} />
        {texto}
      </div>
    </div>
  );
}
