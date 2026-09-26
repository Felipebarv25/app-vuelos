"use client";
// "¿Qué sigue?" — el viaje como algo que hay que ejecutar.
//
// QUE CONTESTA, EN ESTE ORDEN
//
//   1. en que punto esta mi viaje
//   2. que me falta, en numeros
//   3. que hago AHORA
//
// Y nada mas arriba del todo. El resto del tablero —precios, tramos, mapa,
// inteligencia— sigue donde estaba; esto va delante porque es lo unico que
// pide una accion.
//
// POR QUE SOLO CINCO PASOS
//
// Una lista de veinte tareas no es un plan, es una excusa para no empezar. El
// motor las ordena por lo que de verdad desbloquea el viaje y aqui se enseñan
// las primeras; el resto esta a un clic.
//
// LO QUE ESTE PANEL NO HACE
//
// No reserva nada, y no finge que lo hizo. Marcar una casilla guarda que TU ya
// lo hiciste, no que Anduve lo haya gestionado; se dice con todas las letras
// en la propia tarjeta. Donde no hay proveedor real detras, no hay boton:
// un boton que no lleva a ningun sitio miente igual que un precio inventado.

import { useState } from "react";
import { Icono } from "@/components/Icono";
import { useApp } from "@/lib/AppContext";
import { resumenPorTipo } from "@/lib/ejecutorViaje";

const ESTADO_VIAJE = {
  borrador: { clave: "ejEstadoBorrador", punto: "⚪", clase: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
  planificado: { clave: "ejEstadoPlanificado", punto: "🟢", clase: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" },
  listo_para_reservar: { clave: "ejEstadoListoReservar", punto: "🟢", clase: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" },
  parcialmente_reservado: { clave: "ejEstadoParcial", punto: "🟡", clase: "bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200" },
  listo_para_viajar: { clave: "ejEstadoListoViajar", punto: "🟢", clase: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200" },
  en_viaje: { clave: "ejEstadoEnViaje", punto: "✈️", clase: "bg-sky-50 text-sky-900 dark:bg-sky-950/30 dark:text-sky-200" },
  finalizado: { clave: "ejEstadoFinalizado", punto: "🏁", clase: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
};

const ESTADO_TAREA = {
  pendiente: "ejEstPendiente", elegido: "ejEstElegido", listo_para_reservar: "ejEstListoReservar",
  reservado: "ejEstReservado", confirmado: "ejEstConfirmado", completado: "ejEstCompletado",
  no_disponible: "ejEstNoDisponible", no_aplica: "ejEstNoAplica",
};

const TIPO = { vuelo: "ejTipoVuelo", transporte: "ejTipoTransporte", alojamiento: "ejTipoAlojamiento", requisito: "ejTipoRequisito", servicio: "ejTipoServicio", dato: "ejTipoDato" };
const ICONO_TIPO = { vuelo: "plane", transporte: "route", alojamiento: "bed", requisito: "shield", servicio: "compass", dato: "calendar" };

// La confianza del DATO que sostiene la tarea, separada de su estado. Es la
// misma escala del Proceso 3: no se oculta la incertidumbre.
const CONFIANZA = {
  detectado: { punto: "🟢", clave: "iaFuenteDetectado" },
  vivo: { punto: "🟢", clave: "iaFuenteVivo" },
  incluido: { punto: "🟢", clave: "mvFuenteIncluido" },
  curado: { punto: "🟡", clave: "iaFuenteCurado" },
  estimado: { punto: "🟠", clave: "iaFuenteEstimado" },
  sin_dato: { punto: "⚪", clave: "iaFuenteNinguno" },
  "sin-datos": { punto: "⚪", clave: "iaFuenteNinguno" },
};

const BORDE = { alta: "border-rose-200 dark:border-rose-900/60", media: "border-amber-200 dark:border-amber-900/60", baja: "border-slate-200 dark:border-slate-700" };

function Tarea({ tarea, t, onEstado, guardando, puedeGuardar }) {
  const c = CONFIANZA[tarea.confianza] || CONFIANZA.sin_dato;
  const listo = !tarea.requiereAccion;
  // Una reserva solo tiene sentido donde hay algo que reservar. Un dato del
  // viaje o un requisito se hacen, no se reservan.
  const reservable = ["vuelo", "alojamiento", "servicio"].includes(tarea.tipo);

  return (
    <li className={`rounded-2xl border bg-white p-3.5 dark:bg-slate-800 ${listo ? "border-emerald-200 dark:border-emerald-900/60" : BORDE[tarea.prioridad] || BORDE.baja}`}>
      <div className="flex items-start gap-3">
        <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${listo ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300"}`}>
          <Icono nombre={ICONO_TIPO[tarea.tipo] || "compass"} size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <div className={`text-[13.5px] font-extrabold leading-snug ${listo ? "text-slate-400 line-through dark:text-slate-500" : "text-slate-900 dark:text-white"}`}>
            {t(tarea.clave, tarea.vars)}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px]">
            <span className={`font-bold ${listo ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}>
              {t(ESTADO_TAREA[tarea.estado] || "ejEstPendiente")}
            </span>
            <span className="text-slate-400">{c.punto} {t(c.clave)}</span>
            {tarea.fechaLimite && <span className="text-slate-400">· {t("ejAntesDe", { fecha: tarea.fechaLimite })}</span>}
          </div>

          {/* Donde no hay proveedor, se dice; no se pinta un boton falso. */}
          {tarea.tipo === "servicio" && !listo && (
            <p className="mt-1.5 text-[10.5px] leading-relaxed text-slate-400">{t("ejSinProveedor")}</p>
          )}
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-11">
        {tarea.enlace && (
          <a href={tarea.enlace} className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:border-marca-300 dark:border-slate-600 dark:text-slate-200">
            {tarea.tipo === "requisito" ? t("ejVerRequisito") : t("ejIrARuta")}
          </a>
        )}
        {tarea.origen?.tipo === "tramo" && (
          <a href="#transporte" className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:border-marca-300 dark:border-slate-600 dark:text-slate-200">
            {t("ejVerTransporte")}
          </a>
        )}
        {puedeGuardar && !listo && (
          <>
            {reservable && (
              <button type="button" disabled={guardando} onClick={() => onEstado(tarea.id, "reservado")}
                className="rounded-full bg-marca-700 px-3 py-1.5 text-[11px] font-extrabold text-white hover:bg-marca-800 disabled:opacity-60">
                {t("ejMarcarReservado")}
              </button>
            )}
            <button type="button" disabled={guardando} onClick={() => onEstado(tarea.id, "completado")}
              className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-300">
              {t("ejMarcarHecho")}
            </button>
          </>
        )}
        {puedeGuardar && listo && tarea.estado !== "elegido" && (
          <button type="button" disabled={guardando} onClick={() => onEstado(tarea.id, "pendiente")}
            className="rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:text-slate-400">
            {t("ejDeshacer")}
          </button>
        )}
      </div>
    </li>
  );
}

export default function QueSigue({ plan, onEstado, guardando = false, puedeGuardar = true, error = "" }) {
  const { t } = useApp();
  const [todas, setTodas] = useState(false);
  if (!plan || !plan.tareas.length) return null;

  const est = ESTADO_VIAJE[plan.estadoViaje] || ESTADO_VIAJE.planificado;
  const { criticas, pendientes, listas, total } = plan.resumen;
  const lista = todas ? plan.tareas : plan.proximos;
  const porTipo = resumenPorTipo(plan.tareas);

  return (
    <section id="que-sigue" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">{t("ejQueSigue")}</div>
          <h3 className="mt-1 text-[19px] font-black tracking-tight text-slate-900 dark:text-white">
            {plan.todoListo ? t("ejTodoListo") : t("ejProximosPasos")}
          </h3>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11.5px] font-bold ${est.clase}`}>{est.punto} {t(est.clave)}</span>
      </div>

      {/* QUE ME FALTA, en numeros y sin adornos. */}
      {!plan.todoListo && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px]">
          <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("ejTeFalta")}</span>
          {criticas > 0 && <span className="font-bold text-rose-700 dark:text-rose-300">🔴 {t(criticas === 1 ? "ejCriticasUna" : "ejCriticasVarias", { n: criticas })}</span>}
          {pendientes > 0 && <span className="font-bold text-amber-700 dark:text-amber-300">🟡 {t(pendientes === 1 ? "ejPendientesUna" : "ejPendientesVarias", { n: pendientes })}</span>}
          {listas > 0 && <span className="font-semibold text-emerald-700 dark:text-emerald-300">🟢 {t(listas === 1 ? "ejListasUna" : "ejListasVarias", { n: listas })}</span>}
        </div>
      )}

      {plan.todoListo ? (
        <>
          <p className="mt-3 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{t("ejTodoListoSub")}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {porTipo.map((x) => (
              <li key={x.tipo} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] font-bold text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
                ✓ {t(TIPO[x.tipo])} <span className="ml-auto text-[11px] font-semibold opacity-70">{x.listas}/{x.total}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <ol className="mt-4 space-y-2.5">
          {lista.map((tarea) => (
            <Tarea key={tarea.id} tarea={tarea} t={t} onEstado={onEstado} guardando={guardando} puedeGuardar={puedeGuardar} />
          ))}
        </ol>
      )}

      {!plan.todoListo && total > plan.proximos.length && (
        <button type="button" onClick={() => setTodas((v) => !v)}
          className="mt-3 text-[12px] font-bold text-marca-700 hover:underline dark:text-marca-300">
          {todas ? t("ejVerMenos") : t("ejVerTodas", { n: total })}
        </button>
      )}

      {puedeGuardar
        ? <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">{t("ejNoReservamos")}</p>
        : <p className="mt-3 text-[10.5px] leading-relaxed text-slate-400">{t("ejSoloGuardados")}</p>}
      {error && <p className="mt-2 text-[11.5px] font-semibold text-red-600">{t(error)}</p>}

      {/* EL CRONOGRAMA. Las fases son dependencias reales, no fechas
          inventadas: solo el final lleva fecha, y solo si el viajero la puso. */}
      {plan.cronograma.fases.length > 1 && (
        <div className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-700">
          <div className="flex min-w-0 items-stretch gap-1.5 overflow-x-auto pb-1">
            {plan.cronograma.fases.map((f) => {
              const completa = f.listas === f.total;
              return (
                <div key={f.id} className={`min-w-[104px] flex-1 rounded-xl px-3 py-2 ${completa ? "bg-emerald-50 dark:bg-emerald-950/20" : "bg-slate-50 dark:bg-slate-700/40"}`}>
                  <div className={`text-[10.5px] font-black uppercase tracking-wide ${completa ? "text-emerald-700 dark:text-emerald-300" : "text-slate-500 dark:text-slate-300"}`}>{t(f.clave)}</div>
                  <div className="mt-0.5 text-[11px] font-semibold text-slate-400">{f.listas}/{f.total}</div>
                </div>
              );
            })}
            <div className="min-w-[104px] flex-1 rounded-xl bg-marca-50 px-3 py-2 dark:bg-marca-900/20">
              <div className="text-[10.5px] font-black uppercase tracking-wide text-marca-700 dark:text-marca-300">{t("ejFaseViaje")}</div>
              <div className="mt-0.5 text-[11px] font-semibold text-slate-400">{plan.cronograma.fechaViaje || "—"}</div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
