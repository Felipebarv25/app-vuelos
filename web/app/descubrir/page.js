"use client";
// "No sé dónde ir": el otro lado de Anduve.
//
// Hasta ahora la app pedia que supieras el destino. Aqui se pregunta al reves:
// cuanto tienes, cuando puedes y que te gusta — y Anduve propone viajes
// enteros.
//
// FLUJO PROGRESIVO, NO FORMULARIO
//
// Arriba solo hay cuatro campos: cuanto, cuantos dias, cuando y desde donde.
// Todo lo demas —region, ritmo, nivel, intereses— vive detras de "Más
// opciones" y se puede cambiar DESPUES de ver resultados, que es cuando el
// viajero sabe que quiere afinar. Un formulario largo antes de enseñar nada
// es la forma mas rapida de que alguien se vaya.
//
// DE DONDE SALEN LAS PROPUESTAS
//
// De /api/descubrir, que a su vez usa construirRuta() — el mismo motor que ya
// arma rutas en el planificador de presupuesto. Aqui no hay un segundo
// buscador: hay una entrada distinta al mismo motor, con ranking y con salida
// hacia Mi viaje.
//
// LA SUSPENSE, OTRA VEZ
//
// La pagina lee la busqueda de la URL para poder compartirla, y useSearchParams
// obliga a una frontera de Suspense o el build se cae al prerenderizar. Misma
// leccion que /ruta y /mi-viaje.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavTop from "@/components/NavTop";
import BottomTabBar from "@/components/BottomTabBar";
import PropuestaViaje from "@/components/PropuestaViaje";
import { Icono } from "@/components/Icono";
import { useApp } from "@/lib/AppContext";
import { normalizarBusqueda } from "@/lib/perfilBusqueda";
import { ORDENES } from "@/lib/propuestasViaje";
import { REGIONES } from "@/lib/presupuesto";
import { CATEGORIAS_GUSTO } from "@/lib/destinosTags";
import { hubsDe, PAIS_DEFAULT } from "@/lib/paisesOrigen";
import { ubicarPorIATA } from "@/lib/coordsAeropuerto";

// Las categorias de gusto son claves del dato (destinosTags); su nombre
// visible sale del diccionario de idiomas, no de esta lista.
const INTERESES_UI = [
  ["ciudad", "interesCiudad"], ["historia", "interesHistoria"], ["gastronomia", "interesGastronomia"],
  ["playa", "interesPlaya"], ["naturaleza", "interesNaturaleza"], ["montana", "interesMontana"],
  ["aventura", "interesAventura"], ["nocturna", "interesNocturna"], ["romantico", "interesRomantico"],
  ["economico", "interesEconomico"],
];

const REGION_CLAVE = { todas: "regionTodas", sudamerica: "regionSudamerica", norteamerica: "regionNorteamerica", europa: "regionEuropa", asia: "regionAsia", africa: "regionAfrica", oceania: "regionOceania" };
const ORDEN_CLAVE = { compatible: "ordenCompatible", barato: "ordenBarato", valor: "ordenValor", ciudades: "ordenCiudades", comodo: "ordenComodo", rapido: "ordenRapido" };

export default function DescubrirPage() {
  // La cabecera se renderiza en SERVIDOR (por eso vive fuera de Suspense),
  // asi que su HTML sale en el idioma por defecto y cambia al hidratar, igual
  // que el resto del sitio. El titular sigue estando en el HTML, que es lo
  // que esta pagina publica necesita.
  const { t } = useApp();
  return (
    <div className="min-h-screen bg-slate-50 pb-24 dark:bg-slate-900 md:pb-0">
      <NavTop active="descubrir" />
      <main className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        {/* FUERA de Suspense, y no por capricho.

            Estaba todo dentro, asi que el servidor emitia el fallback y el
            HTML de /descubrir llegaba con 166 caracteres: solo el menu.
            Comprobado con curl contra produccion. Es EXACTAMENTE el fallo
            que ya sufrio /ruta y que esta escrito en su cabecera — y aqui
            duele mas, porque esta pagina es publica y su titular es
            justo lo que alguien escribiria en un buscador.

            Nada de esto depende de useSearchParams, asi que puede
            renderizarse en servidor. */}
        <div className="mb-5">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">{t("navDescubre")}</div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 dark:text-white">{t("dscTituloH1")}</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("dscSubtitulo")}
          </p>
        </div>

        <Suspense fallback={<Esqueleto />}>
          <Contenido />
        </Suspense>
      </main>
      <BottomTabBar />
    </div>
  );
}

function Esqueleto() {
  return (
    <div aria-busy="true">
      <div className="h-36 animate-pulse rounded-2xl bg-white dark:bg-slate-800" />
    </div>
  );
}

function Contenido() {
  const { t, lang, usuario } = useApp();
  const router = useRouter();
  const params = useSearchParams();

  const inicial = useMemo(
    () =>
      normalizarBusqueda({
        pais: params.get("pais") || PAIS_DEFAULT,
        origen: params.get("origen") || "",
        presupuesto: Number(params.get("presupuesto")) || 0,
        moneda: params.get("moneda") || "COP",
        dias: Number(params.get("dias")) || 10,
        mes: params.get("mes") || "",
        viajeros: Number(params.get("viajeros")) || 1,
        region: params.get("region") || "todas",
        ritmo: params.get("ritmo") || "normal",
        nivel: params.get("nivel") || "medio",
        intereses: (params.get("intereses") || "").split(",").filter(Boolean),
      }),
    [params]
  );

  const [b, setB] = useState(inicial);
  const [mas, setMas] = useState(false);
  const [orden, setOrden] = useState("compatible");
  const [datos, setDatos] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [construyendo, setConstruyendo] = useState(null);

  const hubs = useMemo(() => hubsDe(b.pais), [b.pais]);
  const set = (campo) => (valor) => setB((x) => normalizarBusqueda({ ...x, [campo]: valor }));

  // PERSONALIZACION: si el usuario ya tiene perfil, sus gustos entran como
  // intereses por defecto. No es una caja negra — se ven marcados y se pueden
  // quitar antes de buscar.
  useEffect(() => {
    if (!usuario || b.intereses.length) return;
    let vivo = true;
    (async () => {
      try {
        const tk = localStorage.getItem("anduve_auth_token") || sessionStorage.getItem("anduve_auth_token");
        const r = await fetch("/api/profile/recomendar", tk ? { headers: { Authorization: `Bearer ${tk}` } } : undefined);
        const d = r.ok ? await r.json() : null;
        const top = d?.perfil?.topGustos || [];
        if (vivo && top.length) setB((x) => normalizarBusqueda({ ...x, intereses: top.slice(0, 3) }));
      } catch { /* sin perfil se busca igual */ }
    })();
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario]);

  const buscar = useCallback(async (criterio = orden) => {
    setBuscando(true); setError(""); setDatos(null);
    try {
      const r = await fetch("/api/descubrir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ busqueda: b, orden: criterio }),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) throw new Error("dscErrorPropuestas");
      setDatos(d);
      // APRENDIZAJE: se registra la busqueda con el sistema de eventos que ya
      // existe, no con uno nuevo.
      fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "presupuesto", monto: b.presupuesto, moneda: b.moneda }),
      }).catch(() => {});
    } catch (e) {
      setError(e?.message || "dscErrorPropuestas");
    } finally {
      setBuscando(false);
    }
  }, [b, orden]);

  function cambiarOrden(criterio) {
    setOrden(criterio);
    if (datos) buscar(criterio);
  }

  // EL PUENTE: propuesta -> viaje de verdad -> Mi viaje.
  async function construir(propuesta) {
    setConstruyendo(propuesta.id);
    setError("");
    try {
      const { propuestaAViaje } = await import("@/lib/propuestasViaje");
      const hub = hubs.find((h) => h.iata === b.origen) || hubs[0];
      const cuerpo = propuestaAViaje(propuesta, b, hub ? { ciudad: hub.ciudad, iata: hub.iata, iso: b.pais.toLowerCase() } : null);
      // Las coordenadas del origen salen del catalogo IATA que ya existe, para
      // que el mapa de Mi viaje pueda situarlo desde el primer momento.
      cuerpo.paradas = await ubicarPorIATA(cuerpo.paradas);

      const tk = localStorage.getItem("anduve_auth_token") || sessionStorage.getItem("anduve_auth_token");
      const r = await fetch("/api/rutas", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
        body: JSON.stringify(cuerpo),
      });
      const d = await r.json();
      if (!r.ok || !d?.ok) {
        throw new Error(d?.motivo === "no-auth" ? "dscErrorSesion" : "dscErrorCrear");
      }
      // Señal fuerte para el perfil: no miro, se lo quedo.
      fetch("/api/profile/evento", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(tk ? { Authorization: `Bearer ${tk}` } : {}) },
        body: JSON.stringify({ tipo: "viaje_construido", ciudad: propuesta.entrada.ciudad, pais: propuesta.entrada.pais, region: propuesta.region }),
      }).catch(() => {});

      router.push(`/mi-viaje?id=${encodeURIComponent(d.id || d.ruta?.id || "")}`);
    } catch (e) {
      setError(e?.message || "dscErrorCrear");
      setConstruyendo(null);
    }
  }

  return (
    <>

      {/* LO ESENCIAL. Cuatro campos y a buscar. */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo etiqueta={t("dscCuantoTienes")}>
            <div className="flex gap-2">
              <input
                type="number" inputMode="numeric" min="0" value={b.presupuesto || ""}
                onChange={(e) => set("presupuesto")(e.target.value)}
                placeholder="6.000.000"
                className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[16px] outline-none focus:border-marca-500 sm:text-[14px] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
              />
              <select value={b.moneda} onChange={(e) => set("moneda")(e.target.value)}
                className="rounded-xl border border-slate-300 bg-white px-2 py-2.5 text-[13px] font-semibold dark:border-slate-600 dark:bg-slate-900 dark:text-white">
                {["COP", "USD", "EUR", "MXN", "PEN", "CLP", "ARS"].map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </Campo>

          <Campo etiqueta={t("dscCuantosDias")}>
            <input type="number" inputMode="numeric" min="2" max="60" value={b.dias}
              onChange={(e) => set("dias")(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[16px] outline-none focus:border-marca-500 sm:text-[14px] dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          </Campo>

          <Campo etiqueta={t("dscCuando")}>
            <input type="month" value={b.mes} onChange={(e) => set("mes")(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[16px] outline-none focus:border-marca-500 sm:text-[14px] dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
          </Campo>

          <Campo etiqueta={t("dscDesdeDonde")}>
            <select value={b.origen || ""} onChange={(e) => set("origen")(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] font-semibold dark:border-slate-600 dark:bg-slate-900 dark:text-white">
              {hubs.map((h) => <option key={h.iata} value={h.iata}>{h.ciudad} ({h.iata})</option>)}
            </select>
          </Campo>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={() => setMas((v) => !v)}
            className="flex items-center gap-1.5 text-[12.5px] font-bold text-marca-700 hover:underline dark:text-marca-300">
            {t("dscMasOpciones")} <Icono nombre="chevronDown" size={14} className={mas ? "rotate-180" : ""} />
          </button>
          <button type="button" onClick={() => buscar()} disabled={buscando}
            className="rounded-full bg-marca-700 px-6 py-3 text-[13.5px] font-extrabold text-white shadow-sm transition hover:bg-marca-800 disabled:opacity-60">
            {buscando ? t("dscBuscando") : t("dscBuscar")}
          </button>
        </div>

        {mas && (
          <div className="mt-4 grid gap-4 border-t border-slate-100 pt-4 dark:border-slate-700 lg:grid-cols-2">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etiqueta={t("dscADonde")}>
                <select value={b.region} onChange={(e) => set("region")(e.target.value)} className={SELECT}>
                  {Object.entries(REGIONES).map(([k, v]) => <option key={k} value={k}>{REGION_CLAVE[k] ? t(REGION_CLAVE[k]) : v}</option>)}
                </select>
              </Campo>
              <Campo etiqueta={t("dscCuantosViajan")}>
                <input type="number" min="1" max="9" value={b.viajeros} onChange={(e) => set("viajeros")(e.target.value)} className={SELECT} />
              </Campo>
              <Campo etiqueta={t("dscNivelViaje")}>
                <select value={b.nivel} onChange={(e) => set("nivel")(e.target.value)} className={SELECT}>
                  <option value="mochilero">{t("dscNivelMochilero")}</option>
                  <option value="medio">{t("dscNivelMedio")}</option>
                  <option value="comodo">{t("dscNivelComodo")}</option>
                </select>
              </Campo>
              <Campo etiqueta={t("dscRitmo")}>
                <select value={b.ritmo} onChange={(e) => set("ritmo")(e.target.value)} className={SELECT}>
                  <option value="normal">{t("dscRitmoNormal")}</option>
                  <option value="tranquilo">{t("dscRitmoTranquilo")}</option>
                </select>
              </Campo>
            </div>

            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{t("dscQueTeGusta")}</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {INTERESES_UI.filter(([k]) => CATEGORIAS_GUSTO.includes(k)).map(([k, clave]) => {
                  const activo = b.intereses.includes(k);
                  return (
                    <button key={k} type="button"
                      onClick={() => set("intereses")(activo ? b.intereses.filter((x) => x !== k) : [...b.intereses, k])}
                      className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${activo ? "bg-marca-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300"}`}>
                      {t(clave)}
                    </button>
                  );
                })}
              </div>
              <label className="mt-3 flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={b.flexibleOrigen} onChange={(e) => set("flexibleOrigen")(e.target.checked)} className="h-4 w-4 rounded" />
                {t("dscOtroAeropuerto")}
              </label>
            </div>
          </div>
        )}
      </section>

      {error && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] font-semibold text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
          {t(error)}
        </div>
      )}

      {datos && (
        <section className="mt-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[19px] font-black text-slate-900 dark:text-white">
                {t(datos.propuestas.length === 1 ? "dscViajeUno" : "dscViajeVarios", { n: datos.propuestas.length })}
              </h2>
              <p className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">
                {datos.presupuestoUsd ? t("dscConPresupuesto", { v: datos.presupuestoUsd }) : t("dscSinLimite")}
                {datos.cambioEnVivo ? t("dscCambioHoy") : t("dscCambioRespaldo")}
                {datos.hayPreciosReales ? t("dscConPreciosReales") : ""}
              </p>
            </div>
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1">
              {Object.entries(ORDENES).map(([k, v]) => (
                <button key={k} type="button" onClick={() => cambiarOrden(k)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold transition ${orden === k ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700"}`}>
                  {ORDEN_CLAVE[k] ? t(ORDEN_CLAVE[k]) : v}
                </button>
              ))}
            </div>
          </div>

          {datos.propuestas.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
              <div className="text-4xl">🧭</div>
              <h3 className="mt-3 text-[17px] font-black text-slate-900 dark:text-white">{t("dscSinResultadosTit")}</h3>
              <p className="mx-auto mt-1.5 max-w-md text-[13px] text-slate-500 dark:text-slate-400">
                {t("dscSinResultadosSub")}
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {datos.propuestas.map((p) => (
                <div key={p.id}>
                  <PropuestaViaje propuesta={p} onConstruir={construir} construyendo={construyendo === p.id} />
                  {p.ahorroOrigen && (
                    <p className="mt-1.5 px-1 text-[11.5px] font-semibold text-emerald-700 dark:text-emerald-300">
                      💡 {t("dscAhorroOrigen", {
                        ciudad: p.ahorroOrigen.ciudad,
                        v: p.ahorroOrigen.ahorroVista != null
                          ? `${p.ahorroOrigen.ahorroVista.toLocaleString("es-CO")} ${b.moneda}`
                          : `US${p.ahorroOrigen.ahorroUsd}`,
                      })}{" "}
                      <span className="font-normal text-slate-500">{t("dscPreciosDetectados")}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!datos && !buscando && (
        <p className="mt-6 text-center text-[13px] text-slate-500 dark:text-slate-400">
          {t("dscInvitacion")} <b>{t("dscBuscar")}</b>. {t("dscInvitacionFin")}
        </p>
      )}
    </>
  );
}

const SELECT = "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[14px] font-semibold dark:border-slate-600 dark:bg-slate-900 dark:text-white";

function Campo({ etiqueta, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{etiqueta}</span>
      {children}
    </label>
  );
}
