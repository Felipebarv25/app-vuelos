"use client";
import { useEffect, useRef, useState } from "react";

// Chat flotante "Asesor de viajes" (Brújula). Conversa con /api/asesor (Claude).
// Si el backend no tiene API key configurada, muestra un aviso amable.
export default function Asesor({ t = (k) => k, usuario, onPlanear }) {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]); // {role, content}
  const [texto, setTexto] = useState("");
  const [cargando, setCargando] = useState(false);
  const [sinClave, setSinClave] = useState(false);
  const finRef = useRef(null);
  const inicializado = useRef(false);

  // Saludo inicial al abrir por primera vez.
  useEffect(() => {
    if (abierto && !inicializado.current) {
      inicializado.current = true;
      const nombre = usuario?.nombre ? `, ${usuario.nombre}` : "";
      setMensajes([{ role: "assistant", content: t("asesorSaludo").replace("{nombre}", nombre) }]);
    }
  }, [abierto, usuario, t]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, cargando]);

  async function enviar(e) {
    e?.preventDefault();
    const pregunta = texto.trim();
    if (!pregunta || cargando) return;
    setTexto("");
    setSinClave(false);

    // Historial para la API: solo user/assistant reales (sin el saludo inicial si quieres,
    // pero lo dejamos como contexto). Añadimos la nueva pregunta.
    const historial = [...mensajes, { role: "user", content: pregunta }];
    setMensajes([...historial, { role: "assistant", content: "" }]);
    setCargando(true);

    try {
      const r = await fetch("/api/asesor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mensajes: historial.filter((m) => m.role === "user" || m.role === "assistant"),
        }),
      });

      if (r.status === 503) {
        setSinClave(true);
        setMensajes((m) => m.slice(0, -1)); // quita el placeholder vacío
        setCargando(false);
        return;
      }
      if (!r.ok || !r.body) throw new Error("error");

      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let acumulado = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acumulado += dec.decode(value, { stream: true });
        setMensajes((m) => {
          const copia = m.slice();
          copia[copia.length - 1] = { role: "assistant", content: acumulado };
          return copia;
        });
      }
    } catch {
      setMensajes((m) => {
        const copia = m.slice();
        copia[copia.length - 1] = { role: "assistant", content: "⚠️ " + t("asesorError") };
        return copia;
      });
    } finally {
      setCargando(false);
    }
  }

  return (
    <>
      {/* Botón flotante */}
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="fixed bottom-5 right-5 z-[3500] flex items-center gap-2 rounded-full bg-gradient-to-r from-marca-500 to-marca-700 px-5 py-3.5 text-white shadow-[0_10px_30px_rgba(79,70,229,.45)] transition hover:brightness-110"
        >
          <span className="text-xl">🧭</span>
          <span className="text-sm font-bold">{t("asesorBoton")}</span>
        </button>
      )}

      {/* Panel del chat */}
      {abierto && (
        <div className="fixed inset-x-0 bottom-0 z-[3500] flex justify-center sm:inset-auto sm:bottom-5 sm:right-5">
          <div className="animar-subir flex h-[75vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,.3)] sm:h-[560px] sm:rounded-3xl sm:shadow-[0_20px_50px_rgba(0,0,0,.3)]">
            {/* Cabecera */}
            <div className="flex items-center justify-between bg-gradient-to-br from-marca-600 to-marca-800 px-4 py-3 text-white">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-lg">🧭</span>
                <div>
                  <div className="text-[15px] font-bold leading-tight">{t("asesorTitulo")}</div>
                  <div className="text-[11px] text-white/80">{t("asesorSubtitulo")}</div>
                </div>
              </div>
              <button onClick={() => setAbierto(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-base">✕</button>
            </div>

            {/* Mensajes */}
            <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
              {mensajes.map((m, i) => (
                <Burbuja key={i} role={m.role} content={m.content} cargando={cargando && i === mensajes.length - 1 && !m.content} />
              ))}

              {sinClave && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800">
                  {t("asesorSinClave")}
                </div>
              )}
              <div ref={finRef} />
            </div>

            {/* Entrada */}
            <form onSubmit={enviar} className="flex items-center gap-2 border-t border-slate-100 bg-white p-3">
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder={t("asesorPlaceholder")}
                className="flex-1 rounded-full border border-slate-200 px-4 py-2.5 text-[14px] outline-none focus:border-marca-400"
              />
              <button
                type="submit"
                disabled={cargando || !texto.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-marca-500 to-marca-600 text-white shadow-marca transition disabled:opacity-40"
              >
                {cargando ? <span className="spin" /> : "➤"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Burbuja({ role, content, cargando }) {
  const esUsuario = role === "user";
  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
          esUsuario
            ? "bg-gradient-to-r from-marca-500 to-marca-600 text-white"
            : "border border-slate-100 bg-white text-slate-700 shadow-suave"
        }`}
      >
        {cargando ? <span className="spin" /> : content}
      </div>
    </div>
  );
}
