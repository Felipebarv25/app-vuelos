"use client";
import { useRef, useState } from "react";

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
  const [alerta, setAlerta] = useState(inicial);
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(String(alerta.umbral));
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState(null);
  const inputRef = useRef(null);
  const guardandoRef = useRef(false);

  const fmt = (n) => "US$ " + Math.round(n).toLocaleString("en-US");

  function mostrarToast(texto, ok = true) {
    setToast({ texto, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function guardar() {
    if (guardandoRef.current) return;
    const nuevo = Math.round(Number(valor));
    if (!Number.isFinite(nuevo) || nuevo <= 0) {
      mostrarToast("El valor debe ser mayor a 0", false);
      return;
    }
    if (nuevo === alerta.umbral) {
      setEditando(false);
      return;
    }
    guardandoRef.current = true;
    setGuardando(true);
    try {
      const res = await fetch("/api/alertas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ id: alerta.id, umbral: nuevo }),
      });
      const d = await res.json();
      if (d.ok) {
        setAlerta(d.alerta);
        setEditando(false);
        mostrarToast("Umbral actualizado a " + fmt(nuevo));
      } else {
        mostrarToast(d.motivo === "sin-sesion" ? "Inicia sesión para editar" : "Error al guardar", false);
      }
    } catch {
      mostrarToast("Error de conexión", false);
    }
    setGuardando(false);
    guardandoRef.current = false;
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
      } else {
        mostrarToast("Error al cambiar estado", false);
      }
    } catch {
      mostrarToast("Error de conexión", false);
    }
    setGuardando(false);
  }

  function iniciarEdicion() {
    setValor(String(alerta.umbral));
    setEditando(true);
    setTimeout(() => inputRef.current?.select(), 50);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") { e.preventDefault(); guardar(); }
    if (e.key === "Escape") setEditando(false);
  }

  return (
    <>
      {/* Precio + estado */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-[14px] text-slate-600 dark:text-slate-400">
        <span>Te avisamos cuando el vuelo baje de</span>

        {editando ? (
          <div className="flex items-center gap-2 rounded-xl border border-marca-200 bg-white px-3 py-2 shadow-sm dark:border-marca-700 dark:bg-slate-800">
            <span className="text-[13px] font-medium text-slate-500">US$</span>
            <input
              ref={inputRef}
              type="number"
              min="1"
              step="1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-[80px] rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-[16px] font-extrabold tabular-nums text-slate-900 outline-none focus:border-marca-500 focus:ring-2 focus:ring-marca-200 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              disabled={guardando}
              autoFocus
            />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); guardar(); }}
              disabled={guardando}
              className="rounded-lg bg-marca-700 px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:bg-marca-800 disabled:opacity-50"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg px-2 py-1.5 text-[12px] font-medium text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-300"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2">
            <span className="text-[18px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
              {fmt(alerta.umbral)}
            </span>
            <button
              type="button"
              onClick={iniciarEdicion}
              className="inline-flex items-center gap-1 rounded-lg border border-marca-200 bg-marca-50 px-2.5 py-1 text-[11.5px] font-bold text-marca-700 transition hover:bg-marca-100 hover:border-marca-300 dark:border-marca-700 dark:bg-marca-900/30 dark:text-marca-400 dark:hover:bg-marca-900/50"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Editar
            </button>
          </div>
        )}

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

      {/* Toast */}
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
