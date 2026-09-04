"use client";
import SelectorPais from "./SelectorPais";
import { useEffect, useState } from "react";
import {
  cargarVisas,
  nombrePais,
  banderaPais,
  isoDesdeNombre,
  interpretarVisa,
  exigeFiebreAmarilla,
  infoPais,
  idiomasEs,
  enchufe,
  estacionesClave,
  aguaClave,
  propinaClave,
  mejorEpoca,
  autorizacionElectronica,
} from "@/lib/requisitos";
import { Icono } from "./Icono";

// Celda de dato del país.
function Dato({ icono, etiqueta, valor }) {
  if (!valor) return null;
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-700 dark:bg-slate-800">
      <div className="inline-flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400">
        <Icono nombre={icono} size={12} /> {etiqueta}
      </div>
      <div className="mt-0.5 text-[13px] font-semibold text-slate-700">{valor}</div>
    </div>
  );
}

const TONO = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
  rose: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300",
  slate: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
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
  const nacNombre = nombrePais(nacionalidad);

  // Página interna /requisitos/<iso> con visa + salud + emergencias.
  // Antes redirigíamos a Google search; ahora todo vive on-site (la info
  // de salud se refresca mensualmente con scripts/actualizar-salud.mjs).
  const urlOficial = `/requisitos/${destinoIso.toLowerCase()}`;
  const urlSalud = `${urlOficial}#salud`;
  const dp = infoPais(destinoIso) || {};
  const conduccion = dp.conduccion === "left" ? t("reqIzquierda") : dp.conduccion === "right" ? t("reqDerecha") : "";
  const moneda = dp.moneda ? `${dp.moneda.nombre}${dp.moneda.sim ? ` (${dp.moneda.sim})` : ""}` : "";
  const idiomas = idiomasEs(dp.idiomas).join(", ");
  const huso = dp.husos?.length ? dp.husos[0] + (dp.husos.length > 1 ? ` (+${dp.husos.length - 1})` : "") : "";
  const tomacorriente = enchufe(destinoIso);
  const ecl = estacionesClave(dp.lat);
  const estaciones = ecl ? t("estac_" + ecl) : "";
  const acl = aguaClave(destinoIso);
  const agua = acl ? t("agua_" + acl) : "";
  const pcl = propinaClave(destinoIso);
  const propina = pcl ? t("prop_" + pcl) : "";
  // QW3: mejor época para viajar (por país, con fallback por hemisferio).
  const epoca = mejorEpoca(destinoIso, dp.lat);
  // QW4: autorización electrónica previa según pasaporte + destino.
  const autoriz = autorizacionElectronica(destinoIso, nacionalidad);

  return (
    <div className="mb-3.5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-suave dark:border-slate-700 dark:bg-slate-800">
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-bold text-marca-900">
          <span className="inline-flex items-center gap-1.5"><Icono nombre="shield" size={16} /> {t("reqTitulo")} {banderaPais(destinoIso)} {paisNombre}</span>
        </span>
        <span className="text-slate-400">{abierto ? "▴" : "▾"}</span>
      </button>

      {abierto && (
        <div className="space-y-3 px-4 pb-4">
          {/* Selector de nacionalidad (de qué pasaporte dependen los requisitos) */}
          <label className="flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">
            {t("reqTuPasaporte")}
            {/* Antes: <select> con ~199 países y el CÓDIGO ISO como nombre
                ("🇦🇩 AD", "🇦🇪 AE"…), sin orden útil ni forma de escribir.
                Encontrar Colombia exigía saber que es "CO". SelectorPais ya
                resolvía esto —nombres reales, alias como "EEUU" o "UK" y
                búsqueda sin acentos— pero no estaba conectado aquí. */}
            <SelectorPais
              value={nacionalidad}
              onChange={(iso) => onNacionalidad?.(iso)}
              className="min-w-[190px]"
              tono="oscuro"
            />
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
            {/* Ficha interna completa (visa + salud + emergencias) */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-bold">
              <a href={urlOficial} className="underline-offset-2 hover:underline">
                {t("reqVerOficial")} →
              </a>
              <a href={urlSalud} className="underline-offset-2 hover:underline">
                {t("reqVerSalud")} →
              </a>
            </div>
          </div>

          {/* QW4 — Autorización electrónica previa (ETIAS / ESTA / eTA / etc.).
              Solo aparece si la combinación pasaporte+destino la requiere.
              Tono ámbar para que destaque como acción requerida antes del viaje. */}
          {autoriz && (
            <div className={`rounded-xl border p-3 ${TONO.amber}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                {t("reqAutorizTit")}
              </div>
              <div className="mt-0.5 text-[15px] font-extrabold">
                {autoriz.tipo} <span className="font-medium opacity-80">· {t("reqAutorizRequerida")}</span>
              </div>
              <div className="mt-1 text-[12.5px] leading-snug opacity-90">{autoriz.nombre}</div>
              {autoriz.nota && (
                <div className="mt-1 text-[12px] opacity-80">{autoriz.nota}</div>
              )}
              <div className="mt-2 text-[12px] font-bold">
                <a href={autoriz.url} target="_blank" rel="noopener" className="underline-offset-2 hover:underline">
                  {t("reqVerSitioOficial")} ↗
                </a>
              </div>
            </div>
          )}

          {/* QW3 — Mejor época para viajar (clima, temporada alta/baja).
              Datos orientativos por país; fallback por hemisferio. */}
          {epoca && (
            <div className="rounded-xl border border-marca-100 bg-marca-50/50 p-3 text-marca-900 dark:border-marca-800 dark:bg-marca-900/20 dark:text-marca-300">
              <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
                {t("reqMejorEpoca")}
              </div>
              <div className="mt-1 grid gap-1.5 text-[12.5px] sm:grid-cols-[auto_1fr] sm:gap-x-3">
                <span className="font-bold opacity-80">✨ {t("reqMejorMes")}</span>
                <span>{epoca.mejor}</span>
                {epoca.evitar && (
                  <>
                    <span className="font-bold opacity-80">🚫 {t("reqEvitarMes")}</span>
                    <span>{epoca.evitar}</span>
                  </>
                )}
                {epoca.clima && (
                  <>
                    <span className="font-bold opacity-80">☀️ {t("reqClimaGeneral")}</span>
                    <span>{epoca.clima}</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Pasaporte + Fiebre amarilla */}
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
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
              <Dato icono="banknote" etiqueta={t("reqMoneda")} valor={moneda} />
              <Dato icono="languages" etiqueta={t("reqIdioma")} valor={idiomas} />
              <Dato icono="landmark" etiqueta={t("reqCapital")} valor={dp.capital} />
              <Dato icono="clock" etiqueta={t("reqHuso")} valor={huso} />
              <Dato icono="car" etiqueta={t("reqConduccion")} valor={conduccion} />
              <Dato icono="phone" etiqueta={t("reqTelefono")} valor={dp.tel} />
              <Dato icono="plug" etiqueta={t("reqEnchufe")} valor={tomacorriente} />
              <Dato icono="cloudSun" etiqueta={t("reqEstaciones")} valor={estaciones} />
              <Dato icono="droplet" etiqueta={t("reqAgua")} valor={agua} />
              <Dato icono="wallet" etiqueta={t("reqPropina")} valor={propina} />
            </div>
          </div>

          <div className="rounded-lg bg-amber-50 p-2.5 text-[11.5px] leading-snug text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
            <span className="inline-flex items-start gap-1.5"><Icono nombre="alert" size={13} className="mt-0.5 shrink-0" /> {t("reqDisclaimer")}</span>
          </div>
          <div className="px-0.5 text-[10.5px] text-slate-400">
            {t("reqFuente")}: Passport Index · REST Countries (datos abiertos)
          </div>
        </div>
      )}
    </div>
  );
}
