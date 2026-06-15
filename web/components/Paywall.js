"use client";
import { useEffect, useState } from "react";
import { Icono } from "./Icono";
import { track } from "@/lib/track";

// Paywall modal. Se abre desde cualquier feature gateada (PDF, 2do viaje,
// 2da alerta, grafico de precios). Muestra los 3 precios con el plan anual
// destacado (anclaje + decoy: el mensual se ve caro al lado del anual).
//
// Checkout: usa Lemon Squeezy hosted checkout (la URL la pasamos por env
// var por producto). Pre-llenamos el email del usuario logueado para que
// despues del pago el webhook nos lo entregue tal cual y podamos asociar
// Pro con la cuenta. Si no hay email (anonimo), pedimos primero login.

const URLS_CHECKOUT = {
  anual: "NEXT_PUBLIC_LS_URL_ANUAL",
  mensual: "NEXT_PUBLIC_LS_URL_MENSUAL",
  lifetime: "NEXT_PUBLIC_LS_URL_LIFETIME",
};

export default function Paywall({
  motivo = "guardar",
  emailUsuario = null,
  onCerrar,
  t = (k) => k,
}) {
  const [planFocado, setPlanFocado] = useState("anual");
  // Resolver las URLs de checkout. Vienen via process.env solo si estan
  // marcadas NEXT_PUBLIC_ (Next.js las exporta al cliente).
  const [urls, setUrls] = useState({});
  useEffect(() => {
    setUrls({
      anual: process.env.NEXT_PUBLIC_LS_URL_ANUAL || "",
      mensual: process.env.NEXT_PUBLIC_LS_URL_MENSUAL || "",
      lifetime: process.env.NEXT_PUBLIC_LS_URL_LIFETIME || "",
    });
  }, []);

  function abrirCheckout(plan) {
    track("paywall_clic", { plan, motivo });
    let url = urls[plan];
    if (!url) {
      // El usuario aun no configuro la URL del checkout: avisamos en lugar
      // de hacer una redireccion rota.
      alert(t("paywallNoConfigurado"));
      return;
    }
    // Prefill del email en checkout hosted de Lemon Squeezy.
    if (emailUsuario) {
      const sep = url.includes("?") ? "&" : "?";
      url += `${sep}checkout%5Bemail%5D=${encodeURIComponent(emailUsuario)}`;
    }
    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener");
    }
  }

  const motivos = {
    guardar: t("paywallMotivoGuardar"),
    pdf: t("paywallMotivoPDF"),
    alerta: t("paywallMotivoAlerta"),
    grafico: t("paywallMotivoGrafico"),
    compartir: t("paywallMotivoCompartir"),
  };
  const motivoTexto = motivos[motivo] || motivos.guardar;

  return (
    <div
      className="fixed inset-0 z-[5500] flex items-end justify-center bg-slate-900/55 p-3 animar-aparecer sm:items-center"
      onClick={onCerrar}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl animar-subir"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 px-6 pb-7 pt-6 text-white">
          <button
            type="button"
            onClick={onCerrar}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Cerrar"
          >
            <Icono nombre="x" size={16} />
          </button>
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
            Viajero 360 Pro
          </div>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
            {t("paywallTitulo")}
          </h2>
          <p className="mt-2 max-w-sm text-[14px] text-white/85">
            {motivoTexto}
          </p>
        </div>

        <div className="px-5 py-5">
          <div className="space-y-2.5">
            <PlanCard
              tipo="anual"
              activo={planFocado === "anual"}
              precio="US$ 24"
              periodo={t("paywallAnio")}
              ahorro={t("paywallAhorroAnual")}
              destacado={true}
              ventajas={[t("paywallV1"), t("paywallV2"), t("paywallV3"), t("paywallV4")]}
              onElegir={() => setPlanFocado("anual")}
              onComprar={() => abrirCheckout("anual")}
              btnLabel={t("paywallEmpezar")}
            />
            <PlanCard
              tipo="mensual"
              activo={planFocado === "mensual"}
              precio="US$ 4.99"
              periodo={t("paywallMes")}
              ahorro={null}
              destacado={false}
              ventajas={[t("paywallVAlt1"), t("paywallVAlt2")]}
              onElegir={() => setPlanFocado("mensual")}
              onComprar={() => abrirCheckout("mensual")}
              btnLabel={t("paywallEmpezar")}
            />
            <PlanCard
              tipo="lifetime"
              activo={planFocado === "lifetime"}
              precio="US$ 39"
              periodo={t("paywallUnaSolaVez")}
              ahorro={t("paywallLifetime100")}
              destacado={false}
              ventajas={[t("paywallVLife1")]}
              onElegir={() => setPlanFocado("lifetime")}
              onComprar={() => abrirCheckout("lifetime")}
              btnLabel={t("paywallEmpezar")}
            />
          </div>

          <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-slate-400">
            <span>✓ {t("paywallSinAtaduras")}</span>
            <span>·</span>
            <span>✓ {t("paywallDevolucion")}</span>
          </div>

          {!emailUsuario && (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              ⚠️ {t("paywallNecesitaLogin")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PlanCard({ activo, precio, periodo, ahorro, destacado, ventajas, onElegir, onComprar, btnLabel }) {
  return (
    <div
      onClick={onElegir}
      className={`cursor-pointer rounded-2xl border-2 p-4 transition ${
        activo
          ? "border-marca-500 bg-marca-50 shadow-md"
          : "border-slate-200 bg-white hover:border-marca-200"
      }`}
    >
      <div className="flex items-end justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[22px] font-extrabold tracking-tight text-marca-900">{precio}</span>
            <span className="text-[13px] font-semibold text-slate-500">/ {periodo}</span>
          </div>
          {ahorro && (
            <div className={`mt-0.5 text-[11.5px] font-bold uppercase tracking-wide ${destacado ? "text-emerald-600" : "text-amber-600"}`}>
              {ahorro}
            </div>
          )}
        </div>
        {destacado && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-emerald-700">
            ★ Top
          </span>
        )}
      </div>
      {ventajas?.length > 0 && (
        <ul className="mt-2.5 space-y-1 text-[12.5px] text-slate-600">
          {ventajas.map((v, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-emerald-500">✓</span>
              <span>{v}</span>
            </li>
          ))}
        </ul>
      )}
      {activo && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onComprar(); }}
          className="mt-3 w-full rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-3 text-[14px] font-bold text-white shadow-marca transition hover:brightness-105"
        >
          {btnLabel} →
        </button>
      )}
    </div>
  );
}
