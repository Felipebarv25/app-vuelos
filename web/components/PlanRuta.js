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
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import SelectorAeropuerto from "./SelectorAeropuerto";
import Bandera from "./Bandera";
import DesglosePresupuesto from "./DesglosePresupuesto";
import IlustracionRuta from "./IlustracionRuta";
import { construirPresupuesto } from "@/lib/presupuestoConstruir";
import { nombrePaisMostrar } from "@/lib/paisesNombres";
import { Icono } from "./Icono";
import { obtenerOfertas } from "@/lib/ofertasDatos";
import {
  coordsCuradas,
  evaluarTramo,
  detectarZigzag,
  resumenRuta,
  ajustarIdaYVuelta,
  tramoSinVueloLargo,
  hubsSugeridos,
} from "@/lib/rutaViva";
import { fmtDuracion } from "@/lib/tramos";
import { linkTransporte, linkCarro, linkHoteles, linkCivitatis } from "@/lib/afiliados";
import { track } from "@/lib/track";
import { leerLocales, escribirLocal, borrarLocal, nuevoUid } from "@/lib/rutasLocales";

// maplibre pesa y no todo el mundo abre un viaje: se carga solo cuando hay
// mapa que pintar.
const MapaRuta = dynamic(() => import("./MapaRuta"), { ssr: false });

// "2027-04-02" y "2027-04" entran igual y salen como "2027-04". El formato
// largo es el que guardaban las rutas antes de pasar a mes.
const conMayuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const aMes = (s) => (/^\d{4}-\d{2}/.test(s || "") ? String(s).slice(0, 7) : "");

// Donde entra una parada nueva.
//
// Se anadia siempre al final, y en un viaje que ya cierra en casa eso deja la
// ciudad nueva DESPUES del regreso: el itinerario terminaba Glasgow ->
// Medellin -> York, con un vuelo Medellin -> York de largo radio que nadie
// planeo. La ultima parada es el regreso: la nueva va justo antes.
function posicionParaNueva(paradas) {
  if (paradas.length < 2) return paradas.length;
  const primera = paradas[0];
  const ultima = paradas[paradas.length - 1];
  const cierra =
    (primera.iata && primera.iata === ultima.iata) || primera.ciudad === ultima.ciudad;
  return cierra ? paradas.length - 1 : paradas.length;
}

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
    incluido: ["bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300", t("rutaFuenteIncluido")],
  };
  const [clase, texto] = mapa[fuente] || mapa["sin-datos"];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${clase}`}>
      {texto}
    </span>
  );
}

// Dato suelto de la portada.
function Chip({ children, fuerte = false }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[12px] font-bold backdrop-blur ${
        fuerte ? "bg-white text-marca-800" : "bg-white/15 text-white"
      }`}
    >
      {children}
    </span>
  );
}

// Cabecera de cada paso del formulario. Numerarlos no es decoracion: la
// tarjeta es larga y sin ellos no se ve que nombre, ruta y presupuesto son
// tres momentos del mismo trabajo.
function Paso({ n, titulo, sub = null }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-marca-50 text-[12px] font-extrabold tabular-nums text-marca-700 dark:bg-marca-900/40 dark:text-marca-300">
        {n}
      </span>
      <div className="min-w-0">
        <div className="text-[14.5px] font-extrabold text-slate-900 dark:text-slate-100">{titulo}</div>
        {sub && <div className="text-[12.5px] text-slate-500 dark:text-slate-400">{sub}</div>}
      </div>
    </div>
  );
}

export default function PlanRuta({
  t = (k) => k,
  lang = "es",
  usuario = null,
  rutaInicial = null,
  alGuardar = null,
  // Vuelve a la lista de viajes. Solo lo pasa /mis-viajes, donde este
  // planificador es el DETALLE de un viaje concreto; en /ruta no aplica.
  onVolver = null,
}) {
  // Qué se carga al abrir, y bajo qué identidad local se guarda.
  //
  //   viaje nuevo        -> uid nuevo, vacío
  //   entrada local      -> esa misma entrada (tus cambios sin guardar)
  //   ruta del servidor  -> sus cambios locales si los hay, si no lo guardado
  const [inicio, uid] = useMemo(() => {
    if (typeof window === "undefined") return [rutaInicial, nuevoUid()];
    if (!rutaInicial || rutaInicial.nueva) return [null, nuevoUid()];
    if (rutaInicial.uid) return [rutaInicial, rutaInicial.uid];
    const local = leerLocales().find((x) => x.id && x.id === rutaInicial.id);
    return [local || rutaInicial, local?.uid || nuevoUid()];
    // Solo al montar: remontamos con `key` al abrir otro viaje.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [paradas, setParadas] = useState(() => inicio?.paradas || []);
  const [viajeros, setViajeros] = useState(() => inicio?.viajeros || 1);
  // Nombre propio del viaje. La API ya lo aceptaba y ya tenia un automatico
  // ("Medellin -> Madrid"); lo que faltaba era poder escribir el tuyo.
  const [nombre, setNombre] = useState(() => inicio?.nombre || "");
  // MES de salida ("YYYY-MM"), no dia.
  //
  // Antes se pedia el dia exacto. Un viaje que se planea con meses de
  // antelacion no tiene dia: el usuario elegia uno inventado y la tarjeta lo
  // repetia despues como si fuera un dato. El mes es lo que de verdad se sabe
  // a esas alturas, y es tambien la unidad con la que se piden precios reales.
  // Se lee el formato viejo "YYYY-MM-DD" para no perder lo ya guardado.
  const [mesInicio, setMesInicio] = useState(() => aMes(inicio?.mesInicio || inicio?.fechaInicio));
  const [recuperado, setRecuperado] = useState(
    () => Boolean(inicio && inicio !== rutaInicial && inicio?.paradas?.length)
  );
  const [ofertas, setOfertas] = useState(null);
  const [vivos, setVivos] = useState(() => inicio?.vivos || {}); // clave tramo -> precio real pedido a mano
  const [buscando, setBuscando] = useState({});
  const [guardando, setGuardando] = useState(false);
  const [idRuta, setIdRuta] = useState(inicio?.id || null);
  const [aviso, setAviso] = useState(null);
  // Lo que el viajero fijo a mano, por ID de linea. Va por ID y no por
  // posicion a proposito: si reordena las ciudades, su precio del hotel de
  // Madrid sigue siendo el de Madrid.
  const [overrides, setOverrides] = useState(() => inicio?.presupuesto?.overrides || {});
  const [ajustes, setAjustes] = useState(
    () => inicio?.presupuesto?.ajustes || { contingenciaPct: 0.1, margenCambiarioPct: 0.03 }
  );
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

  // Persiste en cada cambio. Se incluyen los precios en vivo ya consultados
  // para no volver a gastar cuota de Travelpayouts al reabrir el viaje.
  useEffect(() => {
    if (!paradas.length && !nombre && !mesInicio) { borrarLocal(uid); return; }
    escribirLocal({
      uid, id: idRuta, paradas, viajeros, nombre, mesInicio, vivos,
      presupuesto: { overrides, ajustes },
    });
  }, [uid, paradas, viajeros, nombre, mesInicio, idRuta, vivos, overrides, ajustes]);

  // Empezar otro viaje sin perder el guardado: se suelta el id para que el
  // siguiente "Guardar" cree una ruta nueva en vez de pisar la anterior.
  function nuevoViaje() {
    setParadas([]);
    setViajeros(1);
    setNombre("");
    setMesInicio("");
    setOverrides({});
    setIdRuta(null);
    setVivos({});
    setRecuperado(false);
    borrarLocal(uid);
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
    setParadas((prev) => [...prev.slice(0, posicionParaNueva(prev)), base, ...prev.slice(posicionParaNueva(prev))]);

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
    setParadas((prev) => {
      const pos = posicionParaNueva(prev);
      return [
        ...prev.slice(0, pos),
        {
        ciudad: c.ciudad,
        pais: c.iso,
        paisNombre: c.pais || c.iso,
        iata: "",           // sin aeropuerto: los tramos serán terrestres
        noches: 2,
        lat: c.lat,
        lon: c.lon,
        },
        ...prev.slice(pos),
      ];
    });
    setTextoLibre("");
    setCandidatos(null);
    track("ruta_parada_sin_aeropuerto", { ciudad: c.ciudad });
  }

  // Meter una escala EN MEDIO, no al final.
  //
  // Hasta ahora solo se podia anadir al final y despues subirla a mano con las
  // flechas. Cuando lo que hace falta es exactamente "pasar por Madrid antes
  // de volver", eso son cinco clics para una decision que ya esta tomada.
  const insertarEscala = useCallback(async (pos, hub) => {
    const base = {
      ciudad: hub.ciudad,
      pais: hub.cc,
      paisNombre: hub.pais,
      iata: hub.iata,
      noches: 1,
      lat: null,
      lon: null,
    };
    const cur = coordsCuradas(hub.ciudad, hub.pais);
    if (cur) Object.assign(base, cur);
    setParadas((prev) => [...prev.slice(0, pos), base, ...prev.slice(pos)]);
    track("ruta_escala_hub", { ciudad: hub.ciudad, iata: hub.iata });

    if (cur) return;
    try {
      const r = await fetch(
        `/api/geocodificar?ciudad=${encodeURIComponent(hub.ciudad)}&iso=${encodeURIComponent(hub.cc)}`
      );
      const d = r.ok ? await r.json() : null;
      if (d?.encontrado) {
        setParadas((prev) =>
          prev.map((x) =>
            x.iata === hub.iata && x.lat == null ? { ...x, lat: d.lat, lon: d.lon } : x
          )
        );
      }
    } catch {}
  }, []);

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

  const tramosCrudos = useMemo(() => {
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

  // El precio de un vuelo detectado es de IDA Y VUELTA. Si el viaje cierra
  // sobre el mismo par de ciudades, el tramo de regreso ya esta pagado.
  const { tramos, regresoIncluido, aviso: avisoIdaVuelta } = useMemo(
    () => ajustarIdaYVuelta(tramosCrudos),
    [tramosCrudos]
  );

  const resumen = useMemo(
    () => resumenRuta({ paradas, tramos, viajeros }),
    [paradas, tramos, viajeros]
  );

  // El presupuesto de verdad: lineas con formula, fuente y confianza. El
  // `resumen` de arriba se queda solo para las cifras de cabecera (tiempo en
  // movimiento, confianza de los tramos), que no son gasto.
  const presupuesto = useMemo(
    () => construirPresupuesto({ paradas, tramos, viajeros, overrides, ajustes }),
    [paradas, tramos, viajeros, overrides, ajustes]
  );

  // Suma de unas categorias concretas del presupuesto nuevo.
  const totalDeCategorias = useCallback(
    (cats) =>
      (presupuesto.porCategoria || [])
        .filter((c) => cats.includes(c.categoria))
        .reduce((s, c) => s + c.total, 0),
    [presupuesto]
  );

  const fijarLinea = useCallback((id, monto) => {
    setOverrides((prev) => {
      const sig = { ...prev };
      if (monto == null || !Number.isFinite(Number(monto))) delete sig[id];
      else sig[id] = Math.max(0, Math.round(Number(monto)));
      return sig;
    });
    track("presupuesto_linea_fijada", { id });
  }, []);
  const zigzag = useMemo(() => detectarZigzag(paradas), [paradas]);

  // DIAS del viaje, no fechas. Con el mes de salida no hay dia exacto que dar,
  // y numerar los dias dice lo mismo sin inventarse nada: cuanto dura el viaje
  // y en que tramo cae cada ciudad depende solo de las noches que pongas.
  //
  // El dia 1 es el de salida, y la primera parada de destino cae tambien en el
  // dia 1: se sale y se llega el mismo dia, igual que calculaba la version con
  // fechas.
  const dias = useMemo(() => {
    if (!paradas.length) return null;
    const porParada = [];
    let acum = 0;
    paradas.forEach((p, i) => {
      const desde = acum + 1;
      if (i > 0) acum += Math.max(0, Number(p.noches) || 0);
      porParada.push({ desde, hasta: acum + 1 });
    });
    return { porParada, noches: acum, total: acum + 1 };
  }, [paradas]);

  // Paises por los que pasa el viaje, en el orden en que aparecen y sin
  // repetir. Cada parada trae el ISO de dos letras del catalogo de
  // aeropuertos, asi que la bandera sale del dato que ya teniamos.
  const paisesRuta = useMemo(() => {
    const vistos = [];
    for (const p of paradas) {
      const cc = String(p.pais || "").trim().toLowerCase();
      if (/^[a-z]{2}$/.test(cc) && !vistos.includes(cc)) vistos.push(cc);
    }
    return vistos;
  }, [paradas]);

  // Recorrido en una linea: de donde sales, por que paises pasas, y cuanto
  // dura. Antes esto habia que deducirlo leyendo la lista entera de paradas.
  const recorrido = useMemo(() => {
    if (paradas.length < 2) return "";
    const nombres = [];
    for (const p of paradas) {
      const nom = p.paisNombre || nombrePaisMostrar(p.pais, lang) || p.ciudad;
      if (nombres[nombres.length - 1] !== nom) nombres.push(nom);
    }
    // Mas de cuatro paises no se lee: se resume por los extremos.
    const tramo =
      nombres.length > 4
        ? [nombres[0], "…", nombres[nombres.length - 1]].join(" → ")
        : nombres.join(" → ");
    return tramo;
  }, [paradas, lang]);

  // Cuantos tramos tienen precio de mercado y no estimacion. Es la unica
  // pastilla de la portada que dice algo sobre la calidad del numero grande.
  const tramosReales = useMemo(
    () => tramos.filter((t) => t.fuente === "detectado").length,
    [tramos]
  );

  const porDia = presupuesto.dias > 0 ? Math.round(presupuesto.total / presupuesto.dias) : 0;

  // Etiqueta del mes elegido, en el idioma de la interfaz, en dos formas.
  //
  // `llano` es lo que devuelve el navegador: en espanol, portugues y frances
  // el mes va en minuscula; en ingles, en mayuscula. Esa es la que se mete
  // dentro de una frase ("Sales en abril de 2027" / "You leave in April
  // 2027"). Capitalizar siempre daba "Sales en Abril de 2027".
  //
  // `mesLabel` es la misma con mayuscula inicial, para cuando va sola: la
  // pastilla de la portada y el selector.
  const [mesLlano, mesLabel] = useMemo(() => {
    if (!mesInicio) return ["", ""];
    const d = new Date(mesInicio + "-01T00:00:00");
    if (Number.isNaN(d.getTime())) return ["", ""];
    const llano = d.toLocaleDateString(lang, { month: "long", year: "numeric" });
    return [llano, conMayuscula(llano)];
  }, [mesInicio, lang]);

  // Los proximos 24 meses. Dos anos, no uno: la gente planea viajes largos con
  // mas antelacion que una escapada, y el planificador ya guardaba viajes a
  // 2028.
  const proximosMeses = useMemo(() => {
    const base = new Date();
    const out = [];
    for (let i = 0; i < 24; i++) {
      const m = new Date(base.getFullYear(), base.getMonth() + i, 1);
      out.push({
        clave: `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
        etiqueta: conMayuscula(m.toLocaleDateString(lang, { month: "long", year: "numeric" })),
      });
    }
    return out;
  }, [lang]);

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
        body: JSON.stringify({
          id: idRuta, paradas, viajeros, nombre, mesInicio,
          presupuesto: { overrides, ajustes },
        }),
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
  // Titulo de la portada: tu nombre si lo pusiste; si no, el automatico de la
  // ruta; y si todavia no hay ruta, un marcador honesto en vez de un hueco.
  const tituloViaje =
    nombre.trim() ||
    (paradas.length >= 2
      ? `${paradas[0].ciudad} → ${paradas[paradas.length - 1].ciudad}`
      : paradas.length === 1
        ? paradas[0].ciudad
        : t("rutaSinNombre"));


  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
      {/* ------------------------------------------------------------------
          PORTADA.

          El detalle de un viaje era una pila de cajas sueltas, todas del
          mismo color y del mismo tamano, y no se leia como UNA cosa: nada
          decia "esto es tu viaje a Reino Unido". Ahora la tarjeta se
          presenta con su nombre, sus fechas y su costo, y el resto del
          trabajo (nombre, ruta, presupuesto) vive dentro en tres pasos.
          ------------------------------------------------------------------ */}
      <div className="relative overflow-hidden bg-gradient-to-br from-marca-800 via-marca-600 to-emerald-500 px-5 py-6 text-white sm:px-7">
        {/* La franja derecha estaba vacia: media tarjeta de degradado sin nada
            que decir. En movil la ilustracion baja de opacidad porque ahi el
            texto ocupa todo el ancho y se le pondria encima. */}
        <IlustracionRuta className="opacity-50 sm:opacity-100" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
            {t("rutaIdentidadEyebrow")}
          </div>
          {onVolver ? (
            <button
              type="button"
              onClick={onVolver}
              className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-bold text-white transition hover:bg-white/20"
            >
              ← {t("rutaVolverALista")}
            </button>
          ) : (
            paradas.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (idRuta || window.confirm(t("rutaNuevoConfirmar"))) nuevoViaje();
                }}
                className="shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[12px] font-bold text-white transition hover:bg-white/20"
              >
                + {t("rutaNuevo")}
              </button>
            )
          )}
        </div>

        <div className="relative z-10 mt-2 flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 sm:max-w-[70%]">
          <h3
            className={`text-[24px] font-extrabold leading-tight tracking-tight sm:text-[28px] ${
              nombre.trim() ? "" : "text-white/70"
            }`}
          >
            {tituloViaje}
          </h3>
          {/* Por donde pasa el viaje, sin leer la lista entera. */}
          {paisesRuta.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1.5">
              {paisesRuta.map((cc) => (
                <Bandera key={cc} cc={cc} size={20} />
              ))}
            </span>
          )}
        </div>

        {/* Recorrido y duracion en una linea, que antes habia que deducir
            leyendo la lista entera de paradas. */}
        {recorrido && (
          <p className="relative z-10 mt-1.5 max-w-full text-[13px] font-medium leading-relaxed text-white/80 sm:max-w-[70%]">
            {recorrido}
            {presupuesto.dias > 0 && (
              <>
                {" · "}
                {t("rutaBannerDuracion")
                  .replace("{dias}", presupuesto.dias)
                  .replace("{noches}", presupuesto.noches)}
              </>
            )}
            {paradas.length > 0 && ` · ${t("rutasNParadas").replace("{n}", paradas.length)}`}
          </p>
        )}

        {/* EL PRESUPUESTO, que es el diferencial de Anduve y estaba de pastilla
            entre otras tres. Sale de las pills y se convierte en el numero
            grande de la portada, con su costo por dia al lado: "cuanto cuesta"
            y "cuanto cuesta al dia" son las dos preguntas con las que se
            decide un viaje. */}
        {paradas.length >= 2 && (
          <div className="relative z-10 mt-4 flex max-w-full flex-wrap items-end gap-x-5 gap-y-2 sm:max-w-[70%]">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                {t("rutaBannerPresupuesto")}
              </div>
              <div className="text-[30px] font-bold leading-none tabular-nums">
                {fmtUsd(presupuesto.total)}
              </div>
            </div>
            <div className="pb-0.5 text-[12.5px] font-medium text-white/80">
              {t("rutaBannerPorDia")
                .replace("{porDia}", fmtUsd(porDia))
                .replace(
                  "{viajeros}",
                  (viajeros === 1 ? t("rutaChipViajero") : t("rutaChipViajeros")).replace(
                    "{n}",
                    viajeros
                  )
                )}
            </div>
          </div>
        )}

        <div className="relative z-10 mt-3.5 flex flex-wrap items-center gap-1.5">
          {/* El coral de la marca vuelve al banner, y con un dato detras: el
              rodeo que el reordenador ya calcula. Si no hay rodeo no hay chip:
              felicitar por nada es ruido. */}
          {zigzag.hayZigzag && zigzag.ahorroPct > 0 && (
            <span className="rounded-full bg-acento-500 px-2.5 py-1 text-[12px] font-bold text-white shadow-sm">
              {t("rutaBannerRodeo").replace("{pct}", zigzag.ahorroPct)}
            </span>
          )}
          <Chip>{mesLabel || t("rutasSinFecha")}</Chip>
          {tramosReales > 0 && (
            <Chip>{t("rutaBannerReales").replace("{n}", tramosReales)}</Chip>
          )}
        </div>
      </div>

      <div className="grid gap-6 p-4 sm:p-6">
        {/* Paso 1. Nombre propio y fecha de salida.
            Faltaban las dos. La API ya guardaba `nombre` pero el planificador
            nunca lo mandaba, asi que todas las rutas quedaban con el automatico
            "Medellin -> Madrid"; y de fechas no habia nada en ningun sitio.
            El boton de volver/nuevo se subio a la portada. */}
        <section>
          <Paso n={1} titulo={t("rutaPaso1")} />

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
            {/* Un <select> y no <input type="month">: el nativo no existe en
                Firefox ni en Safari, y ahi se degrada a una caja de texto
                donde hay que escribir "2027-04" a mano. */}
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                {t("rutaMesSalida")}
              </span>
              <select
                value={mesInicio}
                onChange={(e) => setMesInicio(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                <option value="">{t("rutaMesSinDefinir")}</option>
                {/* El mes guardado puede haber quedado atras, o venir de un
                    viaje a mas de dos anos vista: se anade para no perderlo al
                    abrir la tarjeta. */}
                {mesInicio && !proximosMeses.some((m) => m.clave === mesInicio) && (
                  <option value={mesInicio}>{mesLabel || mesInicio}</option>
                )}
                {proximosMeses.map((m) => (
                  <option key={m.clave} value={m.clave}>
                    {m.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(mesLabel || dias) && (
            <p className="mt-2 text-[12.5px] text-slate-500 dark:text-slate-400">
              {(mesLabel ? t("rutaMesResumen") : t("rutaMesResumenSinMes"))
                .replace("{mes}", mesLlano)
                .replace("{n}", dias ? dias.noches : 0)
                .replace("{d}", dias ? dias.total : 0)}
            </p>
          )}
        </section>

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

        {/* Paso 2: la ruta. */}
        <section className="border-t border-slate-100 pt-5 dark:border-slate-700">
          <Paso
            n={2}
            titulo={t("rutaPaso2")}
            sub={paradas.length === 0 ? t("rutaAgregarPrimera") : t("rutaAgregarSiguiente")}
          />
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
        </section>

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
                  {zigzag.arreglaImposibles > 0
                    ? t("rutaZigzagImposibleTitulo")
                    : t("rutaZigzagTitulo").replace("{pct}", zigzag.ahorroPct)}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {/* Cuando el orden nuevo evita un vuelo que no existe, hablar
                      de kilometros seria enganoso: casi siempre son MAS. */}
                  {zigzag.arreglaImposibles > 0
                    ? t("rutaZigzagImposibleAyuda")
                    : t("rutaZigzagAyuda")
                        .replace("{actual}", zigzag.kmActual.toLocaleString("es-CO"))
                        .replace("{optimo}", zigzag.kmOptimo.toLocaleString("es-CO"))}
                  {zigzag.fusionoRepetidas && " " + t("rutaZigzagFusion")}
                </p>
                <div className="mt-2 text-[12.5px] font-semibold text-amber-900 dark:text-amber-200">
                  {zigzag.ordenSugerido.join("  →  ")}
                </div>
                {/* Antes esto solo se podia leer: para seguir el consejo habia
                    que reordenar once paradas a mano con las flechitas. */}
                {zigzag.paradasSugeridas?.length >= 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        setParadas(zigzag.paradasSugeridas);
                        track("ruta_reordenada", {
                          ahorroPct: zigzag.ahorroPct,
                          fusiono: !!zigzag.fusionoRepetidas,
                        });
                      }}
                      className="mt-3 rounded-full bg-amber-800 px-4 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-amber-900"
                    >
                      {t("rutaZigzagAplicar")}
                    </button>
                  )}
              </div>
            )}

            {/* El viaje sobre el mapa, encuadrado a sus propias ciudades.
                Una lista de once paradas no deja ver si el recorrido tiene
                sentido; el mapa lo ensena de un vistazo, y es lo que hace
                evidente si conviene reordenar. */}
            <MapaRuta paradas={paradas} alto={300} textoFallo={t("rutaMapaFallo")} />


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
                      <div className="min-w-0 flex-1 basis-full sm:basis-0">
                        <div className="truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                          {p.ciudad}{" "}
                          <span className="text-[12.5px] font-normal text-slate-400">{p.iata}</span>
                        </div>
                        {/* En que dia del viaje cae esta parada. Sale de las
                            noches, no del calendario: sin dia de salida no hay
                            fecha que dar, pero el tramo del viaje si se sabe. */}
                        {dias && (
                          <div className="text-[11.5px] font-semibold text-marca-700 dark:text-marca-300">
                            {i === 0
                              ? t("rutaDiaSalida")
                              : t("rutaDiasParada")
                                  .replace("{desde}", dias.porParada[i].desde)
                                  .replace("{hasta}", dias.porParada[i].hasta)}
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
                          <a href={linkHoteles({ ciudad: p.ciudad, pais: p.paisNombre || nombrePaisMostrar(p.pais, lang), lat: p.lat, lon: p.lon })} target="_blank" rel="sponsored noopener"
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
                    {!esUltima && tr && tr.fuente !== "misma-ciudad" && (
                      <div className="ml-3.5 border-l-2 border-dashed border-slate-200 py-2 pl-5 dark:border-slate-700">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
                            <Icono nombre={ICONO_MEDIO[tr.medio] || "arrowRight"} size={15} />
                            {tr.medio ? t("rutaMedio_" + tr.medio) : "—"}
                            {tr.operador && <span className="font-normal text-slate-400">· {tr.operador}</span>}
                          </span>
                          {tr.fuente === "incluido" ? (
                            <span className="inline-flex items-baseline gap-1.5">
                              <span className="font-bold text-emerald-700 dark:text-emerald-300">
                                {t("rutaIncluido")}
                              </span>
                              {tr.precioSuelto > 0 && (
                                <span className="text-[12px] tabular-nums text-slate-400 line-through">
                                  {fmtUsd(tr.precioSuelto)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              {tr.precio != null ? fmtUsd(tr.precio) : "—"}
                            </span>
                          )}
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
                          {tr.fuente !== "detectado" && tr.fuente !== "incluido" && tr.desde.iata && tr.hasta.iata && (
                            <button
                              onClick={() => buscarReal(tr)}
                              disabled={buscando[tr.clave]}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              {buscando[tr.clave] ? t("rutaBuscandoReal") : t("rutaBuscarReal")}
                            </button>
                          )}
                        </div>

                        {/* Un vuelo que no existe.
                            El planificador estimaba precio y duracion de Glasgow -> Medellin
                            como si fuera un vuelo mas. No lo es: de Glasgow no sale nadie
                            cruzando el Atlantico. Se dice, y se ofrece la escala que hace
                            falta con un clic, que es lo que el viajero iba a hacer igual. */}
                        {(() => {
                          const falla = tramoSinVueloLargo(tr.desde, tr.hasta, tr.km);
                          if (!falla) return null;
                          const problema = falla.salida ? tr.desde : tr.hasta;
                          const hubs = hubsSugeridos(problema, paradas);
                          return (
                            <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                              <div className="text-[12.5px] font-bold text-amber-900 dark:text-amber-200">
                                {t(falla.salida ? "rutaSinVueloSalida" : "rutaSinVueloLlegada")
                                  .replace("{desde}", tr.desde.ciudad)
                                  .replace("{hasta}", tr.hasta.ciudad)}
                              </div>
                              <p className="mt-1 text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
                                {t("rutaSinVueloAyuda")}
                              </p>
                              {hubs.length > 0 && (
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="text-[11.5px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                                    {t("rutaSinVueloEscala")}
                                  </span>
                                  {hubs.map((h) => (
                                    <button
                                      key={h.iata}
                                      type="button"
                                      onClick={() => insertarEscala(i + 1, h)}
                                      className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[12px] font-bold text-amber-900 transition hover:bg-amber-100 dark:border-amber-700 dark:bg-slate-800 dark:text-amber-200"
                                    >
                                      + {h.etiqueta}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>

            {/* Paso 3: el presupuesto. */}
            {paradas.length >= 2 && (
              <section className="border-t border-slate-100 pt-5 dark:border-slate-700">
                <Paso n={3} titulo={t("rutaPaso3")} sub={t("rutaResumen")} />
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {/* Estas dos tarjetas mostraban cifras POR PERSONA mientras
                      el desglose de abajo mostraba el total del grupo: con dos
                      viajeros los dos bloques se contradecian en la misma
                      pantalla. Ahora salen del mismo motor y son totales. */}
                  <div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaTransporte")}</div>
                    <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtUsd(totalDeCategorias(["transporte_internacional", "transporte_entre_ciudades"]))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">
                      {t("rutaEstadia").replace("{noches}", presupuesto.noches)}
                    </div>
                    <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtUsd(totalDeCategorias(["hospedaje", "alimentacion", "transporte_local", "actividades"]))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaEnMovimiento")}</div>
                    <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtDuracion(resumen.horasEnMovimiento)}
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  {/* En que se va la plata, ahora auditable.
                  Eran cinco barras de colores con un total: bonito y opaco. Hacer
                  clic no desplegaba nada, no habia forma de saber de donde salia
                  cada cifra ni de corregirla, y faltaban categorias enteras —
                  seguro, equipaje, tasa turistica, colchon. Ahora cada categoria
                  se abre en sus lineas y cada linea dice su formula, su fuente y
                  su confianza, y se puede fijar a mano. */}
                  <DesglosePresupuesto
                  presupuesto={presupuesto}
                  overrides={overrides}
                  onFijar={fijarLinea}
                  fmt={fmtUsd}
                  t={t}
                  />
                  <p className="mt-2.5 text-[11.5px] leading-relaxed text-slate-400">
                  {t("rutaCategoriasNota")}
                  </p>

                  {/* Por que el regreso vale cero, o por que el precio de ida trae
                      una vuelta que no encaja con este viaje. */}
                  {regresoIncluido && (
                    <p className="mt-2.5 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] leading-relaxed text-emerald-900 dark:bg-emerald-900/20 dark:text-emerald-200">
                      {t("rutaRegresoNota")
                        .replace("{ahorro}", fmtUsd(regresoIncluido.ahorro))
                        .replace("{ciudad}", regresoIncluido.ciudad)
                        .replace("{casa}", regresoIncluido.casa)}
                    </p>
                  )}
                  {avisoIdaVuelta && (
                    <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                      {t(
                        avisoIdaVuelta === "sin-regreso"
                          ? "rutaAvisoSinRegreso"
                          : "rutaAvisoOtraCiudad"
                      )}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <span className="text-[13px] text-slate-500 dark:text-slate-400">{t("rutaPorPersona")}</span>
                  <span className="text-[17px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmtUsd(presupuesto.totalPorPersona)}</span>
                  <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">
                    {t("rutaTotal").replace("{n}", presupuesto.viajeros)}
                  </span>
                  <span className="text-[26px] font-extrabold tabular-nums tracking-tight text-marca-700 dark:text-marca-300">
                    {fmtUsd(presupuesto.total)}
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
              </section>
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
    </div>
  );
}
