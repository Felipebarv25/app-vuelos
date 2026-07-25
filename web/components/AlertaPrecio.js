"use client";
// Modal/boton para crear una alerta de precio.
//
// Props minimas: ciudad, pais, iata, precioActual?, lang?
// El precio por defecto sugerido es 80% del precio actual (psicologico, un
// descuento que se siente real pero alcanzable).
//
// CRITICAL: el modal se RENDERIZA VIA PORTAL A document.body. Razon: la card
// padre tiene `hover:-translate-y-0.5` (transform). Un position:fixed dentro
// de un ancestro con transform se vuelve relativo a ese ancestro, no al
// viewport. Sin portal, el modal saltaba de posicion cuando el mouse entraba
// o salia de la card (el hover toggle reposicionaba el "viewport"). Con
// portal, el modal vive directamente bajo body y queda anclado al viewport
// real.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/AppContext";
import { Icono } from "./Icono";
import { useBrowserBackClose } from "@/lib/useBrowserBack";
import { PAISES_ORIGEN, PAIS_DEFAULT, paisValido } from "@/lib/paisesOrigen";
import { monedaDePais } from "@/lib/monedas";
import PrecioDual from "./PrecioDual";

// Normaliza para comparar nombres de ciudad ("Medellín" vs "Medellin").
function _norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();
}

export default function AlertaPrecio({ ciudad, pais, iata, precioActual = null, label = null, alertaExistente = null, abrirDirecto = false, onActualizada = null, onCerrar = null }) {
  const esEdicion = !!alertaExistente;
  const { t, lang, usuario, abrirPaywall } = useApp();
  const [abierto, setAbierto] = useState(abrirDirecto);
  // ORIGEN de la alerta (feedback 2026-07-11: usuario de Medellin recibia
  // alertas saliendo de Bogota). Hubs del pais del visitante + "cualquiera".
  // Prioridad del default: eleccion previa (localStorage anduve_hub_origen)
  // > ciudad detectada por IP (/api/geo, header x-vercel-ip-city) > 1er hub.
  const [paisOrigen, setPaisOrigen] = useState(PAIS_DEFAULT);
  const [hubOrigen, setHubOrigen] = useState(() => {
    if (!esEdicion) return [];
    const raw = alertaExistente.origen || "";
    return raw ? raw.split(",").filter(Boolean) : [];
  });
  const [escalasMax, setEscalasMax] = useState(esEdicion ? (alertaExistente.escalasMax ?? 0) : 0);
  useEffect(() => {
    if (esEdicion) return;
    let vivo = true;
    let iso = PAIS_DEFAULT;
    try {
      iso = localStorage.getItem("anduve_pais_iso")
         || sessionStorage.getItem("anduve_pais_iso_geo")
         || PAIS_DEFAULT;
    } catch {}
    if (!paisValido(iso)) iso = PAIS_DEFAULT;
    setPaisOrigen(iso);
    const hubs = PAISES_ORIGEN[iso]?.hubs || [];
    // 1) eleccion previa del usuario (ahora puede ser "BOG,MDE" o "BOG")
    try {
      const previo = localStorage.getItem("anduve_hub_origen");
      if (previo !== null) {
        const arr = previo ? previo.split(",").filter(Boolean) : [];
        setHubOrigen(arr);
        return;
      }
    } catch {}
    // 2) ciudad detectada por IP -> hub que coincida por nombre
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!vivo) return;
        const c = _norm(g?.ciudad);
        const match = c ? hubs.find((h) => _norm(h.ciudad) === c) : null;
        setHubOrigen(match ? [match.iata] : [hubs[0]?.iata].filter(Boolean));
      })
      .catch(() => { if (vivo) setHubOrigen([hubs[0]?.iata].filter(Boolean)); });
    return () => { vivo = false; };
  }, [esEdicion]);
  // Flecha "atrás" del navegador cierra este modal en vez de salir del sitio.
  useBrowserBackClose(abierto, () => setAbierto(false));
  const [umbral, setUmbral] = useState(() =>
    esEdicion ? alertaExistente.umbral
    : precioActual && Number.isFinite(precioActual)
      ? Math.round(precioActual * 0.8)
      : ""
  );
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState(null); // null | "ok" | "limite" | "auth" | "error"

  // Auto-cerrar el modal de exito tras 1.8s. Patron Stripe/GitHub: el usuario
  // confirma la accion y sigue, no tiene que dismissear "Hecho".
  function cerrar() {
    setAbierto(false);
    setEstado(null);
    if (onCerrar) onCerrar();
  }

  useEffect(() => {
    if (estado !== "ok") return;
    const id = setTimeout(cerrar, 1800);
    return () => clearTimeout(id);
  }, [estado]);

  // Para usar createPortal necesitamos esperar al primer paint en cliente.
  // En SSR `document` no existe; sin este guard el componente reventaria.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  // Body scroll lock mientras el modal esta abierto. Mas profesional que
  // dejar que la pagina haga scroll detras: a) si el contenido del modal
  // mide mas que el viewport el usuario puede hacer scroll dentro del modal
  // sin mover la pagina, b) si las ofertas detras se siguen scrolleando
  // el usuario se desorienta. Restauramos overflow al cerrar.
  useEffect(() => {
    if (!abierto) return;
    const overflowPrev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflowPrev; };
  }, [abierto]);

  // ESC cierra el modal. Estandar de accesibilidad de cualquier dialog.
  useEffect(() => {
    if (!abierto) return;
    const onKey = (e) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [abierto]);

  if (!iata) return null;

  function abrir() {
    if (!usuario?.email) {
      setEstado("auth");
      setAbierto(true);
      return;
    }
    // BUG FIX: si el componente quedó con estado "auth" de un click anterior
    // (cuando el usuario no estaba logueado), reseteamos al modo form normal.
    // Sin esto, el usuario que se loguea con Demo Free veía "Necesitas tu
    // email" aunque ya hubiera entrado.
    setEstado(null);
    setAbierto(true);
  }

  async function crear(e) {
    e?.preventDefault();
    if (!umbral || Number(umbral) <= 0) return;
    setCargando(true);
    setEstado(null);
    try {
      const headers = { "Content-Type": "application/json" };
      try {
        const tk = localStorage.getItem("anduve_auth_token")
                || sessionStorage.getItem("anduve_auth_token");
        if (tk) headers.Authorization = `Bearer ${tk}`;
      } catch {}

      try { localStorage.setItem("anduve_hub_origen", hubOrigen.join(",")); } catch {}
      let moneda = "";
      try {
        moneda = sessionStorage.getItem("anduve_moneda_geo")
              || monedaDePais(paisOrigen)
              || "";
      } catch {}

      let r, data;
      if (esEdicion) {
        r = await fetch("/api/alertas", {
          method: "PATCH",
          headers,
          body: JSON.stringify({
            id: alertaExistente.id,
            umbral: Number(umbral),
            origen: hubOrigen.join(","),
            escalasMax,
            activa: true,
          }),
        });
        data = await r.json().catch(() => ({}));
      } else {
        r = await fetch("/api/alertas/crear", {
          method: "POST",
          headers,
          body: JSON.stringify({
            ciudad, pais, iata, umbral: Number(umbral), lang,
            origen: hubOrigen.join(","), escalasMax, moneda,
          }),
        });
        data = await r.json().catch(() => ({}));
        if (r.status === 402) {
          setAbierto(false);
          abrirPaywall("alerta");
          return;
        }
      }
      if (data?.ok) {
        setEstado("ok");
        if (esEdicion && onActualizada) onActualizada(data.alerta);
      }
      else if (data?.motivo === "sin-sesion") setEstado("auth");
      else setEstado("error");
    } catch {
      setEstado("error");
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {!esEdicion && (
        <button
          type="button"
          onClick={abrir}
          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-700 transition hover:bg-amber-100"
        >
          🔔 {label || t("alertaBoton")}
        </button>
      )}

      {abierto && montado && createPortal(
        <div
          className="fixed inset-0 z-[5400] flex items-end justify-center bg-slate-900/55 p-3 animar-aparecer sm:items-center"
          onClick={cerrar}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animar-subir dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 px-6 pb-6 pt-5 text-white">
              <button
                type="button"
                onClick={cerrar}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              >
                <Icono nombre="x" size={16} />
              </button>
              <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/85">🔔 {esEdicion ? "Editar alerta" : t("alertaModalEyebrow")}</div>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                {esEdicion
                  ? `Editar alerta de ${ciudad}`
                  : t("alertaModalTitulo").replace("{ciudad}", ciudad)}
              </h2>
              <p className="mt-2 text-[14px] text-white/85">
                {esEdicion
                  ? "Cambia el umbral, origen o escalas y guarda."
                  : t("alertaModalSub")}
              </p>
            </div>

            {/* min-height evita el "salto" visual cuando el contenido pasa de
                formulario (alto) a estado de exito (corto). Mantiene el modal
                anclado en el mismo lugar y no parece que se cierre y reabra. */}
            <div className="px-5 py-5 min-h-[220px] flex flex-col justify-center">
              {estado === "ok" ? (
                <div className="text-center">
                  <div className="text-5xl">✓</div>
                  <div className="mt-3 text-lg font-extrabold text-marca-900">{esEdicion ? "Alerta actualizada" : t("alertaCreada")}</div>
                  <div className="mt-1 text-[13.5px] text-slate-500">{esEdicion ? "Tus cambios ya están activos." : t("alertaCreadaSub")}</div>
                  <button
                    type="button"
                    onClick={cerrar}
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-marca-500 to-marca-600 py-3 text-[14.5px] font-bold text-white shadow-marca"
                  >
                    {t("alertaCerrar")}
                  </button>
                </div>
              ) : estado === "auth" ? (
                <div className="text-center">
                  <div className="text-3xl">📧</div>
                  <div className="mt-3 text-base font-bold text-marca-900">{t("alertaAuthTitulo")}</div>
                  <div className="mt-1 text-[13.5px] text-slate-500">{t("alertaAuthSub")}</div>
                  <a
                    href="/?login=1"
                    className="mt-4 inline-block rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-marca"
                  >
                    {t("alertaEntrar")} →
                  </a>
                </div>
              ) : (
                <form onSubmit={crear}>
                  <div className="text-[13px] font-bold text-slate-600">{t("alertaUmbral")}</div>
                  <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 focus-within:border-amber-400 dark:border-slate-600 dark:bg-slate-700">
                    <span className="text-[16px] font-bold text-slate-500">US$</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      step="1"
                      value={umbral}
                      onChange={(e) => setUmbral(e.target.value)}
                      placeholder="700"
                      className="flex-1 border-0 bg-transparent text-[24px] font-extrabold text-marca-900 outline-none placeholder:text-slate-300"
                      autoFocus
                    />
                  </div>

                  {/* Equivalente en la moneda del usuario, reactivo a lo que
                      escribe (feedback 2026-07-11: "no sé cuánto representa"). */}
                  {Number(umbral) > 0 && (
                    <div className="mt-1.5 text-[12.5px] font-semibold text-marca-700 dark:text-marca-300">
                      <PrecioDual usd={Number(umbral)} soloLocal />
                    </div>
                  )}

                  {precioActual && (
                    <div className="mt-2 text-[12.5px] text-slate-500">
                      {t("alertaActualHoy")} <b className="text-slate-700">US$ {precioActual}</b>
                      {" "}<PrecioDual usd={precioActual} soloLocal className="text-slate-400" /> ·{" "}
                      <button
                        type="button"
                        className="text-marca-600 underline-offset-2 hover:underline"
                        onClick={() => setUmbral(Math.round(precioActual * 0.8))}
                      >
                        -20%
                      </button>
                      {" · "}
                      <button
                        type="button"
                        className="text-marca-600 underline-offset-2 hover:underline"
                        onClick={() => setUmbral(Math.round(precioActual * 0.7))}
                      >
                        -30%
                      </button>
                    </div>
                  )}

                  {/* ORIGEN: hubs del pais del visitante + "cualquiera". El
                      default sale de la ciudad detectada por IP o de la
                      eleccion anterior (localStorage). */}
                  {(PAISES_ORIGEN[paisOrigen]?.hubs?.length || 0) > 0 && (
                    <div className="mt-4">
                      <div className="text-[13px] font-bold text-slate-600">{t("alertaOrigenLabel")}</div>
                      <div className="mt-1 text-[11px] text-slate-400">Puedes elegir varias ciudades.</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {PAISES_ORIGEN[paisOrigen].hubs.map((h) => {
                          const activo = hubOrigen.includes(h.iata);
                          return (
                            <button
                              key={h.iata}
                              type="button"
                              onClick={() => {
                                setHubOrigen((prev) =>
                                  prev.includes(h.iata)
                                    ? prev.filter((x) => x !== h.iata)
                                    : [...prev, h.iata]
                                );
                              }}
                              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
                                activo
                                  ? "border-amber-500 bg-amber-500 text-white"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {activo && (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 6L9 17l-5-5" />
                                </svg>
                              )}
                              {h.ciudad}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => setHubOrigen([])}
                          className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
                            hubOrigen.length === 0
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {t("alertaOrigenCualquiera")}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ESCALAS: directo por defecto. El usuario acepta escalas
                      explicitamente si las quiere (feedback 2026-07-11). */}
                  <div className="mt-4">
                    <div className="text-[13px] font-bold text-slate-600">{t("alertaEscalasLabel")}</div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {[
                        [0, t("alertaEscalasDirecto")],
                        [1, t("alertaEscalasUna")],
                        [99, t("alertaEscalasCualquiera")],
                      ].map(([v, texto]) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setEscalasMax(v)}
                          className={`rounded-lg border px-2.5 py-1.5 text-[12.5px] font-semibold transition ${
                            escalasMax === v
                              ? "border-amber-500 bg-amber-500 text-white"
                              : "border-slate-200 bg-white text-slate-600 hover:border-amber-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300"
                          }`}
                        >
                          {texto}
                        </button>
                      ))}
                    </div>
                    {escalasMax === 0 && (
                      <div className="mt-1.5 text-[11.5px] text-slate-400">{t("alertaEscalasNota")}</div>
                    )}
                  </div>

                  {estado === "error" && (
                    <div className="mt-2 text-[12.5px] font-semibold text-red-600">
                      {t("alertaError")}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={cargando}
                    className="mt-5 w-full rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-[14.5px] font-bold text-white shadow-marca disabled:opacity-60"
                  >
                    {cargando ? "Guardando…" : esEdicion ? "Guardar cambios →" : `${t("alertaConfirmar")} →`}
                  </button>

                  <div className="mt-3 text-center text-[11.5px] text-slate-400">
                    {t("alertaPrivacidad")}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
