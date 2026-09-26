"use client";
// "CAMBIOS IMPORTANTES" — lo que se movio desde la ultima vez que miraste.
//
// LO QUE ESTE PANEL NO ES
//
// No es una bandeja de notificaciones. Una bandeja acumula todo lo que pasa;
// esto solo enseña lo que CAMBIO y ademas importa. Si el precio se consulto y
// sigue igual, aqui no aparece nada: eso es un log, no una noticia.
//
// Y CUANDO NO HAY NADA, SE DICE EN UNA LINEA
//
// Un bloque vacio y enorme diciendo "sin novedades" ocupa el mejor sitio de la
// pantalla para no decir nada. Cuando todo esta al dia, esto es una linea.
//
// CADA ALERTA DICE DE DONDE SALE
//
// Un precio consultado en vivo y una estimacion no sostienen el mismo consejo.
// La etiqueta de fuente va en la propia tarjeta, con la misma escala del resto
// de la app, y las de precio ademas dicen si el dato es de la fecha exacta o
// del mes: son dos promesas distintas.

import { Icono } from "@/components/Icono";
import { useApp } from "@/lib/AppContext";

const NIVEL = {
  importante: { punto: "🔴", clase: "border-rose-200 bg-rose-50 dark:border-rose-900/60 dark:bg-rose-950/20", clave: "alNivelImportante" },
  atencion: { punto: "🟡", clase: "border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/20", clave: "alNivelAtencion" },
  info: { punto: "🔵", clase: "border-sky-200 bg-sky-50 dark:border-sky-900/60 dark:bg-sky-950/20", clave: "alNivelInfo" },
};

const ICONO = { precio: "plane", coste: "wallet", transporte: "route", tarea: "calendar" };

// El tipo de accion -> su etiqueta. Un mapa explicito y no una clave armada
// con plantilla: las claves del diccionario son identificadores de JS y
// `alAccion_ver-transporte` ni siquiera compila.
const ACCION = {
  "ver-transporte": "alAccionVerTramo",
  "ver-presupuesto": "alAccionVerPresupuesto",
  "resolver-tarea": "alAccionResolver",
  "ver-requisito": "alAccionVerRequisito",
};

const FUENTE = {
  vivo: "iaFuenteVivo", detectado: "iaFuenteDetectado", curado: "iaFuenteCurado",
  estimado: "iaFuenteEstimado", historico: "opEtqHistorico", sin_dato: "iaFuenteNinguno", "sin-datos": "iaFuenteNinguno",
};

/** El texto de cada alerta, por tipo. Un switch corto se lee mejor que magia. */
export function textoAlerta(a, t, money) {
  const d = a.datos || {};
  if (a.tipo === "precio") {
    return {
      titulo: t(d.baja ? "alPrecioBaja" : "alPrecioSube", { desde: a.vars?.desde, hasta: a.vars?.hasta, v: money(Math.abs(d.diferencia)) }),
      detalle: t("alPrecioDetalle", { antes: money(d.anterior), ahora: money(d.actual), pct: Math.abs(d.pct) }),
      // No se mezcla "precio para tu fecha" con "mejor precio del mes".
      matiz: t(d.de === "fecha" ? "alPrecioDeFecha" : "alPrecioDeMes"),
    };
  }
  if (a.tipo === "coste") {
    return {
      titulo: t(d.sube ? "alCosteSube" : "alCosteBaja", { v: money(Math.abs(d.diferencia)) }),
      detalle: t("alCosteDetalle", { antes: money(d.anterior), ahora: money(d.actual), pct: Math.abs(d.pct) }),
      matiz: t("alCosteMatiz"),
    };
  }
  if (a.tipo === "transporte") {
    return {
      titulo: t("alTransporte", { desde: a.vars?.desde, hasta: a.vars?.hasta }),
      detalle: t("alTransporteDetalle", { antes: t(`iaMedio${cap(d.antes)}`), ahora: t(`iaMedio${cap(d.ahora)}`) }),
      matiz: null,
    };
  }
  // Tarea: el titulo lo escribio el motor de ejecucion, con su clave propia.
  return {
    titulo: t("alTarea", { dias: d.dias }),
    detalle: d.tareaClave ? t(d.tareaClave, d.tareaVars) : a.vars?.tarea,
    matiz: null,
  };
}

function cap(x) { const s = String(x || ""); return s.charAt(0).toUpperCase() + s.slice(1); }

export default function CambiosViaje({ alertas = [], resumen, onLeer, onResolver, money, compacto = false }) {
  const { t } = useApp();
  const activas = alertas.filter((a) => a.estado === "activa");

  // Todo al dia: una linea, no un bloque.
  if (!activas.length) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12.5px] font-bold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200">
        <Icono nombre="check" size={14} /> {t("alTodoAlDia")}
      </div>
    );
  }

  const lista = compacto ? activas.slice(0, 3) : activas;

  return (
    <section id="cambios" className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("alEyebrow")}</div>
          <h3 className="mt-1 text-[17px] font-extrabold text-slate-900 dark:text-white">{t("alTitulo")}</h3>
        </div>
        {resumen?.sinLeer > 0 && (
          <button type="button" onClick={onLeer ? () => onLeer(null) : undefined}
            className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300">
            {t("alMarcarLeidas", { n: resumen.sinLeer })}
          </button>
        )}
      </div>

      <ul className="mt-4 space-y-2.5">
        {lista.map((a) => {
          const nv = NIVEL[a.nivel] || NIVEL.info;
          const txt = textoAlerta(a, t, money);
          return (
            <li key={a.id} className={`rounded-2xl border p-3.5 ${nv.clase} ${a.leida ? "opacity-70" : ""}`}>
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/70 text-slate-600 dark:bg-black/20 dark:text-slate-300">
                  <Icono nombre={ICONO[a.tipo] || "compass"} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-extrabold leading-snug text-slate-900 dark:text-white">
                    {nv.punto} {txt.titulo}
                  </div>
                  {txt.detalle && <p className="mt-1 text-[12px] leading-relaxed text-slate-600 dark:text-slate-300">{txt.detalle}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-500 dark:text-slate-400">
                    <span className="font-semibold">{t(FUENTE[a.fuente] || "iaFuenteNinguno")}</span>
                    {txt.matiz && <span>· {txt.matiz}</span>}
                    <span>· {t("alHace", { cuando: hace(a.detectadoEn, t) })}</span>
                  </div>

                  {/* Cada alerta lleva a donde se actua. Ninguna lleva a un boton
                      que no hace nada: si no hay accion real, no hay boton. */}
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {a.accion?.href && (
                      <a href={a.accion.href} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 hover:ring-marca-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600">
                        {t(ACCION[a.accion.tipo] || "alAccionResolver")}
                      </a>
                    )}
                    {a.accion?.ancla && (
                      <a href={a.accion.ancla} className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 ring-1 ring-slate-200 hover:ring-marca-300 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600">
                        {t(ACCION[a.accion.tipo] || "alAccionResolver")}
                      </a>
                    )}
                    {onResolver && (
                      <button type="button" onClick={() => onResolver(a.id)}
                        className="rounded-full px-3 py-1.5 text-[11px] font-bold text-slate-500 hover:underline dark:text-slate-400">
                        {t("alDescartar")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {compacto && activas.length > lista.length && (
        <a href="/alertas" className="mt-3 inline-block text-[12px] font-bold text-marca-700 hover:underline dark:text-marca-300">
          {t("alVerTodas", { n: activas.length })} →
        </a>
      )}
    </section>
  );
}

function hace(ts, t) {
  const ms = Date.now() - Number(ts || 0);
  const h = Math.floor(ms / 3600000);
  if (h < 1) return t("alAhoraMismo");
  if (h === 1) return t("alHaceUnaHora");
  if (h < 24) return t("alHaceHoras", { n: h });
  const d = Math.floor(h / 24);
  return d === 1 ? t("alHaceUnDia") : t("alHaceDias", { n: d });
}
