"use client";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/track";
import { Icono } from "./Icono";

import {
  calcularDestinos,
  construirRuta,
  ciudadesDeRegion,
  llaveCiudad,
  diasPosibles,
  diasRecomendados,
  presupuestoMinimoPara,
  REGIONES,
  MONEDAS,
} from "@/lib/presupuesto";
import { obtenerPreciosReales, buscarVueloEnVivo } from "@/lib/preciosVuelos";
import { useBrowserBackClose } from "@/lib/useBrowserBack";
import { fmtDuracion } from "@/lib/tramos";
import { linkVuelos, linkGoogleFlights, linkHoteles } from "@/lib/afiliados";
import { obtenerTasas, aUsdDe } from "@/lib/fx";
import { PAISES_ORIGEN, PAISES_ORDEN, PAIS_DEFAULT, paisValido, nombreDeIATA } from "@/lib/paisesOrigen";
import SelectorAeropuerto, { banderaDePais } from "./SelectorAeropuerto";

// Módulo "¿Adónde puedo ir con mi presupuesto?".
// Dos modos:
//  - Un destino: lista de ciudades que caben en el presupuesto.
//  - Ruta multiciudad: arma una ruta de varias ciudades dentro del presupuesto,
//    con botón para regenerar otra ruta.
export default function Presupuesto({ onElegirCiudad, onCerrar, t = (k) => k, inicial = null }) {
  // Que la flecha "atrás" del navegador cierre este modal en vez de sacar al
  // usuario al pre-login. Como el componente solo se monta cuando esta abierto,
  // pasamos true fijo: el hook registra/limpia history en mount/unmount.
  useBrowserBackClose(true, onCerrar);
  const [modo, setModo] = useState("ruta"); // "ruta" | "destino"
  // `inicial` permite que el HERO abra este modal pre-llenado con el monto+moneda
  // que el usuario tipeo en el input principal de la home. Sin override quedan
  // los defaults razonables (10M COP).
  const [monto, setMonto] = useState(inicial?.monto ?? 10000000);
  const [moneda, setMoneda] = useState(inicial?.moneda ?? "COP");
  const [dias, setDias] = useState(10);
  // Marca si el usuario tocó los días manualmente. Mientras sea false, los
  // días siguen a la recomendación (presupuesto+región). Cuando edita el
  // select, queda en true y la recomendación pasa a ser sólo informativa.
  const [diasTocado, setDiasTocado] = useState(false);
  const [personas, setPersonas] = useState(1);
  const [region, setRegion] = useState("europa");
  // Mes de viaje (YYYY-MM). Default: mes actual + 2 (lead time razonable para
  // conseguir buenos precios). Travelpayouts itera por mes, no por día exacto,
  // así que con elegir el mes alcanza para precios reales.
  const [mes, setMes] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + 2);
    return d.toISOString().slice(0, 7);
  });
  const [detalle, setDetalle] = useState(null);

  // PERSISTENCIA DEL STATE DEL MODAL (Item D1 — auditoria 2026-06-25):
  // Si el usuario llena el modal y por accidente lo cierra (back del browser,
  // refresh, etc.) antes pierde TODO. Ahora guardamos el state en sessionStorage
  // cada cambio. Al reabrir el modal en la misma session, restauramos. Otra
  // session = empezar limpio (sessionStorage no persiste entre tabs/restart).
  const STORAGE_KEY = "anduve_presupuesto_state";
  // Restaurar UNA vez al montar. Si `inicial` se pasa (por ej. desde el hero),
  // sobreescribe el restore para monto+moneda (lo que el usuario acaba de tipear
  // en la home es mas reciente que lo guardado).
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.modo) setModo(s.modo);
      if (s.monto > 0 && !inicial) setMonto(s.monto);
      if (s.moneda && !inicial) setMoneda(s.moneda);
      if (s.mes) setMes(s.mes);
      if (s.region) setRegion(s.region);
      if (s.personas) setPersonas(s.personas);
      if (s.dias) { setDias(s.dias); setDiasTocado(!!s.diasTocado); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Persistir cuando cambia cualquiera de los campos clave.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        modo, monto, moneda, mes, region, personas, dias, diasTocado,
      }));
    } catch {}
  }, [modo, monto, moneda, mes, region, personas, dias, diasTocado]);

  // Pais de origen del viajero (CO/MX/EC/PE/...). Define que hubs aereos se
  // ofrecen y si los precios del detector aplican o si hay que ir a vivo.
  // - Por defecto Colombia (el mercado principal hoy).
  // - Se detecta automaticamente con /api/geo (x-vercel-ip-country) en la
  //   primera carga si no hay preferencia guardada en localStorage.
  // - El usuario puede cambiarlo manualmente, su eleccion gana sobre la geo.
  const [paisOrigen, setPaisOrigen] = useState(PAIS_DEFAULT);
  const [origen, setOrigen] = useState(""); // IATA del hub elegido (p.ej. "BOG")
  const [geoListo, setGeoListo] = useState(false);

  useEffect(() => {
    let vivo = true;
    // 1) Honrar la preferencia guardada del usuario sobre cualquier cosa.
    let paisGuardado = null;
    let hubGuardado = null;
    try {
      paisGuardado = localStorage.getItem("anduve_pais_origen");
      hubGuardado = localStorage.getItem("anduve_hub_origen");
    } catch {}

    // Acepta CUALQUIER ISO 2-letras como pais guardado (no solo los de
    // PAISES_ORIGEN), porque el combobox de aeropuertos permite elegir
    // países fuera del catálogo curado. Si tenemos hub guardado, lo
    // respetamos; si no, intentamos primer hub del país (si está en
    // catálogo) y si no, dejamos el campo vacío para que el combobox
    // pida selección.
    if (paisGuardado && /^[A-Z]{2}$/.test(paisGuardado) && hubGuardado) {
      setPaisOrigen(paisGuardado);
      setOrigen(hubGuardado);
      setGeoListo(true);
      return;
    }

    // 2) Detectar por IP. Si la geo del usuario coincide con un pais soportado,
    // lo elegimos por defecto. Si no, queda Colombia.
    fetch("/api/geo")
      .then((r) => (r.ok ? r.json() : null))
      .then((g) => {
        if (!vivo) return;
        const pais = g?.pais && paisValido(g.pais) ? g.pais : PAIS_DEFAULT;
        setPaisOrigen(pais);
        setOrigen(PAISES_ORIGEN[pais].hubs[0].iata);
        setGeoListo(true);
      })
      .catch(() => {
        if (!vivo) return;
        setOrigen(PAISES_ORIGEN[PAIS_DEFAULT].hubs[0].iata);
        setGeoListo(true);
      });
    return () => { vivo = false; };
  }, []);

  function cambiarPais(codigo) {
    if (!paisValido(codigo)) return;
    setPaisOrigen(codigo);
    const primerHub = PAISES_ORIGEN[codigo].hubs[0].iata;
    setOrigen(primerHub);
    try {
      localStorage.setItem("anduve_pais_origen", codigo);
      localStorage.setItem("anduve_hub_origen", primerHub);
    } catch {}
    track("pais_origen", { pais: codigo, hub: primerHub });
  }

  function cambiarOrigen(v) {
    setOrigen(v);
    try { localStorage.setItem("anduve_hub_origen", v); } catch {}
    track("origen_cambiado", { origen: v, pais: paisOrigen });
  }

  // Cuando el usuario elige un aeropuerto del combobox, fijamos país e IATA
  // a la vez. Soporta cualquier país del mundo (incluso uno que no esté en
  // PAISES_ORIGEN — en ese caso, paisActual cae al fallback "sin detector").
  // Si a === null, significa que el usuario cambió el filtro de país y el
  // aeropuerto previo ya no era válido — limpiamos origen pero mantenemos
  // paisOrigen (lo seteó el combobox via su propio estado).
  function elegirAeropuerto(a) {
    if (!a) {
      setOrigen("");
      try { localStorage.removeItem("anduve_hub_origen"); } catch {}
      return;
    }
    setPaisOrigen(a.pais);
    setOrigen(a.iata);
    try {
      localStorage.setItem("anduve_pais_origen", a.pais);
      localStorage.setItem("anduve_hub_origen", a.iata);
    } catch {}
    track("aeropuerto_origen", { pais: a.pais, iata: a.iata, ciudad: a.ciudad });
  }

  // Para el chip "💡 Desde X ahorras..." y los disclaimers, calculamos el pais
  // actual y si su detector tiene cobertura real. Si el usuario eligió un
  // país fuera del catálogo curado, generamos un placeholder con bandera real
  // pero sin detector — el banner ámbar se muestra correctamente.
  const paisActual = PAISES_ORIGEN[paisOrigen] || {
    bandera: banderaDePais(paisOrigen),
    nombre: paisOrigen || "",
    hubs: [],
    tieneDetector: false,
  };
  const hubsPais = paisActual.hubs;
  const detectorCubre = paisActual.tieneDetector;

  // Ruta
  const [inicio, setInicio] = useState(""); // llaveCiudad de la ciudad de salida
  const [semilla, setSemilla] = useState(0);
  // Ritmo de la ruta multiciudad: "normal" rellena con tantas ciudades como
  // quepan (2 dias/ciudad min); "tranquilo" deja 3 dias/ciudad min, menos
  // ciudades pero mas tiempo en cada una. Default normal.
  const [ritmo, setRitmo] = useState("normal");

  // Modo destino: buscador de texto.
  const [buscarDestino, setBuscarDestino] = useState("");

  // Ruta: ciudades excluidas (las que el usuario no quiere en su ruta).
  const [excluidos, setExcluidos] = useState([]);

  // Precios reales del detector de vuelos (ofertas.json). Se cargan una vez.
  const [preciosReales, setPreciosReales] = useState({});
  useEffect(() => {
    let vivo = true;
    obtenerPreciosReales().then((m) => vivo && setPreciosReales(m));
    return () => { vivo = false; };
  }, []);

  // Búsquedas en vivo (Travelpayouts) por destino: { "Ciudad|País": "buscando" | "no" }
  // Pasamos los hubs del pais del usuario para que la API busque desde ahi
  // (BOG/MDE para CO, MEX/CUN para MX, etc.) — antes era siempre BOG/MDE.
  const [vivoEstado, setVivoEstado] = useState({});
  async function pedirVivo(d) {
    const k = llaveCiudad(d);
    // Evita relanzar si ya está buscando o si ya tiene datos en preciosReales.
    if (vivoEstado[k] === "buscando" || vivoEstado[k] === "ok") return;
    setVivoEstado((s) => ({ ...s, [k]: "buscando" }));
    // Prioriza el IATA elegido por el usuario, y como fallback usa los hubs
    // curados del país (si está en catálogo). Si el país no está en
    // PAISES_ORIGEN, hubsPais=[] y solo se intenta `origen`.
    const iatasUsuario = origen
      ? [origen, ...hubsPais.map((h) => h.iata).filter((x) => x !== origen)]
      : hubsPais.map((h) => h.iata);
    const r = await buscarVueloEnVivo(d.ciudad, d.pais, iatasUsuario);
    if (r) {
      // Lo guardamos en el shape nuevo (porOrigen + mejor) para que el resto
      // del codigo lo trate igual que los datos del detector.
      const reg = { porOrigen: { [r.origen]: r }, mejor: r };
      setPreciosReales((m) => ({ ...m, [k]: reg }));
      setVivoEstado((s) => ({ ...s, [k]: "ok" }));
    } else {
      setVivoEstado((s) => ({ ...s, [k]: "no" }));
    }
  }

  // Tasas de cambio EN VIVO (antes COP estaba fijo en 4.000 → subestimaba el
  // presupuesto ~10-12% según el dólar del día). Mientras cargan, se usan los
  // valores estáticos de MONEDAS como respaldo.
  const [tasas, setTasas] = useState(null); // { porUsd, fecha, enVivo }
  useEffect(() => {
    let vivo = true;
    obtenerTasas().then((r) => vivo && setTasas(r));
    return () => { vivo = false; };
  }, []);

  // USD que vale 1 unidad de la moneda elegida: tasa en vivo si la hay, si no el
  // respaldo estático del catálogo MONEDAS.
  const aUsdSel = aUsdDe(tasas?.porUsd, moneda) ?? MONEDAS[moneda].aUsd;
  const presupuestoUsd = monto * aUsdSel;

  // Métrica: registra el presupuesto + región usados (2s tras dejar de cambiar,
  // para no contar cada tecla). Alimenta el panel privado.
  useEffect(() => {
    if (!presupuestoUsd) return;
    const id = setTimeout(
      () => track("presupuesto", { usd: Math.round(presupuestoUsd), region }),
      2000
    );
    return () => clearTimeout(id);
  }, [presupuestoUsd, region]);

  // Recomendación: días sugeridos según presupuesto + región + personas.
  // El usuario primero elige a dónde y con cuánto; los días los DEDUCE la app.
  // Si el presupuesto no alcanza ni para el vuelo, recom.advertencia indica el caso.
  const recom = useMemo(
    () => diasRecomendados({ presupuestoUsd, region, personas }),
    [presupuestoUsd, region, personas]
  );

  // Mientras el usuario no edite "Días" manualmente, los días siguen
  // automáticamente a la recomendación. Cuando edita, queda fijo en su valor.
  useEffect(() => {
    if (!diasTocado && recom.recomendado > 0) setDias(recom.recomendado);
  }, [recom.recomendado, diasTocado]);

  // Presupuesto mínimo para cubrir los días que el usuario tiene puestos en
  // este momento (sirve para mostrar "Te faltan ~US$X"). Recalcula cuando
  // cambian días/región/personas, no por cada keystroke del monto.
  const presupMinimo = useMemo(
    () => presupuestoMinimoPara({ region, dias, personas }),
    [region, dias, personas]
  );

  // Regiones ALTERNATIVAS que caben con el presupuesto actual + dias + personas
  // (audit D2 — 2026-06-25). Cuando el banner rojo/ámbar dice "insuficiente"
  // mostramos un atajo "Ver regiones que sí caben" para no dejar al usuario
  // tirado. Excluye la región actual y "todas". Ordenado por holgura desc.
  const regionesQueCaben = useMemo(() => {
    if (presupuestoUsd <= 0) return [];
    return Object.keys(REGIONES)
      .filter((r) => r !== "todas" && r !== region)
      .map((r) => ({ key: r, label: REGIONES[r], min: presupuestoMinimoPara({ region: r, dias, personas }) }))
      .filter((x) => x.min <= presupuestoUsd)
      .sort((a, b) => a.min - b.min);
  }, [presupuestoUsd, dias, personas, region]);

  const resultados = useMemo(
    () => calcularDestinos({ presupuestoUsd, dias, personas, region, preciosReales, origen }),
    [presupuestoUsd, dias, personas, region, preciosReales, origen]
  );
  const caben = resultados.filter((r) => r.cabe);

  const ciudadesRegion = useMemo(() => ciudadesDeRegion(region), [region]);

  // Para el select "Saliendo desde": agrupa TODAS las ciudades del catalogo
  // por region. Antes solo aparecian las de la region elegida como destino
  // (limitante: si eliges Europa no podias arrancar en Sudamerica). Si el
  // usuario elige una ciudad fuera de la region actual, auto-cambiamos la
  // region para mantener la ruta coherente.
  const ciudadesPorRegion = useMemo(() => {
    const todas = ciudadesDeRegion("todas");
    const grupos = {};
    for (const c of todas) {
      const r = c.region || "otros";
      if (!grupos[r]) grupos[r] = [];
      grupos[r].push(c);
    }
    return grupos;
  }, []);

  const ruta = useMemo(
    () =>
      construirRuta({ presupuestoUsd, dias, personas, region, inicio, semilla, excluir: excluidos, preciosReales, origen, ritmo }),
    [presupuestoUsd, dias, personas, region, inicio, semilla, excluidos, preciosReales, origen, ritmo]
  );

  // Modo RUTA: cuando hay ruta y la entrada todavía no tiene precio real,
  // disparamos buscarVueloEnVivo automáticamente (best-effort). Así el usuario
  // ve el precio real sin tener que pulsar nada. Si falla, queda el estimado.
  useEffect(() => {
    if (modo !== "ruta" || !ruta?.entrada || ruta.esRealEntrada) return;
    const k = llaveCiudad(ruta.entrada);
    const estado = vivoEstado[k];
    if (estado === "buscando" || estado === "no") return; // ya intentado
    // Pequeño debounce para no disparar mientras el usuario juega con sliders.
    const id = setTimeout(() => pedirVivo(ruta.entrada), 600);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, ruta?.entrada && llaveCiudad(ruta.entrada), ruta?.esRealEntrada]);

  // ELECCIÓN INTELIGENTE DE LA ENTRADA (Fase 2 — rediseño 2026-06-24):
  // Cuando el usuario abre la ruta multiciudad o cambia origen/región/mes,
  // consultamos /api/entrada-region en background. Eso trae las 6 candidatas
  // MÁS PROBABLEMENTE BARATAS de la región con precio REAL desde el origen
  // del usuario para el mes elegido. Mergeamos al map preciosReales y la
  // lógica existente de construirRuta automáticamente elige la más barata
  // como entrada de la ruta. Sin esto, la primera ciudad era el estimado
  // del catálogo (a veces equivocada para el origen/mes del usuario).
  const [entradaEstado, setEntradaEstado] = useState("idle"); // idle|buscando|ok|no
  useEffect(() => {
    if (modo !== "ruta") return;
    if (!origen || !region || region === "todas" || !mes) return;
    if (presupuestoUsd <= 0) return;
    let vivo = true;
    setEntradaEstado("buscando");
    const id = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/entrada-region?origen=${encodeURIComponent(origen)}&region=${encodeURIComponent(region)}&mes=${encodeURIComponent(mes)}`,
          { cache: "default" }
        );
        if (!r.ok) { if (vivo) setEntradaEstado("no"); return; }
        const data = await r.json();
        if (!vivo) return;
        if (!data.ofertas?.length) { setEntradaEstado("no"); return; }
        // Merge: cada oferta entra al map por llave "Ciudad|País". Conserva
        // la forma { porOrigen, mejor } que el resto del código ya entiende.
        setPreciosReales((prev) => {
          const next = { ...prev };
          const visto = data.visto || new Date().toISOString();
          for (const o of data.ofertas) {
            const llave = `${o.ciudad}|${o.pais}`;
            const oferta = {
              precio: o.precio,
              fecha_ida: o.fecha_ida,
              fecha_vuelta: o.fecha_vuelta,
              link: o.link,
              origen: o.origen,
              visto,
              vivo: true,
              escalas_ida: o.escalas_ida ?? null,
              escalas_vuelta: o.escalas_vuelta ?? null,
            };
            const reg = next[llave] || { porOrigen: {}, mejor: null };
            // Si ya teníamos algo del detector para el mismo origen, lo
            // SOBREESCRIBIMOS — el live para el mes elegido es más relevante.
            reg.porOrigen = { ...reg.porOrigen, [o.origen]: oferta };
            if (!reg.mejor || oferta.precio < reg.mejor.precio) reg.mejor = oferta;
            next[llave] = reg;
          }
          return next;
        });
        setEntradaEstado("ok");
        track("entrada_region", { origen, region, mes, ciudades: data.ofertas.length, mejor: data.mejor?.ciudad });
      } catch {
        if (vivo) setEntradaEstado("no");
      }
    }, 400);
    return () => { vivo = false; clearTimeout(id); };
  }, [modo, origen, region, mes, presupuestoUsd > 0]);

  // Nombre legible de una ciudad excluida (a partir de su llave).
  const nombreLlave = (k) => k.split("|")[0];

  function fmtUsd(v) {
    return "US$ " + Math.round(v).toLocaleString("en-US");
  }
  function fmtLocal(usd) {
    const m = MONEDAS[moneda];
    const val = usd / aUsdSel;
    return m.simbolo + " " + Math.round(val).toLocaleString("es-CO");
  }

  // Lista de los próximos 12 meses (YYYY-MM). El select de "Mes de viaje" la
  // usa para que el usuario sepa cuándo planea ir — sirve para luego pedir
  // precios reales a Travelpayouts (que itera por mes, no por día exacto).
  const proximosMeses = useMemo(() => {
    const meses = [];
    const base = new Date();
    base.setDate(1);
    base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 12; i++) {
      const mm = new Date(base.getFullYear(), base.getMonth() + i, 1);
      meses.push({
        key: `${mm.getFullYear()}-${String(mm.getMonth() + 1).padStart(2, "0")}`,
        label: mm.toLocaleDateString("es-CO", { month: "long", year: "numeric" }),
      });
    }
    return meses;
  }, []);

  return (
    <div className="fixed inset-0 z-[4000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="animar-subir flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,.25)] dark:bg-slate-900">
        {/* Cabecera: tono sobrio, sin gradiente tropical — diseño "panel de
            herramienta seria" en vez de marketing. */}
        <div className="border-b border-slate-200 bg-white px-5 pb-3 pt-4 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                Anduve · Planificador
              </div>
              <div className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                {t("presupTitulo")}
              </div>
            </div>
            <button
              onClick={onCerrar}
              aria-label="Cerrar"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Icono nombre="x" size={16} />
            </button>
          </div>

          {/* Conmutador de modo — más sutil, estilo tabs en vez de pills */}
          <div className="-mb-3 mt-3 flex gap-4 border-b border-transparent">
            {[
              ["ruta", t("presupModoRuta")],
              ["destino", t("presupModoDestino")],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setModo(k)}
                className={`relative pb-2 text-[13px] font-medium tracking-tight transition ${
                  modo === k
                    ? "text-marca-700 dark:text-marca-300"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {label}
                {modo === k && (
                  <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-marca-700 dark:bg-marca-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Orden de campos (rediseño 2026-06-24): origen → presupuesto →
              REGIÓN → personas → mes → días (recomendado por la app). Antes
              se pedían días arriba sin contexto; ahora la app DEDUCE los días
              a partir del presupuesto+región. El usuario puede sobreescribir.
              Criterio del owner: "primero conocer a dónde quiere viajar antes
              que cuántos días le podemos recomendar". */}
          <div className="grid gap-3.5">
            {/* 1) ORIGEN: país + hub aéreo. Combobox typeahead sobre catálogo
                IATA completo (~7000 aeropuertos). Hint del placeholder hace
                evidente que es escribible para que el usuario no piense que
                es un input cerrado. */}
            <div>
              <Label>{t("presupSalesDesde")}</Label>
              <SelectorAeropuerto
                value={origen}
                paisInicial={paisOrigen}
                onChange={elegirAeropuerto}
                placeholder={t("presupSalesDesdePlaceholder") || "Escribe tu país y ciudad"}
                ariaLabel={t("presupSalesDesde")}
              />
              {detectorCubre ? (
                <div className="mt-1.5 text-[11px] text-slate-500">
                  {t("presupSalesDesdeNota")}
                </div>
              ) : (
                <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-[11.5px] leading-snug text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  <b>{t("presupCoberturaTitulo")}:</b>{" "}
                  {t("presupCoberturaAviso").replace("{pais}", paisActual.nombre)}
                </div>
              )}
            </div>

            {/* 2) PRESUPUESTO */}
            <div>
              <Label>{t("presupTuPresup")}</Label>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  value={monto > 0 ? monto.toLocaleString("es-CO") : ""}
                  onChange={(e) => {
                    const raw = (e.target.value || "").replace(/\D/g, "");
                    if (raw === "") { setMonto(0); return; }
                    const n = parseInt(raw, 10);
                    if (!Number.isNaN(n)) setMonto(Math.max(0, n));
                  }}
                  onFocus={(e) => { try { e.target.select(); } catch {} }}
                  placeholder="0"
                  aria-label={t("presupTuPresup")}
                  className="flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none focus:border-marca-500 dark:border-slate-600 dark:bg-slate-800"
                />
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none dark:border-slate-600 dark:bg-slate-800"
                >
                  {Object.keys(MONEDAS).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                <span>≈ {fmtUsd(presupuestoUsd)}</span>
                {moneda !== "USD" && tasas?.porUsd?.[moneda] && (
                  <span className="text-slate-400">
                    · 1 US$ ≈ {Math.round(tasas.porUsd[moneda]).toLocaleString("es-CO")} {moneda}{" "}
                    {tasas.enVivo ? "(tasa de hoy)" : "(aprox.)"}
                  </span>
                )}
              </div>
            </div>

            {/* 3) REGIÓN (movida arriba de días — el destino determina el costo).
                Chips tipográficos en vez de pills redondeadas con emojis. */}
            <div>
              <Label>{t("presupRegion")}</Label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(REGIONES).map(([k, nombre]) => (
                  <button
                    key={k}
                    onClick={() => { setRegion(k); setInicio(""); setSemilla(0); setExcluidos([]); }}
                    className={`rounded-md border px-3 py-1.5 text-[13px] font-medium tracking-tight transition ${
                      region === k
                        ? "border-marca-700 bg-marca-700 text-white"
                        : "border-slate-300 bg-white text-slate-700 hover:border-marca-400 hover:text-marca-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-marca-400"
                    }`}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* 4) PERSONAS y 5) MES DE VIAJE en fila. Personas separado de días
                porque ahora días es deducido y va abajo con su banner. */}
            <div className="flex gap-3">
              <label className="flex-1">
                <Label>{t("presupPersonas")}</Label>
                <select
                  value={personas}
                  onChange={(e) => setPersonas(+e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none dark:border-slate-600 dark:bg-slate-800"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex-1">
                <Label>Mes de viaje</Label>
                <select
                  value={mes}
                  onChange={(e) => setMes(e.target.value)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[15px] capitalize outline-none dark:border-slate-600 dark:bg-slate-800"
                  aria-label="Mes de viaje"
                >
                  {proximosMeses.map((m) => (
                    <option key={m.key} value={m.key} className="capitalize">{m.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {/* 6) DÍAS (recomendado por la app). El select queda editable, pero
                la recomendación se calcula con diasRecomendados() y se muestra
                en el banner debajo. */}
            <div>
              <div className="flex items-center justify-between">
                <Label>
                  {t("dias")}
                  {!diasTocado && recom.recomendado > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-sm bg-marca-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-marca-800 dark:bg-marca-900/40 dark:text-marca-200">
                      Recomendado
                    </span>
                  )}
                </Label>
                {diasTocado && recom.recomendado > 0 && recom.recomendado !== dias && (
                  <button
                    onClick={() => { setDias(recom.recomendado); setDiasTocado(false); }}
                    className="text-[11px] font-medium text-marca-700 underline-offset-2 hover:underline dark:text-marca-300"
                  >
                    Usar recomendado ({recom.recomendado})
                  </button>
                )}
              </div>
              <select
                value={dias}
                onChange={(e) => { setDias(+e.target.value); setDiasTocado(true); }}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-[15px] outline-none dark:border-slate-600 dark:bg-slate-800"
              >
                {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              <AvisoPresupuesto
                recom={recom}
                dias={dias}
                personas={personas}
                presupuestoUsd={presupuestoUsd}
                presupMinimo={presupMinimo}
                fmtUsd={fmtUsd}
                regionLabel={REGIONES[region]}
                regionesQueCaben={regionesQueCaben}
                onCambiarRegion={(r) => { setRegion(r); setInicio(""); setSemilla(0); setExcluidos([]); }}
              />
            </div>

            {/* Solo modo ruta: ciudad de salida. Listamos TODO el catalogo
                agrupado por region; si el usuario elige una ciudad de otra
                region, ajustamos el destino para que la ruta tenga sentido. */}
            {modo === "ruta" && (
              <div>
                <Label>{t("presupDesdeCiudad")}</Label>
                <select
                  value={inicio}
                  onChange={(e) => {
                    const llave = e.target.value;
                    setInicio(llave);
                    setSemilla(0);
                    if (llave) {
                      // Encuentra a que region pertenece la ciudad elegida y
                      // sincroniza la region de destino si es distinta.
                      for (const r of Object.keys(ciudadesPorRegion)) {
                        if (ciudadesPorRegion[r].some((c) => llaveCiudad(c) === llave)) {
                          if (r !== region && REGIONES[r]) setRegion(r);
                          break;
                        }
                      }
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none"
                >
                  <option value="">{t("recomendado")}</option>
                  {Object.keys(ciudadesPorRegion)
                    .filter((r) => REGIONES[r])
                    .map((r) => (
                      <optgroup key={r} label={REGIONES[r]}>
                        {ciudadesPorRegion[r].map((c) => (
                          <option key={llaveCiudad(c)} value={llaveCiudad(c)}>
                            {c.bandera} {c.ciudad}, {c.pais}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* ---------- MODO RUTA ---------- */}
          {modo === "ruta" && (
            <div className="mt-5">
              {!ruta || ruta.ciudades.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  {t("presupNoRuta")}
                </div>
              ) : (
                <>
                  {/* Toggle de ritmo: feedback de la auditoria + agente critico
                      ronda 1. 2 dias/ciudad en rutas largas se siente apretado;
                      tranquilo da 3 dias min (menos ciudades, mas tiempo). */}
                  <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-slate-50 p-2">
                    <span className="px-2 text-[12px] font-semibold text-slate-600">{t("presupRitmoTit")}</span>
                    <div className="flex gap-1">
                      {[["normal", t("presupRitmoNormal")], ["tranquilo", t("presupRitmoTranquilo")]].map(([k, label]) => (
                        <button
                          key={k}
                          onClick={() => setRitmo(k)}
                          className={`rounded-full px-3 py-1.5 text-[12px] font-bold transition ${
                            ritmo === k
                              ? "bg-marca-600 text-white shadow"
                              : "text-slate-500 hover:bg-white dark:text-slate-400 dark:hover:bg-slate-700"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                <RutaCard
                  ruta={ruta}
                  t={t}
                  fmtUsd={fmtUsd}
                  fmtLocal={fmtLocal}
                  onOtra={() => setSemilla((s) => s + 1)}
                  onPlanear={() => onElegirCiudad?.(ruta.entrada)}
                  onPlanearCiudad={(c) => onElegirCiudad?.(c)}
                  onExcluir={(c) =>
                    setExcluidos((x) =>
                      x.includes(llaveCiudad(c)) ? x : [...x, llaveCiudad(c)]
                    )
                  }
                  vivoEstadoEntrada={vivoEstado[llaveCiudad(ruta.entrada)] || null}
                  onPedirVivoEntrada={() => pedirVivo(ruta.entrada)}
                />
                </>
              )}

              {/* Ciudades excluidas: fichas para volver a incluirlas */}
              {excluidos.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-500">
                    {t("presupExcluidas")}:
                  </span>
                  {excluidos.map((k) => (
                    <button
                      key={k}
                      onClick={() => setExcluidos((x) => x.filter((y) => y !== k))}
                      className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-200"
                    >
                      {nombreLlave(k)} <span className="text-slate-400">↩</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------- MODO DESTINO ---------- */}
          {modo === "destino" && (
            <div className="mt-5">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3.5 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-teal-900/20">
                <div>
                  <div className="text-2xl font-extrabold text-emerald-700">{caben.length}</div>
                  <div className="text-xs text-slate-500">{t("presupDestinos")}</div>
                </div>
                <div className="text-right text-[13px] text-slate-500">
                  {dias} {t("dias").toLowerCase()} · {personas}{" "}
                  {personas > 1 ? t("presupPersonasP") : t("presupPersonaS")}
                </div>
              </div>

              <input
                value={buscarDestino}
                onChange={(e) => setBuscarDestino(e.target.value)}
                placeholder={t("presupBuscarCiudad")}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-marca-400"
              />

              <div className="mt-3 space-y-2.5">
                {resultados
                  .filter((d) => {
                    const q = buscarDestino.trim().toLowerCase();
                    if (!q) return true;
                    return (d.ciudad + " " + d.pais).toLowerCase().includes(q);
                  })
                  .map((d) => (
                  <div
                    key={llaveCiudad(d)}
                    className={`rounded-2xl border bg-white p-3.5 transition ${
                      d.cabe ? "border-emerald-200 dark:border-emerald-800" : "border-slate-100 opacity-60"
                    }`}
                  >
                    <div
                      className="flex cursor-pointer items-center gap-3"
                      onClick={() => setDetalle(detalle === llaveCiudad(d) ? null : llaveCiudad(d))}
                    >
                      <span className="text-2xl">{d.bandera}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-bold">
                          {d.ciudad}
                          {d.cabe && (
                            <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">✓</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{d.pais}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[15px] font-extrabold ${d.cabe ? "text-emerald-600" : "text-slate-400"}`}>
                          {fmtUsd(d.total)}
                        </div>
                        <div className="text-[11px] text-slate-400">{fmtLocal(d.total)}</div>
                        {d.esReal ? (
                          <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                            <Icono nombre="flame" size={9} /> {t("presupPrecioReal")}
                          </div>
                        ) : (
                          <div className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-slate-500">
                            {t("presupEstimado")}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Recomendacion: si otro origen (BOG/MDE) es mas barato,
                        avisamos cuanto se ahorra cambiando. Es prueba honesta
                        del detector (compara los precios reales que el sistema
                        ya tiene escaneados) y empuja la propuesta de valor. */}
                    {d.ahorroDesde && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[12px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                        <span>
                          {t("presupAhorroDesde").replace("{origen}", nombreDeIATA(d.ahorroDesde.origen))}
                          {" "}
                          <b>{fmtUsd(d.ahorroDesde.ahorro)}</b>
                        </span>
                      </div>
                    )}

                    {detalle === llaveCiudad(d) && (
                      <div className="animar-subir mt-3 border-t border-dashed border-slate-200 pt-3">
                        <Fila
                          nombre={t("presupVuelo")}
                          valor={fmtUsd(d.desglose.vuelo)}
                          badge={d.esReal ? t("presupPrecioReal") : t("presupEstimado")}
                          badgeReal={d.esReal}
                        />
                        {d.esReal && <FechasOferta vueloReal={d.vueloReal} t={t} />}
                        <Fila
                          nombre={t("presupHospedaje")}
                          valor={fmtUsd(d.desglose.hospedaje)}
                          accion={
                            <a
                              href={linkHoteles({ ciudad: d.ciudad })}
                              target="_blank"
                              rel="sponsored noopener"
                              className="text-[11px] font-bold text-marca-600 hover:underline"
                              title={t("presupBuscarHoteles")}
                            >
                              {t("presupBuscarHoteles")} ↗
                            </a>
                          }
                        />
                        <Fila nombre={t("presupComida")} valor={fmtUsd(d.desglose.comida)} />
                        <Fila nombre={t("presupTransporte")} valor={fmtUsd(d.desglose.transporte)} />
                        <Fila nombre={t("presupExtras")} valor={fmtUsd(d.desglose.extras)} />
                        {d.cabe ? (
                          <div className="mt-1.5 text-xs font-semibold text-emerald-600">
                            {t("presupTeSobra")} {fmtUsd(d.sobra)} · {t("presupAlcanza")}{" "}
                            {diasPosibles(d, presupuestoUsd, personas)} {t("dias").toLowerCase()}
                          </div>
                        ) : (
                          <div className="mt-1.5 text-xs font-semibold text-red-600">
                            {t("presupTeFalta")} {fmtUsd(-d.sobra)}
                          </div>
                        )}
                        {/* Comparador honesto: Google Vuelos a veces tiene precios mejores que Aviasales. */}
                        <a
                          href={linkGoogleFlights({
                            ciudad: d.ciudad,
                            pais: d.pais,
                            fechaIda: d.vueloReal?.fecha_ida,
                            fechaVuelta: d.vueloReal?.fecha_vuelta,
                          })}
                          target="_blank"
                          rel="noopener"
                          className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-semibold text-marca-500 hover:underline"
                        >
                          {t("presupCompararGoogle")} ↗
                        </a>
                        {/* "Buscar precio real" en vivo cuando no tenemos oferta vigente del detector. */}
                        {!d.esReal && (
                          <div className="mt-3">
                            {vivoEstado[llaveCiudad(d)] === "buscando" ? (
                              <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-[13px] font-semibold text-slate-500">
                                <span className="spin h-4 w-4 rounded-full border-2 border-slate-300 border-t-marca-500" />
                                {t("presupBuscandoReal")}
                              </div>
                            ) : vivoEstado[llaveCiudad(d)] === "no" ? (
                              <div className="flex gap-2">
                                <a
                                  href={linkVuelos({ ciudad: d.ciudad, pais: d.pais })}
                                  target="_blank"
                                  rel="sponsored noopener"
                                  className="flex-1 rounded-xl border-[1.5px] border-amber-200 bg-amber-50 py-2.5 text-center text-[12.5px] font-bold text-amber-800 transition hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                                >
                                  <span className="inline-flex items-center justify-center gap-1.5">
                                    <Icono nombre="plane" size={14} /> {t("presupVerAviasales")}
                                  </span>
                                </a>
                                <a
                                  href={linkGoogleFlights({ ciudad: d.ciudad, pais: d.pais })}
                                  target="_blank"
                                  rel="noopener"
                                  className="flex-1 rounded-xl border-[1.5px] border-blue-200 bg-blue-50 py-2.5 text-center text-[12.5px] font-bold text-blue-800 transition hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                >
                                  <span className="inline-flex items-center justify-center gap-1.5">
                                    <Icono nombre="search" size={14} /> {t("presupVerGoogle")}
                                  </span>
                                </a>
                              </div>
                            ) : (
                              <button
                                onClick={() => pedirVivo(d)}
                                className="w-full rounded-xl border-[1.5px] border-emerald-200 bg-emerald-50 py-2.5 text-[13px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300"
                              >
                                <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="refresh" size={14} /> {t("presupBuscarReal")}</span>
                              </button>
                            )}
                          </div>
                        )}
                        <button
                          onClick={() => onElegirCiudad?.(d)}
                          className="mt-3 w-full rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-2.5 text-sm font-bold text-white shadow-marca"
                        >
                          <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="map" size={15} /> {t("presupPlanear")}</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 text-[11px] leading-relaxed text-slate-400">{t("presupAviso")}</div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-500 dark:text-slate-400">{children}</div>;
}

// Etiqueta del medio de transporte cuando no hay nombre comercial (operador
// es null). Mantiene la lectura compacta y consistente con la tabla curada.
function labelMedio(medio) {
  if (medio === "tren") return "Tren";
  if (medio === "bus") return "Bus";
  if (medio === "vuelo") return "Vuelo low-cost";
  if (medio === "ferry") return "Ferry";
  return medio || "";
}

// Banner de advertencia / refuerzo sobre el match presupuesto ↔ días.
// Cubre 4 escenarios:
//   1. Presupuesto no cubre ni el vuelo a la región → bloqueante
//   2. Usuario eligió N días pero su presupuesto sólo alcanza para M < N → alerta
//   3. Presupuesto holgado → confirmación positiva
//   4. Días muy cortos o muy largos para la región → sugerencia
// El tono es informativo y honesto, sin emojis, con cifras concretas.
function AvisoPresupuesto({ recom, dias, personas, presupuestoUsd, presupMinimo, fmtUsd, regionLabel, regionesQueCaben = [], onCambiarRegion }) {
  if (!recom || presupuestoUsd <= 0) return null;

  // Pills de regiones alternativas que SÍ caben. Mostradas dentro del banner
  // rojo o ámbar para que el usuario tenga UN solo click para escapar de la
  // restricción en lugar de "considera otra región" abstracto.
  const renderAlternativas = () => {
    if (!regionesQueCaben?.length) return null;
    const top = regionesQueCaben.slice(0, 3);
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11.5px] font-semibold uppercase tracking-wider opacity-75">Sí cabe en:</span>
        {top.map((r) => (
          <button
            key={r.key}
            onClick={() => onCambiarRegion?.(r.key)}
            className="rounded-md border border-current/30 bg-white/50 px-2 py-0.5 text-[12px] font-bold underline-offset-2 hover:bg-white/80 hover:underline dark:bg-white/5 dark:hover:bg-white/15"
          >
            {r.label}
          </button>
        ))}
      </div>
    );
  };

  // Caso 1: ni siquiera el vuelo cabe.
  if (recom.advertencia === "insuficiente_vuelo") {
    return (
      <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-[13px] leading-snug text-rose-900 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
        <div className="font-semibold">Presupuesto insuficiente para esta región</div>
        <div className="mt-0.5 text-rose-800/90 dark:text-rose-300/90">
          Para un viaje básico de 7 días a {regionLabel} necesitarías al menos{" "}
          <b>{fmtUsd(recom.presupuestoMinSugerido)}</b>.
        </div>
        {renderAlternativas()}
      </div>
    );
  }

  // Caso 2: el monto cubre el vuelo pero los días del usuario exceden lo que alcanza.
  const faltante = presupMinimo - presupuestoUsd;
  if (faltante > 0) {
    return (
      <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-[13px] leading-snug text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
        <div className="font-semibold">Tu presupuesto se queda corto para {dias} días</div>
        <div className="mt-0.5 text-amber-800/90 dark:text-amber-300/90">
          Con {fmtUsd(presupuestoUsd)} alcanza para aproximadamente <b>{recom.recomendado} días</b>{" "}
          en {regionLabel}
          {personas > 1 && ` para ${personas} personas`}. Para llegar a {dias} días te faltarían{" "}
          <b>{fmtUsd(faltante)}</b>.
        </div>
        {renderAlternativas()}
      </div>
    );
  }

  // Caso 3: holgado — el monto alcanza con margen.
  const sobra = presupuestoUsd - presupMinimo;
  if (sobra > recom.diaMediana * personas * 3) {
    return (
      <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-[13px] leading-snug text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200">
        <div className="font-semibold">Presupuesto holgado</div>
        <div className="mt-0.5 text-emerald-800/90 dark:text-emerald-300/90">
          Con {fmtUsd(presupuestoUsd)} podrías quedarte hasta <b>{recom.recomendado} días</b>{" "}
          cómodamente en {regionLabel}, o usar el excedente en experiencias mejores.
        </div>
      </div>
    );
  }

  // Caso 4: alcanza justo. Mensaje informativo neutro.
  return (
    <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-[12.5px] leading-snug text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
      Cubre <b>{dias} días</b> en {regionLabel}
      {personas > 1 && ` para ${personas} personas`}. Mínimo estimado:{" "}
      <b>{fmtUsd(presupMinimo)}</b>.
    </div>
  );
}

// Formatea "2026-03-12" → "12 mar" (sin dependencias, idioma por defecto es).
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function fmtFechaCorta(iso) {
  if (!iso || iso.length < 10) return "";
  const m = Number(iso.slice(5, 7)) - 1;
  const d = Number(iso.slice(8, 10));
  return `${d} ${MESES_CORTOS[m] || ""}`;
}

// "visto hace X" del timestamp del último escaneo. Compartido con Ofertas.js.
function fmtHaceCorto(iso, t) {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const min = Math.round(ms / 60000);
  if (min < 60) return t("ofertasHaceMin").replace("{n}", Math.max(1, min));
  const h = Math.round(min / 60);
  if (h < 24) return t("ofertasHaceHoras").replace("{n}", h);
  const d = Math.round(h / 24);
  return t("ofertasHaceDias").replace("{n}", d);
}

// Línea "Oferta para 12 mar – 20 mar · directo · visto hace 3h" bajo el precio
// cuando es real. QW2: añadimos sello de frescura adyacente al precio para que
// nadie vea una cifra sin saber cuándo fue verificada. Escalas (2026-06-24):
// mostramos cuántas escalas tiene el vuelo recomendado (0 = directo). Si el
// número de escalas ida/vuelta difiere, mostramos el MAYOR con marca "máx".
// Si no tenemos el dato (filas viejas del CSV), no mostramos nada — no
// asumimos directo para no mentirle al usuario.
function fmtEscalas(ida, vuelta) {
  const idaN = Number.isFinite(ida) ? ida : null;
  const vueltaN = Number.isFinite(vuelta) ? vuelta : null;
  if (idaN === null && vueltaN === null) return "";
  // Tomamos el valor existente o el peor (máx) si tenemos ambos.
  let n;
  if (idaN !== null && vueltaN !== null) n = Math.max(idaN, vueltaN);
  else n = (idaN ?? vueltaN);
  if (n === 0) return "directo";
  const palabra = n === 1 ? "escala" : "escalas";
  // Si los tramos difieren, marcarlo para no engañar (peor caso visible).
  const distintos = idaN !== null && vueltaN !== null && idaN !== vueltaN;
  return distintos ? `máx ${n} ${palabra}` : `${n} ${palabra}`;
}

function FechasOferta({ vueloReal, t }) {
  if (!vueloReal || (!vueloReal.fecha_ida && !vueloReal.fecha_vuelta)) return null;
  const visto = vueloReal.visto || vueloReal.generado;
  const hace = visto ? fmtHaceCorto(visto, t) : "";
  const escalas = fmtEscalas(vueloReal.escalas_ida, vueloReal.escalas_vuelta);
  return (
    <div className="-mt-0.5 mb-1 pl-0.5 text-[11px] font-medium text-emerald-700">
      {t("presupOfertaPara")} {fmtFechaCorta(vueloReal.fecha_ida)}
      {vueloReal.fecha_vuelta ? ` – ${fmtFechaCorta(vueloReal.fecha_vuelta)}` : ""}
      {escalas && (
        <span className={`ml-1.5 font-normal ${escalas === "directo" ? "text-emerald-700" : "text-emerald-700/80"}`}>
          · {escalas}
        </span>
      )}
      {hace && <span className="ml-1.5 font-normal text-emerald-700/70">· {hace}</span>}
    </div>
  );
}

function Fila({ nombre, valor, badge = null, badgeReal = false, accion = null }) {
  return (
    <div className="flex items-center justify-between py-1 text-[13px] text-slate-600">
      <span className="flex items-center gap-1.5">
        {nombre}
        {badge && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${
              badgeReal ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-slate-100 text-slate-500"
            }`}
          >
            {badge}
          </span>
        )}
      </span>
      <span className="flex items-center gap-2">
        {accion}
        <b className="text-slate-800">{valor}</b>
      </span>
    </div>
  );
}

// Tarjeta de la ruta multiciudad: línea de tiempo de ciudades + resumen + desglose.
function RutaCard({
  ruta,
  t,
  fmtUsd,
  fmtLocal,
  onOtra,
  onPlanear,
  onPlanearCiudad,
  onExcluir,
  vivoEstadoEntrada,
  onPedirVivoEntrada,
}) {
  const { ciudades, desglose, total, cabe, sobra, diasTotales } = ruta;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-suave dark:border-slate-700 dark:bg-slate-800">
      {/* Encabezado de la ruta */}
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-marca-500">
              {t("presupRutaTitulo")}
            </div>
            <div className="mt-0.5 text-[15px] font-bold text-slate-800">
              {ciudades.map((c) => c.ciudad).join(" → ")}
            </div>
          </div>
          <span className="text-2xl">{ciudades[0]?.bandera}</span>
        </div>
        <div className="mt-2 flex gap-4 text-[12.5px] text-slate-500">
          <span><b className="text-slate-700">{ciudades.length}</b> {t("presupRutaCiudades")}</span>
          <span><b className="text-slate-700">{diasTotales}</b> {t("presupRutaDias")}</span>
        </div>
      </div>

      {/* Línea de tiempo de ciudades. Entre cada par de ciudades mostramos el
          medio de transporte real (AVE, Eurostar, FlixBus, vuelo low-cost) +
          duración + costo. Si el tramo NO está curado, se marca "aprox" para
          ser honestos. La tabla curada vive en lib/tramos.js. */}
      <div className="px-4 py-3">
        {ciudades.map((c, i) => (
          <div key={llaveCiudad(c)}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1 pl-3 text-[12px] text-slate-500 dark:text-slate-400">
                <span className="text-slate-300 dark:text-slate-600">│</span>
                <span className="flex flex-wrap items-center gap-x-1.5">
                  {c.medioTramo && (
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {c.operadorTramo || labelMedio(c.medioTramo)}
                    </span>
                  )}
                  {c.duracionTramoH > 0 && (
                    <span className="text-slate-500">· {fmtDuracion(c.duracionTramoH)}</span>
                  )}
                  <span className="text-slate-500">· {fmtUsd(c.salto)}</span>
                  {c.esTramoCurado === false && (
                    <span className="rounded-sm bg-slate-100 px-1 text-[10px] font-medium uppercase text-slate-500 dark:bg-slate-700 dark:text-slate-400">aprox</span>
                  )}
                  <span className="text-slate-400">· {c.km.toLocaleString("es-CO")} km</span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca-600 text-xs font-bold text-white">
                {i + 1}
              </div>
              <button
                onClick={() => onPlanearCiudad?.(c)}
                className="group flex flex-1 items-center gap-2 text-left"
              >
                <div className="flex-1">
                  <div className="font-bold text-slate-800 group-hover:text-marca-600">
                    {c.bandera} {c.ciudad}
                  </div>
                  <div className="text-xs text-slate-500">{c.pais}</div>
                </div>
                <span className="text-[11px] font-bold text-marca-600 opacity-0 transition group-hover:opacity-100">
                  <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="map" size={15} /> {t("presupPlanear")}</span>
                </span>
              </button>
              <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {c.diasAqui} {t("presupRutaDias")}
              </div>
              {ciudades.length > 1 && (
                <button
                  onClick={() => onExcluir?.(c)}
                  title={t("presupExcluir")}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                >
                  <Icono nombre="x" size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desglose de costos */}
      <div className="border-t border-slate-100 px-4 py-3">
        <Fila
          nombre={t("presupVueloIntl")}
          valor={fmtUsd(desglose.vueloIntl)}
          badge={ruta.esRealEntrada ? t("presupPrecioReal") : t("presupEstimado")}
          badgeReal={ruta.esRealEntrada}
        />
        {ruta.esRealEntrada && <FechasOferta vueloReal={ruta.vueloRealEntrada} t={t} />}

        {/* Precio real EN VIVO para el vuelo internacional cuando todavía es estimado. */}
        {!ruta.esRealEntrada && (
          <div className="mb-1.5 mt-1 flex flex-wrap items-center gap-2">
            {vivoEstadoEntrada === "buscando" ? (
              <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-500">
                <span className="spin h-3 w-3 rounded-full border-2 border-slate-300 border-t-marca-500" />
                {t("presupBuscandoReal")}
              </div>
            ) : vivoEstadoEntrada === "no" ? (
              <a
                href={linkVuelos({ ciudad: ruta.entrada.ciudad, pais: ruta.entrada.pais })}
                target="_blank"
                rel="sponsored noopener"
                className="text-[11.5px] font-semibold text-amber-700 underline-offset-2 hover:underline"
              >
                {t("presupVerAviasales")} ↗
              </a>
            ) : (
              <button
                onClick={onPedirVivoEntrada}
                className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700 transition hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300"
              >
                <Icono nombre="refresh" size={11} /> {t("presupBuscarReal")}
              </button>
            )}
            <a
              href={linkGoogleFlights({
                ciudad: ruta.entrada.ciudad,
                pais: ruta.entrada.pais,
                fechaIda: ruta.vueloRealEntrada?.fecha_ida,
                fechaVuelta: ruta.vueloRealEntrada?.fecha_vuelta,
              })}
              target="_blank"
              rel="noopener"
              className="text-[11.5px] font-semibold text-marca-500 underline-offset-2 hover:underline"
            >
              {t("presupCompararGoogle")} ↗
            </a>
          </div>
        )}
        {/* Cuando ya es real, comparador Google igual disponible para validar. */}
        {ruta.esRealEntrada && (
          <a
            href={linkGoogleFlights({
              ciudad: ruta.entrada.ciudad,
              pais: ruta.entrada.pais,
              fechaIda: ruta.vueloRealEntrada?.fecha_ida,
              fechaVuelta: ruta.vueloRealEntrada?.fecha_vuelta,
            })}
            target="_blank"
            rel="noopener"
            className="-mt-1 mb-1 inline-block text-[11px] font-semibold text-marca-500 underline-offset-2 hover:underline"
          >
            {t("presupCompararGoogle")} ↗
          </a>
        )}

        <Fila nombre={t("presupEntreCiudades")} valor={fmtUsd(desglose.saltos)} />
        <Fila nombre={t("presupHospedaje")} valor={fmtUsd(desglose.hospedaje)} />
        <Fila nombre={t("presupComida")} valor={fmtUsd(desglose.comida)} />
        <Fila nombre={t("presupTransporte")} valor={fmtUsd(desglose.transporte)} />
        <Fila nombre={t("presupExtras")} valor={fmtUsd(desglose.extras)} />
      </div>

      {/* Total */}
      <div className={`flex items-center justify-between px-4 py-3 ${cabe ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Total</div>
          <div className={`text-xl font-extrabold ${cabe ? "text-emerald-700" : "text-red-600"}`}>
            {fmtUsd(total)}
          </div>
          <div className="text-[11px] text-slate-400">{fmtLocal(total)}</div>
        </div>
        <div className="text-right text-[13px] font-semibold">
          {cabe ? (
            <span className="text-emerald-700 dark:text-emerald-400">{t("presupTeSobra")} {fmtUsd(sobra)}</span>
          ) : (
            <span className="text-rose-700 dark:text-rose-400">{t("presupTeFalta")} {fmtUsd(-sobra)}</span>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 border-t border-slate-100 p-3">
        <button
          onClick={onOtra}
          className="flex-1 rounded-xl border-[1.5px] border-marca-100 bg-white py-3 text-sm font-bold text-marca-700 transition hover:bg-marca-50 dark:border-slate-700 dark:bg-slate-700 dark:text-marca-300 dark:hover:bg-slate-600"
        >
          <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="refresh" size={15} /> {t("presupOtraRuta")}</span>
        </button>
        <button
          onClick={onPlanear}
          className="flex-1 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-3 text-sm font-bold text-white shadow-marca"
        >
          <span className="inline-flex items-center justify-center gap-1.5"><Icono nombre="map" size={15} /> {t("presupPlanear")}</span>
        </button>
      </div>
    </div>
  );
}
