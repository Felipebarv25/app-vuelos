"use client";
// Buscador del catalogo /destino (feedback 2026-07-11: "si busco una ciudad
// en especial quiero poderla filtrar"). Client island dentro de la pagina
// SSR: el listado SEO completo queda intacto debajo; esto es un atajo que
// filtra en vivo y navega directo.
//
//   <BuscadorDestinos destinos={[{ slug, ciudad, pais, vuelo }]} />

import Link from "next/link";
import { useMemo, useState } from "react";

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export default function BuscadorDestinos({ destinos = [] }) {
  const [q, setQ] = useState("");

  const resultados = useMemo(() => {
    const nq = norm(q);
    if (nq.length < 2) return [];
    return destinos
      .filter((d) => norm(`${d.ciudad} ${d.pais}`).includes(nq))
      .slice(0, 8);
  }, [q, destinos]);

  return (
    <div className="relative mt-5 max-w-md">
      <div className="flex items-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 focus-within:border-marca-400 dark:border-slate-600 dark:bg-slate-800">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="shrink-0 text-slate-400">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Busca tu ciudad (Madrid, Tokio, Lima…)"
          className="w-full border-0 bg-transparent text-[15px] text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          aria-label="Buscar destino"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600" aria-label="Limpiar">✕</button>
        )}
      </div>

      {q.trim().length >= 2 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-600 dark:bg-slate-800">
          {resultados.length === 0 ? (
            <div className="px-4 py-3 text-[13.5px] text-slate-400">
              No encontramos esa ciudad en el catálogo (aún).
            </div>
          ) : (
            resultados.map((d) => (
              <Link
                key={d.slug}
                href={`/destino/${d.slug}`}
                className="flex items-center justify-between px-4 py-2.5 transition hover:bg-marca-50 dark:hover:bg-slate-700"
              >
                <span className="text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                  {d.ciudad}
                  <span className="ml-1.5 text-[12.5px] font-medium text-slate-400">{d.pais}</span>
                </span>
                {d.vuelo && (
                  <span className="text-[12.5px] font-bold text-marca-700 dark:text-marca-300">
                    desde US$ {d.vuelo}
                  </span>
                )}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}
