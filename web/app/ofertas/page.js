"use client";
// Ruta /ofertas — Vuelos baratos detectados.
// Antes vivia en el home como una seccion mas abajo del hero. Ahora tiene
// su propia URL (compartible) y nav top. Al hacer click en una oferta o
// "Planear", navega al home con ?q=Ciudad,Pais para que arranque el flujo
// de planificacion.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import NavTop from "@/components/NavTop";
import Ofertas from "@/components/Ofertas";
import { Icono } from "@/components/Icono";

export default function PaginaOfertas() {
  const { t, lang } = useApp();
  const router = useRouter();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  function planear(q) {
    router.push(`/?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <NavTop active="ofertas" />

      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
        {/* Cabecera de la seccion */}
        <div className="mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
            Vuelos
          </div>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900 lg:text-[32px] dark:text-slate-100">
            Ofertas detectadas
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            Precios escaneados cada 3 horas desde {fechaInicio || fechaFin ? "tus fechas" : "los hubs principales"}.
            Si te gusta una, click en planear y te armamos el itinerario completo.
          </p>
        </div>

        {/* Selector de fechas (opcional, filtra las ofertas) */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-end gap-3">
            <div className="mr-auto">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
                ¿Cuándo viajas?
              </div>
              <div className="mt-0.5 text-[13.5px] font-bold text-slate-900 dark:text-slate-100">Filtra por rango de fechas (opcional)</div>
            </div>
            <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Icono nombre="planeTakeoff" size={15} /> Fecha ida
              </span>
              <input
                type="date"
                value={fechaInicio}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Icono nombre="planeLanding" size={15} /> Fecha vuelta
              </span>
              <input
                type="date"
                value={fechaFin}
                min={fechaInicio || new Date().toISOString().slice(0, 10)}
                onChange={(e) => setFechaFin(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </label>
            {(fechaInicio || fechaFin) && (
              <button
                onClick={() => { setFechaInicio(""); setFechaFin(""); }}
                className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-slate-500 underline-offset-2 hover:underline"
              >
                Quitar filtro
              </button>
            )}
          </div>
        </div>

        {/* Componente Ofertas (reutilizado del home) */}
        <Ofertas
          t={t}
          lang={lang}
          rango={fechaInicio && fechaFin ? { inicio: fechaInicio, fin: fechaFin } : null}
          onPlanear={planear}
        />
      </main>
    </div>
  );
}
