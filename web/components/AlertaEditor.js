"use client";
import { useState } from "react";
import { useApp } from "@/lib/AppContext";
import AlertaPrecio from "./AlertaPrecio";

function authHeaders() {
  const h = {};
  try {
    const tk =
      localStorage.getItem("anduve_auth_token") ||
      sessionStorage.getItem("anduve_auth_token");
    if (tk) h.Authorization = `Bearer ${tk}`;
  } catch {}
  return h;
}

export default function AlertaEditor({ alerta: inicial }) {
  const { refrescarAlertas, t } = useApp();
  const [alerta, setAlerta] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);

  const fmt = (n) => "US$ " + Math.round(n).toLocaleString("en-US");

  function mostrarToast(texto, ok = true) {
    setToast({ texto, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function toggleActiva() {
    setGuardando(true);
    try {
      const res = await fetch("/api/alertas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id: alerta.id, activa: !alerta.activa }),
      });
      const d = await res.json();
      if (d.ok) {
        setAlerta(d.alerta);
        mostrarToast(d.alerta.activa ? "Alerta reactivada" : "Alerta pausada");
        // Que el badge "Pausada" del menu de usuario se actualice al instante.
        refrescarAlertas();
      } else {
        mostrarToast("Error al cambiar estado", false);
      }
    } catch {
      mostrarToast("Error de conexión", false);
    }
    setGuardando(false);
  }

  function handleActualizada(alertaActualizada) {
    setAlerta(alertaActualizada);
    setEditando(false);
    mostrarToast("Alerta actualizada correctamente");
  }

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-slate-600 dark:text-slate-400">
        <span>Te avisamos cuando el vuelo baje de</span>

        <div className="inline-flex items-center gap-2">
          <span className="text-[18px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
            {fmt(alerta.umbral)}
          </span>
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-marca-200 bg-marca-50 px-2.5 py-1 text-[11.5px] font-bold text-marca-700 transition hover:bg-marca-100 hover:border-marca-300 dark:border-marca-700 dark:bg-marca-900/30 dark:text-marca-400 dark:hover:bg-marca-900/50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </button>
        </div>

        {alerta.ultimoPrecioAvisado ? (
          <span
            title={t("alertaUltimoAvisoAyuda")}
            className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-[11.5px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            {t("alertaUltimoAviso")}: {fmt(alerta.ultimoPrecioAvisado)}
          </span>
        ) : null}

        {alerta.activa ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            · Activa
          </span>
        ) : (
          <span className="inline-flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              · Pausada
            </span>
            <button
              type="button"
              onClick={toggleActiva}
              disabled={guardando}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11.5px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            >
              {guardando ? "…" : "Reactivar alerta"}
            </button>
          </span>
        )}
      </div>

      {editando && (
        <AlertaPrecio
          ciudad={alerta.ciudad}
          pais={alerta.pais}
          iata={alerta.iata}
          alertaExistente={alerta}
          abrirDirecto={true}
          onActualizada={handleActualizada}
          onCerrar={() => setEditando(false)}
        />
      )}

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 animate-[fadeIn_0.2s] rounded-xl px-5 py-2.5 text-[13px] font-semibold shadow-lg ${
            toast.ok ? "bg-emerald-700 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.texto}
        </div>
      )}
    </>
  );
}
