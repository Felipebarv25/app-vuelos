"use client";
// Combobox de moneda con typeahead. Substituto del <select> de 4 opciones.
// Muestra TODAS las ~80 monedas ISO 4217 más usadas, filtra en vivo
// cuando el usuario escribe el code o el nombre.
//
//   <SelectorMoneda value="COP" onChange={(code) => ...} />

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MONEDAS, buscarMonedas } from "@/lib/monedas";

export default function SelectorMoneda({ value, onChange, className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [iSeleccion, setISeleccion] = useState(0);
  const [montado, setMontado] = useState(false);
  // Portal solo es válido cliente-side. Esperamos al primer render.
  useEffect(() => { setMontado(true); }, []);
  // Posición del dropdown calculada desde el rect del trigger button.
  // Usamos posición fixed para que NO le afecte el overflow:hidden del
  // card que envuelve este componente.
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const dropRef = useRef(null);
  const inputRef = useRef(null);

  // Cerrar al click fuera (incluyendo el dropdown via portal).
  useEffect(() => {
    function onClick(e) {
      if (ref.current?.contains(e.target)) return;
      if (dropRef.current?.contains(e.target)) return;
      setAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Cuando se abre, calcular posición + focus al input.
  useEffect(() => {
    if (abierto && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
      setQ("");
      setISeleccion(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [abierto]);

  // Cerrar al hacer scroll para que el dropdown no quede flotando lejos.
  useEffect(() => {
    if (!abierto) return;
    const onScroll = () => setAbierto(false);
    window.addEventListener("scroll", onScroll, true);
    return () => window.removeEventListener("scroll", onScroll, true);
  }, [abierto]);

  const resultados = useMemo(() => buscarMonedas(q), [q]);

  function elegir(code) {
    onChange?.(code);
    setAbierto(false);
    setQ("");
  }

  function onKey(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setISeleccion((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setISeleccion((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const sel = resultados[iSeleccion];
      if (sel) elegir(sel.code);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  const dropdown = abierto && montado && createPortal(
    <div
      ref={dropRef}
      style={{ position: "fixed", top: pos.top, right: pos.right }}
      className="z-[100] w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-modal"
    >
      <input
        ref={inputRef}
        type="text"
        value={q}
        onChange={(e) => { setQ(e.target.value); setISeleccion(0); }}
        onKeyDown={onKey}
        placeholder="Buscar (USD, euro, peso…)"
        className="w-full border-0 border-b border-slate-100 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
        autoComplete="off"
      />
      <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
        {resultados.length === 0 ? (
          <li className="px-3 py-2.5 text-[13px] text-slate-400">Sin resultados</li>
        ) : (
          resultados.map((m, i) => (
            <li key={m.code}>
              <button
                type="button"
                onClick={() => elegir(m.code)}
                onMouseEnter={() => setISeleccion(i)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13px] transition ${
                  i === iSeleccion
                    ? "bg-marca-50 text-marca-900"
                    : "text-slate-700 hover:bg-slate-50"
                } ${m.code === value ? "font-bold" : ""}`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className="w-10 shrink-0 font-mono text-[12px] font-bold">{m.code}</span>
                  <span className="truncate">{m.nombre}</span>
                </span>
                <span className="shrink-0 text-[12px] text-slate-400">{m.simbolo}</span>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>,
    document.body
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex items-center gap-1 border-0 bg-transparent text-[13px] font-semibold text-slate-500 outline-none hover:text-slate-700 focus:text-slate-700"
        aria-haspopup="listbox"
        aria-expanded={abierto}
      >
        {value}
        <span className={`text-[10px] transition ${abierto ? "rotate-180" : ""}`}>▾</span>
      </button>
      {dropdown}
    </div>
  );
}
