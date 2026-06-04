"use client";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { IDIOMAS } from "@/lib/idiomas";
import { Logo } from "@/components/Logo";

// Pantalla de bienvenida: el usuario elige idioma y pone su nombre (login ligero).
// Se muestra solo la primera vez (luego se recuerda en el dispositivo).
export default function Bienvenida() {
  const { t, lang, cambiarIdioma, entrar } = useApp();
  const [nombre, setNombre] = useState("");

  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-gradient-to-br from-marca-500 via-marca-600 to-marca-900">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-[0_24px_60px_rgba(49,46,129,.45)] animar-subir">
        <div className="flex justify-center text-marca-600"><Logo size={56} /></div>
        <h1 className="text-[26px] font-bold text-marca-900 text-center tracking-tight mt-2">
          Viajero <span className="text-acento-500">360</span>
        </h1>
        <p className="text-sm text-slate-500 text-center mt-1">{t("tagline")}</p>

        {/* Selector de idioma (código neutro, sin banderas de país) */}
        <div className="mt-6">
          <div className="text-[13px] font-bold text-slate-600 mb-2">{t("idioma")}</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(IDIOMAS).map(([cod, info]) => (
              <button
                key={cod}
                onClick={() => cambiarIdioma(cod)}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition ${
                  lang === cod
                    ? "border-marca-500 bg-marca-50 font-bold text-marca-900"
                    : "border-slate-200 bg-white font-medium text-slate-700"
                }`}
              >
                <span className={`flex h-6 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold ${
                  lang === cod ? "bg-marca-600 text-white" : "bg-slate-100 text-slate-500"
                }`}>{cod.toUpperCase()}</span>
                {info.nombre}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre (login ligero) */}
        <div className="mt-5">
          <div className="text-[13px] font-bold text-slate-600 mb-2">{t("tuNombre")}</div>
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar(nombre)}
            placeholder="Felipe…"
            className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-base"
            autoFocus
          />
        </div>

        <button
          onClick={() => entrar(nombre)}
          className="w-full mt-6 py-3.5 rounded-2xl border-0 bg-gradient-to-r from-marca-500 to-marca-600 text-white text-base font-bold shadow-marca"
        >
          {t("comenzar")} →
        </button>
      </div>
    </div>
  );
}

