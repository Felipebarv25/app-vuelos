"use client";
// Ruta /ruta — planificador de itinerarios de varias ciudades.
//
// Panel propio y no un modo más del planificador de presupuesto porque el flujo
// es el inverso: allá se parte de cuánta plata hay y se proponen ciudades; aquí
// las ciudades ya están decididas y lo que se calcula es el costo. Además tiene
// URL propia para poder compartir un itinerario por enlace.
//
// POR QUE ESTA PAGINA SERVIA UN HTML VACIO (auditoria, P-04)
//
// El cuerpo llegaba con CERO caracteres de texto — comprobado con curl a
// produccion —, asi que ni Google veia nada ni el usuario tenia primer pintado
// hasta que cargaba y arrancaba el JavaScript. En una de las dos paginas mas
// importantes de la app.
//
// La causa no era el "use client": Next SI renderiza en servidor los
// componentes de cliente. Era esto:
//
//     <Suspense fallback={null}>   <-- toda la pagina dentro
//       <Contenido />              <-- y Contenido usa useSearchParams()
//     </Suspense>
//
// useSearchParams() no se puede resolver al prerenderizar (los parametros de
// consulta no existen hasta que hay una peticion real), asi que Next emite el
// FALLBACK de la frontera de Suspense que lo envuelve. El fallback era `null`.
// Resultado: la pagina entera desaparecia del HTML por un solo hook.
//
// El arreglo no es un refactor: es mover la frontera. Solo el trozo que
// depende del `id` de la URL va dentro de Suspense; la cabecera, la
// navegacion y el pie quedan fuera y se renderizan en servidor. Y el fallback
// deja de ser `null` para ser algo que se pueda ver y leer.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import NavTop from "@/components/NavTop";
import BotonVolver from "@/components/BotonVolver";
import FooterAnduve from "@/components/FooterAnduve";
import BottomTabBar from "@/components/BottomTabBar";
import PlanRuta from "@/components/PlanRuta";

// Lo unico que depende de los parametros de la URL, y por tanto lo unico que
// no puede prerenderizarse.
function PlanificadorConEnlace() {
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

  if (cargando) return <Esqueleto />;

  return (
    <PlanRuta
      t={t}
      lang={lang}
      usuario={usuario}
      rutaInicial={rutaInicial}
      key={rutaInicial?.id || "nueva"}
    />
  );
}

// Fallback con forma. Antes era `null`, que es lo que dejaba el HTML en
// blanco; ahora se ve el hueco del planificador mientras llega.
function Esqueleto() {
  return (
    <div
      aria-busy="true"
      className="rounded-2xl border border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="h-4 w-40 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
      <div className="mt-3 h-11 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
      <div className="mt-3 h-11 w-2/3 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700" />
    </div>
  );
}

export default function PaginaRuta() {
  const { t } = useApp();

  return (
    <div className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-900 md:pb-0">
      <NavTop active="ruta" />
      <BotonVolver />

      <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-10">
        {/* FUERA de la frontera de Suspense: esto es lo que ahora si llega en
            el HTML, y lo que Google puede leer. */}
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

        <Suspense fallback={<Esqueleto />}>
          <PlanificadorConEnlace />
        </Suspense>
      </main>

      <FooterAnduve />
      <BottomTabBar />
    </div>
  );
}
