"use client";
// Wizard "tu ruta a tu medida" (2026-07-13) — 3 preguntas de filtro al
// estilo Itinio: ① que te llama (multi), ② ritmo, ③ dia o noche.
// Se abre solo la PRIMERA vez que el usuario entra a una ciudad (y luego
// desde el chip "✨ A tu medida"). Al aplicar, page.js pondera las
// categorias del itinerario, ajusta paradas/dia y guarda los gustos.
//
//   <PersonalizarRuta inicial={gustos} onAplicar={(g)=>...} onCerrar={...} t={t} />

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBrowserBackClose } from "@/lib/useBrowserBack";
import { INTERESES } from "@/lib/gustos";
import { Icono } from "./Icono";

// Fallback ES si el padre no pasa `t` (claves globales con prefijo gustos_).
const TXT = {
  titulo: "Tu ruta, a tu medida",
  sub: "3 preguntas rápidas y armamos el plan como a ti te gusta.",
  p1: "¿Qué te llama más? Elige todas las que quieras",
  p2: "¿A qué ritmo viajas?",
  relajado: "Relajado",
  relajadoSub: "3-4 paradas por día",
  intenso: "Intenso",
  intensoSub: "6+ paradas por día",
  p3: "¿Más de día o de noche?",
  diurno: "De día",
  nocturno: "De noche",
  cta: "Armar mi ruta ✨",
  luego: "Ahora no",
  int_cultura: "Cultura",
  int_comida: "Comida",
  int_naturaleza: "Naturaleza",
  int_rumba: "Rumba",
  int_compras: "Compras",
  int_miradores: "Fotos y miradores",
  int_deporte: "Deporte",
};
const CLAVE_GLOBAL = { diurno: "diurno", nocturno: "nocturno" };
function crearTx(t) {
  return (k, vars = {}) => {
    if (t) {
      const clave = CLAVE_GLOBAL[k] || "gustos_" + k;
      const v = t(clave, vars);
      if (v !== clave) return v;
    }
    let s = TXT[k] || k;
    for (const [kk, v] of Object.entries(vars)) s = s.replace(`{${kk}}`, v);
    return s;
  };
}

export default function PersonalizarRuta({ inicial = null, onAplicar, onCerrar, t = null }) {
  const tx = crearTx(t);
  useBrowserBackClose(true, onCerrar);
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  const [intereses, setIntereses] = useState(() => new Set(inicial?.intereses || []));
  const [ritmo, setRitmo] = useState(inicial?.ritmo || "relajado");
  const [momento, setMomento] = useState(inicial?.momento || "diurno");

  function toggleInteres(k) {
    setIntereses((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }

  if (!montado) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5700] flex items-end justify-center bg-slate-900/60 animar-aparecer sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animar-subir dark:bg-slate-900 sm:rounded-3xl lg:max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="bg-gradient-to-br from-marca-600 to-marca-900 px-5 pb-4 pt-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[20px] font-extrabold tracking-tight">✨ {tx("titulo")}</h2>
              <p className="mt-1 text-[12.5px] leading-snug text-white/80">{tx("sub")}</p>
            </div>
            <button
              onClick={onCerrar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              aria-label="Cerrar"
            >
              <Icono nombre="x" size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="lg:grid lg:grid-cols-3 lg:gap-6">
            {/* ① Intereses */}
            <div>
              <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{tx("p1")}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Object.entries(INTERESES).map(([k, v]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => toggleInteres(k)}
                    className={`rounded-full border px-3.5 py-2 text-[13px] font-bold transition ${
                      intereses.has(k)
                        ? "border-marca-600 bg-marca-600 text-white shadow-suave"
                        : "border-slate-200 bg-white text-slate-600 hover:border-marca-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {v.emoji} {tx("int_" + k)}
                  </button>
                ))}
              </div>
            </div>

            {/* ② Ritmo */}
            <div className="mt-5 lg:mt-0">
              <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{tx("p2")}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
                {[["relajado", "🌤️"], ["intenso", "⚡"]].map(([k, emoji]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setRitmo(k)}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      ritmo === k
                        ? "border-marca-600 bg-marca-50 dark:bg-marca-900/30"
                        : "border-slate-200 bg-white hover:border-marca-300 dark:border-slate-600 dark:bg-slate-800"
                    }`}
                  >
                    <div className="text-[14px] font-extrabold text-slate-800 dark:text-slate-100">{emoji} {tx(k)}</div>
                    <div className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">{tx(k + "Sub")}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* ③ Momento */}
            <div className="mt-5 lg:mt-0">
              <div className="text-[13px] font-bold text-slate-700 dark:text-slate-200">{tx("p3")}</div>
              <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-1">
                {[["diurno", "☀️"], ["nocturno", "🌙"]].map(([k, emoji]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setMomento(k)}
                    className={`rounded-2xl border px-3 py-3 text-center text-[14px] font-extrabold transition ${
                      momento === k
                        ? "border-marca-600 bg-marca-50 text-slate-800 dark:bg-marca-900/30 dark:text-slate-100"
                        : "border-slate-200 bg-white text-slate-600 hover:border-marca-300 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {emoji} {tx(k)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="border-t border-slate-100 px-5 py-3.5 dark:border-slate-700">
          <button
            type="button"
            disabled={intereses.size === 0}
            onClick={() => onAplicar?.({ intereses: [...intereses], ritmo, momento })}
            className="w-full rounded-2xl bg-gradient-to-r from-marca-500 to-marca-700 py-3.5 text-[15px] font-extrabold text-white shadow-marca transition hover:brightness-110 disabled:opacity-50"
          >
            {tx("cta")}
          </button>
          <button
            type="button"
            onClick={onCerrar}
            className="mt-1.5 w-full py-2 text-center text-[12.5px] font-semibold text-slate-400 hover:text-slate-600"
          >
            {tx("luego")}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
