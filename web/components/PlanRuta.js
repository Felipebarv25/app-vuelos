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
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import SelectorAeropuerto from "./SelectorAeropuerto";
import Bandera from "./Bandera";
import DesglosePresupuesto from "./DesglosePresupuesto";
import IlustracionRuta from "./IlustracionRuta";
import { construirPresupuesto } from "@/lib/presupuestoConstruir";
import { lineasMigracion } from "@/lib/migracion";
import { cargarVisas, listaPaises } from "@/lib/requisitos";
import { obtenerTasas } from "@/lib/fx";
import { convertir, NIVELES, NIVEL_POR_DEFECTO } from "@/lib/presupuestoLineas";
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
import {
  linkTransporte,
  linkCarro,
  linkHoteles,
  linkCivitatis,
  linkVuelos,
  linkTren,
  linkBus,
} from "@/lib/afiliados";
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

// Nacionalidades para el selector. PAISES_ISO guarda el ISO como "nombre"
// ("GB": {nombre: "GB"}), asi que el nombre legible sale de
// nombrePaisMostrar y la lista se ordena ya traducida.
function nacionalidades(lang) {
  return listaPaises()
    .map((x) => ({ cc: x.cc, nombre: nombrePaisMostrar(x.cc, lang) || x.cc }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
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
  // NACIONALIDAD, que no es el pais de salida.
  //
  // Hasta ahora solo se preguntaba "sales desde", y de eso se deducia todo.
  // No es lo mismo: un colombiano que sale de Madrid sigue necesitando visa
  // britanica, y un espanol que sale de Bogota no. Sin este campo el calculo
  // migratorio no se puede hacer bien, y era el agujero del diferencial de
  // Anduve.
  const [pasaporte, setPasaporte] = useState(() => inicio?.pasaporte || "CO");
  const [monedaVista, setMonedaVista] = useState(() => inicio?.monedaVista || "COP");
  // NIVEL DE GASTO. El mismo viaje da tres presupuestos muy distintos, y
  // hasta ahora solo existia el de en medio: el catalogo de costo de vida
  // esta calibrado para "gama media" y no habia forma de decir que duermes en
  // hostal o que quieres un cuatro estrellas.
  const [nivel, setNivel] = useState(() => inicio?.nivel || NIVEL_POR_DEFECTO);
  // FECHA EXACTA DE SALIDA, opcional y dentro del mes elegido.
  //
  // El mes basta para planear con meses de antelacion, pero cuando ya sabes
  // que sales el 10 de mayo el precio deja de ser "lo mas barato del mes" y
  // pasa a ser el de tu dia. Sigue siendo opcional a proposito: pedir la fecha
  // exacta a quien todavia no la tiene es lo que hacia el campo viejo.
  const [fechaIda, setFechaIda] = useState(() => inicio?.fechaIda || "");

  // Suma dias a una fecha ISO y devuelve otra ISO.
  const sumaDias = useCallback((iso, n) => {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }, []);

  // "mayo de 2027" a partir de "2027-05".
  const fmtMes = useCallback(
    (m) => {
      const d = new Date(m + "-01T00:00:00");
      return Number.isNaN(d.getTime())
        ? m
        : d.toLocaleDateString(lang, { month: "long", year: "numeric" });
    },
    [lang]
  );

  // "12 may 2027" a partir de "2027-05-12".
  const fmtDia = useCallback(
    (iso) => {
      if (!iso) return "";
      const d = new Date(iso + "T00:00:00");
      return Number.isNaN(d.getTime())
        ? iso
        : d.toLocaleDateString(lang, { day: "numeric", month: "short", year: "numeric" });
    },
    [lang]
  );
  const [visas, setVisas] = useState(null);
  const [tasas, setTasas] = useState(null);
  const [overrides, setOverrides] = useState(() => inicio?.presupuesto?.overrides || {});
  const [ajustes, setAjustes] = useState(
    () => inicio?.presupuesto?.ajustes || { contingenciaPct: 0.1, margenCambiarioPct: 0.03 }
  );
  // Cambia tras cada parada agregada para remontar el buscador y dejarlo
  // vacío: si no, se queda con "Madrid (MAD)" escrito y encadenar la
  // siguiente parada obliga a borrar a mano.
  const [nSelector, setNSelector] = useState(0);
  // Parada resaltada. La comparten la lista y el mapa en los dos sentidos:
  // tocar una tarjeta vuela hasta su chinche, y tocar un chinche resalta su
  // tarjeta. Es el numero de parada (1..n), no el indice, porque es lo que se
  // ve escrito en los dos sitios.
  const [paradaActiva, setParadaActiva] = useState(null);

  useEffect(() => { obtenerOfertas().then(setOfertas); }, []);
  // El dataset de visas pesa 660 KB: se pide una sola vez y solo cuando el
  // viaje ya tiene paradas que consultar.
  useEffect(() => {
    if (paradas.length > 0 && !visas) cargarVisas().then(setVisas);
  }, [paradas.length, visas]);
  useEffect(() => { obtenerTasas().then(setTasas); }, []);

  // Persiste en cada cambio. Se incluyen los precios en vivo ya consultados
  // para no volver a gastar cuota de Travelpayouts al reabrir el viaje.
  useEffect(() => {
    if (!paradas.length && !nombre && !mesInicio) { borrarLocal(uid); return; }
    escribirLocal({
      uid, id: idRuta, paradas, viajeros, nombre, mesInicio, vivos,
      pasaporte, monedaVista, nivel, fechaIda,
      presupuesto: { overrides, ajustes },
    });
  }, [uid, paradas, viajeros, nombre, mesInicio, idRuta, vivos, overrides, ajustes, pasaporte, monedaVista, nivel, fechaIda]);

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
    // Si el selector ya trae coordenadas — las ciudades sin aeropuerto vienen
    // del geocodificador con ellas — nos ahorramos la segunda consulta.
    if (Number.isFinite(a.lat) && Number.isFinite(a.lon)) {
      base.lat = a.lat;
      base.lon = a.lon;
      setParadas((prev) => [
        ...prev.slice(0, posicionParaNueva(prev)),
        base,
        ...prev.slice(posicionParaNueva(prev)),
      ]);
      setNSelector((n) => n + 1);
      track("ruta_parada_agregada", { ciudad: a.ciudad, iata: a.iata || "sin-aeropuerto" });
      return;
    }

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

  // EL RECALCULO NO BLOQUEA LO QUE SE ESCRIBE.
  //
  // Cada tecla en "noches" rehacia, sincrono y en el hilo de la interfaz, los
  // tramos, el reordenador con su 2-opt y el presupuesto entero linea por
  // linea. Medido: hasta 2.126 ms de INP. Eso no es "va lento", es que la
  // tecla siguiente no entra.
  //
  // La LISTA de paradas sigue pintandose con el valor inmediato — se ve al
  // instante lo que escribes —; lo caro se calcula despues con el ultimo
  // valor. Es de React, sin librerias, y no cambia ningun resultado: solo
  // cuando se calcula.
  const paradasCalc = useDeferredValue(paradas);
  const recalculando = paradasCalc !== paradas;

  const tramosCrudos = useMemo(() => {
    const out = [];
    for (let i = 0; i < paradasCalc.length - 1; i++) {
      const desde = paradasCalc[i];
      const hasta = paradasCalc[i + 1];
      const clave = `${desde.iata}-${hasta.iata}-${i}`;
      // El precio del dia exacto lo trae buscarReal() cuando hay fecha puesta:
      // la API no permite sacar el precio por dia de una lista mensual, hay
      // que preguntar por el dia.
      const real = vivos[clave] || vueloDetectado(desde, hasta);
      out.push({ ...evaluarTramo({ desde, hasta, vueloReal: real }), desde, hasta, clave });
    }
    return out;
  }, [paradasCalc, vivos, vueloDetectado]);

  // El precio de un vuelo detectado es de IDA Y VUELTA. Si el viaje cierra
  // sobre el mismo par de ciudades, el tramo de regreso ya esta pagado.
  const { tramos, regresoIncluido, aviso: avisoIdaVuelta } = useMemo(
    () => ajustarIdaYVuelta(tramosCrudos),
    [tramosCrudos]
  );

  const resumen = useMemo(
    () => resumenRuta({ paradas: paradasCalc, tramos, viajeros }),
    [paradasCalc, tramos, viajeros]
  );

  // El presupuesto de verdad: lineas con formula, fuente y confianza. El
  // `resumen` de arriba se queda solo para las cifras de cabecera (tiempo en
  // movimiento, confianza de los tramos), que no son gasto.
  const porUsd = tasas?.porUsd || {};

  // Visas y autorizaciones entran como lineas de pre-viaje del mismo motor,
  // no como un bloque aparte: son gasto del viaje igual que el hotel.
  const extrasMigracion = useMemo(
    () => (visas ? lineasMigracion({ paradas: paradasCalc, pasaporte, viajeros, visas }) : []),
    [visas, paradasCalc, pasaporte, viajeros]
  );

  const presupuesto = useMemo(
    () =>
      construirPresupuesto({
        paradas: paradasCalc, tramos, viajeros, overrides, ajustes,
        extras: extrasMigracion,
        porUsd,
        nivel,
      }),
    [paradasCalc, tramos, viajeros, overrides, ajustes, extrasMigracion, porUsd, nivel]
  );

  // Formato en la moneda que el viajero eligio ver. Los totales del motor
  // vienen en dolares; aqui se convierten solo para pintarlos.
  const fmtVista = useCallback(
    (usd) => {
      const v = convertir(usd, "USD", monedaVista, porUsd);
      const dec = monedaVista === "COP" || monedaVista === "CLP" ? 0 : 0;
      return `${monedaVista === "USD" ? "US$" : ""}${Math.round(v).toLocaleString("es-CO", {
        maximumFractionDigits: dec,
      })}${monedaVista === "USD" ? "" : " " + monedaVista}`;
    },
    [monedaVista, porUsd]
  );

  // Suma de unas categorias concretas del presupuesto nuevo.
  const totalDeCategorias = useCallback(
    (cats) =>
      (presupuesto.porCategoria || [])
        .filter((c) => cats.includes(c.categoria))
        .reduce((s, c) => s + c.total, 0),
    [presupuesto]
  );

  // CUANDO SALE MAS BARATO.
  //
  // La lista de salidas del mes ya esta descargada por la misma consulta que
  // trajo el precio: solo hay que mirarla. Se compara la mas barata contra la
  // fecha que el viajero tiene puesta — o contra la que se esta usando — y si
  // la diferencia se nota, se dice.
  const mejorFecha = useMemo(() => {
    if (!mesInicio) return null;
    for (const t of tramos) {
      const meses = vivos[t.clave]?.porMes;
      if (!meses?.length) continue;
      const tuyo = meses.find((m) => m.mes === mesInicio);
      const barato = meses.reduce((a, b) => (b.precio < a.precio ? b : a), meses[0]);
      if (!barato?.mes || barato.mes === mesInicio) continue;
      // Se avisa solo si el ahorro se nota: por diez dolares nadie mueve un
      // viaje de mes.
      const ahorro = (tuyo?.precio || t.precio || 0) - barato.precio;
      if (ahorro >= 40) {
        return { ...barato, ahorro, tramo: `${t.desde?.ciudad} → ${t.hasta?.ciudad}` };
      }
    }
    return null;
  }, [tramos, vivos, mesInicio]);

  const fijarLinea = useCallback((id, monto) => {
    setOverrides((prev) => {
      const sig = { ...prev };
      if (monto == null || !Number.isFinite(Number(monto))) delete sig[id];
      else sig[id] = Math.max(0, Math.round(Number(monto)));
      return sig;
    });
    track("presupuesto_linea_fijada", { id });
  }, []);
  // El 2-opt es lo mas caro de todo el componente: va con el valor diferido.
  const zigzag = useMemo(() => detectarZigzag(paradasCalc), [paradasCalc]);

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
      // Si hay dia puesto se pide ESE dia: una llamada. Si no, los seis meses
      // que el endpoint ya consultaba, de los que sale la recomendacion.
      const r = await fetch(
        `/api/vuelo-vivo?iata=${tr.hasta.iata}&origenes=${tr.desde.iata}` +
          (fechaIda ? `&fecha=${fechaIda}` : "")
      );
      const d = r.ok ? await r.json() : null;
      if (d?.encontrado) {
        // Se guardan TODAS las salidas del mes, no solo la mas barata: de ahi
        // salen el precio de tu fecha concreta y la recomendacion de cuando
        // sale mejor. Vienen en la misma llamada, asi que no cuesta cuota.
        setVivos((v) => ({
          ...v,
          [tr.clave]: {
            precio: d.precio,
            duracion_h: d.duracion_ida ? d.duracion_ida / 60 : null,
            aerolinea: d.aerolinea,
            // Lo mejor de cada mes, que el endpoint ya tenia consultado y
            // tiraba. De aqui sale "en marzo sale mas barato".
            porMes: Array.isArray(d.porMes) ? d.porMes : [],
            esDeTuFecha: !!d.esDeTuFecha,
          },
        }));
      } else {
        // Con dia puesto, el motivo casi siempre es que NO hay tarifa en
        // cache para ese dia concreto — no que la ruta no exista. Decir "no
        // encontramos vuelo" ahi seria enganoso.
        setAviso(
          fechaIda
            ? t("rutaSinVueloEseDia")
                .replace("{ruta}", `${tr.desde.ciudad} → ${tr.hasta.ciudad}`)
                .replace("{fecha}", fmtDia(fechaIda))
            : t("rutaSinVueloReal").replace("{ruta}", `${tr.desde.ciudad} → ${tr.hasta.ciudad}`)
        );
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
          pasaporte, monedaVista, nivel, fechaIda,
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
            que decir.

            En MOVIL no se pinta. Bajarle la opacidad no era suficiente: a 390
            px el texto ocupa el ancho completo y los pines caian justo encima
            del titulo y del recorrido — probado, ilegible. Un degradado limpio
            es mejor que una ilustracion que estorba, y el movil es donde esta
            la mayoria de este publico. */}
        <IlustracionRuta className="hidden sm:block" />

        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
            {t("rutaIdentidadEyebrow")}
          </div>
          {/* El "Volver a mis viajes" que habia aqui se quito: quedaba
              perdido dentro del banner y duplicaba el boton flotante, que
              ahora cierra el viaje y ademas se ve siempre al hacer scroll.
              Dos controles para lo mismo, y el visible era el que no
              funcionaba. */}
          {onVolver ? null : (
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

        <div className="relative z-10 mt-2 flex max-w-full flex-wrap items-center gap-x-3 gap-y-2 sm:max-w-[64%]">
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
          <p className="relative z-10 mt-1.5 max-w-full text-[13px] font-medium leading-relaxed text-white/80 sm:max-w-[64%]">
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
          <div className="relative z-10 mt-4 flex max-w-full flex-wrap items-end gap-x-5 gap-y-2 sm:max-w-[64%]">
            <div>
              <div className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-white/70">
                {t("rutaBannerPresupuesto")}
              </div>
              <div className="text-[30px] font-bold leading-none tabular-nums">
                {fmtVista(presupuesto.total)}
              </div>
            </div>
            <div className="pb-0.5 text-[12.5px] font-medium text-white/80">
              {t("rutaBannerPorDia")
                .replace("{porDia}", fmtVista(porDia))
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

          {/* PASAPORTE Y MONEDA.
              El pasaporte decide las visas — no el aeropuerto de salida — y la
              moneda decide en que se lee todo. Por defecto Colombia y COP,
              que es el publico de esta app; el itinerario mostraba solo
              dolares mientras el asesor ya sabia hablar en pesos. */}
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                {t("rutaPasaporte")}
              </span>
              <select
                value={pasaporte}
                onChange={(e) => setPasaporte(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {nacionalidades(lang).map((x) => (
                  <option key={x.cc} value={x.cc}>{x.nombre}</option>
                ))}
              </select>
              <span className="mt-1 block text-[11.5px] text-slate-400">
                {t("rutaPasaporteAyuda")}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                {t("rutaMonedaVista")}
              </span>
              <select
                value={monedaVista}
                onChange={(e) => setMonedaVista(e.target.value)}
                className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              >
                {["COP", "USD", "EUR", "GBP", "MXN", "PEN", "CLP", "ARS", "BRL"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
              {monedaVista !== "USD" && porUsd[monedaVista] > 0 && (
                <span className="mt-1 block text-[11.5px] text-slate-400">
                  {t("rutaTasa")
                    .replace("{tasa}", Math.round(porUsd[monedaVista]).toLocaleString("es-CO"))
                    .replace("{moneda}", monedaVista)
                    .replace(
                      "{fecha}",
                      tasas?.enVivo
                        ? t("rutaTasaHoy")
                        : t("rutaTasaRespaldo")
                    )}
                </span>
              )}
            </label>
          </div>

          {/* FECHA EXACTA, opcional. Solo tiene sentido si ya hay mes: sin el
              no hay rango donde elegir un dia. */}
          {mesInicio && (
            <div className="mt-3">
              <label className="block sm:max-w-xs">
                <span className="mb-1 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
                  {t("rutaFechaExacta")}
                </span>
                <input
                  type="date"
                  value={fechaIda}
                  min={`${mesInicio}-01`}
                  max={`${mesInicio}-31`}
                  onChange={(e) => setFechaIda(e.target.value)}
                  className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                />
              </label>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-400">
                {fechaIda ? t("rutaFechaExactaPuesta") : t("rutaFechaExactaAyuda")}
              </p>
              {fechaIda && (
                <button
                  type="button"
                  onClick={() => setFechaIda("")}
                  className="mt-1 text-[11.5px] font-semibold text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:text-slate-400"
                >
                  {t("rutaFechaQuitar")}
                </button>
              )}
            </div>
          )}

          {/* CUANDO SALE MAS BARATO. Sale de la misma consulta que trajo el
              precio, asi que no cuesta cuota; solo aparece si el ahorro se
              nota de verdad. */}
          {mejorFecha && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="text-[13px] font-bold text-emerald-900 dark:text-emerald-200">
                {t("rutaMejorFechaTit")
                  .replace("{mes}", fmtMes(mejorFecha.mes))
                  .replace("{ahorro}", fmtVista(mejorFecha.ahorro))}
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-800 dark:text-emerald-300">
                {t("rutaMejorFechaSub").replace("{tramo}", mejorFecha.tramo)}
              </p>
              <button
                type="button"
                onClick={() => {
                  setMesInicio(mejorFecha.mes);
                  setFechaIda("");
                  track("ruta_mes_barato", { mes: mejorFecha.mes });
                }}
                className="mt-2 rounded-full bg-emerald-700 px-3.5 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-emerald-800"
              >
                {t("rutaMejorFechaUsar")}
              </button>
            </div>
          )}

          {/* NIVEL DE GASTO. Tres formas de hacer el mismo viaje, y no es un
              factor sobre el total: cada rubro se mueve lo suyo. El hospedaje
              cambia de categoria, la comida de sitio, el transporte de medio,
              y el equipaje y la clase de vuelo aparecen o no. */}
          <div className="mt-4">
            <span className="mb-1.5 block text-[11.5px] font-semibold uppercase tracking-wider text-slate-400">
              {t("rutaNivelLabel")}
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
              {["mochilero", "medio", "comodo"].map((k) => {
                const activo = nivel === k;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { setNivel(k); track("ruta_nivel", { nivel: k }); }}
                    aria-pressed={activo}
                    className={`rounded-xl border-2 p-2.5 text-left transition ${
                      activo
                        ? "border-marca-500 bg-marca-50 dark:border-marca-500 dark:bg-marca-900/30"
                        : "border-slate-200 bg-white hover:border-marca-300 dark:border-slate-700 dark:bg-slate-800"
                    }`}
                  >
                    <span
                      className={`block text-[13.5px] font-extrabold ${
                        activo ? "text-marca-800 dark:text-marca-200" : "text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {t("nivel_" + k)}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
                      {t("nivelSub_" + k)}
                    </span>
                  </button>
                );
              })}
            </div>
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
              // Ciudades sin aeropuerto en la MISMA busqueda. Antes York de
              // Inglaterra solo aparecia en un segundo buscador plegado que
              // habia que descubrir y que ni siquiera autocompletaba.
              incluirSinAeropuerto
              value=""
              onChange={agregar}
              placeholder={t("rutaBuscarCiudad")}
              ariaLabel={t("rutaBuscarCiudad")}
              lang={lang}
              t={t}
            />
          </div>

          {/* Aqui vivia un segundo buscador plegado, "¿Tu ciudad no tiene
              aeropuerto?", con su propio input y su propio boton. Sobra: la
              busqueda principal ya ofrece esas ciudades, y con
              autocompletado en vez de un boton. Dos formas de hacer lo mismo,
              una escondida, es peor que una sola que funcione. */}
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
            {zigzag.hayZigzag && (() => {
              // Lo unico que mejora es juntar repetidas: ni rodeo ni vuelo
              // imposible. Hablar de kilometros aqui seria mentir.
              const soloFusion = zigzag.fusionoRepetidas && !(zigzag.ahorroPct > 0);
              return (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <div className="text-[13.5px] font-bold text-amber-900 dark:text-amber-200">
                  {/* Tres casos distintos, y mezclarlos deja el aviso
                      contradiciendose: "rodeo del 0%" y "18.806 km cuando
                      podrias recorrer 18.806 km" cuando lo unico que sobraba
                      eran dos paradas repetidas. */}
                  {zigzag.arreglaImposibles > 0
                    ? t("rutaZigzagImposibleTitulo")
                    : soloFusion
                    ? t("rutaZigzagSoloFusionTitulo")
                    : t("rutaZigzagTitulo").replace("{pct}", zigzag.ahorroPct)}
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-800 dark:text-amber-300">
                  {/* Cuando el orden nuevo evita un vuelo que no existe, hablar
                      de kilometros seria enganoso: casi siempre son MAS. */}
                  {zigzag.arreglaImposibles > 0
                    ? t("rutaZigzagImposibleAyuda")
                    : soloFusion
                    ? t("rutaZigzagSoloFusionAyuda")
                    : t("rutaZigzagAyuda")
                        .replace("{actual}", zigzag.kmActual.toLocaleString("es-CO"))
                        .replace("{optimo}", zigzag.kmOptimo.toLocaleString("es-CO"))}
                  {!soloFusion && zigzag.fusionoRepetidas && " " + t("rutaZigzagFusion")}
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
              );
            })()}

            {/* El viaje sobre el mapa, encuadrado a sus propias ciudades.
                Una lista de once paradas no deja ver si el recorrido tiene
                sentido; el mapa lo ensena de un vistazo, y es lo que hace
                evidente si conviene reordenar. */}
            {/* Mas alto que antes (300): con once paradas europeas no cabia
                nada. En movil se queda en 300. */}
            <MapaRuta
              paradas={paradas}
              alto={420}
              textoFallo={t("rutaMapaFallo")}
              seleccionada={paradaActiva}
              onSeleccionar={setParadaActiva}
              t={t}
            />


            {/* Itinerario */}
            <ol className="grid gap-0">
              {paradas.map((p, i) => {
                const tr = tramos[i];
                const esUltima = i === paradas.length - 1;
                return (
                  <li key={`${p.iata}-${i}`}>
                    {/* Parada. Pulsarla lleva el mapa hasta su chinche; el
                        borde teal marca cual es la que se esta mirando. */}
                    <div
                      onClick={() => setParadaActiva(i + 1)}
                      className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border bg-white p-3.5 transition dark:bg-slate-800 ${
                        paradaActiva === i + 1
                          ? "border-marca-500 ring-2 ring-marca-200 dark:ring-marca-800"
                          : "border-slate-200 hover:border-marca-300 dark:border-slate-700"
                      }`}
                    >
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca-50 text-[12px] font-bold tabular-nums text-marca-700 dark:bg-marca-900/40 dark:text-marca-300">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1 basis-full sm:basis-0">
                        <div className="flex items-center gap-1.5 truncate text-[15px] font-bold text-slate-900 dark:text-slate-100">
                          <span className="truncate">{p.ciudad}</span>
                          {/* La bandera del pais de la parada. Cada parada ya
                              guarda su ISO, asi que no cuesta un dato nuevo. */}
                          <Bandera cc={p.pais} size={16} className="shrink-0" />
                          {p.iata && (
                            <span className="shrink-0 text-[12.5px] font-normal text-slate-400">{p.iata}</span>
                          )}
                        </div>
                        {/* En que dia del viaje cae esta parada. Sale de las
                            noches, no del calendario: sin dia de salida no hay
                            fecha que dar, pero el tramo del viaje si se sabe. */}
                        {dias && (
                          <div className="text-[11.5px] font-semibold text-marca-700 dark:text-marca-300">
                            {/* Con dia de salida se pueden dar FECHAS de
                                verdad; sin el, solo los dias del viaje. Cuando
                                se paso de fecha exacta a mes hubo que renunciar
                                a esto — ahora vuelve, pero solo cuando el dato
                                existe de verdad. */}
                            {fechaIda
                              ? i === 0
                                ? t("rutaSalesEl").replace("{fecha}", fmtDia(sumaDias(fechaIda, 0)))
                                : t("rutaEstasDel")
                                    .replace("{desde}", fmtDia(sumaDias(fechaIda, dias.porParada[i].desde - 1)))
                                    .replace("{hasta}", fmtDia(sumaDias(fechaIda, dias.porParada[i].hasta - 1)))
                              : i === 0
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
                                  {fmtVista(tr.precioSuelto)}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">
                              {tr.precio != null ? fmtVista(tr.precio) : "—"}
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
                          {/* RESERVAR, no solo mirar. El tramo tenia "Ver como
                              llegar" (Rome2Rio, informativo) y "Buscar precio
                              real", pero de aqui no se podia comprar nada. El
                              destino depende del medio: vuelo a Aviasales,
                              tren y bus a Omio, ferry y el resto a Rome2Rio,
                              que es el unico que cubre rutas fuera de Europa
                              sin configurar nada. */}
                          {tr.fuente !== "incluido" && (
                            <a
                              href={
                                tr.medio === "vuelo"
                                  ? linkVuelos({
                                      ciudad: tr.hasta.ciudad,
                                      pais: tr.hasta.paisNombre || nombrePaisMostrar(tr.hasta.pais, lang),
                                    })
                                  : tr.medio === "tren"
                                  ? linkTren({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad })
                                  : tr.medio === "bus"
                                  ? linkBus({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad })
                                  : linkTransporte({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad })
                              }
                              target="_blank"
                              rel="sponsored noopener"
                              onClick={() => track("reserva_tramo", { medio: tr.medio })}
                              className="rounded-lg bg-marca-700 px-2.5 py-1 text-[12px] font-bold text-white transition hover:bg-marca-800"
                            >
                              {t("rutaReservar")}
                            </a>
                          )}
                          <a href={linkTransporte({ desde: tr.desde.ciudad, hasta: tr.hasta.ciudad })}
                             target="_blank" rel="sponsored noopener"
                             className="rounded-lg bg-marca-50 px-2.5 py-1 text-[12px] font-bold text-marca-700 transition hover:bg-marca-100 dark:bg-marca-900/30 dark:text-marca-300">
                            {t("rutaVerOpciones")}
                          </a>
                          {/* El boton tambien en los tramos con precio YA
                              detectado, con otra etiqueta.
                              Antes solo salia donde faltaba precio, asi que en
                              el vuelo largo — que casi siempre viene detectado
                              y es el que decide el presupuesto — no habia
                              forma de pedir la comparacion de meses. Y esa
                              comparacion es justo la que dice "en marzo te
                              ahorras US$149". */}
                          {tr.fuente !== "incluido" && tr.desde.iata && tr.hasta.iata && (
                            <button
                              onClick={() => buscarReal(tr)}
                              disabled={buscando[tr.clave]}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                            >
                              {buscando[tr.clave]
                                ? t("rutaBuscandoReal")
                                : tr.fuente === "detectado"
                                ? t("rutaVerMeses")
                                : t("rutaBuscarReal")}
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
                      {fmtVista(totalDeCategorias(["transporte_internacional", "transporte_entre_ciudades"]))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">
                      {t("rutaEstadia").replace("{noches}", presupuesto.noches)}
                    </div>
                    <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtVista(totalDeCategorias(["hospedaje", "alimentacion", "transporte_local", "actividades"]))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400">{t("rutaEnMovimiento")}</div>
                    <div className="text-[19px] font-extrabold tabular-nums text-slate-900 dark:text-slate-100">
                      {fmtDuracion(resumen.horasEnMovimiento)}
                    </div>
                  </div>
                </div>
                {/* Mientras el recalculo diferido va por detras, las cifras
                    se atenuan. Sin esta senal el retraso parece un fallo:
                    escribes 5.000 y el total sigue diciendo lo de antes. */}
                <div
                  aria-busy={recalculando}
                  className={`mt-5 transition-opacity ${recalculando ? "opacity-50" : ""}`}
                >
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
                  fmt={fmtVista}
                    moneda={monedaVista}
                    porUsd={porUsd}
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
                        .replace("{ahorro}", fmtVista(regresoIncluido.ahorro))
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
                  <span className="text-[17px] font-bold tabular-nums text-slate-700 dark:text-slate-200">{fmtVista(presupuesto.totalPorPersona)}</span>
                  <span className="ml-auto text-[13px] text-slate-500 dark:text-slate-400">
                    {t("rutaTotal").replace("{n}", presupuesto.viajeros)}
                  </span>
                  <span className="text-[26px] font-extrabold tabular-nums tracking-tight text-marca-700 dark:text-marca-300">
                    {fmtVista(presupuesto.total)}
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
