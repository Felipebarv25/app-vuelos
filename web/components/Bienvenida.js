"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/AppContext";
import { IDIOMAS } from "@/lib/idiomas";
import { Logo, LogoMarca } from "@/components/Logo";
import { Icono } from "@/components/Icono";

// Presupuesto modal lazy — solo se baja si el visitante hace click en "Probar
// sin cuenta". Para el visitante que solo viene a leer y se va, no paga el JS.
const Presupuesto = dynamic(() => import("@/components/Presupuesto"));

// Landing pre-login: scrolleable, full-screen, con propuesta de valor antes
// del formulario de auth. Aplica behavioral econ / neuromarketing: loss
// aversion en headline, social proof real (no inflado), scarcity legitima
// (datos cada 3h), reciprocity ("empezar es gratis"), curiosity gap,
// cognitive ease (Fraunces en titulos + espacios generosos).
//
// Auth flow: el login no esta al fondo de la pagina; se abre en un dialogo
// centrado disparado por (a) los botones del top-right "Ingresar"/"Crear
// cuenta", (b) el CTA del hero, o (c) URL ?login=1. Dentro del dialogo el
// usuario elige Google o email. Si elige email, cerramos el dialogo y
// mostramos PantallaMagicCode (full screen focus, sin distracciones).
// Wrapper para usar el Icono component al tamaño exacto de las pills de
// features del landing (28x28). Centraliza el sizing para no repetirlo.
function FeatureIcon({ nombre }) {
  return <Icono nombre={nombre} size={26} />;
}

export default function Bienvenida() {
  const {
    t,
    lang,
    cambiarIdioma,
    entrarGoogle,
    pedirCodigoEmail,
    verificarCodigoEmail,
  } = useApp();

  const [nombre, setNombre] = useState("");
  const [recordar, setRecordar] = useState(true);
  const [mostrarLogin, setMostrarLogin] = useState(false);
  const [montado, setMontado] = useState(false);
  // Trial anonimo del Presupuesto (audit B1 - 2026-06-25). El visitante puede
  // probar el feature signature SIN registrarse. Cuando elige una ciudad
  // dentro, guardamos la intencion en sessionStorage y abrimos el dialogo de
  // login. Tras autenticar, la home lee la intencion y abre esa ciudad.
  const [mostrarPresupuestoTrial, setMostrarPresupuestoTrial] = useState(false);
  // Social proof real: conteo en vivo desde /api/online. null = aún no lo
  // sabemos; número = lo que reporta KV. Si la red falla o KV no responde,
  // queda en null y la UI lo oculta (cero números inventados).
  const [online, setOnline] = useState(null);
  // Mejor oferta REAL para el anchor de precio. Antes el bloque decia
  // "vs ~US$1.200 armandolo por tu cuenta" — numero inventado sin fuente que
  // dañaba la seccion "Datos reales, no marketing" (lectura 360 2026-07-11).
  // Ahora: mejor ganga de ofertas.json comparada contra su MEDIANA historica
  // (dato que el detector ya calcula). Si el fetch falla, cae al copy estatico.
  const [ofertaTop, setOfertaTop] = useState(null);
  useEffect(() => {
    let vivo = true;
    fetch("/ofertas.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!vivo || !d?.rutas?.length) return;
        const conDcto = d.rutas.filter((r) => r.descuento >= 5 && r.mediana > r.precio);
        if (!conDcto.length) return;
        const top = conDcto.sort((a, b) => b.descuento - a.descuento)[0];
        setOfertaTop({ ...top, origenNombre: d.origenes?.[top.origen] || top.origen });
      })
      .catch(() => {});
    return () => { vivo = false; };
  }, []);

  // Auth config (Google / magic code disponibles segun env vars).
  const [authConfig, setAuthConfig] = useState({ google: false, magicCode: false });
  useEffect(() => { setMontado(true); }, []);
  useEffect(() => {
    fetch("/api/auth-config")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAuthConfig({ google: !!d.google, magicCode: !!d.magicCode }))
      .catch(() => {});
    // Auto-abrir login si llega con ?login=1 (ej. desde una accion que
    // requiere sesion como crear alerta).
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("login") === "1") setMostrarLogin(true);
    }
  }, []);

  // Polling del live counter (cada 45s). El endpoint tiene cache-control 10s
  // en su edge así que muchos usuarios concurrentes no saturan KV.
  useEffect(() => {
    let vivo = true;
    async function cargar() {
      try {
        const r = await fetch("/api/online", { cache: "no-store" });
        if (!r.ok) return;
        const d = await r.json();
        if (vivo && d?.ok && typeof d.online === "number") setOnline(d.online);
      } catch {}
    }
    cargar();
    const id = setInterval(cargar, 45000);
    return () => { vivo = false; clearInterval(id); };
  }, []);

  // ESC cierra el dialogo de login. Estandar de accesibilidad.
  useEffect(() => {
    if (!mostrarLogin) return;
    const onKey = (e) => { if (e.key === "Escape") setMostrarLogin(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mostrarLogin]);

  // Body lock mientras el dialogo esta abierto.
  useEffect(() => {
    if (!mostrarLogin) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [mostrarLogin]);

  // Flujo magic code (paso 1 = email, paso 2 = codigo).
  const [pasoMagic, setPasoMagic] = useState(0);
  const [emailInput, setEmailInput] = useState("");
  const [codigoInput, setCodigoInput] = useState("");
  const [magicCargando, setMagicCargando] = useState(false);
  const [magicError, setMagicError] = useState(null);

  async function enviarCodigo(e) {
    e?.preventDefault();
    setMagicError(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailInput.trim())) {
      setMagicError(t("authErrorEmail"));
      return;
    }
    setMagicCargando(true);
    const r = await pedirCodigoEmail(emailInput.trim());
    setMagicCargando(false);
    if (r.ok) setPasoMagic(2);
    else setMagicError(t("authErrorEnvio"));
  }

  async function verificarCodigo(e) {
    e?.preventDefault();
    setMagicError(null);
    const codigo = codigoInput.replace(/\D/g, "").slice(0, 6);
    if (codigo.length !== 6) {
      setMagicError(t("authErrorCodigo"));
      return;
    }
    setMagicCargando(true);
    const r = await verificarCodigoEmail(emailInput.trim(), codigo, nombre.trim() || null, recordar);
    setMagicCargando(false);
    if (!r.ok) setMagicError(t("authErrorCodigoMal"));
  }

  function elegirEmailEnDialogo() {
    setMostrarLogin(false);
    setPasoMagic(1);
  }

  // Si esta en flujo magic code -> pantalla dedicada (full screen focus).
  if (pasoMagic > 0) {
    return <PantallaMagicCode {...{
      t, pasoMagic, emailInput, codigoInput, nombre, recordar, magicCargando, magicError,
      setEmailInput, setCodigoInput, setNombre, setRecordar, setPasoMagic, setMagicError,
      enviarCodigo, verificarCodigo,
    }} />;
  }

  return (
    <div className="fixed inset-0 z-[5000] overflow-y-auto bg-slate-50 dark:bg-slate-900">
      {/* ============== HERO ============== */}
      <section className="relative min-h-[92vh] w-full overflow-hidden">
        {/* Slideshow de viajeros felices en distintos entornos. Cambia cada
            15s con crossfade. La 1ª foto carga con fetchpriority=high (LCP),
            las demás lazy. Todas son Unsplash License (uso comercial libre).
            Self-hosted en /public para evitar hotlink throttling de Unsplash. */}
        <HeroSlideshow />
        <div className="absolute inset-0 bg-gradient-to-b from-marca-900/85 via-marca-800/70 to-marca-900/95" />

        {/* Top nav: idioma + botones de auth */}
        <div className="relative z-10 flex items-center justify-between gap-3 px-5 pt-4 sm:px-8">
          {/* Marca discreta arriba izquierda */}
          <div className="hidden sm:block">
            <LogoMarca size={60} tono="claro" />
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.28em] text-white/85">
              {t("tagline")}
            </div>
          </div>

          {/* Acciones top-right */}
          <div className="ml-auto flex items-center gap-2.5">
            {/* Selector idioma compacto */}
            <div className="flex gap-1 rounded-full bg-white/10 p-1 backdrop-blur-md">
              {Object.entries(IDIOMAS).map(([cod]) => (
                <button
                  key={cod}
                  onClick={() => cambiarIdioma(cod)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider transition ${
                    lang === cod ? "bg-white text-marca-700" : "text-white/70 hover:text-white"
                  }`}
                >
                  {cod.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={() => setMostrarLogin(true)}
              className="rounded-full px-4 py-2 text-[13px] font-bold text-white/90 transition hover:text-white"
            >
              {t("navIngresar")}
            </button>
            <button
              onClick={() => setMostrarLogin(true)}
              className="rounded-full bg-acento-500 px-4 py-2 text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(244,99,63,.45)] transition hover:-translate-y-0.5 hover:bg-acento-600"
            >
              {t("navCrearCuenta")}
            </button>
          </div>
        </div>

        {/* Contenido hero centrado */}
        <div className="relative mx-auto flex min-h-[80vh] max-w-3xl flex-col items-center justify-center px-6 py-12 text-center text-white">
          {/* Logo animado — tamano reducido de 180 a 130 (audit 2026-06-29)
              para dar mas peso al copy sin sacrificar la presencia visual
              del walker+planeta. */}
          <div className="drop-shadow-[0_8px_20px_rgba(0,0,0,0.3)] mb-[-28px]">
            <Logo size={130} animado tono="claro" />
          </div>

          {/* Chip "precios actualizados ahora" — livelyness real */}
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-3.5 py-1.5 text-[12px] font-bold uppercase tracking-wider backdrop-blur-md">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
            {t("landingChipVivo")}
          </div>

          {/* Headline */}
          <h1 className="mt-5 font-display text-[42px] font-extrabold leading-[1.05] tracking-tight sm:text-[62px]">
            {t("landingHeadline1")}<br />
            <span className="text-acento-400">{t("landingHeadline2")}</span>
          </h1>

          <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-white/85 sm:text-[18px]">
            {t("landingSub")}
          </p>

          {/* CTAs: JERARQUIA INVERTIDA (audit 2026-06-29). Antes el CTA
              principal era "Crear cuenta" (alta friccion) y el secundario
              "Probar sin cuenta" (baja friccion). Se invirtio: ahora
              probar SIN registrarse es el CTA principal coral fuerte, y
              crear cuenta queda como link secundario mas discreto. La logica:
              deja que el usuario experimente el producto ANTES de pedirle
              nada. Los que valoren la app se registraran naturalmente al
              querer guardar un viaje o crear alerta. */}
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
            <button
              onClick={() => setMostrarPresupuestoTrial(true)}
              className="rounded-2xl bg-acento-500 px-8 py-3.5 text-[15.5px] font-bold text-white shadow-[0_10px_30px_rgba(244,115,77,.45)] transition hover:-translate-y-0.5 hover:bg-acento-600"
            >
              {t("landingCtaHero")} →
            </button>
            <button
              onClick={() => setMostrarLogin(true)}
              className="text-[14px] font-semibold text-white/85 underline-offset-4 hover:text-white hover:underline"
            >
              {t("navCrearCuenta")}
            </button>
          </div>

          {/* Chips honestos */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[12.5px] font-semibold text-white/80">
            <span className="rounded-full border border-white/25 px-3 py-1">✓ {t("landingChipGratis")}</span>
            <span className="rounded-full border border-white/25 px-3 py-1">✓ {t("landingChipSinTarjeta")}</span>
            <span className="rounded-full border border-white/25 px-3 py-1">✓ {t("landingChipReal")}</span>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/60 animate-bounce">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </section>

      {/* ============== QUÉ HACE ANDUVE (sección unificada) ==============
          Auditoría 2026-06-29: antes había 3 secciones que decían casi lo
          mismo: "Features" (mapas/vuelos/alertas/brújula), "Tu viaje en
          detalle" (día por día, GPS, comer, llegar), y "Cómo funciona" (3
          pasos genéricos). Todo eso convertía el landing en una lista
          repetitiva de bullets. Reemplazado por UNA sola sección con las
          4 funciones core reales del producto, cada una con su ícono
          representativo y una descripción concreta de qué HACE, no
          "cómo funciona" abstracto. */}
      <section className="bg-white py-20 px-6 dark:bg-slate-800">
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <div className="text-[11.5px] font-bold uppercase tracking-[0.25em] text-marca-600 dark:text-marca-300">
              {t("landingFeatEyebrow")}
            </div>
            <h2 className="mt-2 font-display text-[32px] font-extrabold tracking-tight text-marca-900 sm:text-[40px] dark:text-marca-200">
              {t("landingFeatTit")}
            </h2>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {[
              // El ejemplo de París apunta a la página pública /destino/paris-francia
              // (SSR, sin login). Antes iba a /?q=París y el visitante anónimo
              // volvía a caer en este mismo landing — botón que no cumplía.
              { icono: "map",      titKey: "landingFeat1Tit", subKey: "landingFeat1Sub", ctaKey: "landingFeat1Cta", href: "/destino/paris-francia" },
              { icono: "plane",    titKey: "landingFeat2Tit", subKey: "landingFeat2Sub", ctaKey: "landingFeat2Cta", href: "/ofertas" },
              { icono: "bell",     titKey: "landingFeat3Tit", subKey: "landingFeat3Sub" },
              { icono: "compass",  titKey: "landingFeat4Tit", subKey: "landingFeat4Sub" },
            ].map((f, i) => (
              <div
                key={i}
                className="group rounded-3xl border border-slate-100 bg-white p-6 shadow-suave transition hover:-translate-y-1 hover:border-marca-200 hover:shadow-media dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-marca-50 text-marca-700 dark:bg-marca-900/30 dark:text-marca-300">
                  <FeatureIcon nombre={f.icono} />
                </div>
                <h3 className="mt-4 text-[19px] font-extrabold text-marca-900 dark:text-marca-200">{t(f.titKey)}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600 dark:text-slate-400">{t(f.subKey)}</p>
                {f.href && (
                  <a
                    href={f.href}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] font-bold text-marca-700 transition group-hover:translate-x-0.5 hover:text-marca-800 dark:text-marca-300 dark:hover:text-marca-200"
                  >
                    {t(f.ctaKey)}
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 5l7 7-7 7" />
                    </svg>
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pro upsell REMOVIDO del pre-login (audit A4 - 2026-06-25): pedirle
          al visitante nuevo que considere Pro antes de probar el producto
          reduce trust. La pagina /pro sigue accesible desde el footer y se
          encuentra naturalmente desde el post-login. */}

      {/* ============== SOCIAL PROOF (live + stats honestos) ============== */}
      <section className="bg-marca-900 py-16 px-6 text-white">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-[28px] font-extrabold tracking-tight sm:text-[36px]">
            {t("landingSocialTit")}
          </h2>

          {/* Stack vertical centrado — orden de importancia descendente:
              (a) social proof real (live counter), (b) ancla de precio con
              valor concreto, (c) stat de producto de soporte (80+). */}
          <div className="mt-10 flex flex-col items-center gap-6">
            {/* Contador en vivo. Solo aparece con ≥5 — un "1 viajero ahora"
                es ANTI-social-proof: grita app vacía y daña mas de lo que
                suma (lectura 360 2026-07-11). Cero números inventados: si
                hay poca gente, simplemente no se muestra. */}
            {online != null && online >= 5 && (
              <div className="inline-flex items-center gap-2.5 rounded-full bg-emerald-500/15 px-4 py-2 ring-1 ring-emerald-400/40">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="text-[13.5px] font-bold">
                  {online}
                  <span className="ml-1.5 font-semibold uppercase tracking-wider text-white/80">
                    {online === 1 ? t("landingViajeroAhora") : t("landingViajerosAhora")}
                  </span>
                </span>
              </div>
            )}

            {/* Anchor de precio: card protagonista. Datos 100% REALES desde
                ofertas.json (mejor ganga + su mediana historica). El copy
                estatico "vs ~US$1.200 armandolo por tu cuenta" solo queda
                como fallback si el fetch falla — era un numero sin fuente
                que restaba credibilidad (lectura 360 2026-07-11). */}
            <div className="w-full max-w-md rounded-3xl bg-white/10 px-8 py-6 ring-1 ring-white/15 backdrop-blur-md">
              <div className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {t("landingPrecioEjemplo")}
              </div>
              {ofertaTop ? (
                <>
                  <div className="mt-2 font-display text-[28px] font-extrabold leading-tight sm:text-[32px]">
                    {ofertaTop.origenNombre} → {ofertaTop.ciudad}{" "}
                    <span className="text-acento-400">US${Math.round(ofertaTop.precio).toLocaleString("en-US")}</span>
                  </div>
                  <div className="mt-2 text-[13.5px] text-white/65 line-through">
                    {t("landingPrecioNormal").replace("{v}", `US$${Math.round(ofertaTop.mediana).toLocaleString("en-US")}`)}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-emerald-300">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    {t("landingPrecioBajo").replace("{n}", ofertaTop.descuento)}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-2 font-display text-[28px] font-extrabold leading-tight sm:text-[32px]">
                    {t("landingPrecioRuta")} <span className="text-acento-400">US$733</span>
                  </div>
                  <div className="mt-2 text-[13.5px] text-white/65 line-through">
                    {t("landingPrecioVs")}
                  </div>
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[12px] font-bold uppercase tracking-wider text-emerald-300">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                    {t("landingPrecioAhorro")}
                  </div>
                </>
              )}
            </div>

            {/* Stat de producto en línea pequeña como caption de soporte. */}
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[36px] font-extrabold text-acento-400">80+</span>
              <span className="text-[13px] font-semibold uppercase tracking-wider text-white/70">
                {t("landingStatDestinos")}
              </span>
            </div>
          </div>

          {/* CTA final */}
          <button
            onClick={() => setMostrarLogin(true)}
            className="mt-10 rounded-2xl bg-acento-500 px-7 py-3.5 text-[15.5px] font-bold text-white shadow-[0_10px_30px_rgba(244,99,63,.45)] transition hover:-translate-y-0.5 hover:bg-acento-600"
          >
            {t("landingCtaFinal")} →
          </button>
        </div>
      </section>

      {/* ============== FOOTER simple ============== */}
      <footer className="bg-marca-900 px-6 py-8 text-center text-[12.5px] text-white/50">
        <div className="flex flex-wrap items-center justify-center gap-4">
          <a href="/privacidad" className="hover:text-white/80">{t("footerPrivacidad")}</a>
          <span className="text-white/30">·</span>
          <a href="/terminos" className="hover:text-white/80">{t("footerTerminos")}</a>
        </div>
        <div className="mt-3">© {new Date().getFullYear()} Anduve · {t("footer")}</div>
      </footer>

      {/* ============== PRESUPUESTO TRIAL ANONIMO ============== */}
      {mostrarPresupuestoTrial && montado && (
        <PresupuestoTrial
          t={t}
          onCerrar={() => setMostrarPresupuestoTrial(false)}
          onIntent={() => {
            // Cerramos el modal y abrimos el dialogo de login. Al autenticar,
            // la home lee anduve_intent_q de sessionStorage y abre la ciudad.
            setMostrarPresupuestoTrial(false);
            setMostrarLogin(true);
          }}
        />
      )}

      {/* ============== DIÁLOGO LOGIN ============== */}
      {mostrarLogin && montado && createPortal(
        <div
          className="fixed inset-0 z-[6000] flex items-center justify-center bg-slate-900/60 p-4 animar-aparecer"
          onClick={() => setMostrarLogin(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl animar-subir dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <LogoMarca size={44} animado />
                <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  {t("tagline")}
                </div>
              </div>
              <button
                onClick={() => setMostrarLogin(false)}
                aria-label="Cerrar"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <h3 className="mt-3 font-display text-[24px] font-extrabold tracking-tight text-marca-900">
              {t("loginDialogTit")}
            </h3>
            <p className="mt-1 text-[13.5px] text-slate-500">{t("loginDialogSub")}</p>

            <div className="mt-5">
              <button
                onClick={authConfig.google ? entrarGoogle : undefined}
                disabled={!authConfig.google}
                className={`flex w-full items-center justify-center gap-3 rounded-2xl border py-3.5 text-[15px] font-bold shadow-suave transition ${
                  authConfig.google
                    ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:shadow-media dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                    : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed dark:border-slate-700 dark:bg-slate-700"
                }`}
              >
                <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
                  <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.1 29.5 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 44c5.4 0 10.3-2.1 13.9-5.4l-6.4-5.4C29.4 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.6 5.1C9.7 39.7 16.3 44 24 44z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.4 5.4c-.5.4 6.5-4.7 6.5-15 0-1.3-.1-2.4-.4-3.5z"/>
                </svg>
                {t("entrarGoogle")}
              </button>

              {authConfig.magicCode && (
                <>
                  <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    <span className="h-px flex-1 bg-slate-200" />
                    {t("oContinuar")}
                    <span className="h-px flex-1 bg-slate-200" />
                  </div>
                  <button
                    onClick={elegirEmailEnDialogo}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-marca-200 bg-marca-50 py-3.5 text-[15px] font-bold text-marca-700 transition hover:bg-marca-100 dark:border-marca-800 dark:bg-marca-900/30 dark:text-marca-300"
                  >
                    ✉️ {t("authEntrarEmail")}
                  </button>
                </>
              )}

              {!authConfig.google && !authConfig.magicCode && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12.5px] text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  {t("authConfigurando")}
                </div>
              )}

              <label className="mt-5 flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-slate-600">
                <input
                  type="checkbox"
                  checked={recordar}
                  onChange={(e) => setRecordar(e.target.checked)}
                  className="h-4 w-4 cursor-pointer rounded border-slate-300 text-marca-600 focus:ring-marca-500"
                />
                {t("authRecordar")}
              </label>

              <div className="mt-3 text-center text-[11.5px] text-slate-400">
                {t("landingLoginPrivacidad")}
              </div>

              {/* NOTA: las cuentas demo (Pro / Free) se quitaron de la UI el
                  2026-06-22 — decisión del usuario para empujar la creación
                  de cuenta real. El endpoint /api/auth/demo se mantiene
                  funcional para verificación admin/QA (curl manual). */}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Pantalla dedicada del flujo magic code (paso 1 email / paso 2 código).
function PantallaMagicCode({
  t, pasoMagic, emailInput, codigoInput, nombre, recordar, magicCargando, magicError,
  setEmailInput, setCodigoInput, setNombre, setRecordar, setPasoMagic, setMagicError,
  enviarCodigo, verificarCodigo,
}) {
  return (
    <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-gradient-to-br from-marca-500 via-marca-600 to-marca-900 dark:from-slate-900 dark:via-slate-800 dark:to-marca-900">
      <div className="bg-white rounded-3xl p-7 w-full max-w-sm shadow-[0_24px_60px_rgba(15,118,110,.45)] animar-subir dark:bg-slate-800">
        <div className="flex justify-center text-marca-600"><Logo size={64} animado /></div>

        {pasoMagic === 1 && (
          <form onSubmit={enviarCodigo} className="mt-5">
            <div className="text-[13px] font-bold text-slate-600 mb-2">{t("authTuEmail")}</div>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder={t("authPlaceholderEmail")}
              className="w-full px-3.5 py-3 rounded-xl border border-slate-200 text-base"
              autoFocus
            />
            {magicError && (
              <div className="mt-2 text-[12.5px] font-semibold text-red-600">{magicError}</div>
            )}
            <button
              type="submit"
              disabled={magicCargando}
              className="w-full mt-4 py-3.5 rounded-2xl border-0 bg-gradient-to-r from-marca-500 to-marca-600 text-white text-base font-bold shadow-marca disabled:opacity-60"
            >
              {magicCargando ? "…" : t("authEnviarCodigo")} →
            </button>
            <button
              type="button"
              onClick={() => { setPasoMagic(0); setMagicError(null); }}
              className="w-full mt-2 py-2 text-[13px] font-semibold text-slate-500"
            >
              ← {t("authVolver")}
            </button>
          </form>
        )}

        {pasoMagic === 2 && (
          <form onSubmit={verificarCodigo} className="mt-5">
            <div className="text-[13px] text-slate-600 mb-2">
              {t("authMandamosCodigo")} <b className="text-marca-700">{emailInput}</b>
            </div>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              value={codigoInput}
              onChange={(e) => setCodigoInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder={t("authPlaceholderCodigo")}
              className="w-full px-3.5 py-3 rounded-xl border-2 border-marca-200 text-center text-2xl font-extrabold tracking-[0.4em] font-mono"
              autoFocus
            />
            <div className="mt-3 text-[12.5px] font-semibold text-slate-500">{t("authComoLlamamos")}</div>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={t("authPlaceholderNombre")}
              className="w-full mt-1 px-3.5 py-2.5 rounded-xl border border-slate-200 text-base"
            />

            <label className="mt-3 flex cursor-pointer items-center gap-2.5 text-[13px] font-medium text-slate-600">
              <input
                type="checkbox"
                checked={recordar}
                onChange={(e) => setRecordar(e.target.checked)}
                className="h-4 w-4 cursor-pointer rounded border-slate-300 text-marca-600 focus:ring-marca-500"
              />
              {t("authRecordar")}
            </label>

            {magicError && (
              <div className="mt-2 text-[12.5px] font-semibold text-red-600">{magicError}</div>
            )}
            <button
              type="submit"
              disabled={magicCargando}
              className="w-full mt-4 py-3.5 rounded-2xl border-0 bg-gradient-to-r from-marca-500 to-marca-600 text-white text-base font-bold shadow-marca disabled:opacity-60"
            >
              {magicCargando ? "…" : t("authVerificar")} →
            </button>
            <button
              type="button"
              onClick={() => { setPasoMagic(1); setCodigoInput(""); setMagicError(null); }}
              className="w-full mt-2 py-2 text-[13px] font-semibold text-slate-500"
            >
              ← {t("authCambiarEmail")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// Modal de Presupuesto en MODO TRIAL ANONIMO. El visitante puede usarlo sin
// haberse registrado. Si elige una ciudad (boton Planear), guardamos la
// intencion en sessionStorage como "anduve_intent_q" y abrimos el dialogo de
// login. Tras autenticar la home lee la intencion y la abre directamente.
function PresupuestoTrial({ t, onCerrar, onIntent }) {
  // OJO: pasar `t` SIEMPRE. Sin él, Presupuesto usa su default (k) => k y el
  // visitante ve las claves i18n crudas ("presupTitulo", "PRESUPREGION"...)
  // en el CTA principal del landing. Bug detectado en la lectura 360 2026-07-11.
  return (
    <Presupuesto
      t={t}
      onCerrar={onCerrar}
      onElegirCiudad={(d) => {
        try {
          sessionStorage.setItem("anduve_intent_q", `${d.ciudad}, ${d.pais}`);
        } catch {}
        onIntent?.();
      }}
    />
  );
}

// Slideshow del hero del landing pre-login. Rota cada 15s entre 7 fotos
// Unsplash (license libre, ver public/creditos.txt). Crossfade de 1.2s.
// La 1ª carga eager (LCP); las demás lazy. Cada índice activo tiene
// opacity=1, los demás opacity=0. Funciona sin JS adicional (CSS transition).
const HERO_FOTOS = 7;
const HERO_INTERVALO_MS = 15000;

function HeroSlideshow() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % HERO_FOTOS), HERO_INTERVALO_MS);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="absolute inset-0">
      {Array.from({ length: HERO_FOTOS }, (_, idx) => (
        <img
          key={idx}
          src={`/landing-hero-${idx + 1}.jpg`}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1200ms] ease-in-out"
          style={{ opacity: idx === i ? 1 : 0 }}
          loading={idx === 0 ? "eager" : "lazy"}
          fetchpriority={idx === 0 ? "high" : "auto"}
        />
      ))}
    </div>
  );
}
