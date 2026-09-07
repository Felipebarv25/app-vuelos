"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import NavTop from "@/components/NavTop";
import BottomTabBar from "@/components/BottomTabBar";
import MiViajeDashboard from "@/components/MiViajeDashboard";

export default function MiViajePage() {
  const [rutas, setRutas] = useState([]);
  const [seleccion, setSeleccion] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const r = await fetch("/api/rutas", { cache: "no-store" });
      const d = r.ok ? await r.json() : null;
      if (!d?.ok) {
        setError(d?.motivo === "no-auth" ? "Necesitas iniciar sesión para abrir tus viajes guardados." : "No pudimos cargar tus viajes.");
        setRutas([]);
        setSeleccion(null);
        return;
      }
      const lista = Array.isArray(d.rutas) ? d.rutas : [];
      setRutas(lista);
      setSeleccion((actual) => lista.find((x) => x.id === actual?.id) || lista[0] || null);
    } catch {
      setError("No pudimos conectar con tus viajes. Inténtalo de nuevo.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-900 md:pb-0">
      <NavTop active="misviajes" />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">Tu centro de viaje</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">Mi viaje</h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              Un solo lugar para ver tu ruta, detectar lo que falta y tomar mejores decisiones antes de viajar.
            </p>
          </div>
          <Link href="/mis-viajes" className="rounded-full bg-marca-700 px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-sm hover:bg-marca-800">
            Gestionar viajes
          </Link>
        </div>

        {cargando && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-marca-600" />
            <p className="mt-3 text-[13px] text-slate-500">Cargando tu viaje…</p>
          </div>
        )}

        {!cargando && error && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
            <h2 className="text-[16px] font-extrabold text-amber-900 dark:text-amber-200">Aún no podemos mostrar tu viaje</h2>
            <p className="mt-1.5 text-[13px] text-amber-800/80 dark:text-amber-200/70">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={cargar} className="rounded-full bg-amber-800 px-4 py-2 text-[12px] font-bold text-white hover:bg-amber-900">Reintentar</button>
              <Link href="/mis-viajes" className="rounded-full border border-amber-300 px-4 py-2 text-[12px] font-bold text-amber-900 dark:text-amber-200">Ir a Mis viajes</Link>
            </div>
          </div>
        )}

        {!cargando && !error && rutas.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-12">
            <div className="text-5xl">🧭</div>
            <h2 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">Todavía no has construido un viaje</h2>
            <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              Empieza definiendo tus ciudades. Después iremos añadiendo vuelos, transporte, alojamiento, presupuesto, itinerario y requisitos al mismo viaje.
            </p>
            <Link href="/mis-viajes" className="mt-6 inline-flex rounded-full bg-marca-700 px-5 py-3 text-[13px] font-extrabold text-white hover:bg-marca-800">
              Construir mi primer viaje
            </Link>
          </div>
        )}

        {!cargando && !error && rutas.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
              <div className="px-2 pb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">Mis viajes</div>
              <div className="space-y-1">
                {rutas.map((ruta) => (
                  <button
                    key={ruta.id}
                    type="button"
                    onClick={() => setSeleccion(ruta)}
                    className={`w-full rounded-xl px-3 py-2.5 text-left transition ${seleccion?.id === ruta.id ? "bg-marca-50 text-marca-900 ring-1 ring-marca-200 dark:bg-marca-900/30 dark:text-marca-100 dark:ring-marca-800" : "hover:bg-slate-50 dark:hover:bg-slate-700"}`}
                  >
                    <span className="block truncate text-[12.5px] font-extrabold">{ruta.nombre || "Viaje sin nombre"}</span>
                    <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{(ruta.paradas || []).map((p) => p.ciudad).join(" → ")}</span>
                  </button>
                ))}
              </div>
            </aside>

            {seleccion && (
              <MiViajeDashboard
                ruta={seleccion}
                onEditarRuta={() => { window.location.href = `/mis-viajes?editar=${encodeURIComponent(seleccion.id)}`; }}
                onOptimizar={() => { window.location.href = `/mis-viajes?editar=${encodeURIComponent(seleccion.id)}#planificador`; }}
              />
            )}
          </div>
        )}
      </main>

      <BottomTabBar />
    </div>
  );
}
