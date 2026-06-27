"use client";
// Modal de feedback: 3 textareas (qué te gusta, qué no, qué mejorarías) +
// email opcional. Cualquiera de los 3 textareas obligatorio. POSTea a
// /api/feedback que guarda en KV (lo lee el panel admin /panel).
//
// createPortal a document.body para evitar el bug clásico de position:fixed
// dentro de un ancestor con transform/will-change (Ofertas hover hace eso).
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/AppContext";
import { Icono } from "./Icono";
import { useBrowserBackClose } from "@/lib/useBrowserBack";

export default function Feedback({ abierto, onCerrar, onEnviado }) {
  // Flecha "atrás" del navegador cierra el modal en vez de salir del sitio.
  useBrowserBackClose(abierto, () => onCerrar?.());
  const { t, usuario, lang } = useApp();
  const [like, setLike] = useState("");
  const [dislike, setDislike] = useState("");
  const [mejora, setMejora] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const refLike = useRef(null);

  // Pre-rellena el email si el usuario está logueado.
  useEffect(() => {
    if (abierto && usuario?.email) setEmail(usuario.email);
  }, [abierto, usuario?.email]);

  // Lock del scroll del body + focus en el primer textarea + ESC para cerrar.
  useEffect(() => {
    if (!abierto) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => refLike.current?.focus(), 100);
    function onKey(e) { if (e.key === "Escape") onCerrar?.(); }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = original;
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  async function enviar(e) {
    e.preventDefault();
    if (!like.trim() && !dislike.trim() && !mejora.trim()) {
      setError(t("feedbackErrorVacio"));
      return;
    }
    setError("");
    setEnviando(true);
    try {
      const r = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          like: like.trim(),
          dislike: dislike.trim(),
          mejora: mejora.trim(),
          email: email.trim(),
          nombre: usuario?.nombre || "",
          url: typeof window !== "undefined" ? window.location.href : "",
          lang,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d?.error === "vacio" ? t("feedbackErrorVacio") : t("feedbackErrorEnviar"));
        return;
      }
      // Limpia y avisa al padre.
      setLike(""); setDislike(""); setMejora("");
      onEnviado?.();
      onCerrar?.();
    } catch {
      setError(t("feedbackErrorEnviar"));
    } finally {
      setEnviando(false);
    }
  }

  const contenido = (
    <div
      className="fixed inset-0 z-[7000] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
      onClick={onCerrar}
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-titulo"
    >
      <div
        className="animar-subir relative w-full max-w-lg overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-[0_24px_60px_rgba(15,118,110,.35)] dark:border-slate-700 dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-marca-600 to-marca-800 px-6 py-5 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">
                {t("feedbackEyebrow")}
              </div>
              <h2 id="feedback-titulo" className="mt-1 font-display text-2xl font-extrabold tracking-tight">
                {t("feedbackTitulo")}
              </h2>
              <p className="mt-1 text-[13.5px] text-white/85">{t("feedbackSub")}</p>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              aria-label={t("cerrar")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={enviar} className="space-y-4 px-6 py-5">
          <Campo
            etiqueta={t("feedbackLike")}
            emoji="👍"
            valor={like}
            onChange={setLike}
            placeholder={t("feedbackLikePh")}
            inputRef={refLike}
          />
          <Campo
            etiqueta={t("feedbackDislike")}
            emoji="👎"
            valor={dislike}
            onChange={setDislike}
            placeholder={t("feedbackDislikePh")}
          />
          <Campo
            etiqueta={t("feedbackMejora")}
            emoji="💡"
            valor={mejora}
            onChange={setMejora}
            placeholder={t("feedbackMejoraPh")}
          />

          {/* Email opcional */}
          <div>
            <label className="mb-1 block text-[12.5px] font-bold text-slate-600 dark:text-slate-300">
              {t("feedbackEmail")}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("feedbackEmailPh")}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-700"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCerrar}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13.5px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            >
              {t("cancelar")}
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-5 py-2.5 text-[13.5px] font-bold text-white shadow-marca transition hover:brightness-105 disabled:opacity-60"
            >
              {enviando ? t("feedbackEnviando") : (<><Icono nombre="send" size={14} /> {t("feedbackEnviar")}</>)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(contenido, document.body);
}

function Campo({ etiqueta, emoji, valor, onChange, placeholder, inputRef }) {
  return (
    <div>
      <label className="mb-1 flex items-center gap-1.5 text-[13px] font-bold text-slate-700 dark:text-slate-200">
        <span aria-hidden>{emoji}</span> {etiqueta}
      </label>
      <textarea
        ref={inputRef}
        rows={3}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={1500}
        className="w-full resize-y rounded-xl border border-slate-200 px-3.5 py-2.5 text-[14px] outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-700"
      />
    </div>
  );
}
