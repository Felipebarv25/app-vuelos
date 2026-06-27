"use client";
// Menu desplegable del usuario en el header.
//  - Avatar (inicial del nombre)
//  - Estado: Free / Pro Mensual / Pro Anual / Lifetime
//  - Mis alertas (con contador)
//  - Mis viajes (guardados)
//  - Hazte Pro / Gestionar suscripcion
//  - Salir

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { Icono } from "./Icono";
import Feedback from "./Feedback";
import Toast from "./Toast";

export default function MenuUsuario({ oscuro = false }) {
  const { t, usuario, pro, plan, salir, abrirPaywall } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [alertas, setAlertas] = useState([]);
  const [mostrarFeedback, setMostrarFeedback] = useState(false);
  const [graciasFeedback, setGraciasFeedback] = useState(false);
  const ref = useRef(null);

  // Cargar contador de alertas cuando se abre el menu (no en cada render).
  useEffect(() => {
    if (!abierto || !usuario?.email) return;
    let vivo = true;
    const headers = {};
    try {
      const tk = localStorage.getItem("anduve_auth_token")
              || sessionStorage.getItem("anduve_auth_token");
      if (tk) headers.Authorization = `Bearer ${tk}`;
    } catch {}
    fetch("/api/alertas", { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => vivo && d?.ok && setAlertas(d.alertas || []))
      .catch(() => {});
    return () => { vivo = false; };
  }, [abierto, usuario?.email]);

  // Click afuera = cerrar.
  useEffect(() => {
    if (!abierto) return;
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [abierto]);

  if (!usuario) return null;
  const inicial = (usuario.nombre || usuario.email || "V").trim().charAt(0).toUpperCase();
  const etiquetaPlan = pro
    ? plan === "lifetime" ? "Lifetime"
    : plan === "anual" ? "Pro Anual"
    : plan === "mensual" ? "Pro Mensual"
    : "Pro"
    : "Gratis";

  async function borrarAlerta(id) {
    const headers = {};
    try {
      const tk = localStorage.getItem("anduve_auth_token")
              || sessionStorage.getItem("anduve_auth_token");
      if (tk) headers.Authorization = `Bearer ${tk}`;
    } catch {}
    await fetch(`/api/alertas?id=${id}`, { method: "DELETE", headers });
    setAlertas((arr) => arr.filter((a) => a.id !== id));
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        className={`flex items-center gap-2 rounded-full border px-2.5 py-1.5 transition ${
          oscuro
            ? "border-white/30 bg-white/10 text-white hover:bg-white/20"
            : "border-slate-200 bg-white text-slate-700 hover:border-marca-200"
        }`}
        aria-label={t("menuUsuarioAria")}
      >
        {usuario.foto ? (
          <img
            src={usuario.foto}
            alt=""
            className="h-8 w-8 rounded-full border border-white/30 object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-extrabold ${
            oscuro ? "bg-white/25 text-white" : "bg-marca-100 text-marca-700"
          }`}>
            {inicial}
          </span>
        )}
        <span className="hidden max-w-[120px] truncate text-[13px] font-semibold sm:inline">
          {(() => {
            const nombre = usuario.nombre || t("defaultNombre");
            // Solo primer nombre, capitalizado. "felipe barrera vargas" -> "Felipe".
            // El nombre completo va en el dropdown abierto (linea 110).
            const primer = nombre.trim().split(/\s+/)[0] || "";
            return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase();
          })()}
        </span>
        {pro && (
          <span className="rounded-full bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-900">
            ★
          </span>
        )}
        <span className={`text-[10px] ${oscuro ? "text-white/70" : "text-slate-400"}`}>▾</span>
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-[1200] mt-2 w-[280px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/40">
            <div className="text-[14px] font-extrabold text-marca-900 dark:text-slate-100">
              {usuario.nombre || t("defaultNombre")}
            </div>
            {usuario.email && (
              <div className="truncate text-[12px] text-slate-500 dark:text-slate-400">{usuario.email}</div>
            )}
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-marca-700 ring-1 ring-marca-100 dark:bg-slate-700 dark:text-marca-400 dark:ring-slate-600">
              {pro && "★ "}{etiquetaPlan}
            </div>
          </div>

          {/* Mis alertas */}
          <div className="px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("menuMisAlertas")} ({alertas.length})
            </div>
            {alertas.length === 0 ? (
              <div className="mt-1 text-[12.5px] text-slate-400 dark:text-slate-500">
                {t("menuSinAlertas")}
              </div>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {alertas.slice(0, 5).map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-[12.5px] dark:bg-slate-700/60"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold text-marca-900 dark:text-slate-200">
                        {a.ciudad} <span className="text-slate-400">·</span> <span className="text-amber-700 dark:text-amber-400">≤ US$ {a.umbral}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => borrarAlerta(a.id)}
                      className="ml-2 text-[11px] text-slate-400 hover:text-red-500"
                      aria-label={t("menuBorrarAlerta")}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-700">
            {!pro && (
              <button
                type="button"
                onClick={() => { setAbierto(false); abrirPaywall("guardar"); }}
                className="block w-full bg-gradient-to-r from-amber-50 to-amber-100/60 px-4 py-3 text-left text-[13.5px] font-bold text-amber-800 transition hover:from-amber-100 dark:from-amber-900/30 dark:to-amber-800/20 dark:text-amber-300 dark:hover:from-amber-900/50"
              >
                ★ {t("menuHazteProCTA")}
              </button>
            )}
            {pro && (
              <a
                href="https://app.lemonsqueezy.com/my-orders"
                target="_blank"
                rel="noopener"
                className="block w-full px-4 py-3 text-left text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {t("menuGestionarPro")} ↗
              </a>
            )}
            <a
              href="/pro"
              className="block w-full px-4 py-3 text-left text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t("menuPlanes")}
            </a>
            <button
              type="button"
              onClick={() => { setAbierto(false); setMostrarFeedback(true); }}
              className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Icono nombre="messageSquare" size={15} /> {t("menuFeedback")}
            </button>
            <button
              type="button"
              onClick={() => { setAbierto(false); salir(); }}
              className="block w-full px-4 py-3 text-left text-[13.5px] font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              {t("salir")}
            </button>
          </div>
        </div>
      )}

      <Feedback
        abierto={mostrarFeedback}
        onCerrar={() => setMostrarFeedback(false)}
        onEnviado={() => {
          setGraciasFeedback(true);
          setTimeout(() => setGraciasFeedback(false), 2800);
        }}
      />
      <Toast mostrar={graciasFeedback} texto={t("feedbackGracias")} icono="check" />
    </div>
  );
}
