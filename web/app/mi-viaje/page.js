"use client";
// Mi viaje: el centro del viaje, con la ruta, lo que falta y las decisiones.
//
// POR QUE LA FRONTERA DE SUSPENSE ESTA DONDE ESTA
//
// Esta pagina usa useSearchParams() para leer ?id=. Ese hook no se puede
// resolver al prerenderizar —los parametros de consulta no existen hasta que
// hay una peticion real—, asi que Next exige una frontera de Suspense y, si
// no la encuentra, ROMPE EL BUILD:
//
//   useSearchParams() should be wrapped in a suspense boundary at page
//   "/mi-viaje"
//   Error occurred prerendering page "/mi-viaje" ... exiting the build
//
// Es exactamente lo que ya le paso a /ruta, y alli quedo escrita la leccion:
// la frontera NO va envolviendo la pagina entera, y el fallback NO es `null`.
// Si se envuelve todo, el servidor emite el fallback y el HTML llega vacio:
// ni Google ve nada ni el usuario tiene primer pintado hasta que arranca el
// JavaScript. Asi que aqui dentro de Suspense va SOLO el trozo que depende
// del `id` de la URL; la cabecera, la navegacion y el pie quedan fuera y se
// renderizan en servidor. Y el fallback es un esqueleto que se puede ver.

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import Link from "next/link";
import NavTop from "@/components/NavTop";
import BottomTabBar from "@/components/BottomTabBar";
import MiViajeDashboard from "@/components/MiViajeDashboard";

export default function MiViajePage() {
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-slate-50 pb-20 dark:bg-slate-900 md:pb-0">
      <NavTop active="miviaje" />

      <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {/* Fuera de Suspense: esto no depende de la URL, asi que se renderiza
            en servidor y la pagina nunca llega en blanco. */}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">{t("mvPagEyebrow")}</div>
            <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{t("navMiViaje")}</h1>
            <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
              {t("mvPagIntro")}
            </p>
          </div>
          <Link href="/mis-viajes" className="rounded-full bg-marca-700 px-4 py-2.5 text-[12.5px] font-extrabold text-white shadow-sm hover:bg-marca-800">
            {t("mvPagGestionar")}
          </Link>
        </div>

        <Suspense fallback={<Esqueleto />}>
          <Contenido />
        </Suspense>
      </main>

      <BottomTabBar />
    </div>
  );
}

// El fallback tiene forma: es el mismo bloque que se ve mientras cargan los
// viajes, no un hueco.
function Esqueleto() {
  const { t } = useApp();
  return (
    <div
      aria-busy="true"
      className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-marca-600" />
      <p className="mt-3 text-[13px] text-slate-500">{t("mvPagCargando")}</p>
    </div>
  );
}

function Contenido() {
  const { t, lang } = useApp();
  const searchParams = useSearchParams();
  const viajeId = searchParams.get("id");
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
        setError(d?.motivo === "no-auth" ? "mvPagErrorAuth" : "mvPagErrorCargar");
        setRutas([]);
        setSeleccion(null);
        return;
      }
      const lista = Array.isArray(d.rutas) ? d.rutas : [];
      setRutas(lista);
      setSeleccion((actual) => {
        if (viajeId) return lista.find((x) => x.id === viajeId) || null;
        return lista.find((x) => x.id === actual?.id) || lista[0] || null;
      });
    } catch {
      setError("mvPagErrorConexion");
    } finally {
      setCargando(false);
    }
  }, [viajeId]);

  useEffect(() => { cargar(); }, [cargar]);

  const viajeNoEncontrado = !cargando && !error && Boolean(viajeId) && !seleccion;

  return (
    <>
      {cargando && <Esqueleto />}

      {!cargando && error && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="text-[16px] font-extrabold text-amber-900 dark:text-amber-200">{t("mvPagNoPodemos")}</h2>
          <p className="mt-1.5 text-[13px] text-amber-800/80 dark:text-amber-200/70">{t(error)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={cargar} className="rounded-full bg-amber-800 px-4 py-2 text-[12px] font-bold text-white hover:bg-amber-900">{t("mvPagReintentar")}</button>
            <Link href="/mis-viajes" className="rounded-full border border-amber-300 px-4 py-2 text-[12px] font-bold text-amber-900 dark:text-amber-200">{t("mvPagIrMisViajes")}</Link>
          </div>
        </div>
      )}

      {viajeNoEncontrado && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-900/20">
          <div className="text-4xl">🧭</div>
          <h2 className="mt-3 text-xl font-black text-amber-950 dark:text-amber-100">{t("mvPagNoEncontrado")}</h2>
          <p className="mt-1.5 text-[13px] text-amber-900/75 dark:text-amber-100/70">{t("mvPagNoEncontradoSub")}</p>
          <Link href="/mi-viaje" className="mt-5 inline-flex rounded-full bg-marca-700 px-5 py-2.5 text-[12.5px] font-extrabold text-white hover:bg-marca-800">{t("mvPagVerMisViajes")}</Link>
        </div>
      )}

      {!cargando && !error && !viajeId && rutas.length === 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-12">
          <div className="text-5xl">🧭</div>
          <h2 className="mt-4 text-2xl font-black text-slate-900 dark:text-white">{t("mvPagSinViaje")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-slate-500 dark:text-slate-400">{t("mvPagSinViajeSub")}</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Link href="/descubrir" className="inline-flex rounded-full bg-marca-700 px-5 py-3 text-[13px] font-extrabold text-white hover:bg-marca-800">{t("mvPagNoSeDonde")}</Link>
            <Link href="/ruta" className="inline-flex rounded-full border border-slate-200 px-5 py-3 text-[13px] font-extrabold text-slate-700 hover:border-marca-300 dark:border-slate-700 dark:text-slate-200">{t("mvPagYaSeCiudades")}</Link>
          </div>
        </div>
      )}

      {!cargando && !error && rutas.length > 0 && !viajeId && (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
            <div className="px-2 pb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-slate-400">{t("navMisViajes")}</div>
            <div className="space-y-1">
              {rutas.map((ruta) => (
                <Link key={ruta.id} href={`/mi-viaje?id=${encodeURIComponent(ruta.id)}`} className="block w-full rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700">
                  <span className="block truncate text-[12.5px] font-extrabold">{ruta.nombre || t("mvPagSinNombre")}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{(ruta.paradas || []).map((p) => p.ciudad).join(" → ")}</span>
                </Link>
              ))}
            </div>
          </aside>
          {seleccion && <MiViajeDashboard ruta={seleccion} t={t} lang={lang} onOptimizar={() => { window.location.href = `/ruta?id=${encodeURIComponent(seleccion.id)}`; }} />}
        </div>
      )}

      {/* La vista de DETALLE, solo con ?id=.

          Aqui faltaba el `viajeId` y las dos ramas se cumplian a la vez sin
          el parametro: la pagina montaba DOS tableros, con sus dos mapas,
          dos bloques con el mismo id —HTML invalido— y el doble de consultas
          de vuelo en vivo, que son de pago. Se veia como un tablero repetido
          debajo del otro. */}
      {!cargando && !error && viajeId && seleccion && (
        <div className="space-y-5">
          {viajeId && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link href="/mi-viaje" className="text-[12px] font-bold text-marca-700 hover:underline dark:text-marca-300">← {t("mvPagTodosMisViajes")}</Link>
              <Link href={`/ruta?id=${encodeURIComponent(seleccion.id)}`} className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[11.5px] font-extrabold text-slate-700 hover:border-marca-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">{t("mvEditarRuta")}</Link>
            </div>
          )}
          <MiViajeDashboard ruta={seleccion} t={t} lang={lang} onOptimizar={() => { window.location.href = `/ruta?id=${encodeURIComponent(seleccion.id)}`; }} />
        </div>
      )}
    </>
  );
}
