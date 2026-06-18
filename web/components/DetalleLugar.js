"use client";
import { useEffect, useState } from "react";
import { fotoDeLugar, galeriaDeLugar } from "@/lib/imagenes";
import { planTransporte, trazarRuta, perfilDeModo } from "@/lib/rutaReal";
import { distanciaMetros } from "@/lib/rutas";
import { fmtMin } from "@/lib/itinerario";
import { monedaDePais, costoLocal, costoUsd } from "@/lib/monedasPais";
import { obtenerTasas } from "@/lib/fx";
import { BotonTourLugar } from "./Afiliados";
import { Icono, iconoCategoria } from "./Icono";
import { nombreLocalizado } from "@/lib/nombres";

// Distancia legible (m / km).
function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}
// Modo de viaje para los enlaces de Google Maps.
function gmapsModo(modo) {
  if (modo === "walking") return "walking";
  if (modo === "cycling") return "bicycling";
  if (modo === "driving") return "driving";
  return "transit"; // bus, metro, tren
}

// Panel/modal que muestra TODO sobre un lugar SIN salir de la app:
// foto, descripción, y cómo llegar desde la ubicación del usuario
// (transporte, tiempo, costo y ruta dibujada en nuestro mapa).
export default function DetalleLugar({ lugar, ciudad, origen, onCerrar, onTrazarRuta, onAgregar, t = (k) => k, lang = "es" }) {
  const nombreLug = nombreLocalizado(lugar, lang);
  const [foto, setFoto] = useState(null);
  const [cargandoFoto, setCargandoFoto] = useState(true);
  const [errorFoto, setErrorFoto] = useState(false);
  const [modoSel, setModoSel] = useState(null);
  const [verMas, setVerMas] = useState(false);
  // Galeria de mas fotos del mismo lugar (Wikimedia Commons). Vacia hasta que
  // el efecto la cargue; sin spinner: no es esencial para usar la pantalla.
  const [galeria, setGaleria] = useState([]);
  // Indice de la foto principal mostrada (0 = foto base; 1..N = galeria[i-1]).
  const [iFoto, setIFoto] = useState(0);

  // Punto de referencia: tu ubicación (GPS) si la hay; si no, el centro de la
  // ciudad, para poder mostrar SIEMPRE las opciones de cómo llegar.
  const refOrigen = origen || (ciudad?.lat != null ? [ciudad.lat, ciudad.lon] : null);
  const metros = refOrigen ? distanciaMetros(refOrigen, lugar.coord) : null;
  const transportes = metros != null ? planTransporte(metros) : [];

  // Tasas de cambio en vivo para mostrar el costo local con el dólar del día
  // (antes la tasa estaba quemada en monedasPais.js). Si fallan, monedaDePais
  // usa su valor de respaldo.
  const [porUsd, setPorUsd] = useState(null);
  useEffect(() => {
    let vivo = true;
    obtenerTasas().then((r) => vivo && setPorUsd(r.porUsd));
    return () => { vivo = false; };
  }, []);
  const moneda = monedaDePais(ciudad?.pais, porUsd);

  useEffect(() => {
    let vivo = true;
    setCargandoFoto(true);
    setErrorFoto(false);
    setFoto(null);
    setGaleria([]);
    setIFoto(0);
    fotoDeLugar(nombreLug, ciudad?.nombre).then((f) => {
      if (vivo) {
        setFoto(f);
        setCargandoFoto(false);
      }
    });
    // Galeria en paralelo (no bloquea la pantalla); excluye la foto principal.
    galeriaDeLugar(nombreLug, ciudad?.nombre, 6).then((g) => {
      if (!vivo) return;
      const urls = (g?.urls || []).filter(Boolean);
      setGaleria(urls);
    });
    return () => {
      vivo = false;
    };
  }, [lugar, ciudad, nombreLug]);

  // URL de la foto que se muestra en grande: la principal si iFoto = 0, o la
  // miniatura correspondiente. Si no hay foto principal pero si galeria, usamos
  // la primera de galeria como portada.
  const urlPrincipal = foto?.url || null;
  const urlsMostrables = [urlPrincipal, ...galeria.filter((u) => u !== urlPrincipal)].filter(Boolean);
  const fotoActualUrl = urlsMostrables[iFoto] || urlPrincipal;

  async function elegirTransporte(tr) {
    setModoSel(tr.modo);
    if (!origen) return;
    const ruta = await trazarRuta(origen, lugar.coord, perfilDeModo(tr.modo));
    onTrazarRuta?.({ ...ruta, modo: tr.modo, lugar });
  }

  return (
    <div
      className="fixed inset-0 z-[3000] flex items-end justify-center bg-slate-900/55 animar-aparecer"
      onClick={onCerrar}
    >
      <div
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-t-[20px] bg-white shadow-[0_-8px_30px_rgba(0,0,0,.3)] animar-subir dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Asa para arrastrar (estética móvil) */}
        <div className="mx-auto mb-1 mt-2.5 h-[5px] w-[42px] rounded-full bg-slate-300" />

        {/* Foto del lugar */}
        <div className="relative h-[220px] overflow-hidden bg-slate-200">
          {cargandoFoto ? (
            <div className="flex h-full w-full items-center justify-center text-slate-400">
              <span className="spin" />
            </div>
          ) : fotoActualUrl && !errorFoto ? (
            <img
              src={fotoActualUrl}
              alt={nombreLug}
              loading="lazy"
              onError={() => setErrorFoto(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-marca-400 to-marca-900">
              <Icono nombre={iconoCategoria(lugar.categoria)} size={54} strokeWidth={1.5} />
            </div>
          )}
          <button
            className="absolute right-3 top-3 flex h-[34px] w-[34px] items-center justify-center rounded-full border-0 bg-black/50 text-white"
            onClick={onCerrar}
          >
            <Icono nombre="x" size={17} />
          </button>
          {/* Contador de foto cuando hay galeria */}
          {urlsMostrables.length > 1 && (
            <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white">
              {iFoto + 1} / {urlsMostrables.length}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3.5 pt-8 text-white">
            <div className="text-[22px] font-extrabold">{nombreLug}</div>
            <div className="text-[13px] opacity-95">
              {lugar.categoria}
              {lugar.cocina ? ` · ${lugar.cocina}` : ""}
              {lugar.notable && <span className="ml-1 inline-flex items-center gap-0.5">· <Icono nombre="star" size={11} /> Destacado</span>}
            </div>
          </div>
        </div>

        {/* Tira de miniaturas para cambiar de foto (solo si hay galeria). */}
        {urlsMostrables.length > 1 && (
          <div className="flex gap-2 overflow-x-auto px-4 pt-3">
            {urlsMostrables.map((u, i) => (
              <button
                key={u}
                type="button"
                onClick={() => { setIFoto(i); setErrorFoto(false); }}
                className={`h-[58px] w-[78px] shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                  i === iFoto ? "ring-marca-500" : "ring-transparent hover:ring-slate-300"
                }`}
              >
                <img src={u} alt={`${nombreLug} ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-4">
          {/* Acciones rápidas */}
          <div className="mb-3.5 flex flex-wrap gap-2">
            {onAgregar && (
              <button
                onClick={() => onAgregar(lugar)}
                className="rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-marca transition hover:brightness-105"
              >
                <span className="inline-flex items-center gap-1"><Icono nombre="plus" size={14} /> {t("agregar")}</span>
              </button>
            )}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${lugar.coord[0]},${lugar.coord[1]}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-slate-200 px-3.5 py-2 text-[13px] font-bold text-marca-600 transition hover:bg-slate-50"
            >
              <Icono nombre="map" size={15} /> Google Maps
            </a>
            <BotonTourLugar lugar={lugar} ciudad={ciudad} t={t} />
          </div>

          {/* Descripción (de Wikipedia), expandible */}
          {foto?.extracto && (
            <p className="mb-3.5 text-sm leading-relaxed text-slate-700">
              {verMas || foto.extracto.length <= 240
                ? foto.extracto
                : foto.extracto.slice(0, 240) + "… "}
              {foto.extracto.length > 240 && (
                <button onClick={() => setVerMas((v) => !v)} className="font-semibold text-marca-600">
                  {verMas ? t("verMenos") : t("verMas")}
                </button>
              )}
            </p>
          )}

          {/* Cómo llegar: tiempos y costos por medio de transporte (USD + local) */}
          <div className="mb-2 inline-flex items-center gap-1.5 font-bold text-marca-900"><Icono nombre="compass" size={16} /> {t("comoLlegar")}</div>

          {transportes.length > 0 ? (
            <>
              <div className="mb-2.5 text-[13px] text-slate-500">
                {origen ? (
                  <>
                    {t("estasA")} <b>{fmtDist(metros)}</b> {t("deAqui")}
                  </>
                ) : (
                  <>
                    ≈ <b>{fmtDist(metros)}</b> {t("desdeCentro")}
                    {ciudad?.nombre ? ` ${ciudad.nombre}` : ""}
                  </>
                )}
              </div>

              <div className="grid gap-2">
                {transportes.map((tr) => {
                  const gratis = tr.usd[0] === 0 && tr.usd[1] === 0;
                  const loc = gratis ? null : costoLocal(tr.usd[0], tr.usd[1], moneda);
                  const claseBase = `flex items-center gap-3 rounded-xl border p-3 transition ${
                    modoSel === tr.modo
                      ? "border-marca-500 bg-marca-50"
                      : tr.recomendado
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-100 bg-white"
                  }`;
                  const cuerpo = (
                    <>
                      <span className="text-[22px]">{tr.icono}</span>
                      <div className="flex-1 text-left">
                        <div className="text-[15px] font-bold">
                          {tr.nombre}
                          {tr.recomendado && (
                            <span className="ml-2 rounded-full bg-emerald-600 px-1.5 py-0.5 align-middle text-[10px] font-bold text-white">
                              {t("recomendado")}
                            </span>
                          )}
                        </div>
                        <div className="inline-flex flex-wrap items-center gap-1 text-xs text-slate-500">
                          <Icono nombre="clock" size={12} /> {fmtMin(tr.minutos)} · <Icono nombre="banknote" size={12} />{" "}
                          {gratis ? t("gratis") : costoUsd(tr.usd[0], tr.usd[1])}
                          {loc && <span className="text-slate-400"> · {loc}</span>}
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[13px] font-bold text-marca-600">
                        {origen ? <>{t("verRuta")} <Icono nombre="arrowRight" size={14} /></> : <Icono nombre="map" size={16} />}
                      </span>
                    </>
                  );
                  // Con GPS: dibuja la ruta dentro de la app. Sin GPS: abre la
                  // ruta en Google Maps (usa tu ubicación actual del teléfono).
                  return origen ? (
                    <button key={tr.modo} onClick={() => elegirTransporte(tr)} className={claseBase}>
                      {cuerpo}
                    </button>
                  ) : (
                    <a
                      key={tr.modo}
                      href={`https://www.google.com/maps/dir/?api=1&destination=${lugar.coord[0]},${lugar.coord[1]}&travelmode=${gmapsModo(tr.modo)}`}
                      target="_blank"
                      rel="noopener"
                      className={claseBase}
                    >
                      {cuerpo}
                    </a>
                  );
                })}
              </div>

              <div className="mt-2 text-[11px] text-slate-400">{t("aproxAviso")}</div>
              {!origen && (
                <div className="mt-2 rounded-[10px] bg-amber-50 p-2.5 text-[12px] leading-snug text-amber-700">
                  <span className="inline-flex items-start gap-1.5"><Icono nombre="pin" size={13} className="mt-0.5 shrink-0" /> {t("activaGps")}</span>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-[10px] bg-amber-100 p-3 text-[13px] leading-snug text-amber-800">
              <span className="inline-flex items-start gap-1.5"><Icono nombre="pin" size={13} className="mt-0.5 shrink-0" /> {t("activaGps")}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
