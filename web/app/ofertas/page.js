"use client";
// Ruta /ofertas — Vuelos baratos detectados.
// Antes vivia en el home como una seccion mas abajo del hero. Ahora tiene
// su propia URL (compartible) y nav top. Al hacer click en una oferta o
// "Planear", navega al home con ?q=Ciudad,Pais para que arranque el flujo
// de planificacion.
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { obtenerOfertas, ventanaDeFechas } from "@/lib/ofertasDatos";
import NavTop from "@/components/NavTop";
import BotonVolver from "@/components/BotonVolver";
import Ofertas from "@/components/Ofertas";
import FooterAnduve from "@/components/FooterAnduve";
import BottomTabBar from "@/components/BottomTabBar";
import { Icono } from "@/components/Icono";

// Brújula: chat flotante de marca. Solo se carga cuando hace falta (lazy)
// para no penalizar el LCP de la ruta.
// El Asesor de viajes se retiro (2026-09-04): su flujo —region, presupuesto,
// dias— es exactamente el del planificador "Te recomiendo la ruta" de
// /mis-viajes, que ademas deja editar el resultado. Dos puertas al mismo
// sitio, y la del chat era la peor: no se podia ajustar nada de lo que
// proponia. El componente sigue en components/Asesor.js por si vuelve.

// "2026-09-14" -> "septiembre 2026"
function fmtMes(iso, lang) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return "";
  return d.toLocaleDateString(lang, { month: "long", year: "numeric" });
}

export default function PaginaOfertas() {
  const { t, lang, usuario } = useApp();
  const router = useRouter();
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");

  // Hasta dónde llegan los datos. El detector solo explora los próximos 6
  // meses, así que dejar el selector abierto hasta el infinito invitaba a pedir
  // fechas que jamás van a tener ofertas: el usuario elegía mayo de 2027 y el
  // panel le respondía con vuelos de febrero.
  const [ventana, setVentana] = useState(null);
  useEffect(() => {
    let vivo = true;
    obtenerOfertas().then((d) => { if (vivo) setVentana(ventanaDeFechas(d)); });
    return () => { vivo = false; };
  }, []);
  const hoy = new Date().toISOString().slice(0, 10);
  const minFecha = ventana && ventana.min > hoy ? ventana.min : hoy;
  const maxFecha = ventana?.max || undefined;

  function planear(q) {
    // Anonimo: /?q= re-renderiza el landing y se pierde la intencion (lectura
    // 360 2026-07-11). Guardamos la ciudad como intent (mismo mecanismo del
    // trial anonimo B1) y abrimos el login; tras autenticar, la home lee
    // anduve_intent_q y abre esa ciudad directamente.
    if (!usuario) {
      try { sessionStorage.setItem("anduve_intent_q", q); } catch {}
      router.push("/?login=1");
      return;
    }
    router.push(`/?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-900 md:pb-0">
      <NavTop active="ofertas" />
      <BotonVolver />

      <main className="mx-auto max-w-6xl px-4 py-8 lg:px-8 lg:py-10">
        {/* Cabecera de la seccion */}
        <div className="mb-8">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
            {t("ofertasEyebrow")}
          </div>
          <h1 className="mt-1 text-[26px] font-extrabold tracking-tight text-slate-900 lg:text-[32px] dark:text-slate-100">
            {t("ofertasH1")}
          </h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("ofertasSub")}
          </p>
        </div>

        {/* Selector de fechas (opcional, filtra las ofertas) */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-wrap items-end gap-3">
            <div className="mr-auto">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
                {t("ofertasCuandoEyebrow")}
              </div>
              <div className="mt-0.5 text-[13.5px] font-bold text-slate-900 dark:text-slate-100">{t("ofertasCuandoLabel")}</div>
              {ventana && (
                <div className="mt-0.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                  {t("ofertasVentana")
                    .replace("{desde}", fmtMes(ventana.min, lang))
                    .replace("{hasta}", fmtMes(ventana.max, lang))}
                </div>
              )}
            </div>
            <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Icono nombre="planeTakeoff" size={15} /> {t("ofertasFechaIda")}
              </span>
              <input
                type="date"
                value={fechaInicio}
                min={minFecha}
                max={maxFecha}
                onChange={(e) => setFechaInicio(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </label>
            <label className="flex flex-col gap-1 text-[12.5px] font-semibold text-slate-600 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Icono nombre="planeLanding" size={15} /> {t("ofertasFechaVuelta")}
              </span>
              <input
                type="date"
                value={fechaFin}
                min={fechaInicio || minFecha}
                max={maxFecha}
                onChange={(e) => setFechaFin(e.target.value)}
                className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-[13.5px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </label>
            {(fechaInicio || fechaFin) && (
              <button
                onClick={() => { setFechaInicio(""); setFechaFin(""); }}
                className="rounded-md px-2.5 py-1.5 text-[12px] font-semibold text-slate-500 underline-offset-2 hover:underline"
              >
                {t("ofertasQuitarFiltro")}
              </button>
            )}
          </div>
        </div>

        {/* Componente Ofertas (reutilizado del home). sinCabecera: esta
            pagina ya tiene su propio H1 arriba — sin la prop se veia el
            titulo dos veces seguidas. */}
        <Ofertas
          t={t}
          lang={lang}
          rango={fechaInicio && fechaFin ? { inicio: fechaInicio, fin: fechaFin } : null}
          onPlanear={planear}
          sinCabecera
        />
      </main>

      <FooterAnduve />

      {/* Brújula flotante. onPlanear navega al home con la consulta;
          onAbrirPresupuesto va al home con ?presupuesto=1 que la home lee
          para abrir el modal automaticamente. */}
      <div className="print:hidden">
      </div>

      <BottomTabBar />
    </div>
  );
}
