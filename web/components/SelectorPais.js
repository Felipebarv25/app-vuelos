"use client";
// Combobox typeahead de país. Usa PAISES_ISO (todos los países del
// mundo con bandera emoji). Sirve para el override de "Detectado: X"
// — el usuario corrige cuando la IP da el país equivocado (VPN,
// roaming, etc.).
//
//   <SelectorPais value="CO" onChange={(iso) => ...} />

import { useEffect, useMemo, useRef, useState } from "react";
import { PAISES_ISO } from "@/lib/paisesISO";

const PAISES = Object.entries(PAISES_ISO).map(([cc, info]) => ({
  cc,
  nombre: info.nombre,
  bandera: info.bandera || "🌍",
  nombreLower: (info.nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""),
}));

function buscarPaises(query) {
  const q = (query || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!q) return PAISES.slice(0, 30);
  const exactos = [];
  const prefijos = [];
  const contiene = [];
  for (const p of PAISES) {
    const cc = p.cc.toLowerCase();
    if (cc === q || p.nombreLower === q) exactos.push(p);
    else if (cc.startsWith(q) || p.nombreLower.startsWith(q)) prefijos.push(p);
    else if (p.nombreLower.includes(q)) contiene.push(p);
  }
  return [...exactos, ...prefijos, ...contiene].slice(0, 30);
}

export default function SelectorPais({ value, onChange, className = "" }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [iSeleccion, setISeleccion] = useState(0);
  const ref = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (!ref.current?.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  useEffect(() => {
    if (abierto) {
      setQ("");
      setISeleccion(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [abierto]);

  const resultados = useMemo(() => buscarPaises(q), [q]);
  const paisActual = PAISES.find((p) => p.cc === value);

  function elegir(cc) {
    onChange?.(cc);
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
      if (sel) elegir(sel.cc);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div ref={ref} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] font-semibold text-white/85 underline-offset-2 outline-none transition hover:text-white hover:underline"
        aria-haspopup="listbox"
        aria-expanded={abierto}
      >
        <span className="text-base leading-none">📍</span>
        <span className="text-white/75">Detectado:</span>
        <span>{paisActual ? `${paisActual.bandera} ${paisActual.nombre}` : "—"}</span>
        <span className="text-[11px] text-white/60">✎</span>
      </button>

      {abierto && (
        <div className="absolute left-1/2 top-full z-50 mt-1 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-modal">
          <input
            ref={inputRef}
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setISeleccion(0); }}
            onKeyDown={onKey}
            placeholder="Buscar país (Colombia, ES, France…)"
            className="w-full border-0 border-b border-slate-100 bg-white px-3 py-2.5 text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
            autoComplete="off"
          />
          <ul role="listbox" className="max-h-72 overflow-y-auto py-1">
            {resultados.length === 0 ? (
              <li className="px-3 py-2.5 text-[13px] text-slate-400">Sin resultados</li>
            ) : (
              resultados.map((p, i) => (
                <li key={p.cc}>
                  <button
                    type="button"
                    onClick={() => elegir(p.cc)}
                    onMouseEnter={() => setISeleccion(i)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition ${
                      i === iSeleccion
                        ? "bg-marca-50 text-marca-900"
                        : "text-slate-700 hover:bg-slate-50"
                    } ${p.cc === value ? "font-bold" : ""}`}
                  >
                    <span className="text-base">{p.bandera}</span>
                    <span className="flex-1 truncate">{p.nombre}</span>
                    <span className="shrink-0 font-mono text-[11px] text-slate-400">{p.cc}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
