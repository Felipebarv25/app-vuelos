"use client";
import { useEffect, useState } from "react";
import {
  cargarVisas,
  listaPaises,
  nombrePais,
  banderaPais,
  isoDesdeNombre,
  interpretarVisa,
  exigeFiebreAmarilla,
  linkOficial,
  linkSalud,
} from "@/lib/requisitos";

const TONO = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
};

// Panel de "Requisitos de entrada" al país destino: visa (según tu pasaporte),
// pasaporte, fiebre amarilla y enlaces a fuentes oficiales. Datos referenciales.
export default function RequisitosViaje({ ciudad, nacionalidad, onNacionalidad, t = (k) => k }) {
  const [visas, setVisas] = useState(null);
  const [abierto, setAbierto] = useState(true);

  useEffect(() => {
    let vivo = true;
    cargarVisas().then((v) => vivo && setVisas(v));
    return () => { vivo = false; };
  }, []);

  const destinoIso = isoDesdeNombre(ciudad?.pais);
  if (!destinoIso) return null; // no pudimos identificar el país: no mostramos nada

  const req = visas?.[nacionalidad]?.[destinoIso];
  const info = interpretarVisa(req);
  const yf = exigeFiebreAmarilla(destinoIso);
  const paisNombre = nombrePais(destinoIso);
  const naciNombre = nombrePais(nacionalidad);
  const paises = listaPaises();

  return (
    <div className="mb-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-suave">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-marca-900">
          🛂 {t("reqTitulo")} {banderaPais(destinoIso)} {paisNombre}
        </span>
        <span className="text-slate-400">{abierto ? "▴" : "▾"}</span>
      </button>

      {abierto && (
        <div className="space-y-3 px-4 pb-4">
          {/* Selector de nacionalidad (de qué pasaporte dependen los requisitos) */}
          <label className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
            {t("reqTuPasaporte")}
            <select
              value={nacionalidad}
              onChange={(e) => onNacionalidad?.(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[13px] font-semibold text-marca-700"
            >
              {paises.map((p) => (
                <option key={p.cc} value={p.cc}>
                  {p.bandera} {p.nombre}
                </option>
              ))}
            </select>
          </label>

          {/* Visa */}
          <div className={`rounded-xl border p-3 ${TONO[info?.color] || TONO.slate}`}>
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">{t("reqVisa")}</div>
            {!visas ? (
              <div className="mt-1 text-sm"><span className="spin" /></div>
            ) : info ? (
              <div className="mt-0.5 text-[15px] font-extrabold">
                {info.tipo === "sinvisaDias"
                  ? t("req_sinvisaDias").replace("{n}", info.dias)
                  : t("req_" + info.tipo)}
              </div>
            ) : (
              <div className="mt-0.5 text-[14px] font-semibold">{t("req_desconocido")}</div>
            )}
            <div className="mt-1 text-[12px] opacity-80">{t("reqVisaNota")}</div>
          </div>

          {/* Pasaporte + Fiebre amarilla */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">{t("reqPasaporte")}</div>
              <div className="mt-0.5 text-[13.5px] font-semibold">{t("reqPasaporteNota")}</div>
            </div>
            <div className={`rounded-xl border p-3 ${yf ? TONO.amber : TONO.slate}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">{t("reqSalud")}</div>
              <div className="mt-0.5 text-[13.5px] font-semibold">
                {yf ? t("reqFiebreSi") : t("reqFiebreNo")}
              </div>
            </div>
          </div>

          {/* Enlaces oficiales + aviso */}
          <div className="flex flex-wrap gap-2">
            <a
              href={linkOficial(paisNombre, naciNombre)}
              target="_blank"
              rel="noopener"
              className="rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-3.5 py-2 text-[12.5px] font-bold text-white shadow-marca transition hover:brightness-105"
            >
              ✅ {t("reqVerOficial")}
            </a>
            <a
              href={linkSalud(paisNombre)}
              target="_blank"
              rel="noopener"
              className="rounded-xl border-[1.5px] border-slate-200 px-3.5 py-2 text-[12.5px] font-bold text-marca-600 transition hover:bg-slate-50"
            >
              💉 {t("reqVerSalud")}
            </a>
          </div>
          <div className="rounded-lg bg-amber-50 p-2.5 text-[11.5px] leading-snug text-amber-700">
            ⚠️ {t("reqDisclaimer")}
          </div>
        </div>
      )}
    </div>
  );
}
