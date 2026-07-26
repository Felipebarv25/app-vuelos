"use client";
// Menu desplegable del usuario en el header.
//  - Avatar (inicial del nombre)
//  - Estado: Free / Pro Mensual / Pro Anual / Lifetime
//  - Mis alertas (con contador)
//  - Mis viajes (guardados)
//  - Hazte Pro / Gestionar suscripcion
//  - Salir

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/AppContext";
import { Icono } from "./Icono";
import Feedback from "./Feedback";
import Toast from "./Toast";

export default function MenuUsuario({ oscuro = false }) {
  // Las alertas vienen del contexto (fuente unica compartida con AlertasChip).
  // Al abrir el menu se refrescan, porque puede haberse creado una alerta en
  // otra pantalla desde la ultima carga.
  const { t, usuario, pro, plan, salir, abrirPaywall,
          alertas: alertasCtx, refrescarAlertas } = useApp();
  const alertas = alertasCtx || [];
  const [abierto, setAbierto] = useState(false);
  const [mostrarFeedback, setMostrarFeedback] = useState(false);
  const [graciasFeedback, setGraciasFeedback] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [editValor, setEditValor] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    if (abierto && usuario?.email) refrescarAlertas();
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

  function authHdrs() {
    const h = {};
    try {
      const tk = localStorage.getItem("anduve_auth_token")
              || sessionStorage.getItem("anduve_auth_token");
      if (tk) h.Authorization = `Bearer ${tk}`;
    } catch {}
    return h;
  }

  // Tras cualquier escritura se refresca el contexto, para que el contador de
  // este menu Y el del chip del home queden al dia sin recargar la pagina.
  async function borrarAlerta(id) {
    await fetch(`/api/alertas?id=${id}`, { method: "DELETE", headers: authHdrs() });
    await refrescarAlertas();
  }

  async function guardarUmbral(id) {
    const nuevo = Math.round(Number(editValor));
    if (!Number.isFinite(nuevo) || nuevo <= 0) { setEditandoId(null); return; }
    const viejo = alertas.find((a) => a.id === id);
    if (viejo && nuevo === viejo.umbral) { setEditandoId(null); return; }
    await fetch("/api/alertas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHdrs() },
      body: JSON.stringify({ id, umbral: nuevo }),
    });
    setEditandoId(null);
    await refrescarAlertas();
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
            {/* El contador cuenta TODAS las alertas del usuario. Antes filtraba
                por `activa !== false`, pero `activa: false` no significa que el
                usuario la apagara: marcarDisparada() la pone en false al enviar
                el email (anti-spam). Con 5 alertas de las que 2 ya avisaron, el
                encabezado decia "(3)" mientras la lista mostraba 5. Las que ya
                avisaron se marcan abajo con su propio badge. */}
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t("menuMisAlertas")} ({alertas.length})
            </div>
            {alertas.length === 0 ? (
              <div className="mt-1 text-[12.5px] text-slate-400 dark:text-slate-500">
                {t("menuSinAlertas")}
              </div>
            ) : (
              /* Antes se cortaba en slice(0, 5) sin avisar: con mas de 5
                 alertas las demas quedaban invisibles y no habia forma de
                 llegar a ellas (no existe una pagina indice de alertas). Ahora
                 se listan todas, con scroll para que el menu no crezca sin
                 limite. */
              <ul className="mt-1.5 max-h-[240px] space-y-1.5 overflow-y-auto pr-0.5">
                {alertas.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5 text-[12.5px] dark:bg-slate-700/60"
                  >
                    <Link
                      href={`/alertas/${a.id}`}
                      onClick={() => setAbierto(false)}
                      className="min-w-0 shrink truncate font-semibold text-marca-900 hover:text-marca-700 dark:text-slate-200 dark:hover:text-marca-300"
                    >
                      {a.ciudad}
                    </Link>
                    {/* Una alerta ya disparada no vuelve a enviar email hasta
                        reactivarla. Sin esta marca se veia igual que una activa
                        y no habia forma de saber por que dejo de avisar. */}
                    {a.activa === false && (
                      <span
                        title={t("menuAlertaAvisadaAyuda")}
                        className="ml-1 shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-slate-500 dark:bg-slate-600 dark:text-slate-300"
                      >
                        {t("menuAlertaAvisada")}
                      </span>
                    )}
                    <span className="mx-1 text-slate-400">·</span>
                    {editandoId === a.id ? (
                      <span className="inline-flex items-center gap-1">
                        <span className="text-[11px] text-slate-400">US$</span>
                        <input
                          type="number"
                          min="1"
                          value={editValor}
                          onChange={(e) => setEditValor(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") guardarUmbral(a.id); if (e.key === "Escape") setEditandoId(null); }}
                          onBlur={() => guardarUmbral(a.id)}
                          className="w-[60px] rounded border border-marca-300 bg-white px-1.5 py-0.5 text-[12px] font-bold tabular-nums text-slate-900 outline-none focus:ring-1 focus:ring-marca-400 dark:border-marca-600 dark:bg-slate-700 dark:text-slate-100"
                          autoFocus
                        />
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setEditandoId(a.id); setEditValor(String(a.umbral)); }}
                        className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                        title="Editar umbral"
                      >
                        ≤&nbsp;US$&nbsp;{a.umbral}
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="ml-0.5 text-slate-400"><path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
                      </button>
                    )}
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
            <Link
              href="/pro"
              onClick={() => setAbierto(false)}
              className="block w-full px-4 py-3 text-left text-[13.5px] font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {t("menuPlanes")}
            </Link>
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
