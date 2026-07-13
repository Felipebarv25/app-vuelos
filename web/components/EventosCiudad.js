"use client";
// Anduve Live — agenda social de eventos de la ciudad (2026-07-11).
// Conciertos, deporte y teatro reales (Ticketmaster) + capa social propia:
// "yo voy" con contador de anduvers y chat por evento para coordinarse.
//
// Filtros de fecha: Hoy / Mañana / Este finde / fecha exacta (para el que
// viaja el 28 de agosto y quiere saber que hay ESE dia).
//
//   <EventosCiudad ciudad="Medellín" paisIso="CO" onCerrar={...} />

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@/lib/track";
import { useBrowserBackClose } from "@/lib/useBrowserBack";
import { Icono } from "./Icono";

const TXT = {
  titulo: "Eventos en {ciudad}",
  sub: "Lo que está pasando: conciertos, deporte, teatro. Marca \"voy\" y coordina con otros viajeros.",
  hoy: "Hoy",
  manana: "Mañana",
  finde: "Este finde",
  fecha: "Elegir fecha",
  cargando: "Buscando eventos…",
  vacio: "No encontramos eventos para esa fecha en {ciudad}. Prueba otra fecha — la agenda cambia todos los días.",
  noConfig: "Estamos conectando la agenda de eventos de {ciudad}. Muy pronto podrás ver conciertos, partidos y teatro aquí.",
  error: "No pudimos cargar la agenda ahora. Intenta de nuevo en un momento.",
  voy: "¡Yo voy!",
  yaVoy: "Voy ✓",
  van: "{n} anduvers van",
  vaUno: "1 anduver va",
  nadie: "Sé el primero en ir",
  chat: "Chat",
  entradas: "Entradas",
  chatPlaceholder: "Escribe al grupo del evento…",
  chatVacio: "Nadie ha escrito aún. Rompe el hielo: ¿a qué hora llegan?",
  chatLogin: "Inicia sesión para escribir en el chat (leer es gratis).",
  chatNormas: "Sé buena gente. Sin links. Los mensajes son públicos.",
  enviar: "Enviar",
  reportar: "Reportar mensaje",
  borrar: "Borrar mi mensaje",
  seguro: "¿Seguro?",
  avisoLenguaje: "Cuidemos el lenguaje 🙏 Ese mensaje no se envió.",
  avisoLinks: "Los links no están permitidos en el chat.",
  avisoRapido: "Vas muy rápido — espera unos segundos.",
};
// i18n (2026-07-13): las claves viven en lib/idiomas.js con prefijo ev_
// (o chat_ para las compartidas con ChatViajeros). TXT queda como fallback
// ES por si el padre no pasa `t` (leccion del bug del trial: los defaults
// silenciosos muestran claves crudas).
const CLAVE_GLOBAL = {
  reportar: "chat_reportar", borrar: "chat_borrar", seguro: "chat_seguro",
  avisoLenguaje: "chat_avisoLenguaje", avisoLinks: "chat_avisoLinks", avisoRapido: "chat_avisoRapido",
};
function crearTx(t) {
  return (k, vars = {}) => {
    if (t) {
      const clave = CLAVE_GLOBAL[k] || "ev_" + k;
      const v = t(clave, vars);
      if (v !== clave) return v; // la clave existe en el diccionario global
    }
    let s = TXT[k] || k;
    for (const [kk, v] of Object.entries(vars)) s = s.replace(`{${kk}}`, v);
    return s;
  };
}

const ICONO_TIPO = { musica: "🎵", deporte: "⚽", arte: "🎭", cine: "🎬", otro: "🎟️" };

function authHeaders() {
  const h = { "Content-Type": "application/json" };
  try {
    const tk = localStorage.getItem("anduve_auth_token")
            || sessionStorage.getItem("anduve_auth_token");
    if (tk) h.Authorization = `Bearer ${tk}`;
  } catch {}
  return h;
}

function iso(d) { return d.toISOString().slice(0, 10); }

export default function EventosCiudad({ ciudad, paisIso = "", onCerrar, t = null }) {
  const tx = crearTx(t);
  useBrowserBackClose(true, onCerrar);
  const [montado, setMontado] = useState(false);
  useEffect(() => { setMontado(true); }, []);

  // Rango de fechas seleccionado.
  const hoy = new Date();
  const [rango, setRango] = useState({ tipo: "hoy", desde: iso(hoy), hasta: iso(hoy) });
  const [fechaCustom, setFechaCustom] = useState("");

  const [estado, setEstado] = useState("cargando"); // cargando | ok | vacio | noconfig | error
  const [eventos, setEventos] = useState([]);
  const [chatAbierto, setChatAbierto] = useState(null); // id del evento con chat expandido

  function elegirRango(tipo) {
    const d = new Date();
    if (tipo === "hoy") setRango({ tipo, desde: iso(d), hasta: iso(d) });
    else if (tipo === "manana") {
      d.setDate(d.getDate() + 1);
      setRango({ tipo, desde: iso(d), hasta: iso(d) });
    } else if (tipo === "finde") {
      // Proximo viernes a domingo (si ya es finde, el actual).
      const dia = d.getDay(); // 0 dom ... 6 sab
      const hastaViernes = dia <= 5 ? 5 - dia : 6;
      const vie = new Date(d); vie.setDate(d.getDate() + (dia === 6 || dia === 0 ? 0 : hastaViernes));
      const dom = new Date(vie); dom.setDate(vie.getDate() + (vie.getDay() === 0 ? 0 : 7 - vie.getDay()));
      setRango({ tipo, desde: iso(dia === 0 ? d : vie), hasta: iso(dom) });
    }
  }
  function elegirFecha(f) {
    setFechaCustom(f);
    if (f) setRango({ tipo: "fecha", desde: f, hasta: f });
  }

  // Cargar eventos al cambiar el rango.
  useEffect(() => {
    let vivo = true;
    setEstado("cargando");
    setChatAbierto(null);
    const qs = new URLSearchParams({ ciudad, desde: rango.desde, hasta: rango.hasta });
    if (paisIso) qs.set("pais", paisIso);
    fetch(`/api/eventos?${qs}`, { headers: authHeaders() })
      .then(async (r) => {
        const d = await r.json().catch(() => null);
        if (!vivo) return;
        if (d?.ok) {
          setEventos(d.eventos || []);
          setEstado(d.eventos?.length ? "ok" : "vacio");
          track("eventos_ver", { ciudad, rango: rango.tipo, n: d.eventos?.length || 0 });
        } else if (d?.motivo === "no-configurado") setEstado("noconfig");
        else setEstado("error");
      })
      .catch(() => vivo && setEstado("error"));
    return () => { vivo = false; };
  }, [ciudad, paisIso, rango.desde, rango.hasta]);

  async function toggleVoy(ev) {
    const nuevo = !ev.voy;
    // Optimista.
    setEventos((arr) => arr.map((e) => e.id === ev.id
      ? { ...e, voy: nuevo, asisten: Math.max(0, (e.asisten || 0) + (nuevo ? 1 : -1)) }
      : e));
    try {
      const r = await fetch("/api/eventos/asistir", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: ev.id, voy: nuevo }),
      });
      const d = await r.json().catch(() => null);
      if (r.status === 401) {
        // Sin sesion: revertir y mandar a login conservando la intencion.
        setEventos((arr) => arr.map((e) => e.id === ev.id ? { ...e, voy: !nuevo, asisten: ev.asisten } : e));
        window.location.href = "/?login=1";
        return;
      }
      if (d?.ok) {
        setEventos((arr) => arr.map((e) => e.id === ev.id ? { ...e, asisten: d.asisten, voy: d.voy } : e));
        track("eventos_voy", { id: ev.id, voy: nuevo });
      }
    } catch {}
  }

  const fmtFechaChip = (f) => {
    if (!f) return "";
    const d = new Date(f + "T00:00:00");
    return d.toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" });
  };

  if (!montado) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[5600] flex items-end justify-center bg-slate-900/60 animar-aparecer sm:items-center sm:p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl animar-subir dark:bg-slate-900 sm:h-[80vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="bg-gradient-to-br from-marca-700 to-marca-900 px-5 pb-4 pt-5 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">Anduve Live</div>
              <h2 className="mt-0.5 text-[22px] font-extrabold tracking-tight">{tx("titulo", { ciudad })}</h2>
              <p className="mt-1 max-w-md text-[12.5px] leading-snug text-white/75">{tx("sub")}</p>
            </div>
            <button
              onClick={onCerrar}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 hover:bg-white/25"
              aria-label="Cerrar"
            >
              <Icono nombre="x" size={16} />
            </button>
          </div>

          {/* Filtros de fecha */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {[["hoy", tx("hoy")], ["manana", tx("manana")], ["finde", tx("finde")]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => elegirRango(k)}
                className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                  rango.tipo === k ? "bg-white text-marca-800" : "bg-white/15 text-white hover:bg-white/25"
                }`}
              >
                {label}
              </button>
            ))}
            <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold transition ${
              rango.tipo === "fecha" ? "bg-white text-marca-800" : "bg-white/15 text-white hover:bg-white/25"
            }`}>
              <Icono nombre="calendar" size={13} />
              {rango.tipo === "fecha" && fechaCustom ? fmtFechaChip(fechaCustom) : tx("fecha")}
              <input
                type="date"
                value={fechaCustom}
                min={iso(new Date())}
                onChange={(e) => elegirFecha(e.target.value)}
                className="h-0 w-0 opacity-0"
              />
            </label>
          </div>
        </div>

        {/* Cuerpo scrolleable */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {estado === "cargando" && (
            <div className="py-14 text-center text-[13.5px] text-slate-500"><span className="spin" /> {tx("cargando")}</div>
          )}
          {estado === "noconfig" && (
            <div className="mx-auto max-w-sm py-14 text-center">
              <div className="text-4xl">🎟️</div>
              <div className="mt-3 text-[14.5px] font-bold text-slate-700 dark:text-slate-200">{tx("noConfig", { ciudad })}</div>
            </div>
          )}
          {estado === "vacio" && (
            <div className="mx-auto max-w-sm py-14 text-center">
              <div className="text-4xl">🌙</div>
              <div className="mt-3 text-[14.5px] text-slate-600 dark:text-slate-300">{tx("vacio", { ciudad })}</div>
            </div>
          )}
          {estado === "error" && (
            <div className="mx-auto max-w-sm py-14 text-center text-[14px] text-slate-500">{tx("error")}</div>
          )}

          {estado === "ok" && eventos.map((ev) => (
            <div key={ev.id} className="mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-suave dark:border-slate-700 dark:bg-slate-800">
              <div className="flex gap-3 p-3">
                {ev.img ? (
                  <img src={ev.img} alt="" className="h-20 w-28 shrink-0 rounded-xl object-cover" loading="lazy" />
                ) : (
                  <div className="flex h-20 w-28 shrink-0 items-center justify-center rounded-xl bg-marca-50 text-3xl dark:bg-marca-900/30">
                    {ICONO_TIPO[ev.tipo]}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="truncate text-[14.5px] font-extrabold leading-tight text-marca-900 dark:text-slate-100">
                      {ICONO_TIPO[ev.tipo]} {ev.nombre}
                    </div>
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-slate-500">
                    {fmtFechaChip(ev.fecha)}{ev.hora ? ` · ${ev.hora}` : ""}{ev.lugar ? ` · ${ev.lugar}` : ""}
                  </div>
                  {/* Social proof */}
                  <div className="mt-1 text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                    {ev.asisten > 1 ? tx("van", { n: ev.asisten }) : ev.asisten === 1 ? tx("vaUno") : tx("nadie")}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <button
                      onClick={() => toggleVoy(ev)}
                      className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                        ev.voy
                          ? "bg-emerald-500 text-white"
                          : "bg-marca-700 text-white hover:bg-marca-800"
                      }`}
                    >
                      {ev.voy ? tx("yaVoy") : tx("voy")}
                    </button>
                    <button
                      onClick={() => setChatAbierto(chatAbierto === ev.id ? null : ev.id)}
                      className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12.5px] font-bold text-slate-600 transition hover:border-marca-300 hover:text-marca-700 dark:border-slate-600 dark:text-slate-300"
                    >
                      💬 {tx("chat")}
                    </button>
                    {ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="sponsored noopener"
                        onClick={() => track("eventos_entradas", { id: ev.id })}
                        className="rounded-full border border-slate-200 px-3.5 py-1.5 text-[12.5px] font-bold text-slate-600 transition hover:border-marca-300 hover:text-marca-700 dark:border-slate-600 dark:text-slate-300"
                      >
                        {tx("entradas")} ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
              {chatAbierto === ev.id && <ChatEvento idEvento={ev.id} tx={tx} />}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ---------- Chat de un evento ----------
function ChatEvento({ idEvento, tx = crearTx(null) }) {
  const [mensajes, setMensajes] = useState(null); // null = cargando
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [necesitaLogin, setNecesitaLogin] = useState(false);
  const [confirmando, setConfirmando] = useState(null); // "ts:uid" esperando confirmacion
  const [aviso, setAviso] = useState(null); // rechazo del servidor (lenguaje, links, rate limit)
  const finRef = useRef(null);
  const miUid = useRef(null);
  // Lo que YO reporte no debe reaparecer con el proximo poll aunque aun no
  // alcance el umbral global de ocultamiento.
  const reportados = useRef(new Set());

  async function cargar() {
    try {
      const r = await fetch(`/api/eventos/chat?id=${encodeURIComponent(idEvento)}`);
      const d = await r.json().catch(() => null);
      if (d?.ok) setMensajes((d.mensajes || []).filter((m) => !reportados.current.has(`${m.ts}:${m.uid}`)));
    } catch {}
  }

  async function reportar(m) {
    const marca = `${m.ts}:${m.uid}`;
    if (confirmando !== marca) { setConfirmando(marca); return; }
    setConfirmando(null);
    try {
      const r = await fetch("/api/eventos/chat/reportar", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: idEvento, ts: m.ts, uid: m.uid }),
      });
      if (r.status === 401) { setNecesitaLogin(true); return; }
      const d = await r.json().catch(() => null);
      if (d?.ok) {
        reportados.current.add(marca);
        setMensajes((arr) => (arr || []).filter((x) => `${x.ts}:${x.uid}` !== marca));
        track("chat_reportar", { evento: idEvento, propio: !!d.propio });
      }
    } catch {}
  }

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 10000); // poll cada 10s — suficiente para coordinar
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idEvento]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajes?.length]);

  async function enviar(e) {
    e?.preventDefault();
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    try {
      const r = await fetch("/api/eventos/chat", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ id: idEvento, texto: t }),
      });
      const d = await r.json().catch(() => null);
      if (r.status === 401) { setNecesitaLogin(true); return; }
      if (d?.ok && d.mensaje) {
        miUid.current = d.mensaje.uid;
        setMensajes((m) => [...(m || []), d.mensaje]);
        setTexto("");
      } else if (d?.motivo === "lenguaje") {
        setAviso(tx("avisoLenguaje"));
      } else if (d?.motivo === "sin-links") {
        setAviso(tx("avisoLinks"));
      } else if (d?.motivo === "muy-rapido") {
        setAviso(tx("avisoRapido"));
      }
    } catch {} finally {
      setEnviando(false);
    }
  }

  return (
    <div className="border-t border-slate-100 bg-slate-50/70 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
        {mensajes === null && (
          <div className="py-3 text-center text-[12px] text-slate-400"><span className="spin" /></div>
        )}
        {mensajes?.length === 0 && (
          <div className="py-3 text-center text-[12.5px] text-slate-400">{tx("chatVacio")}</div>
        )}
        {mensajes?.map((m, i) => {
          const mio = miUid.current && m.uid === miUid.current;
          const marca = `${m.ts}:${m.uid}`;
          const botonReporte = (
            <button
              onClick={() => reportar(m)}
              className={`shrink-0 self-center rounded-full px-1.5 py-0.5 text-[10px] transition ${
                confirmando === marca
                  ? "bg-rose-100 font-bold text-rose-600 dark:bg-rose-900/40 dark:text-rose-300"
                  : "text-slate-300 opacity-40 hover:text-rose-400 dark:text-slate-500 sm:opacity-0 sm:group-hover:opacity-100"
              }`}
              aria-label={mio ? tx("borrar") : tx("reportar")}
              title={mio ? tx("borrar") : tx("reportar")}
            >
              {confirmando === marca ? tx("seguro") : mio ? "🗑" : "⚑"}
            </button>
          );
          return (
            <div key={`${m.ts}-${i}`} className={`group flex items-end gap-1 ${mio ? "justify-end" : "justify-start"}`}>
              {mio && botonReporte}
              <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-[13px] leading-snug ${
                mio ? "bg-marca-600 text-white" : "bg-white text-slate-700 shadow-suave dark:bg-slate-800 dark:text-slate-200"
              }`}>
                {!mio && <span className="mr-1.5 font-bold text-marca-600 dark:text-marca-300">{m.de}</span>}
                {m.texto}
              </div>
              {!mio && botonReporte}
            </div>
          );
        })}
        <div ref={finRef} />
      </div>

      {necesitaLogin ? (
        <a
          href="/?login=1"
          className="mt-2 block rounded-xl bg-marca-700 py-2.5 text-center text-[13px] font-bold text-white"
        >
          {tx("chatLogin")}
        </a>
      ) : (
        <form onSubmit={enviar} className="mt-2 flex gap-2">
          <input
            value={texto}
            onChange={(e) => { setTexto(e.target.value); if (aviso) setAviso(null); }}
            maxLength={280}
            placeholder={tx("chatPlaceholder")}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13.5px] outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={enviando || !texto.trim()}
            className="rounded-xl bg-marca-700 px-4 py-2 text-[13px] font-bold text-white disabled:opacity-50"
          >
            {tx("enviar")}
          </button>
        </form>
      )}
      {aviso && (
        <div className="mt-1.5 rounded-lg bg-rose-50 px-2 py-1 text-center text-[11.5px] font-bold text-rose-600 dark:bg-rose-900/30 dark:text-rose-300">
          {aviso}
        </div>
      )}
      <div className="mt-1.5 text-center text-[10.5px] text-slate-400">{tx("chatNormas")}</div>
    </div>
  );
}
