"use client";
// "AQUI PUEDES HACERLO."
//
// Cierra la frase que el resto del tablero empieza: esto es lo que decidiste,
// esto es lo que te falta, y aqui esta el sitio donde se hace. Ni un paso mas:
// Anduve no cobra, no reserva y no promete disponibilidad.
//
// LA RECOMENDACION VA ANTES QUE LA ACCION
//
// Cada fila dice primero QUE hacer y con que dato se sostiene; el boton viene
// detras y en gris. Si esto se lee como un escaparate de "oferta, oferta,
// oferta", esta mal hecho aunque funcione.
//
// SIN PROVEEDOR NO HAY BOTON
//
// Una accion sin url se pinta igual, con su frase, pero sin nada que pulsar.
// Es preferible decir "busca alojamiento cuando quieras reservar" que fabricar
// un enlace que no lleva a ninguna parte.
//
// ABRIR UN PROVEEDOR NO ES RESERVAR
//
// Pulsar no cambia la ruta, ni las noches, ni el presupuesto, ni el estado del
// viaje. El unico que puede decir "esto ya lo reserve" es el viajero, y para
// eso esta el formulario de al lado, que guarda lo que EL aporta.

import { useState } from "react";
import { Icono } from "@/components/Icono";
import { useApp } from "@/lib/AppContext";
import { track } from "@/lib/track";
import { hayAccionAfiliada } from "@/lib/accionesViaje";

const ICONO = { vuelo: "plane", alojamiento: "bed", transporte: "route", requisito: "shield", servicio: "compass" };

// La fuente del dato que acompaña a la accion, con la escala de siempre.
const FUENTE = {
  oferta: { punto: "🟢", clave: "acFuenteOferta" },
  vivo: { punto: "🟢", clave: "iaFuenteVivo" },
  detectado: { punto: "🟢", clave: "iaFuenteDetectado" },
  curado: { punto: "🟡", clave: "iaFuenteCurado" },
  estimado: { punto: "🟠", clave: "iaFuenteEstimado" },
  sin_dato: { punto: "⚪", clave: "iaFuenteNinguno" },
  "sin-datos": { punto: "⚪", clave: "iaFuenteNinguno" },
};

// Que texto lleva el boton segun lo que hay detras.
const ETIQUETA = {
  vuelo: "acVerDisponibilidad", alojamiento: "acBuscarAlojamiento",
  transporte: "acVerOpciones", requisito: "acRevisar", servicio: "acVerOpciones",
};

function Reserva({ accion, reserva, onGuardar, onBorrar, t }) {
  const [abierto, setAbierto] = useState(false);
  const [proveedor, setProveedor] = useState(reserva?.proveedor || accion.proveedor || "");
  const [referencia, setReferencia] = useState(reserva?.referencia || "");
  const [fecha, setFecha] = useState(reserva?.fecha || "");

  if (reserva) {
    return (
      <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200">
        <span className="font-bold">✓ {t("acReservado")}</span>
        {reserva.proveedor ? <> · {reserva.proveedor}</> : null}
        {reserva.referencia ? <> · {reserva.referencia}</> : null}
        {reserva.fecha ? <> · {reserva.fecha}</> : null}
        <button type="button" onClick={() => onBorrar(accion.id)} className="ml-2 inline-flex min-h-[32px] items-center px-1 font-bold underline-offset-2 hover:underline">
          {t("acBorrarReserva")}
        </button>
      </div>
    );
  }

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)}
        className="mt-2 inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-4 text-[11.5px] font-bold text-slate-600 hover:bg-slate-50 sm:min-h-[32px] sm:px-3 dark:border-slate-600 dark:text-slate-300">
        {t("acMarcarReservado")}
      </button>
    );
  }

  return (
    <form
      className="mt-2 flex flex-col gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-700/40"
      onSubmit={(e) => { e.preventDefault(); onGuardar(accion.id, { proveedor, referencia, fecha }); setAbierto(false); }}
    >
      <p className="text-[10.5px] leading-relaxed text-slate-500 dark:text-slate-400">{t("acReservaNota")}</p>
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={proveedor} onChange={(e) => setProveedor(e.target.value)} maxLength={60} placeholder={t("acCampoProveedor")}
          className="min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[16px] outline-none focus:border-marca-500 sm:text-[12.5px] dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
        <input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={60} placeholder={t("acCampoReferencia")}
          className="min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[16px] outline-none focus:border-marca-500 sm:text-[12.5px] dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          className="min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-[16px] outline-none focus:border-marca-500 sm:text-[12.5px] dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="rounded-full bg-marca-700 px-3.5 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-marca-800">{t("acGuardar")}</button>
        <button type="button" onClick={() => setAbierto(false)} className="rounded-full px-3 py-1.5 text-[11.5px] font-bold text-slate-500 hover:underline">{t("acCancelar")}</button>
      </div>
    </form>
  );
}

export default function AccionesViaje({ acciones = [], reservas = {}, onReservar, onBorrarReserva, puedeGuardar = true, money }) {
  const { t } = useApp();
  if (!acciones.length) return null;

  const reservable = (tipo) => ["vuelo", "alojamiento", "servicio"].includes(tipo);

  return (
    <section id="acciones" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("acEyebrow")}</div>
      <h3 className="mt-1 text-[17px] font-extrabold text-slate-900 dark:text-white">{t("acTitulo")}</h3>
      <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">{t("acSubtitulo")}</p>

      <ol className="mt-4 divide-y divide-slate-100 dark:divide-slate-700">
        {acciones.map((a) => {
          const f = FUENTE[a.fuente] || FUENTE.sin_dato;
          const reserva = reservas?.[a.id];
          return (
            <li key={a.id} className="py-3 first:pt-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                    <Icono nombre={ICONO[a.tipo] || "compass"} size={15} />
                  </span>
                  <div className="min-w-0">
                    {/* Primero QUE, y con que dato se sostiene. */}
                    <div className="text-[13.5px] font-extrabold leading-snug text-slate-900 dark:text-white">{t(a.clave, a.vars)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                      <span>{f.punto} {t(f.clave)}</span>
                      {a.contexto?.estimadoUsd != null && money && <span>· {t("acEstimado", { v: money(a.contexto.estimadoUsd) })}</span>}
                      {a.contexto?.precioUsd != null && money && <span>· {money(a.contexto.precioUsd)}</span>}
                      {a.proveedor && <span>· {a.proveedor}</span>}
                      {/* La relacion comercial se declara donde existe, y solo ahi. */}
                      {a.afiliado && <span className="text-slate-400">· {t("acAfiliado")}</span>}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 sm:text-right">
                  {a.url ? (
                    <a
                      href={a.url}
                      target={a.url.startsWith("/") ? undefined : "_blank"}
                      rel={a.url.startsWith("/") ? undefined : "noreferrer sponsored"}
                      onClick={() => track("afiliado_clic", { cat: a.cat })}
                      className="inline-flex min-h-[40px] items-center rounded-full border border-slate-200 px-4 text-[12px] font-bold text-slate-700 hover:border-marca-300 sm:min-h-[34px] sm:px-3.5 sm:text-[11.5px] dark:border-slate-600 dark:text-slate-200"
                    >
                      {t(ETIQUETA[a.tipo] || "acVerOpciones")} ↗
                    </a>
                  ) : (
                    <span className="text-[11px] text-slate-400">{t("acSinProveedor")}</span>
                  )}
                </div>
              </div>

              {/* Lo que el viajero aporta cuando ya reservo por su cuenta. */}
              {puedeGuardar && reservable(a.tipo) && (
                <div className="pl-11">
                  <Reserva accion={a} reserva={reserva} onGuardar={onReservar} onBorrar={onBorrarReserva} t={t} />
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {hayAccionAfiliada(acciones) && (
        <p className="mt-4 text-[10.5px] leading-relaxed text-slate-400">{t("acNotaAfiliados")}</p>
      )}
    </section>
  );
}
