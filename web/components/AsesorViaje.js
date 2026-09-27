"use client";
// PREGUNTAR SOBRE **ESTE** VIAJE.
//
// El tablero contesta lo que sabemos decir de antemano: cuanto cuesta, como
// moverse, que falta. Lo que no cubre es la pregunta que no previmos —"¿me da
// el tiempo entre Liverpool y Edimburgo?", "¿por que el tren y no el avion?",
// "¿que pasa si quito Birmingham?"— y para eso hace falta conversar.
//
// NO ES LA BRUJULA
//
// La Brujula (components/Asesor.js) recomienda destinos a quien no sabe a
// donde ir, y vive flotando en toda la app. Esto es lo contrario: el viaje ya
// existe, y el asesor solo habla de ese. Comparten endpoint; lo que cambia es
// que aqui el servidor le pasa los datos reales del viaje.
//
// SE ABRE A MANO, Y ESO NO ES PEREZA
//
// Cada mensaje cuesta dinero de una API de pago. Igual que las consultas de
// vuelo en vivo, esto no se dispara solo: el panel arranca cerrado y no manda
// nada hasta que el viajero escribe. Abrirlo tampoco consulta: solo escribir.
//
// LO QUE NO PUEDE HACER
//
// No reserva, no compra y no inventa precios: el servidor le da las cifras del
// viaje con su procedencia y le prohibe rellenar huecos. Cuando no sabe algo,
// tiene que decirlo. Eso esta en lib/contextoViaje, donde se puede auditar.

import { useCallback, useEffect, useRef, useState } from "react";
import { Icono } from "@/components/Icono";
import { useApp } from "@/lib/AppContext";
import { track } from "@/lib/track";

const MAX_MENSAJE = 500;

export default function AsesorViaje({ viaje, analisis, plan }) {
  const { t, lang } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  // Lo que el servidor dice del limite. No se calcula aqui: se recibe.
  const [limite, setLimite] = useState(null);
  const finRef = useRef(null);
  const campoRef = useRef(null);

  // El scroll solo con el panel abierto y solo cuando hay conversacion: sin la
  // guarda, este efecto pelea con el scroll del resto del tablero.
  useEffect(() => {
    if (!abierto || !mensajes.length) return;
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [abierto, mensajes]);

  // Cambiar de viaje invalida la conversacion: las respuestas hablaban de otro.
  useEffect(() => { setMensajes([]); setError(""); }, [viaje?.id]);

  const preguntar = useCallback(async (pregunta) => {
    const limpia = String(pregunta || "").trim().slice(0, MAX_MENSAJE);
    if (!limpia || enviando) return;

    const historial = [...mensajes, { role: "user", content: limpia }];
    setMensajes([...historial, { role: "assistant", content: "" }]);
    setTexto("");
    setEnviando(true);
    setError("");

    try {
      const r = await fetch("/api/asesor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Se mandan DATOS, no el prompt: el texto lo arma el servidor.
        body: JSON.stringify({ mensajes: historial, viaje, analisis, plan, idioma: lang }),
      });

      if (r.status === 503) { setError("asesorSinClave"); setMensajes(mensajes); return; }
      // El guardia del servidor contesta con su motivo. Se traduce a algo que
      // el viajero entienda, no a un "error" a secas: una cosa es que falte
      // entrar a la cuenta y otra que se hayan acabado las preguntas de hoy.
      if (r.status === 401 || r.status === 402) {
        const d = await r.json().catch(() => ({}));
        setLimite({ limite: d?.limite ?? null, usado: d?.usado ?? 0, motivo: d?.motivo || "limite" });
        track("limit_reached", { capacidad: "asesor" });
        setMensajes(mensajes);
        return;
      }
      if (!r.ok || !r.body) throw new Error("http");

      // Streaming: la respuesta se va pintando, que es la diferencia entre
      // parecer roto y parecer que esta pensando.
      const lector = r.body.getReader();
      const dec = new TextDecoder();
      let acumulado = "";
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        acumulado += dec.decode(value, { stream: true });
        setMensajes([...historial, { role: "assistant", content: acumulado }]);
      }
      if (!acumulado.trim()) throw new Error("vacio");
    } catch {
      setError("asesorError");
      setMensajes(mensajes);
    } finally {
      setEnviando(false);
      campoRef.current?.focus();
    }
  }, [mensajes, enviando, viaje, analisis, plan, lang]);

  if (!viaje?.paradas?.length || !analisis) return null;

  // Las sugerencias salen del viaje, no de una lista fija: si no hay tareas
  // pendientes, no se propone preguntar por ellas.
  const pendientes = (plan?.tareas || []).filter((x) => x.requiereAccion);
  const sugerencias = [
    pendientes.length ? { clave: "avQueHago" } : null,
    { clave: "avAlcanza" },
    (analisis?.tramos || []).length ? { clave: "avPorQueMedio" } : null,
  ].filter(Boolean);

  return (
    <section id="asesor-viaje" className="rounded-2xl border border-marca-200 bg-marca-50/60 p-5 dark:border-marca-900 dark:bg-marca-900/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-marca-100 text-marca-700 dark:bg-marca-900/50 dark:text-marca-300">
            <Icono nombre="compass" size={17} />
          </span>
          <div className="min-w-0">
            <h3 className="text-[15px] font-extrabold text-marca-900 dark:text-marca-100">{t("avTitulo")}</h3>
            <p className="mt-0.5 max-w-xl text-[12px] leading-relaxed text-marca-900/70 dark:text-marca-100/70">{t("avSubtitulo")}</p>
          </div>
        </div>
        {!abierto && (
          <button type="button" onClick={() => setAbierto(true)}
            className="shrink-0 rounded-full bg-marca-700 px-4 py-2 text-[12px] font-extrabold text-white hover:bg-marca-800">
            {t("avAbrir")}
          </button>
        )}
      </div>

      {abierto && (
        <>
          {mensajes.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {mensajes.map((m, i) => (
                <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[12.5px] leading-relaxed ${
                    m.role === "user"
                      ? "bg-marca-700 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-700"
                  }`}>
                    {m.content || (enviando ? t("avPensando") : "")}
                  </div>
                </div>
              ))}
              <div ref={finRef} />
            </div>
          )}

          {/* Las sugerencias son atajos de escritura, no respuestas: pulsarlas
              manda la pregunta igual que si la hubiera tecleado. */}
          {!mensajes.length && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {sugerencias.map((s) => (
                <button key={s.clave} type="button" disabled={enviando} onClick={() => preguntar(t(s.clave))}
                  className="rounded-full border border-marca-200 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-marca-800 hover:border-marca-400 disabled:opacity-60 dark:border-marca-900 dark:bg-slate-800 dark:text-marca-200">
                  {t(s.clave)}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => { e.preventDefault(); preguntar(texto); }}
            className="mt-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center"
          >
            <input
              ref={campoRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              maxLength={MAX_MENSAJE}
              placeholder={t("avPlaceholder")}
              disabled={enviando}
              className="min-w-0 flex-1 rounded-full border border-marca-200 bg-white px-4 py-2.5 text-[16px] outline-none focus:border-marca-500 disabled:opacity-60 sm:text-[13px] dark:border-slate-600 dark:bg-slate-900 dark:text-white"
            />
            <button type="submit" disabled={enviando || !texto.trim()}
              className="shrink-0 rounded-full bg-marca-700 px-4 py-2.5 text-[12.5px] font-extrabold text-white hover:bg-marca-800 disabled:opacity-60 sm:py-2">
              {enviando ? t("avPensando") : t("avEnviar")}
            </button>
          </form>

          {error && <p className="mt-2 text-[11.5px] font-semibold text-red-600">{t(error)}</p>}
          {limite && (
            <div className="mt-2 rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-600">
              <p className="text-[11.5px] leading-relaxed text-slate-600 dark:text-slate-300">
                {limite.motivo === "no-auth"
                  ? t("proEntrarPara")
                  : t("proLimiteAgotado", { total: limite.limite ?? "", pro: 60 })}
              </p>
              {limite.motivo !== "no-auth" && (
                <a href="/pro" onClick={() => track("pro_cta", { desde: "asesor" })}
                  className="mt-2 inline-flex min-h-[38px] items-center rounded-full border border-slate-200 px-4 text-[11.5px] font-bold text-slate-700 hover:border-marca-300 dark:border-slate-600 dark:text-slate-200">
                  {t("proConocer")} →
                </a>
              )}
            </div>
          )}
          <p className="mt-2 text-[10.5px] leading-relaxed text-marca-900/55 dark:text-marca-100/50">{t("avAviso")}</p>
        </>
      )}
    </section>
  );
}
