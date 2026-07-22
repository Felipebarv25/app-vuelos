"use client";
import { useEffect, useState } from "react";
import PrecioDual from "./PrecioDual";

const AEROLINEAS = {
  AV: "Avianca", LA: "LATAM", DM: "Arajet", JA: "JetSMART", Y4: "Volaris",
  VB: "Viva Aerobus", AM: "Aeroméxico", CM: "Copa", P5: "Wingo", AR: "Aerolíneas Arg.",
  G3: "Gol", AD: "Azul", H2: "Sky Airline", AC: "Air Canada", AA: "American",
  DL: "Delta", UA: "United", B6: "JetBlue", NK: "Spirit", F9: "Frontier",
  IB: "Iberia", UX: "Air Europa", TP: "TAP", AF: "Air France", KL: "KLM",
  LH: "Lufthansa", BA: "British Airways", AZ: "ITA Airways", LX: "Swiss",
  TK: "Turkish", EK: "Emirates", QR: "Qatar Airways", ET: "Ethiopian",
  FR: "Ryanair", W4: "Wizz Air", BF: "French Bee", G4: "Allegiant",
  XL: "LATAM Ecuador", PU: "Plus Ultra", F8: "Flair", CA: "Air China", AS: "Alaska",
  W9: "Wizz Air UK", "2D": "Aero VIP", AL: "Air Leisure",
};

const ORIGENES = {
  BOG: "Bogotá", MDE: "Medellín", MEX: "CDMX", UIO: "Quito", LIM: "Lima",
  SCL: "Santiago", EZE: "Buenos Aires", GRU: "São Paulo", CCS: "Caracas",
  MAD: "Madrid", MIA: "Miami",
};

const MESES_COMPLETO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function nombreAero(cod) {
  return AEROLINEAS[(cod || "").trim().toUpperCase()] || cod || "—";
}
function nombreOrigen(cod) {
  return ORIGENES[(cod || "").trim().toUpperCase()] || cod || "";
}
function fmt(n) {
  return "US$ " + Math.round(n).toLocaleString("en-US");
}
function fmtFecha(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${Number(d)} ${meses[Number(m) - 1]} ${y}`;
}
function escalasTexto(n) {
  if (n === null || n === undefined || isNaN(n)) return null;
  if (n === 0) return "Directo";
  if (n === 1) return "1 escala";
  return `${n} escalas`;
}

function tiempoDesde(iso) {
  if (!iso) return null;
  try {
    const ms = Date.now() - new Date(iso).getTime();
    if (ms < 0 || isNaN(ms)) return null;
    const min = Math.floor(ms / 60000);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h}h`;
    const d = Math.floor(h / 24);
    return `hace ${d}d`;
  } catch { return null; }
}

export default function VuelosBaratos({ iata, umbral, ciudad }) {
  const [datos, setDatos] = useState(null);
  const [anioSel, setAnioSel] = useState("");

  useEffect(() => {
    if (!iata) return;
    fetch("/historial-resumen.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        const d = json?.destinos?.[iata];
        if (d?.vuelos?.length) {
          setDatos(d);
          const anios = [...new Set(d.vuelos.map((v) => v.anio))].sort();
          setAnioSel(anios[anios.length - 1] || "");
        }
      })
      .catch(() => {});
  }, [iata]);

  if (!datos) return null;

  const { vuelos, promedio } = datos;
  const anios = [...new Set(vuelos.map((v) => v.anio))].sort();
  const filtrados = vuelos.filter((v) => v.anio === anioSel);
  const minPrecio = filtrados.length ? Math.min(...filtrados.map((v) => v.precio)) : 0;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-extrabold tracking-tight text-slate-900 lg:text-[20px] dark:text-slate-100">
            Vuelos más baratos encontrados
          </h2>
          <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">
            Precio más bajo detectado por mes hacia {ciudad}. Datos del radar de Anduve.
          </p>
        </div>
        {anios.length > 1 && (
          <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
            {anios.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAnioSel(a)}
                className={`rounded-md px-3 py-1 text-[12px] font-bold transition ${
                  a === anioSel
                    ? "bg-white text-marca-700 shadow-sm dark:bg-slate-700 dark:text-marca-300"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtrados.map((v) => {
          const mesIdx = Number(v.ym.slice(5, 7)) - 1;
          const mesNombre = MESES_COMPLETO[mesIdx] || v.label;
          const desc = promedio ? Math.round(((promedio - v.precio) / promedio) * 100) : 0;
          const esMejor = v.precio === minPrecio;
          const bajoUmbral = umbral && v.precio <= umbral;
          const escIda = escalasTexto(v.escalas_ida);
          const escVuelta = escalasTexto(v.escalas_vuelta);
          const frescura = tiempoDesde(v.visto);

          return (
            <div
              key={v.ym}
              className={`group relative overflow-hidden rounded-2xl border transition hover:shadow-lg ${
                esMejor
                  ? "border-emerald-300 bg-gradient-to-br from-emerald-50 to-white dark:border-emerald-700 dark:from-emerald-950/40 dark:to-slate-800"
                  : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
              }`}
            >
              <div className={`flex items-center justify-between px-4 py-2.5 ${
                esMejor
                  ? "bg-emerald-100/60 dark:bg-emerald-900/30"
                  : "bg-slate-50 dark:bg-slate-700/40"
              }`}>
                <span className={`text-[13px] font-bold ${
                  esMejor ? "text-emerald-800 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"
                }`}>
                  {mesNombre}
                </span>
                <div className="flex items-center gap-1.5">
                  {esMejor && (
                    <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Más barato
                    </span>
                  )}
                  {bajoUmbral && !esMejor && (
                    <span className="rounded-full bg-marca-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                      Bajo tu umbral
                    </span>
                  )}
                  {desc > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9.5px] font-bold text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      -{desc}%
                    </span>
                  )}
                </div>
              </div>

              <div className="px-4 pb-4 pt-3">
                <div className={`text-[24px] font-extrabold tabular-nums tracking-tight ${
                  esMejor ? "text-emerald-700 dark:text-emerald-300" : "text-slate-900 dark:text-slate-100"
                }`}>
                  {fmt(v.precio)}
                  <span className="ml-1.5 text-[11px] font-medium text-slate-400">ida y vuelta</span>
                </div>

                <div className="mt-0.5">
                  <PrecioDual usd={v.precio} soloLocal className="text-[12.5px] font-semibold text-marca-700 dark:text-marca-300" />
                </div>

                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {(v.aerolinea || "?").slice(0, 2)}
                    </div>
                    <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-200">
                      {nombreAero(v.aerolinea)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" />
                    </svg>
                    <span>
                      <b>{v.origen}</b>
                      <span className="mx-1 text-slate-400">→</span>
                      {nombreOrigen(v.origen)}
                    </span>
                  </div>

                  {(escIda || escVuelta) && (
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400">
                        <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                      </svg>
                      <span className="text-slate-600 dark:text-slate-400">
                        {escIda && <span>Ida: <b className={v.escalas_ida === 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>{escIda}</b></span>}
                        {escIda && escVuelta && <span className="mx-1.5 text-slate-300">·</span>}
                        {escVuelta && <span>Vuelta: <b className={v.escalas_vuelta === 0 ? "text-emerald-600 dark:text-emerald-400" : ""}>{escVuelta}</b></span>}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-[12.5px] text-slate-600 dark:text-slate-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    <span>{fmtFecha(v.ida)}{v.vuelta ? ` — ${fmtFecha(v.vuelta)}` : ""}</span>
                  </div>

                  {frescura && (
                    <div className="flex items-center gap-2 text-[11.5px] text-slate-400 dark:text-slate-500">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                      </svg>
                      <span>Visto {frescura}</span>
                    </div>
                  )}
                </div>

                {v.origen && v.ida && (
                  <a
                    href={`https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(v.origen)}+to+${encodeURIComponent(ciudad)}+on+${v.ida}${v.vuelta ? `+return+${v.vuelta}` : ""}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2 text-[12.5px] font-bold transition ${
                      esMejor
                        ? "bg-emerald-700 text-white hover:bg-emerald-800"
                        : "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500"
                    }`}
                  >
                    Buscar este vuelo
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 17L17 7M17 7H7M17 7v10" />
                    </svg>
                  </a>
                )}
              </div>

              {esMejor && (
                <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-emerald-400/20 blur-2xl" />
              )}
            </div>
          );
        })}
      </div>

      {promedio > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[12.5px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
          <span>
            Promedio histórico: <b className="text-slate-800 dark:text-slate-200">{fmt(promedio)}</b>
            <PrecioDual usd={promedio} soloLocal className="ml-1.5 text-slate-400" />
          </span>
          {umbral && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>
                Tu umbral: <b className="text-marca-700 dark:text-marca-400">{fmt(umbral)}</b>
                <PrecioDual usd={umbral} soloLocal className="ml-1.5 text-slate-400" />
              </span>
            </>
          )}
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <span>{filtrados.length} meses con datos en {anioSel}</span>
        </div>
      )}

      <p className="mt-2 text-[11px] text-slate-400">
        Precios en USD ida y vuelta, detectados por el radar de Anduve (fuente: Travelpayouts). Precios referenciales — la disponibilidad y precio final dependen de la aerolínea al momento de reservar.
      </p>
    </section>
  );
}
