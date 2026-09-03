"use client";
// El presupuesto, linea por linea y con todo a la vista.
//
// Lo que habia antes eran cinco barras de colores con un total. Bonito y
// opaco: hacer clic en "Dormir" no desplegaba nada, no habia forma de saber de
// donde salia la cifra ni de corregirla, y faltaban categorias enteras — visa,
// seguro, equipaje, tasa turistica, colchon.
//
// La regla aqui es simple: si mostramos un numero, decimos de donde sale y
// dejamos cambiarlo. Un presupuesto que no se puede auditar no se puede creer,
// y uno que no se puede corregir no sirve para viajar.

import { useState } from "react";
import { Icono } from "./Icono";
import { montoEfectivo, estaEditada } from "@/lib/presupuestoLineas";

const ETIQUETA = {
  pre_viaje: "Antes de salir",
  transporte_internacional: "Vuelos de largo radio",
  transporte_entre_ciudades: "Entre ciudades",
  transporte_local: "Moverte allá",
  hospedaje: "Dormir",
  alimentacion: "Comer",
  actividades: "Salir y ver",
  varios: "Varios",
  colchon: "Colchón",
};

const COLOR = {
  pre_viaje: "bg-violet-500",
  transporte_internacional: "bg-marca-600",
  transporte_entre_ciudades: "bg-marca-400",
  transporte_local: "bg-sky-500",
  hospedaje: "bg-blue-500",
  alimentacion: "bg-amber-500",
  actividades: "bg-rose-500",
  varios: "bg-slate-400",
  colchon: "bg-emerald-500",
};

const SELLO = {
  real_detectado: ["bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", "PRECIO REAL"],
  verificado_manual: ["bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300", "VERIFICADO"],
  estimado: ["bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", "ESTIMADO"],
};

function Sello({ confianza }) {
  const [clase, texto] = SELLO[confianza] || SELLO.estimado;
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${clase}`}>
      {texto}
    </span>
  );
}

function Linea({ linea, overrides, onFijar, fmt }) {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const editada = estaEditada(linea, overrides);
  const monto = montoEfectivo(linea, overrides);

  return (
    <li className="border-b border-slate-100 last:border-0 dark:border-slate-700">
      <button
        type="button"
        onClick={() => { setAbierta((v) => !v); setTexto(String(monto)); }}
        className="flex w-full items-center gap-2 py-2 text-left"
      >
        <Icono nombre={abierta ? "chevronUp" : "chevronDown"} size={13} />
        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700 dark:text-slate-200">
          {linea.concepto}
        </span>
        {editada && (
          <span className="shrink-0 rounded bg-marca-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-marca-800 dark:bg-marca-900/40 dark:text-marca-200">
            Tuyo
          </span>
        )}
        <span className="shrink-0 text-[13px] font-bold tabular-nums text-slate-900 dark:text-slate-100">
          {fmt(monto)}
        </span>
      </button>

      {abierta && (
        <div className="pb-3 pl-6 pr-1">
          <div className="flex flex-wrap items-center gap-2">
            <Sello confianza={linea.confianza} />
            <span className="text-[12px] font-semibold text-slate-600 dark:text-slate-300">
              {linea.formula}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            {linea.fuente}
            {linea.nota ? ` · ${linea.nota}` : ""}
          </p>

          {linea.editable && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">
                Tu cifra
              </span>
              <input
                type="number"
                min="0"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1 text-right text-[13px] tabular-nums dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => onFijar(linea.id, Number(texto))}
                className="rounded-full bg-marca-700 px-3 py-1 text-[12px] font-bold text-white transition hover:bg-marca-800"
              >
                Fijar
              </button>
              {editada && (
                <button
                  type="button"
                  onClick={() => onFijar(linea.id, null)}
                  className="text-[12px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:text-slate-400"
                >
                  Volver al calculado
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export default function DesglosePresupuesto({
  presupuesto,
  overrides = {},
  onFijar,
  fmt = (n) => `US$ ${Math.round(n).toLocaleString("es-CO")}`,
  t = (k) => k,
}) {
  const [abierta, setAbierta] = useState(null);
  if (!presupuesto?.porCategoria?.length) return null;
  const total = presupuesto.total || 1;

  return (
    <div className="mt-5">
      <div className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400">
        {t("rutaPorCategoria")}
      </div>

      <ul className="mt-2.5 grid gap-1.5">
        {presupuesto.porCategoria.map((c) => {
          const pct = Math.round((c.total / total) * 100);
          const esta = abierta === c.categoria;
          return (
            <li
              key={c.categoria}
              className="rounded-xl border border-slate-200 px-3 dark:border-slate-700"
            >
              <button
                type="button"
                onClick={() => setAbierta(esta ? null : c.categoria)}
                className="flex w-full items-center gap-2.5 py-2.5 text-left"
              >
                <Icono nombre={esta ? "chevronUp" : "chevronDown"} size={14} />
                <span className="w-[104px] shrink-0 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300">
                  {ETIQUETA[c.categoria] || c.categoria}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <span
                    className={`block h-full rounded-full ${COLOR[c.categoria] || "bg-slate-400"}`}
                    style={{ width: `${Math.max(2, pct)}%` }}
                  />
                </span>
                <span className="w-9 shrink-0 text-right text-[11.5px] tabular-nums text-slate-400">
                  {pct}%
                </span>
                <span className="w-20 shrink-0 text-right text-[13px] font-bold tabular-nums text-slate-900 dark:text-slate-100">
                  {fmt(c.total)}
                </span>
              </button>

              {esta && (
                <ul className="border-t border-slate-100 dark:border-slate-700">
                  {c.lineas.map((l) => (
                    <Linea
                      key={l.id}
                      linea={l}
                      overrides={overrides}
                      onFijar={onFijar}
                      fmt={fmt}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
