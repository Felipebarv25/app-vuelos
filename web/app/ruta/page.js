"use client";
// Ruta /ruta — planificador de itinerarios de varias ciudades.
//
// Panel propio y no un modo más del planificador de presupuesto porque el flujo
// es el inverso: allá se parte de cuánta plata hay y se proponen ciudades; aquí
// las ciudades ya están decididas y lo que se calcula es el costo. Además tiene
// URL propia para poder compartir un itinerario por enlace.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import NavTop from "@/components/NavTop";
import BotonVolver from "@/components/BotonVolver";
import FooterAnduve from "@/components/FooterAnduve";
import BottomTabBar from "@/components/BottomTabBar";
import PlanRuta from "@/components/PlanRuta";

function Contenido() {
  const { t, lang, usuario } = useApp();
  const params = useSearchParams();
  const id = params.get("id");

  const [rutaInicial, setRutaInicial] = useState(null);
  const [cargando, setCargando] = useState(Boolean(id));

  // Ruta compartida por enlace: se lee sin necesidad de sesión.
  useEffect(() => {
    if (!id) return;
    let vivo = true;
    fetch(`/api/rutas?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d?.ok) setRutaInicial(d.ruta); })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-900 md:pb-0">
      <NavTop active="ruta" />
      <BotonVolver />

      <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-10">
        <div className="mb-7">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
            {t("rutaEyebrow")}
          </div>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900 lg:text-[32px] dark:text-slate-100">
            {t("rutaH1")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("rutaSub")}
          </p>
        </div>

        {cargando ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-[14px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
            …
          </div>
        ) : (
          <PlanRuta
            t={t}
            lang={lang}
            usuario={usuario}
            rutaInicial={rutaInicial}
            key={rutaInicial?.id || "nueva"}
          />
        )}
      </main>

      <FooterAnduve />
      <BottomTabBar />
    </div>
  );
}

export default function PaginaRuta() {
  // useSearchParams necesita un límite de Suspense en el App Router.
  return (
    <Suspense fallback={null}>
      <Contenido />
    </Suspense>
  );
}
