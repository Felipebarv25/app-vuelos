"use client";
// Una PROPUESTA DE VIAJE. No un vuelo, no una ciudad: un viaje entero.
//
// LO QUE TIENE QUE CONTESTAR DE UN VISTAZO
//
//   que viaje es          bandera, region, ruta completa
//   cuanto dura           dias repartidos, y si faltan, cuantos
//   cuanto cuesta         desglose por partida y total en TU moneda
//   si te alcanza         verde/ambar/rojo con el motivo, no solo el color
//   por que esta aqui     las razones, en palabras
//   cuanto fiarte         de donde sale cada cifra
//
// LA LINEA DE PROCEDENCIA NO ES UN ADORNO
//
// Un total que suma un vuelo consultado de verdad, un tren con tarifa curada
// y un alojamiento estimado NO es un precio: es una mezcla. Presentarlo como
// un numero limpio seria mentir por omision, asi que la tarjeta dice de que
// esta hecho. Y la barra de confianza mide eso —cuanto se apoya en datos—,
// que es cosa distinta de la compatibilidad, que mide si te encaja.

import { useState } from "react";
import Bandera from "./Bandera";
import { Icono } from "./Icono";
import { useApp } from "@/lib/AppContext";

function money(v, cod) {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  const simbolo = cod === "COP" ? "$" : cod === "EUR" ? "€" : cod === "GBP" ? "£" : cod === "USD" ? "US$" : `${cod} `;
  return `${simbolo}${Number(v).toLocaleString(cod === "COP" ? "es-CO" : "en-US", { maximumFractionDigits: 0 })}`;
}

const SEMAFORO = {
  dentro: { emoji: "🟢", clave: "propSemDentro", clase: "bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-200 dark:ring-emerald-900" },
  cerca: { emoji: "🟡", clave: "propSemCerca", clase: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:ring-amber-900" },
  supera: { emoji: "🔴", clave: "propSemSupera", clase: "bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-200 dark:ring-rose-900" },
  "sin-presupuesto": { emoji: "⚪", clave: "propSemSinPresupuesto", clase: "bg-slate-50 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700" },
};

// Las regiones y las categorias de gusto ya son claves en el dato; aqui solo
// se les pone nombre. La razon de por que se propone un viaje llega tambien
// como codigo desde lib/propuestasViaje, para poder redactarla en el idioma
// del viajero sin que el motor tenga que saber cual es.
const REGION = { todas: "regionTodas", sudamerica: "regionSudamerica", norteamerica: "regionNorteamerica", europa: "regionEuropa", asia: "regionAsia", africa: "regionAfrica", oceania: "regionOceania" };
const CULPABLE = { vuelo: "propCulpableVuelo", alojamiento: "propCulpableAlojamiento", saltos: "propCulpableSaltos", comida: "propCulpableComida" };
const RAZON = { margen: "propRazonMargen", dias: "propRazonDias", ciudades: "propRazonCiudades", intereses: "propRazonIntereses" };
const INTERES = { ciudad: "interesCiudad", historia: "interesHistoria", gastronomia: "interesGastronomia", playa: "interesPlaya", naturaleza: "interesNaturaleza", montana: "interesMontana", aventura: "interesAventura", nocturna: "interesNocturna", romantico: "interesRomantico", economico: "interesEconomico" };

export default function PropuestaViaje({ propuesta: p, onConstruir, construyendo = false }) {
  const { t } = useApp();
  const [abierto, setAbierto] = useState(false);
  const sem = SEMAFORO[p.presupuesto?.estado] || SEMAFORO["sin-presupuesto"];
  const cod = p.monedaVista || "USD";
  const total = p.totalVista ?? p.totalUsd;
  const codTotal = p.totalVista != null ? cod : "USD";
  const faltanDias = Math.max(0, (p.diasPedidos || 0) - p.diasTotales);
  const d = p.desgloseVista || p.desglose;
  const codD = p.desgloseVista ? cod : "USD";
  // Vida diaria = comida + extras. Separarlas en la tarjeta es ruido; el
  // desglose fino ya vive en el presupuesto del viaje.
  const vidaDiaria = (d.comida || 0) + (d.extras || 0);

  // "Porque deja margen y cubre los 12 dias que pediste": la frase se arma
  // aqui a partir de los codigos, no llega hecha del servidor.
  const razones = (p.razonesCodigos?.length ? p.razonesCodigos : null)
    ?.map((r) => {
      const clave = RAZON[r.codigo];
      if (!clave) return null;
      if (r.codigo === "intereses") {
        const lista = (r.vars?.intereses || []).map((i) => (INTERES[i] ? t(INTERES[i]).toLowerCase() : i));
        return t(clave, { intereses: lista.join(t("propRazonUnion")) });
      }
      return t(clave, r.vars);
    })
    .filter(Boolean);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-marca-300 dark:border-slate-700 dark:bg-slate-800">
      <div className="p-4 sm:p-5">
        {/* Cabecera: donde y cuanto dura */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {[...new Set(p.ciudades.map((c) => c.iso))].filter(Boolean).slice(0, 5).map((iso) => (
                <Bandera key={iso} cc={String(iso).toLowerCase()} size={18} />
              ))}
              <span className="ml-1 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{REGION[p.region] ? t(REGION[p.region]) : p.regionNombre}</span>
            </div>
            <h3 className="mt-1.5 text-[17px] font-black leading-tight text-slate-900 dark:text-white sm:text-[19px]">
              {t(p.ciudades.length === 1 ? "propCiudadUna" : "propCiudadVarias", { n: p.ciudades.length })} · {t(p.diasTotales === 1 ? "propDiaUno" : "propDiaVarios", { n: p.diasTotales })}
            </h3>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("propCompatibilidad")}</div>
            <div className="text-[22px] font-black leading-none text-marca-700 dark:text-marca-300">{p.compatibilidad}<span className="text-[12px] font-bold text-slate-400">/100</span></div>
          </div>
        </div>

        {/* La ruta, que es de lo que va la propuesta */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {p.ciudades.map((c, i) => (
            <span key={`${c.ciudad}-${i}`} className="flex items-center gap-1.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                {c.ciudad}
                {c.dias > 0 && <span className="ml-1 text-[10.5px] text-slate-400">{c.dias}d</span>}
              </span>
              {i < p.ciudades.length - 1 && <span className="text-slate-300 dark:text-slate-600">→</span>}
            </span>
          ))}
        </div>

        {faltanDias > 0 && (
          <p className="mt-2.5 rounded-xl bg-amber-50 px-3 py-2 text-[11.5px] font-semibold text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {t("propFaltanDias", { hay: p.diasTotales, pedidos: p.diasPedidos, pedidos2: p.diasPedidos, v: money(p.necesarioVista ?? p.necesarioParaDiasPedidos, p.necesarioVista != null ? cod : "USD") })}
          </p>
        )}

        {/* Desglose: un viaje completo, no un billete */}
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-4">
          <Linea icono="plane" etiqueta={t("propVuelo")} valor={money(d.vueloIntl, codD)} />
          <Linea icono="bed" etiqueta={t("propAlojamiento")} valor={money(d.hospedaje, codD)} />
          <Linea icono="route" etiqueta={t("propTransporte")} valor={money((d.saltos || 0) + (d.transporte || 0), codD)} />
          <Linea icono="utensils" etiqueta={t("propVidaDiaria")} valor={money(vidaDiaria, codD)} />
        </div>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-slate-100 pt-3 dark:border-slate-700">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("propTotalEstimado")}</div>
            <div className="text-[24px] font-black leading-none text-slate-900 dark:text-white">{money(total, codTotal)}</div>
          </div>
          <span className={`rounded-full px-3 py-1.5 text-[11.5px] font-bold ring-1 ${sem.clase}`}>
            {sem.emoji} {t(sem.clave)}
          </span>
        </div>

        {p.presupuesto?.estado === "dentro" && p.presupuesto.diferencia < 0 && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("propTeSobran", { v: money(p.presupuesto.diferenciaVista ?? Math.abs(p.presupuesto.diferencia), p.presupuesto.diferenciaVista != null ? cod : "USD") })}
          </p>
        )}
        {(p.presupuesto?.estado === "cerca" || p.presupuesto?.estado === "supera") && (
          <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
            {t("propSePasa", { v: money(p.presupuesto.diferenciaVista ?? p.presupuesto.diferencia, p.presupuesto.diferenciaVista != null ? cod : "USD") })}
            {p.presupuesto.culpable ? t("propSePasaPor", { culpable: CULPABLE[p.presupuesto.culpableCodigo] ? t(CULPABLE[p.presupuesto.culpableCodigo]) : p.presupuesto.culpable }) : null}.
          </p>
        )}

        {/* Por que te lo enseñamos: la personalizacion no puede ser una caja negra */}
        {p.razones?.length > 0 && (
          <div className="mt-3 rounded-xl bg-marca-50 px-3 py-2.5 dark:bg-marca-900/20">
            <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-marca-700 dark:text-marca-300">{t("propPorQue")}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-marca-900/80 dark:text-marca-100/80">
              {t("propPorque", { razones: (razones?.length ? razones : p.razones).join(", ") })}
            </p>
          </div>
        )}

        {/* Confianza: de que esta hecho el numero de arriba */}
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="mt-3 flex w-full items-center gap-2 text-left"
          aria-expanded={abierto}
        >
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <span
              className={`block h-full rounded-full ${p.confianza >= 70 ? "bg-emerald-500" : p.confianza >= 45 ? "bg-amber-400" : "bg-slate-400"}`}
              style={{ width: `${p.confianza}%` }}
            />
          </span>
          <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            {t("propConfianza", { n: p.confianza })}
          </span>
          <Icono nombre="chevronDown" size={14} className={`shrink-0 text-slate-400 transition ${abierto ? "rotate-180" : ""}`} />
        </button>

        {abierto && (
          <ul className="mt-2 space-y-1 text-[11.5px] text-slate-600 dark:text-slate-300">
            <li>
              ✈️ {t("propFteVuelo")}{" "}
              <b className={p.fuentes.vuelo === "real" ? "text-emerald-600" : "text-amber-600"}>
                {t(p.fuentes.vuelo === "real" ? "propFteVueloReal" : "propFteVueloEstimado")}
              </b>
            </li>
            <li>
              🚆 {t("propFteTraslados")}{" "}
              <b className="text-sky-600">{t("propFteCurados", { n: p.fuentes.tramosCurados })}</b>
              {p.fuentes.tramosAprox > 0 && <> · <b className="text-amber-600">{t("propFteAprox", { n: p.fuentes.tramosAprox })}</b></>}
            </li>
            <li>🏨 {t("propFteEstancia")} <b className="text-amber-600">{t("propFteEstimacion")}</b> {t("propFteEstanciaFin")}</li>
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={() => onConstruir?.(p)}
        disabled={construyendo}
        className="flex w-full items-center justify-center gap-2 bg-marca-700 px-4 py-3.5 text-[13px] font-extrabold text-white transition hover:bg-marca-800 disabled:opacity-60"
      >
        {construyendo ? t("propCreando") : t("propConstruir")}
        {!construyendo && <Icono nombre="arrowRight" size={16} />}
      </button>
    </article>
  );
}

function Linea({ icono, etiqueta, valor }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400"><Icono nombre={icono} size={13} /></span>
      <span className="min-w-0 flex-1 truncate text-slate-500 dark:text-slate-400">{etiqueta}</span>
      <b className="shrink-0 text-slate-800 dark:text-slate-100">{valor}</b>
    </div>
  );
}
