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

  const fmt = (n) => "US$ " + Math.round(n).toLocaleString("en-US");

  function mostrarToast(texto, ok = true) {
    setToast({ texto, ok });
    setTimeout(() => setToast(null), 2500);
  }

  async function guardar() {
    const nuevo = Math.round(Number(valor));
    if (!Number.isFinite(nuevo) || nuevo <= 0) {
      mostrarToast("El valor debe ser mayor a 0", false);
      return;
    }
    if (nuevo === alerta.umbral) {
      setEditando(false);
      return;
    }
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
        mostrarToast("Umbral actualizado");
      } else {
        mostrarToast(d.motivo === "sin-sesion" ? "Inicia sesión para editar" : "Error al guardar", false);
      }
    } catch {
      mostrarToast("Error de conexión", false);
    }
    setGuardando(false);
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
    setTimeout(() => inputRef.current?.select(), 30);
  }

  function onKeyDown(e) {
    if (e.key === "Enter") guardar();
    if (e.key === "Escape") setEditando(false);
  }

  return (
    <>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2 text-[13.5px] text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          Te avisamos cuando el vuelo baje de{" "}
          {editando ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="text-slate-500">US$</span>
              <input
                ref={inputRef}
                type="number"
                min="1"
                step="1"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                onKeyDown={onKeyDown}
                onBlur={() => !guardando && guardar()}
                className="w-[90px] rounded-lg border border-marca-300 bg-white px-2 py-1 text-[15px] font-bold tabular-nums text-slate-900 outline-none ring-2 ring-marca-200 focus:border-marca-500 focus:ring-marca-300 dark:border-marca-600 dark:bg-slate-800 dark:text-slate-100 dark:ring-marca-800"
                disabled={guardando}
                autoFocus
              />
              <button
                type="button"
                onClick={guardar}
                disabled={guardando}
                className="rounded-md bg-marca-700 px-2.5 py-1 text-[11.5px] font-bold text-white transition hover:bg-marca-800 disabled:opacity-50"
              >
                {guardando ? "…" : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => setEditando(false)}
                className="rounded-md px-2 py-1 text-[11.5px] font-medium text-slate-500 transition hover:text-slate-700 dark:hover:text-slate-300"
              >
                Cancelar
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={iniciarEdicion}
              className="group inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition hover:bg-marca-50 dark:hover:bg-marca-900/30"
              title="Clic para editar el umbral"
            >
              <b className="text-slate-900 dark:text-slate-100">{fmt(alerta.umbral)}</b>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-slate-400 transition group-hover:text-marca-600 dark:group-hover:text-marca-400"
              >
                <path d="M17 3a2.85 2.85 0 114 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
          )}
        </span>

        {alerta.activa ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            · Activa
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              · Disparada (pausada)
            </span>
            <button
              type="button"
              onClick={toggleActiva}
              disabled={guardando}
              className="rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
            >
              {guardando ? "…" : "Reactivar"}
            </button>
          </span>
        )}
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-xl px-5 py-2.5 text-[13px] font-semibold shadow-lg transition-all ${
            toast.ok
              ? "bg-emerald-700 text-white"
              : "bg-red-600 text-white"
          }`}
        >
          {toast.texto}
        </div>
      )}
    </>
  );
}
