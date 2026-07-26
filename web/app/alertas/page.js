"use client";
// Ruta /alertas — indice de las alertas de precio del usuario.
//
// Por que existe: hasta ahora la unica forma de llegar a una alerta concreta era
// el desplegable del menu de usuario, que ademas cortaba la lista. Y el chip
// verde del home decia "tienes N alertas de precio" pero su boton llevaba a
// /ofertas, un explorador generico que no conoce las alertas del usuario. Esta
// pagina es lo que ese chip prometia: tus alertas, con el mejor precio detectado
// hoy para cada una.
//
// Los datos salen de dos sitios que ya existen:
//   - la lista de alertas, del AppContext (fuente unica, se refresca al crear,
//     borrar o editar en cualquier pantalla)
//   - el mejor precio por destino, de /historial-resumen.json, el mismo fichero
//     que consume el banner VuelosBaratos
import Link from "next/link";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import NavTop from "@/components/NavTop";
import BotonVolver from "@/components/BotonVolver";
import FooterAnduve from "@/components/FooterAnduve";
import BottomTabBar from "@/components/BottomTabBar";
import PrecioDual from "@/components/PrecioDual";
import { Icono } from "@/components/Icono";

function fmt(n) {
  return "US$ " + Math.round(n).toLocaleString("en-US");
}

function authHdrs() {
  const h = {};
  try {
    const tk = localStorage.getItem("anduve_auth_token")
            || sessionStorage.getItem("anduve_auth_token");
    if (tk) h.Authorization = `Bearer ${tk}`;
  } catch {}
  return h;
}

// Mejor precio detectado para una alerta, SOLO entre los origenes que el usuario
// guardo en ella.
//
// Sin origen guardado no se calcula nada a proposito. El fallback obvio (tomar el
// minimo de todos los origenes) da resultados que enganan: para Barcelona saldria
// US$ 83 desde Madrid y para Roma US$ 62 desde Madrid — puentes aereos europeos
// marcados como "bajo tu umbral" a alguien que sale de Colombia. Es el mismo
// error que tenia el promedio de VuelosBaratos. Mejor pedir el origen.
function mejorPrecio(alerta, resumen) {
  const origenes = alerta.origen ? alerta.origen.split(",").filter(Boolean) : [];
  if (!origenes.length) return null;
  const d = resumen?.destinos?.[alerta.iata];
  if (!d?.vuelos?.length) return null;
  const candidatos = d.vuelos.filter((v) => origenes.includes(v.origen));
  if (!candidatos.length) return null;
  return candidatos.reduce((mejor, v) => (!mejor || v.precio < mejor.precio ? v : mejor), null);
}

export default function PaginaAlertas() {
  const { t, usuario, alertas, refrescarAlertas } = useApp();
  const [resumen, setResumen] = useState(null);
  const [borrando, setBorrando] = useState(null);

  useEffect(() => {
    let vivo = true;
    fetch("/historial-resumen.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (vivo) setResumen(j); })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  async function borrar(id) {
    setBorrando(id);
    try {
      await fetch(`/api/alertas?id=${id}`, { method: "DELETE", headers: authHdrs() });
      await refrescarAlertas();
    } catch {}
    setBorrando(null);
  }

  const lista = alertas || [];

  return (
    <div className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-900 md:pb-0">
      <NavTop />
      <BotonVolver />

      <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-10">
        <div className="mb-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
            {t("alertasIdxEyebrow")}
          </div>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900 lg:text-[32px] dark:text-slate-100">
            {t("alertasIdxH1")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("alertasIdxSub")}
          </p>
        </div>

        {!usuario ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-5 py-8 text-center dark:border-slate-700 dark:bg-slate-800">
            <p className="text-[14px] font-semibold text-slate-700 dark:text-slate-200">
              {t("alertasIdxSinSesion")}
            </p>
            <Link
              href="/?login=1"
              className="mt-4 inline-flex rounded-xl bg-marca-700 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-marca-800"
            >
              {t("alertasIdxSinSesionCta")}
            </Link>
          </div>
        ) : alertas == null ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />
            ))}
          </div>
        ) : lista.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/60 px-5 py-8 text-center dark:border-amber-800/50 dark:from-amber-900/20 dark:to-amber-800/10">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/30 text-amber-800 dark:text-amber-300">
              <Icono nombre="bell" size={20} />
            </span>
            <p className="mt-3 text-[15px] font-bold text-amber-900 dark:text-amber-200">
              {t("alertasIdxVacioTit")}
            </p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-amber-800/80 dark:text-amber-300/70">
              {t("alertasIdxVacioSub")}
            </p>
            <Link
              href="/ofertas"
              className="mt-4 inline-flex rounded-xl bg-amber-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-amber-700"
            >
              {t("alertasIdxVacioCta")} →
            </Link>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {lista.map((a) => {
                const sinOrigen = !(a.origen && a.origen.split(",").filter(Boolean).length);
                const mejor = mejorPrecio(a, resumen);
                const bajoUmbral = mejor && a.umbral && mejor.precio <= a.umbral;
                const falta = mejor && a.umbral ? mejor.precio - a.umbral : null;
                return (
                  <li
                    key={a.id}
                    className={`rounded-2xl border bg-white transition hover:shadow-suave dark:bg-slate-800 ${
                      bajoUmbral
                        ? "border-emerald-300 dark:border-emerald-700"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <div className="flex flex-wrap items-start gap-x-4 gap-y-3 px-4 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/alertas/${a.id}`}
                            className="text-[16px] font-extrabold tracking-tight text-slate-900 hover:text-marca-700 dark:text-slate-100 dark:hover:text-marca-300"
                          >
                            {a.ciudad}
                          </Link>
                          {a.pais && (
                            <span className="text-[12px] text-slate-400 dark:text-slate-500">{a.pais}</span>
                          )}
                          {a.activa === false ? (
                            <span
                              title={t("menuAlertaAvisadaAyuda")}
                              className="rounded bg-slate-200 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-600 dark:text-slate-300"
                            >
                              {t("menuAlertaAvisada")}
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                              {t("alertasIdxVigilando")}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">
                          {t("alertasIdxUmbral")}: <b className="text-marca-700 dark:text-marca-300">{fmt(a.umbral)}</b>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        {mejor ? (
                          <>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                              {t("alertasIdxMejor")}
                            </div>
                            <div className={`text-[20px] font-extrabold tabular-nums tracking-tight ${
                              bajoUmbral
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-slate-900 dark:text-slate-100"
                            }`}>
                              {fmt(mejor.precio)}
                            </div>
                            <PrecioDual usd={mejor.precio} soloLocal className="text-[11.5px] text-slate-400" />
                            <div className="mt-0.5 text-[11.5px]">
                              {bajoUmbral ? (
                                <span className="font-bold text-emerald-700 dark:text-emerald-400">
                                  {t("alertasIdxBajoUmbral")}
                                </span>
                              ) : (
                                <span className="text-slate-500 dark:text-slate-400">
                                  {t("alertasIdxFalta")} {fmt(falta)}
                                </span>
                              )}
                            </div>
                          </>
                        ) : sinOrigen ? (
                          <Link
                            href={`/alertas/${a.id}`}
                            className="block max-w-[190px] text-[12px] font-semibold text-amber-700 hover:underline dark:text-amber-400"
                          >
                            {t("alertasIdxSinOrigen")}
                          </Link>
                        ) : (
                          <div className="text-[12px] text-slate-400 dark:text-slate-500">
                            {resumen ? t("alertasIdxSinDatos") : "…"}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-2 dark:border-slate-700">
                      <Link
                        href={`/alertas/${a.id}`}
                        className="text-[12.5px] font-bold text-marca-700 hover:underline dark:text-marca-300"
                      >
                        {t("alertasIdxDetalle")} →
                      </Link>
                      <button
                        type="button"
                        onClick={() => borrar(a.id)}
                        disabled={borrando === a.id}
                        className="text-[12px] font-semibold text-slate-400 transition hover:text-red-500 disabled:opacity-50"
                      >
                        {t("menuBorrarAlerta")}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <p className="mt-4 text-[11.5px] leading-relaxed text-slate-400">
              {t("alertasIdxNota")}
            </p>
          </>
        )}
      </main>

      <FooterAnduve />
      <BottomTabBar />
    </div>
  );
}
