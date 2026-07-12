"use client";
// Chat de viajeros por CIUDAD (feedback 2026-07-11: "no solo eventos — que
// los que están visitando Medellín puedan hablar, compartir experiencias,
// tal vez encontrarse"). Reutiliza la infra social de Anduve Live:
//   - presencia: ev:asis:ciudad-<slug> ("ando por aquí") con contador
//   - chat grupal: ev:chat:ciudad-<slug> (rate limit, sin links, 280 chars)
// Chat privado 1:1 = fase 2 (requiere inbox + bloqueos; documentado).
//
// UI: boton flotante "💬 Viajeros" sobre la vista de ciudad; abre un panel
// lateral/bottom-sheet con contador de presencia + chat grupal.

import { useEffect, useRef, useState } from "react";
import { track } from "@/lib/track";
import { useBrowserBackClose } from "@/lib/useBrowserBack";
import { Icono } from "./Icono";

function slugCiudad(nombre) {
  return "ciudad-" + (nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  try {
    const tk = localStorage.getItem("anduve_auth_token")
            || sessionStorage.getItem("anduve_auth_token");
    if (tk) h.Authorization = `Bearer ${tk}`;
  } catch {}
  return h;
}

export default function ChatViajeros({ ciudad }) {
  const [abierto, setAbierto] = useState(false);
  useBrowserBackClose(abierto, () => setAbierto(false));
  const id = slugCiudad(ciudad);

  const [mensajes, setMensajes] = useState(null);
  const [nAqui, setNAqui] = useState(0);
  const [aquiYo, setAquiYo] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [necesitaLogin, setNecesitaLogin] = useState(false);
  const finRef = useRef(null);
  const miUid = useRef(null);

  async function cargar() {
    try {
      const r = await fetch(`/api/eventos/chat?id=${encodeURIComponent(id)}`);
      const d = await r.json().catch(() => null);
      if (d?.ok) setMensajes(d.mensajes || []);
    } catch {}
  }

  // Presencia: cuantos "andan por aqui" (usa el endpoint de asistencia con
  // el id de la ciudad — misma mecanica que los eventos).
  async function marcarPresencia(voy) {
    try {
      const r = await fetch("/api/eventos/asistir", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id, voy }),
      });
      const d = await r.json().catch(() => null);
      if (r.status === 401) { setNecesitaLogin(true); return; }
      if (d?.ok) { setNAqui(d.asisten); setAquiYo(d.voy); }
    } catch {}
  }

  useEffect(() => {
    if (!abierto) return;
    cargar();
    track("chat_ciudad_abrir", { ciudad });
    const t = setInterval(cargar, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, id]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes?.length]);

  async function enviar(e) {
    e?.preventDefault();
    const tx = texto.trim();
    if (!tx || enviando) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/eventos/chat", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id, texto: tx }),
      });
      const d = await r.json().catch(() => null);
      if (r.status === 401) { setNecesitaLogin(true); return; }
      if (d?.ok && d.mensaje) {
        miUid.current = d.mensaje.uid;
        setMensajes((m) => [...(m || []), d.mensaje]);
        setTexto("");
        // Escribir en el chat implica "ando por aqui": presencia automatica.
        if (!aquiYo) marcarPresencia(true);
      }
    } catch {} finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {/* Boton flotante — queda arriba del boton de la Brujula (bottom-36). */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="fixed bottom-36 right-4 z-[3400] flex items-center gap-2 rounded-full bg-white px-4 py-3 text-marca-800 shadow-[0_10px_30px_rgba(2,6,23,.25)] ring-1 ring-slate-200 transition hover:-translate-y-0.5 dark:bg-slate-800 dark:text-marca-200 dark:ring-slate-600 md:bottom-24 md:right-5"
          aria-label={`Chat de viajeros en ${ciudad}`}
        >
          <span className="text-lg">💬</span>
          <span className="text-[13px] font-bold">Viajeros</span>
        </button>
      )}

      {abierto && (
        <div className="fixed inset-x-0 bottom-0 z-[3600] flex justify-center sm:inset-auto sm:bottom-5 sm:right-5">
          <div className="animar-subir flex h-[72vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,.3)] dark:bg-slate-800 sm:h-[560px] sm:rounded-3xl sm:shadow-[0_20px_50px_rgba(0,0,0,.3)]">
            {/* Cabecera */}
            <div className="bg-gradient-to-br from-marca-600 to-marca-800 px-4 py-3.5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[15px] font-bold leading-tight">💬 Viajeros en {ciudad}</div>
                  <div className="text-[11.5px] text-white/80">
                    {nAqui > 0 ? `${nAqui} ${nAqui === 1 ? "viajero anda" : "viajeros andan"} por aquí` : "Comparte tips, planes o júntense"}
                  </div>
                </div>
                <button onClick={() => setAbierto(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><Icono nombre="x" size={16} /></button>
              </div>
              <button
                onClick={() => marcarPresencia(!aquiYo)}
                className={`mt-2 rounded-full px-3 py-1.5 text-[11.5px] font-bold transition ${
                  aquiYo ? "bg-emerald-400 text-emerald-950" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {aquiYo ? "📍 Ando por aquí ✓" : "📍 Yo también ando por aquí"}
              </button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
              {mensajes === null && (
                <div className="py-6 text-center text-[12px] text-slate-400"><span className="spin" /></div>
              )}
              {mensajes?.length === 0 && (
                <div className="px-6 py-8 text-center text-[13px] leading-relaxed text-slate-400">
                  Nadie ha escrito aún. Rompe el hielo: ¿qué lugar te sorprendió hoy?
                </div>
              )}
              {mensajes?.map((m, i) => {
                const mio = miUid.current && m.uid === miUid.current;
                return (
                  <div key={`${m.ts}-${i}`} className={`flex ${mio ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13.5px] leading-snug ${
                      mio ? "bg-marca-600 text-white" : "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200"
                    }`}>
                      {!mio && <span className="mr-1.5 font-bold text-marca-600 dark:text-marca-300">{m.de}</span>}
                      {m.texto}
                    </div>
                  </div>
                );
              })}
              <div ref={finRef} />
            </div>

            {/* Input */}
            <div className="border-t border-slate-100 px-3 py-2.5 dark:border-slate-700">
              {necesitaLogin ? (
                <a href="/?login=1" className="block rounded-xl bg-marca-700 py-2.5 text-center text-[13px] font-bold text-white">
                  Crea tu cuenta gratis para escribir (leer es libre)
                </a>
              ) : (
                <form onSubmit={enviar} className="flex gap-2">
                  <input
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    maxLength={280}
                    placeholder="Escribe a los viajeros de la ciudad…"
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    disabled={enviando || !texto.trim()}
                    className="rounded-xl bg-marca-700 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
                  >
                    Enviar
                  </button>
                </form>
              )}
              <div className="mt-1.5 text-center text-[10px] text-slate-400">
                Sé buena gente. Sin links. Los mensajes son públicos y viven 120 días.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
