"use client";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import { IDIOMAS } from "@/lib/idiomas";

export default function SelectorIdioma({ oscuro = true }) {
  const { lang, cambiarIdioma, darkMode } = useApp();
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setAbierto((v) => !v)}
        className={oscuro
          ? "rounded-lg border-0 bg-white/20 px-2.5 py-1.5 text-[15px] text-white"
          : "rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1.5 text-[15px] text-marca-700 dark:border-slate-700 dark:bg-slate-800 dark:text-marca-300"
        }
      >
        {lang?.toUpperCase()} ▾
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-[1500]" onClick={() => setAbierto(false)} />
          <div className="animar-subir absolute right-0 top-[110%] z-[1600] min-w-[160px] overflow-hidden rounded-xl bg-white shadow-[0_8px_24px_rgba(0,0,0,.2)] dark:bg-slate-800 dark:shadow-[0_8px_24px_rgba(0,0,0,.5)]">
            {Object.entries(IDIOMAS).map(([cod, info]) => (
              <button
                key={cod}
                onClick={() => { cambiarIdioma(cod); setAbierto(false); }}
                className={`flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[14px] transition ${
                  lang === cod
                    ? "bg-marca-50 font-bold text-marca-700 dark:bg-marca-900/40 dark:text-marca-300"
                    : "font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                <span className="rounded bg-slate-100 px-1 py-0.5 text-[11px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                  {cod.toUpperCase()}
                </span>
                {info.nombre}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
