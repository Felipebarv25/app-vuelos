"use client";
// Planificador de RUTAS MULTIPARADA.
//
// El planificador de presupuesto pregunta "¿cuánta plata tienes?" y propone
// ciudades. Este hace lo contrario: el viajero ya sabe sus ciudades y su orden,
// y aquí se le dice qué cuesta, cómo moverse y cuánto tiempo pierde en camino.
//
// TRANSVERSAL POR DISEÑO: nada aquí asume un país de origen ni una lista de
// ciudades. Las paradas salen del catálogo IATA completo (~7.000 aeropuertos),
// las coordenadas del catálogo curado o del geocodificador, y el costo diario
// de la ciudad, del país o de la región, en ese orden. Cada cifra dice de dónde
// viene para no vender una estimación como si fuera un precio de mercado.
import { useCallback, useEffect, useMemo, useState } from "react";
import SelectorAeropuerto from "./SelectorAeropuerto";
import { Icono } from "./Icono";
import { obtenerOfertas } from "@/lib/ofertasDatos";
import { coordsCuradas, evaluarTramo, detectarZigzag, resumenRuta } from "@/lib/rutaViva";
import { fmtDuracion } from "@/lib/tramos";
import { linkTransporte, linkCarro, linkHoteles, linkCivitatis } from "@/lib/afiliados";
import { track } from "@/lib/track";

const sinAcentos = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Icono.js no tiene tren/bus/barco; "route" hace de transporte terrestre
// generico. Mejor un icono honesto que uno que no existe y no pinta nada.
const ICONO_MEDIO = { vuelo: "plane", tren: "route", bus: "route", ferry: "route", carro: "car" };

// Etiqueta honesta del origen de cada cifra.
function Sello({ fuente, t }) {
  const mapa = {
    detectado: ["bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", t("rutaFuenteDetectado")],
    curado: ["bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300", t("rutaFuenteCurado")],
    estimado: ["bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300", t("rutaFuenteEstimado")],
    "sin-datos": ["bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300", t("rutaFuenteSinDatos")],
  };
  const [clase, texto] = mapa[fuente] || mapa["sin-datos"];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${clase}`}>
      {texto}
    </span>
  );
}

// Borrador en curso. El usuario armo una ruta de dos paradas, cambio de
// pestana en /mis-viajes y la perdio entera: el planificador solo esta montado
// mientras su pestana esta activa, asi que React lo desmonta y el estado se va.
// Un refresco hacia lo mismo. Guardar en KV no servia de red: exige sesion y
// ademas hay que acordarse de pulsar el boton.
//
// Esto persiste lo que estas armando en el propio navegador, sin cuenta y sin
// pulsar nada. No sustituye a "Guardar" (eso sincroniza y permite compartir):
// es que perder media hora de trabajo por cambiar de pestana no es aceptable.
const BORRADOR = "anduve_ruta_borrador";

function leerBorrador() {
  try {
    const raw = localStorage.getItem(BORRADOR);
    if (!raw) return null;
    const d = JSON.parse(raw);
    return Array.isArray(d?.paradas) && d.paradas.length ? d : null;
  } catch {
    return null;
  }
}

export default function PlanRuta({ t = (k) => k, lang = "es", usuario = null, rutaInicial = null, alGuardar = null }) {
  // Una ruta abierta por enlace manda sobre el borrador; si no, se recupera lo
  // que estabas armando.
  const inicio = rutaInicial || (typeof window !== "undefined" ? leerBorrador() : null);
  const [paradas, setParadas] = useState(() => inicio?.paradas || []);
  const [viajeros, setViajeros] = useState(() => inicio?.viajeros || 1);
  // Nombre propio del viaje. La API ya lo aceptaba y ya tenia un automatico
  // ("Medellin -> Madrid"); lo que faltaba era poder escribir el tuyo.
  const [nombre, setNombre] = useState(() => inicio?.nombre || "");
  // Fecha de salida. De aqui y de las noches de cada parada salen las fechas
  // de todo el viaje, sin pedirlas dos veces ni poder contradecirse.
  const [fechaInicio, setFechaInicio] = useState(() => inicio?.fechaInicio || "");
  const [recuperado, setRecuperado] = useState(
    () => Boolean(!rutaInicial && inicio?.paradas?.length)
  );
  const [ofertas, setOfertas] = useState(null);
  const [vivos, setVivos] = useState(() => inicio?.vivos || {}); // clave tramo -> precio real pedido a mano
  const [buscando, setBuscando] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [idRuta, setIdRuta] = useState(inicio?.id || null);
  const [aviso, setAviso] = useState(null);
  // Cambia tras cada parada agregada para remontar el buscador y dejarlo
  // vacío: si no, se queda con "Madrid (MAD)" escrito y encadenar la
  // siguiente parada obliga a borrar a mano.
  const [nSelector, setNSelector] = useState(0);
  // Buscador secundario para ciudades SIN AEROPUERTO. El selector principal
  // busca sobre el catálogo IATA, así que York, Brujas o Siena no aparecen
  // aunque sean paradas normales de una ruta en tren. Sin esto, "York" caía
  // en York, Estados Unidos, que sí tiene aeropuerto.
  const [textoLibre, setTextoLibre] = useState("");
  const [candidatos, setCandidatos] = useState(null);
  const [buscandoLibre, setBuscandoLibre] = useState(false);

  useEffect(() => { obtenerOfertas().then(setOfertas); }, []);

  // Guarda el borrador en cada cambio. Se incluyen los precios en vivo ya
  // consultados para no volver a gastar cuota de Travelpayouts al volver.
  useEffect(() => {
    try {
      if (!paradas.length) { localStorage.removeItem(BORRADOR); return; }
      localStorage.setItem(
        BORRADOR,
        JSON.stringify({ paradas, viajeros, nombre, fechaInicio, id: idRuta, vivos })
      );
    } catch {}
  }, [paradas, viajeros, nombre, fechaInicio, idRuta, vivos]);

  // Empezar otro viaje sin perder el guardado: se suelta el id para que el
  // siguiente "Guardar" cree una ruta nueva en vez de pisar la anterior.
  function nuevoViaje() {
    setParadas([]);
    setViajeros(1);
    setNombre("");
    setFechaInicio("");
    setIdRuta(null);
    setVivos({});
    setRecuperado(false);
    try { localStorage.removeItem(BORRADOR); } catch {}
  }

  const fmtUsd = (v) => "US$ " + Math.round(v || 0).toLocaleString("en-US");

  // --- Agregar / quitar / mover paradas -------------------------------------
  const agregar = useCallback(async (a) => {
    if (!a?.ciudad) return;
    const base = {
      ciudad: a.ciudad,
      pais: a.pais,           // ISO 2 letras del catálogo de aeropuertos
      paisNombre: a.paisNombre || a.pais,
      iata: a.iata,
      noches: 2,
      lat: null,
      lon: null,
    };
    // 1) catálogo curado (instantáneo)  2) geocodificador (cualquier ciudad)
    const cur = coordsCuradas(a.ciudad, a.paisNombre || a.pais);
    if (cur) Object.assign(base, cur);
    setParadas((prev) => [...prev, base]);

    if (!cur) {
      try {
        // Se manda el ISO, no el nombre: el geocodificador filtra por
        // countrycode. Con el nombre en español confundía países enteros.
        const r = await fetch(
          `/api/geocodificar?ciudad=${encodeURIComponent(a.ciudad)}&iso=${encodeURIComponent(a.pais || "")}`
        );
        const d = r.ok ? await r.json() : null;
        if (d?.encontrado) {
          setParadas((prev) =>
            prev.map((p) =>
              p.ciudad === base.ciudad && p.iata === base.iata && p.lat == null
                ? { ...p, lat: d.lat, lon: d.lon }
                : p
            )
          );
        }
      } catch {}
    }
    setNSelector((n) => n + 1);
    track("ruta_parada_agregada", { ciudad: a.ciudad, iata: a.iata });
  }, []);

  async function buscarLibre() {
    const q = textoLibre.trim();
    if (q.length < 2) return;
    setBuscandoLibre(true);
    setCandidatos(null);
    try {
      const r = await fetch(`/api/geocodificar?lista=1&ciudad=${encodeURIComponent(q)}`);
      const d = r.ok ? await r.json() : null;
      setCandidatos(d?.resultados || []);
    } catch {
      setCandidatos([]);
    }
    setBuscandoLibre(false);
  }

  function agregarLibre(c) {
    setParadas((prev) => [
      ...prev,
      {
        ciudad: c.ciudad,
        pais: c.iso,
        paisNombre: c.pais || c.iso,
        iata: "",           // sin aeropuerto: los tramos serán terrestres
        noches: 2,
        lat: c.lat,
        lon: c.lon,
      },
    ]);
    setTextoLibre("");
    setCandidatos(null);
    track("ruta_parada_sin_aeropuerto", { ciudad: c.ciudad });
  }

  const quitar = (i) => setParadas((p) => p.filter((_, k) => k !== i));
  const mover = (i, delta) =>
    setParadas((p) => {
      const j = i + delta;
      if (j < 0 || j >= p.length) return p;
      const c = [...p];
      [c[i], c[j]] = [c[j], c[i]];
      return c;
    });
  const cambiarNoches = (i, n) =>
    setParadas((p) => p.map((x, k) => (k === i ? { ...x, noches: Math.max(0, Number(n) || 0) } : x)));

  // --- Precios reales que la app YA tiene -----------------------------------
  // ofertas.json guarda el destino por nombre de ciudad y por código, así que se
  // casa por ambos. Es gratis: ya está descargado.
  const vueloDetectado = useCallback(
    (desde, hasta) => {
      const rutas = ofertas?.rutas || [];
      const c = sinAcentos(hasta.ciudad);
      const hit = rutas.find(
        (r) =>
          r.origen === desde.iata &&
          (r.destino === hasta.iata || sinAcentos(r.ciudad) === c)
      );
      if (!hit) return null;
      const durH =
        hit.duracion_ida != null ? Number(hit.duracion_ida) / 60 : null;
      return { precio: hit.precio, duracion_h: durH, aerolinea: hit.aerolinea };
    },
    [ofertas]
  );

  const tramos = useMemo(() => {
    const out = [];
    for (let i = 0; i < paradas.length - 1; i++) {
      const desde = paradas[i];
      const hasta = paradas[i + 1];
      const clave = `${desde.iata}-${hasta.iata}-${i}`;
      const real = vivos[clave] || vueloDetectado(desde, hasta);
      out.push({ ...evaluarTramo({ desde, hasta, vueloReal: real }), desde, hasta, clave });
    }
    return out;
  }, [paradas, vivos, vueloDetectado]);

  const resumen = useMemo(
    () => resumenRuta({ paradas, tramos, viajeros }),
    [paradas, tramos, viajeros]
  );
  const zigzag = useMemo(() => detectarZigzag(paradas), [paradas]);

  // Fechas de cada parada a partir de la salida y de las noches que ya pusiste
  // ciudad por ciudad. Se derivan en vez de pedirse: si el usuario escribiera
  // la fecha de fin a mano, podria contradecir a las noches y no habria forma
  // de saber cual de las dos manda.
  const fechas = useMemo(() => {
    if (!fechaInicio) return null;
    const base = new Date(fechaInicio + "T00:00:00");
    if (Number.isNaN(base.getTime())) return null;
    const suma = (dias) => {
      const d = new Date(base);
      d.setDate(d.getDate() + dias);
      return d;
    };
    const porParada = [];
    let acumulado = 0;
    paradas.forEach((p, i) => {
      porParada.push({ llegada: suma(acumulado), noches: i === 0 ? 0 : Math.max(0, Number(p.noches) || 0) });
      if (i > 0) acumulado += Math.max(0, Number(p.noches) || 0);
    });
    return { porParada, fin: suma(acumulado), noches: acumulado };
  }, [fechaInicio, paradas]);

  const fmtFecha = (d) =>
    d ? d.toLocaleDateString(lang, { day: "numeric", month: "short" }) : "";

  // --- Precio real bajo demanda ---------------------------------------------
  // No se piden solos: cada consulta gasta cuota de Travelpayouts. El usuario
  // decide en qué tramo quiere el dato de verdad.
  async function buscarReal(tr) {
    if (!tr.desde.iata || !tr.hasta.iata) return;
    setBuscando((b) => ({ ...b, [tr.clave]: true }));
    try {
      const r = await fetch(
        `/api/vuelo-vivo?iata=${tr.hasta.iata}&origenes=${tr.desde.iata}`
      );
      const d = r.ok ? await r.json() : null;
      if (d?.encontrado) {
        setVivos((v) => ({
          ...v,
          [tr.clave]: {
            precio: d.precio,
            duracion_h: d.duracion_ida ? d.duracion_ida / 60 : null,
            aerolinea: d.aerolinea,
          },
        }));
      } else {
        setAviso(t("rutaSinVueloReal").replace("{ruta}", `${tr.desde.ciudad} → ${tr.hasta.ciudad}`));
      }
    } catch {
      setAviso(t("rutaErrorRed"));
    }
    setBuscando((b) => ({ ...b, [tr.clave]: false }));
  }

  // --- Guardar / compartir ---------------------------------------------------
  async function guardar() {
    if (paradas.length < 2) return;
    setGuardando(true);
    try {
      const h = { "Content-Type": "application/json" };
      try {
        const tk = localStorage.getItem("anduve_auth_token") || sessionStorage.getItem("anduve_auth_token");
        if (tk) h.Authorization = `Bearer ${tk}`;
      } catch {}
      const r = await fetch("/api/rutas", {
        method: "POST",
        headers: h,
        body: JSON.stringify({ id: idRuta, paradas, viajeros, nombre, fechaInicio }),
      });
      const d = await r.json();
      if (d?.ok) {
        setIdRuta(d.ruta.id);
        setAviso(t("rutaGuardada"));
        track("ruta_guardada", { paradas: paradas.length });
        // Que la lista de rutas guardadas de /mis-viajes se entere sin recargar.
        alGuardar?.(d.ruta);
      } else {
        setAviso(d?.motivo === "no-auth" ? t("rutaEntraParaGuardar") : t("rutaErrorGuardar"));
      }
    } catch {
      setAviso(t("rutaErrorGuardar"));
    }
    setGuardando(false);
  }

  const enlaceCompartir = idRuta
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/ruta?id=${idRuta}`
    : null;

  // ---------------------------------------------------------------------------
  return (
    <div className="grid gap-6">
      {/* Identidad del viaje: nombre propio y fecha de salida.
          Faltaban las dos. La API ya guardaba `nombre` pero el planificador
          nunca lo mandaba, asi que todas las rutas quedaban con el automatico
          "Medellin -> Madrid"; y de fechas no habia nada en ningun sitio. */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
            {t("rutaIdentidadEyebrow")}
          </div>
          {paradas.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (idRuta || window.confirm(t("rutaNuevoConfirmar"))) nuevoViaje();
              }}
              className="rounded-full border-[1.5px] border-slate-200 px-3 py-1 text-[12px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + {t("rutaNuevo")}
            </button>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
              {t("rutaNombre")}
            </span>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={120}
              placeholder={
                paradas.length >= 2
                  ? `${paradas[0].ciudad} → ${paradas[paradas.length - 1].ciudad}`
                  : t("rutaNombrePlaceholder")
              }
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
              {t("rutaFechaSalida")}
            </span>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
          </label>
        </div>

        {fechas && (
          <p className="mt-2 text-[12.5px] text-slate-500 dark:text-slate-400">
            {t("rutaFechasResumen")
              .replace("{salida}", fmtFecha(fechas.porParada[0]?.llegada))
              .replace("{regreso}", fmtFecha(fechas.fin))
              .replace("{n}", fechas.noches)}
          </p>
        )}
      </div>

      {/* Borrador recuperado: se avisa, porque ver contenido que no acabas de
          escribir sin explicacion desconcierta mas de lo que ayuda. */}
      {recuperado && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200">
          <span>{t("rutaBorradorRecuperado")}</span>
          <button
            type="button"
            onClick={() => setRecuperado(false)}
            className="ml-auto font-bold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            {t("rutaEntendido")}
          </button>
        </div>
      )}

      {/* Añadir parada */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
        <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
          {t("rutaAgregarEyebrow")}
        </div>
        <div className="mt-0.5 text-[13.5px] font-bold text-slate-900 dark:text-slate-100">
          {paradas.length === 0 ? t("rutaAgregarPrimera") : t("rutaAgregarSiguiente")}
        </div>
        <div className="mt-3 max-w-md">
          <SelectorAeropuerto
            key={nSelector}
            filtroPais={false}
            value=""
            onChange={agregar}
            placeholder={t("rutaBuscarCiudad")}
            ariaLabel={t("rutaBuscarCiudad")}
            lang={lang}
          />
        </div>

        {/* Ciudades sin aeropuerto */}
        <details className="mt-3 max-w-md">
          <summary className="cursor-pointer text-[12.5px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:text-slate-400">
            {t("rutaSinAeropuerto")}
          </summary>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              value={textoLibre}
              onChange={(e) => setTextoLibre(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); buscarLibre(); } }}
              placeholder={t("rutaSinAeropuertoPlaceholder")}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={buscarLibre}
              disabled={buscandoLibre || textoLibre.trim().length < 2}
              className="shrink-0 rounded-xl border-[1.5px] border-slate-200 px-3 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {buscandoLibre ? "…" : t("rutaBuscar")}
            </button>
          </div>
          {candidatos && candidatos.length === 0 && (
            <div className="mt-2 text-[12.5px] text-slate-500 dark:text-slate-400">
              {t("rutaSinAeropuertoVacio")}
            </div>
          )}
          {candidatos && candidatos.length > 0 && (
            <ul className="mt-2 grid gap-1">
              {candidatos.map((c, i) => (
                <li key={`${c.ciudad}-${c.iso}-${i}`}>
                  <button
                    type="button"
                    onClick={() => agregarLibre(c)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-left text-[13.5px] transition hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{c.ciudad}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      {c.region ? ` · ${c.region}` : ""}{c.pais ? ` · ${c.pais}` : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>

      {paradas.length > 0 && (
        <>
          {/* Viajeros */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-[13px] font-semibold text-slate-600 dark:text-slate-400">
              {t("rutaViajeros")}
            </label>
            <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-700">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setViajeros(n)}
                  className={`h-8 w-8 rounded-full text-[13px] font-bold transition ${
                    viajeros === n
                      ? "bg-white text-marca-700 shadow dark:bg-slate-600 dark:text-marca-300"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Zigzag */}
          {zigzag.hayZigzag && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="text-[13.5px] font-bold text-amber-900 dark:text-amber-200">
                {t("rutaZigzagTitulo").replace("{pct}", zigzag.ahorroPct)}
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">
                {t("rutaZigzagAyuda")
                  .replace("{actual}", zigzag.kmActual.toLocaleString("es-CO"))
                  .replace("{optimo}", zigzag.kmOptimo.toLocaleString("es-CO"))}
              </p>
              <div className="mt-2 text-[12.5px] font-semibold text-amber-900 dark:text-amber-200">
                {zigzag.ordenSugerido.join("  →  ")}
              </div>
            </div>
          )}

          {/* Itinerario */}
          <ol className="grid gap-0">
            {paradas.map((p, i) => {
              const tr = tramos[i];
              const esUltima = i === paradas.length - 1;
              return (
                <li key={`${p.iata}-${i}`}>
                  {/* Parada */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-800">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-[12px] font-bold tabular-nums text-marca-700 dark:bg-marca-900/40 dark:text-marca-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                        {p.ciudad}{" "}
                        <span className="text-[12.5px] font-normal text-slate-400">{p.iata}</span>
                      </div>
                      {/* Fechas de esta parada, derivadas de la salida y de
                          las noches. Solo aparecen si pusiste fecha. */}
                      {fechas && (
                        <div className="text-[11.5px] font-semibold text-marca-700 dark:text-marca-300">
                          {i === 0
                            ? t("rutaSalesEl").replace("{fecha}", fmtFecha(fechas.porParada[0].llegada))
                            : t("rutaEstasDel")
                                .replace("{desde}", fmtFecha(fechas.porParada[i].llegada))
                                .replace(
                                  "{hasta}",
                                  fmtFecha(
                                    fechas.porParada[i + 1]?.llegada ||
                                      (i === paradas.length - 1 ? fechas.fin : null)
                                  )
                                )}
                        </div>
                      )}
                      {p.lat == null && (
                        <div className="text-[11.5px] text-amber-700 dark:text-amber-400">
                          {t("rutaSinCoordenadas")}
                        </div>
                      )}
                    </div>

                    {i > 0 && (
                      <label className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                        <input
                          type="number"
                          min="0"
                          max="365"
                          value={p.noches}
                          onChange={(e) => cambiarNoches(i, e.target.value)}
                          className="w-14 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-[13px] tabular-nums dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                        />
                        {t("rutaNoches")}
                      </label>
                    )}

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => mover(i, -1)}
                        disabled={i === 0}
                        aria-label={t("rutaSubir")}
                        title={t("rutaSubir")}
                        className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => mover(i, 1)}
                        disabled={esUltima}
                        aria-label={t("rutaBajar")}
                        title={t("rutaBajar")}
                        className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-700"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => quitar(i)}
                        aria-label={t("rutaQuitar")}
                        title={t("rutaQuitar")}
                        className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30"
                      >
                        ×
                      </button>
                    </div>

                    {/* Reservas de la ciudad (no en la primera: es tu casa) */}
                    {i > 0 && (
                      <div className="flex w-full flex-wrap gap-1.5 border-t border-slate-100 pt-2.5 dark:border-slate-700">
                        <a href={linkHoteles({ ciudad: p.ciudad, lat: p.lat, lon: p.lon })} target="_blank" rel="sponsored noopener"
                           className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                          {t("rutaDormir")}
                        </a>
                        <a href={linkCivitatis({ ciudad: p.ciudad })} target="_blank" rel="sponsored noopener"
                           className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                          {t("rutaHacer")}
                        </a>
                        <a href={linkCarro({ ciudad: p.ciudad, pais: p.paisNombre })} target="_blank" rel="sponsored noopener"
                           className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700">
                          {t("rutaCarro")}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Tramo hacia la siguiente parada */}
                  {!esUltima && tr && (
                    <div className="ml-3.5 border-l-2 border-dashed border-slate-200 py-2 pl-5 dark:border-slate-700">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                          <Icono nombre={ICONO_MEDIO[tr.medio] || "arrowRight"} size={15} />
                          {tr.medio ? t("rutaMedio_" + tr.medio) : "—"}
                          {tr.operador && <span className="font-normal text-slate-400">· {tr.operador}</span>}
                        </span>
                        <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                          {tr.precio != null ? fmtUsd(tr.precio) : "—"}
                        </span>
                        {tr.puertaAPuerta_h != null && (
                          <span className="text-slate-500 dark:text-slate-400">
                            {fmtDuracion(tr.puertaAPuerta_h)} {t("rutaPuertaAPuerta")}
                          </span>
                        )}
                        {tr.km != null && (
                          <span className="tabular-nums text-slate-400">{tr.km.toLocaleString("es-CO")} km</span>
                        )}
                        <Sello fuente={tr.fuente} t={t} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <a href={linkTransporte({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad })}
                           target="_blank" rel="sponsored noopener"
                           className="rounded-lg bg-marca-50 px-2.5 py-1 text-[12px] font-bold text-marca-700 transition hover:bg-marca-100 dark:bg-marca-900/30 dark:text-marca-300">
                          {t("rutaVerOpciones")}
                        </a>
                        {tr.fuente !== "detectado" && tr.desde.iata && tr.hasta.iata && (
                          <button
                            onClick={() => buscarReal(tr)}
                            disabled={buscando[tr.clave]}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                          >
                            {buscando[tr.clave] ? t("rutaBuscandoReal") : t("rutaBuscarReal")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* Resumen */}
          {paradas.length >= 2 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
                {t("rutaResumen")}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaTransporte")}</div>
                  <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{fmtUsd(resumen.transporte)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">
                    {t("rutaEstadia").replace("{noches}", resumen.noches)}
                  </div>
                  <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">{fmtUsd(resumen.estadia)}</div>
                </div>
                <div>
                  <div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaEnMovimiento")}</div>
                  <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                    {fmtDuracion(resumen.horasEnMovimiento)}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-slate-100 pt-4 dark:border-slate-700">
                <span className="text-[13px] text-slate-500 dark:text-slate-400">{t("rutaPorPersona")}</span>
                <span className="text-[17px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmtUsd(resumen.porPersona)}</span>
                <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">
                  {t("rutaTotal").replace("{n}", resumen.viajeros)}
                </span>
                <span className="text-[26px] font-extrabold tabular-nums tracking-tight text-marca-700 dark:text-marca-300">
                  {fmtUsd(resumen.total)}
                </span>
              </div>

              <p className="mt-3 text-[12px] leading-relaxed text-slate-500 dark:text-slate-400">
                {t("rutaConfianza")
                  .replace("{detectados}", resumen.confianza.detectados)
                  .replace("{curados}", resumen.confianza.curados)
                  .replace("{estimados}", resumen.confianza.estimados)}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={guardar}
                  disabled={guardando}
                  className="rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-4 py-2.5 text-[13px] font-bold text-white shadow-marca transition hover:brightness-105 disabled:opacity-60"
                >
                  {guardando ? t("rutaGuardando") : idRuta ? t("rutaActualizar") : t("rutaGuardar")}
                </button>
                {enlaceCompartir && (
                  <button
                    onClick={() => {
                      try {
                        navigator.clipboard.writeText(enlaceCompartir);
                        setAviso(t("rutaEnlaceCopiado"));
                      } catch {}
                    }}
                    className="rounded-xl border-[1.5px] border-slate-200 px-4 py-2.5 text-[13px] font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {t("rutaCompartir")}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {aviso && (
        <div
          role="status"
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-700 shadow-suave dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        >
          {aviso}{" "}
          <button onClick={() => setAviso(null)} className="ml-1 font-bold text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
