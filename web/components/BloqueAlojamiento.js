"use client";
// DONDE VAS A DORMIR.
//
// El presupuesto ya contaba el alojamiento, pero sumado y escondido dentro de
// "alojamiento y vida diaria". El viajero no puede hacer nada con un total:
// para decidir necesita verlo ciudad por ciudad —cuantas noches, cuanto sale,
// de donde sale esa cifra.
//
// LO QUE ESTA PANTALLA NO ES
//
// No es un buscador de hoteles y no finge serlo. La cifra es el COSTE DE VIDA
// estimado de la ciudad (lib/rutaViva), no una tarifa: se dice en la cabecera
// y se marca la fuente en cada fila. Cuando el dato sale de la mediana del
// pais y no de la ciudad, tambien se dice.
//
// No hay boton de "reservar" porque no hay nada detras. Lo unico que se puede
// hacer es marcar que ya lo tienes resuelto, y eso se guarda como lo que es:
// algo que hiciste tu.

import { Icono } from "@/components/Icono";
import { useApp } from "@/lib/AppContext";

export default function BloqueAlojamiento({ estadia = [], tareas = [], onEstado, guardando = false, puedeGuardar = true, money }) {
  const { t } = useApp();
  if (!estadia.length) return null;

  const porCiudad = new Map(tareas.filter((x) => x.tipo === "alojamiento").map((x) => [x.datos?.ciudad, x]));

  return (
    <div id="alojamiento" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("mvBlqAlojamiento")}</div>
      <h3 className="mt-1 text-[17px] font-extrabold text-slate-900 dark:text-white">{t("ejAlojTitulo")}</h3>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{t("ejAlojSub")}</p>

      <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
        {estadia.map((e) => {
          const tarea = porCiudad.get(e.ciudad);
          const listo = tarea && !tarea.requiereAccion;
          return (
            <div key={e.ciudad} className="flex flex-col gap-2 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={listo ? "text-emerald-600" : "text-slate-400"}><Icono nombre="bed" size={15} /></span>
                  <span className="truncate text-[13.5px] font-extrabold text-slate-800 dark:text-slate-100">{e.ciudad}</span>
                  {listo && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9.5px] font-black text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">{t("ejEstCompletado")}</span>}
                </div>
                <div className="mt-0.5 pl-7 text-[11px] text-slate-500 dark:text-slate-400">
                  {t(e.noches === 1 ? "mvNocheUna" : "mvNocheVarias", { n: e.noches })}
                  {e.diarioUsd ? <> · {t("ejAlojPorNoche", { v: money(e.diarioUsd) })}</> : null}
                  {" · "}
                  <span className={e.fuente === "ciudad" ? "text-sky-600" : "text-amber-600"}>
                    {e.fuente === "ciudad" ? t("iaFuenteCurado") : t("iaFuenteEstimado")}
                  </span>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-3 pl-7 sm:pl-0">
                <div className="sm:text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{t("ejAlojEstimado")}</div>
                  <div className="text-[14px] font-black text-slate-900 dark:text-white">{money(e.totalUsd)}</div>
                </div>
                {puedeGuardar && tarea && (
                  <button
                    type="button"
                    disabled={guardando}
                    onClick={() => onEstado(tarea.id, listo ? "pendiente" : "completado")}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold disabled:opacity-60 ${listo ? "border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-400" : "border border-slate-200 text-slate-700 hover:border-marca-300 dark:border-slate-600 dark:text-slate-200"}`}
                  >
                    {listo ? t("ejDeshacer") : t("ejAlojMarcar")}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
