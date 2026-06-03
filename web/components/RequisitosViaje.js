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
  infoPais,
  idiomasEs,
  enchufe,
  estacionesClave,
} from "@/lib/requisitos";

// Celda de dato del país.
function Dato({ icono, etiqueta, valor }) {
  if (!valor) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
      <div className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        {icono} {etiqueta}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold text-slate-700">{valor}</div>
    </div>
  );
}

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
  const paises = listaPaises();
  const dp = infoPais(destinoIso) || {};
  const conduccion = dp.conduccion === "left" ? t("reqIzquierda") : dp.conduccion === "right" ? t("reqDerecha") : "";
  const moneda = dp.moneda ? `${dp.moneda.nombre}${dp.moneda.sim ? ` (${dp.moneda.sim})` : ""}` : "";
  const idiomas = idiomasEs(dp.idiomas).join(", ");
  const huso = dp.husos?.length ? dp.husos[0] + (dp.husos.length > 1 ? ` (+${dp.husos.length - 1})` : "") : "";
  const tomacorriente = enchufe(destinoIso);
  const ecl = estacionesClave(dp.lat);
  const estaciones = ecl ? t("estac_" + ecl) : "";

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

          {/* Datos útiles del país (depositados aquí, sin salir de la app) */}
          <div>
            <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">
              {t("reqDatosPais")}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <Dato icono="💰" etiqueta={t("reqMoneda")} valor={moneda} />
              <Dato icono="🗣️" etiqueta={t("reqIdioma")} valor={idiomas} />
              <Dato icono="🏛️" etiqueta={t("reqCapital")} valor={dp.capital} />
              <Dato icono="🕐" etiqueta={t("reqHuso")} valor={huso} />
              <Dato icono="🚗" etiqueta={t("reqConduccion")} valor={conduccion} />
              <Dato icono="📞" etiqueta={t("reqTelefono")} valor={dp.tel} />
              <Dato icono="🔌" etiqueta={t("reqEnchufe")} valor={tomacorriente} />
              <Dato icono="🌤️" etiqueta={t("reqEstaciones")} valor={estaciones} />
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 p-2.5 text-[11.5px] leading-snug text-amber-700">
            ⚠️ {t("reqDisclaimer")}
          </div>
        </div>
      )}
    </div>
  );
}
