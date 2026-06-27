"use client";
// Ruta /mis-viajes — Viajes guardados del usuario.
// Antes vivia como una seccion del home (debajo del hero) ademas de un acceso
// en el dropdown del MenuUsuario. Ahora tiene URL propia (compartible y mejor
// estructura). Al hacer click en "Abrir" navega al home con
// ?destino=ciudad-slug para reconstruir el viaje.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/AppContext";
import { listarViajesAsync, borrarViajeAsync } from "@/lib/viajes";
import NavTop from "@/components/NavTop";
import { Icono } from "@/components/Icono";

export default function PaginaMisViajes() {
  const { t, lang, usuario } = useApp();
  const router = useRouter();
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const v = await listarViajesAsync(usuario);
      if (vivo) {
        setViajes(v || []);
        setCargando(false);
      }
    })();
    return () => { vivo = false; };
  }, [usuario]);

  function reabrir(v) {
    // Navegamos al home con el parametro `q` que page.js usa para buscar
    // la ciudad y reconstruir el contexto.
    const q = v.ciudad?.nombre ? `${v.ciudad.nombre}, ${v.ciudad.pais || ""}` : "";
    router.push(`/?q=${encodeURIComponent(q)}`);
  }

  async function eliminar(id) {
    const nuevos = await borrarViajeAsync(usuario, id);
    setViajes(nuevos || []);
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <NavTop active="misviajes" />

      <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-10">
        {/* Cabecera */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
              Tus planes
            </div>
            <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900 lg:text-[32px] dark:text-slate-100">
              Mis viajes
              {usuario?.google && (
                <span className="ml-3 inline-flex items-center gap-1 align-middle text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <Icono nombre="check" size={12} /> Sincronizado
                </span>
              )}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-slate-600 dark:text-slate-400">
              {viajes.length > 0
                ? `${viajes.length} ${viajes.length === 1 ? "viaje guardado" : "viajes guardados"}.`
                : "Cuando guardes un viaje aparecerá aquí."}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-marca-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-marca-800"
          >
            + Planear un viaje nuevo
          </Link>
        </div>

        {/* Estado: cargando, vacio o lista */}
        {cargando && (
          <div className="py-12 text-center text-slate-400">Cargando viajes…</div>
        )}

        {!cargando && viajes.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-800">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-marca-50 text-marca-700 dark:bg-marca-900/30 dark:text-marca-300">
              <Icono nombre="bookmark" size={20} />
            </div>
            <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">Sin viajes guardados todavía</div>
            <p className="mt-1 text-[13px] text-slate-600 dark:text-slate-400">
              Planea tu primer viaje y guárdalo desde la página de la ciudad.
            </p>
            <Link
              href="/"
              className="mt-4 inline-flex rounded-md bg-marca-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-marca-800"
            >
              Empezar
            </Link>
          </div>
        )}

        {!cargando && viajes.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {viajes.map((v) => (
              <div
                key={v.id}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-marca-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15.5px] font-extrabold text-slate-900 dark:text-slate-100">
                    {v.ciudad?.nombre}
                  </div>
                  <div className="truncate text-[12.5px] text-slate-500 dark:text-slate-400">
                    {v.ciudad?.pais}
                    {v.fechaInicio && v.fechaFin
                      ? ` · ${new Date(v.fechaInicio + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" })}–${new Date(v.fechaFin + "T00:00:00").toLocaleDateString(lang, { day: "numeric", month: "short" })}`
                      : ` · ${v.dias} días`}
                  </div>
                </div>
                <button
                  onClick={() => reabrir(v)}
                  className="shrink-0 rounded-md bg-marca-700 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-marca-800"
                >
                  Abrir
                </button>
                <button
                  onClick={() => eliminar(v.id)}
                  aria-label="Eliminar viaje"
                  title="Eliminar viaje"
                  className="flex shrink-0 items-center rounded-md px-2 py-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-900/20"
                >
                  <Icono nombre="x" size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
