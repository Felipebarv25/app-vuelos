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

export default function AlertaPrecio({ ciudad, pais, iata, precioActual = null, label = null }) {
  const { t, lang, usuario, abrirPaywall } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [umbral, setUmbral] = useState(() =>
    precioActual && Number.isFinite(precioActual)
      ? Math.round(precioActual * 0.8)
      : ""
  );
  const [cargando, setCargando] = useState(false);
  const [estado, setEstado] = useState(null); // null | "ok" | "limite" | "auth" | "error"

  // Auto-cerrar el modal de exito tras 1.8s. Patron Stripe/GitHub: el usuario
  // confirma la accion y sigue, no tiene que dismissear "Hecho".
  useEffect(() => {
    if (estado !== "ok") return;
    const id = setTimeout(() => { setAbierto(false); setEstado(null); }, 1800);
    return () => clearTimeout(id);
  }, [estado]);

  // Para usar createPortal necesitamos esperar al primer paint en cliente.
  // En SSR `document` no existe; sin este guard el componente reventaria.
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  if (!iata) return null;

  function abrir() {
    if (!usuario?.email) {
      setEstado("auth");
      setAbierto(true);
      return;
    }
    setAbierto(true);
  }

  async function crear(e) {
    e?.preventDefault();
    if (!umbral || Number(umbral) <= 0) return;
    setCargando(true);
    setEstado(null);
    try {
      // Pasar token Bearer si hay (sesion email magic code).
      const headers = { "Content-Type": "application/json" };
      try {
        const tk = localStorage.getItem("v360_auth_token");
        if (tk) headers.Authorization = `Bearer ${tk}`;
      } catch {}

      const r = await fetch("/api/alertas/crear", {
        method: "POST",
        headers,
        body: JSON.stringify({ ciudad, pais, iata, umbral: Number(umbral), lang }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 402) {
        // Gate Free: ya tiene 1 alerta. Abrimos el paywall en lugar de error.
        setAbierto(false);
        abrirPaywall("alerta");
        return;
      }
      if (data?.ok) setEstado("ok");
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
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-bold text-amber-700 transition hover:bg-amber-100"
      >
        🔔 {label || t("alertaBoton")}
      </button>

      {abierto && montado && createPortal(
        <div
          className="fixed inset-0 z-[5400] flex items-end justify-center bg-slate-900/55 p-3 animar-aparecer sm:items-center"
          onClick={() => { setAbierto(false); setEstado(null); }}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animar-subir"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="relative bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 px-6 pb-6 pt-5 text-white">
              <button
                type="button"
                onClick={() => { setAbierto(false); setEstado(null); }}
                className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
              >
                <Icono nombre="x" size={16} />
              </button>
              <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/85">🔔 {t("alertaModalEyebrow")}</div>
              <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                {t("alertaModalTitulo").replace("{ciudad}", ciudad)}
              </h2>
              <p className="mt-2 text-[14px] text-white/85">
                {t("alertaModalSub")}
              </p>
            </div>

            {/* min-height evita el "salto" visual cuando el contenido pasa de
                formulario (alto) a estado de exito (corto). Mantiene el modal
                anclado en el mismo lugar y no parece que se cierre y reabra. */}
            <div className="px-5 py-5 min-h-[220px] flex flex-col justify-center">
              {estado === "ok" ? (
                <div className="text-center">
                  <div className="text-5xl">✓</div>
                  <div className="mt-3 text-lg font-extrabold text-marca-900">{t("alertaCreada")}</div>
                  <div className="mt-1 text-[13.5px] text-slate-500">{t("alertaCreadaSub")}</div>
                  <button
                    type="button"
                    onClick={() => { setAbierto(false); setEstado(null); }}
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
                  <div className="mt-2 flex items-center gap-2 rounded-xl border-2 border-slate-200 bg-white px-3.5 py-3 focus-within:border-amber-400">
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

                  {precioActual && (
                    <div className="mt-2 text-[12.5px] text-slate-500">
                      {t("alertaActualHoy")} <b className="text-slate-700">US$ {precioActual}</b> ·{" "}
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
                    {cargando ? "…" : t("alertaConfirmar")} →
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
