"use client";
// Combobox doble (país + aeropuerto) sobre el catálogo IATA completo
// (~7000 aeropuertos del mundo). Ambos campos son typeaheads con filtrado
// en vivo según lo que el usuario escribe.
//
// País: opcional. Si está vacío (Todo el mundo), no filtra. Si tiene un
// país elegido, el typeahead de aeropuerto solo busca dentro de ese país.
//
// Aeropuerto: si el país filtro NO coincide con el aeropuerto pre-elegido,
// el input se limpia para que el usuario elija otro consistente.
//
// Carga el JSON bajo demanda la primera vez que el componente se monta.
// Singleton compartido entre instancias.
import { useEffect, useMemo, useRef, useState } from "react";
// Banderas en PNG: el emoji de bandera no renderiza en Windows y las filas se
// leian "jp Tokio" en vez de "🇯🇵 Tokio".
import Bandera from "./Bandera";
import {
  HUBS_PRIORITARIOS,
  HUBS_SECUNDARIOS,
  HUB_DESEMPATE,
  ALIAS_CIUDAD,
  ETIQUETA_CIUDAD,
} from "@/data/hubs-prioritarios";

// Bandera emoji desde código ISO de 2 letras (regional indicators).
export function banderaDePais(cc) {
  if (!cc || cc.length !== 2) return "🌍";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65)
  );
}

// Singleton del catálogo cargado.
let _catalogoPromise = null;
async function cargarCatalogo() {
  if (_catalogoPromise) return _catalogoPromise;
  _catalogoPromise = fetch("/aeropuertos.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((arr) =>
      arr.map((a) => ({
        iata: a.i,
        // `ciudad` es lo que se MUESTRA y lo que se propaga al elegir: el nombre
        // comercial cuando el catálogo IATA usa otro ("Rionegro" por Medellín,
        // "Ezeiza" por Buenos Aires, "Tocumen" por Ciudad de Panamá).
        ciudad: ETIQUETA_CIUDAD[a.i] || a.c,
        // El nombre del catálogo se conserva porque la búsqueda sigue casando
        // contra él: quien escriba "Rionegro" o "Ezeiza" debe seguir llegando.
        ciudadCatalogo: a.c,
        pais: a.p,
        nombre: a.n,
        ciudadLower: (a.c || "").toLowerCase(),
        etiquetaLower: (ETIQUETA_CIUDAD[a.i] || "").toLowerCase(),
        nombreLower: (a.n || "").toLowerCase(),
      }))
    )
    .catch(() => []);
  return _catalogoPromise;
}

// Normaliza para búsqueda: minúsculas + sin tildes.
// Este componente no recibe `t`: se apana con `lang`, igual que ya hace con
// nombrePais(cc, lang). Sus otros textos siguen en espanol a pelo
// ("Ningun aeropuerto coincide", el placeholder) — deuda anterior a esto, no
// la arreglo de paso para no ensanchar el cambio.
const SIN_APT = { es: "sin aeropuerto", en: "no airport", pt: "sem aeroporto", fr: "sans aéroport" };

function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Nombres en español -> nombre de la ciudad en el catálogo IATA, que está en
// inglés o en el idioma local. Sin esto el nombre español no encuentra la ciudad
// ("Tokio", "Nueva York", "Estambul" daban cero) o, peor, encuentra la
// equivocada: "Medellín" daba EOH (Olaya Herrera, el aeropuerto pequeño) en vez
// de MDE, y "Panamá" daba Panama City, Florida en vez de Tocumen.
//
// El mapa se genera desde los datos que la app ya mantiene (lib/iataCiudades.js)
// y se valida contra el país de cada aeropuerto. Ver data/hubs-prioritarios.js.
//
// Acepta prefijos para que funcione mientras se teclea: con "toki" ya devuelve
// "tokyo", sin tener que completar "tokio".
function exonimos(t) {
  if (!t || t.length < 3) return [];
  const exacto = ALIAS_CIUDAD[t];
  if (exacto) return exacto;
  const out = [];
  for (const es in ALIAS_CIUDAD) {
    if (es.startsWith(t)) out.push(...ALIAS_CIUDAD[es]);
    if (out.length >= 4) break;
  }
  return out;
}

// Helper: nombre legible de un país ISO 2-letras vía Intl.DisplayNames.
function nombrePais(cc, lang = "es") {
  try {
    const dn = new Intl.DisplayNames([lang], { type: "region" });
    return dn.of(cc) || cc;
  } catch {
    return cc;
  }
}

// Filtra y rankea aeropuertos. Pool = todo el catálogo si no hay filtro de
// país, o solo los del país filtrado si lo hay. Si no hay query y SÍ hay
// filtro, devuelve los primeros 20 del país ordenados alfabéticamente.
function buscarAeropuertos(catalogo, q, paisFiltro = "", limite = 20) {
  const limpio = q.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const t = norm(limpio);
  const pool = paisFiltro
    ? catalogo.filter((a) => a.pais === paisFiltro)
    : catalogo;

  if (!t && paisFiltro) {
    // Hubs primero, y alfabético dentro de cada grupo. Es el primer contacto del
    // planificador de presupuesto: el usuario elige su país y todavía no ha
    // escrito nada. Con orden puramente alfabético, elegir Colombia mostraba
    // Acandí, Aguachica, Amalfi, Andes y Apiay — cinco pistas diminutas, sin
    // Bogotá ni Medellín a la vista. Argentina y España empezaban igual.
    const nivel = (a) =>
      HUBS_PRIORITARIOS.has(a.iata) ? 0 : HUBS_SECUNDARIOS.has(a.iata) ? 1 : 2;
    return [...pool]
      .sort((a, b) => nivel(a) - nivel(b) || a.ciudad.localeCompare(b.ciudad, "es"))
      .slice(0, limite);
  }
  if (!t) return [];

  const hintIata = (q.match(/\(([A-Za-z]{3})\)/) || [])[1]?.toUpperCase();
  if (t.length === 3) {
    const ex = pool.find((a) => a.iata.toLowerCase() === t);
    if (ex) {
      const resto = pool
        .filter((a) => a !== ex && (norm(a.ciudadLower).startsWith(t) || norm(a.etiquetaLower).startsWith(t) || norm(a.nombreLower).includes(t)))
        .slice(0, limite - 1);
      return [ex, ...resto];
    }
  }
  if (hintIata) {
    const ex = pool.find((a) => a.iata === hintIata);
    if (ex) {
      const resto = pool
        .filter((a) => a !== ex && (norm(a.ciudadLower).includes(t) || norm(a.etiquetaLower).includes(t) || norm(a.nombreLower).includes(t)))
        .slice(0, limite - 1);
      return [ex, ...resto];
    }
  }
  // Se puntúa contra lo que el usuario escribió Y contra el nombre en inglés
  // del catálogo si es un exónimo. Se toma el mejor de los dos, así "Roma"
  // pone Rome/FCO arriba en vez de Cape Romanzof.
  const alias = exonimos(t);
  const terminos = alias.length ? [t, ...alias] : [t];
  const puntuar = (c, n, iata, term) => {
    if (c === term) return 100;
    if (c.startsWith(term)) return 80;
    if (c.includes(term)) return 60;
    if (iata.startsWith(term)) return 50;
    if (n.includes(term)) return 40;
    return 0;
  };

  const scored = [];
  for (const a of pool) {
    const c = norm(a.ciudadLower);
    const n = norm(a.nombreLower);
    // La etiqueta comercial también se busca. Es lo que garantiza que todo lo
    // que se ve en la lista se pueda escribir: si se muestra "Medellín", tiene
    // que encontrarse escribiendo "Medellín", no solo "Rionegro".
    const e = a.etiquetaLower ? norm(a.etiquetaLower) : "";
    const iata = a.iata.toLowerCase();
    let score = 0;
    for (const term of terminos) {
      const s = puntuar(c, n, iata, term);
      if (s > score) score = s;
      if (e) {
        const se = puntuar(e, n, iata, term);
        if (se > score) score = se;
      }
    }
    // Empujón a los aeropuertos que la app ya trata como destino u origen real.
    // +20 al principal y +10 al segundo aeropuerto de la misma ciudad, para que
    // Gatwick no le gane a Heathrow ni Ciampino a Fiumicino. Desempata DENTRO
    // del mismo nivel de coincidencia sin dejar que una coincidencia débil salte
    // una fuerte (un hub que solo coincide por nombre, 40+20, sigue debajo de
    // una ciudad exacta, 100). Sin esto "Londres" ponía
    // London/YXU (Ontario) antes de Heathrow, "París" ponía Paris/PHT (Texas)
    // antes de CDG, "Madrid" ponía ECV antes de MAD y "Bali" ponía un
    // aeropuerto de Camerún en primer lugar.
    if (score > 0) {
      if (HUBS_PRIORITARIOS.has(a.iata)) score += 20;
      else if (HUBS_SECUNDARIOS.has(a.iata)) score += 10;
      // Ciudades con dos aeropuertos de primer nivel (Londres, París, São
      // Paulo, Shanghái, Tokio, Estambul): +5 marca cuál es EL principal, si no
      // el empate lo rompía el orden del catálogo y ganaba Gatwick sobre
      // Heathrow.
      if (HUB_DESEMPATE.has(a.iata)) score += 5;
    }
    if (score > 0) scored.push({ a, score });
    if (scored.length > limite * 6) break;
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limite).map((x) => x.a);
}

// Filtra países por substring. Devuelve hasta `limite` ordenados por
// relevancia: empieza por (prioridad) > contiene.
function buscarPaises(paises, q, limite = 100) {
  const t = norm(q.trim());
  if (!t) return paises.slice(0, limite); // sin query: muestra todo (limitado)
  const empieza = [];
  const contiene = [];
  for (const p of paises) {
    const n = norm(p.nombre);
    if (n.startsWith(t)) empieza.push(p);
    else if (n.includes(t)) contiene.push(p);
    if (empieza.length + contiene.length >= limite * 2) break;
  }
  return [...empieza, ...contiene].slice(0, limite);
}

// Etiqueta visible para el campo de país. Solo el NOMBRE: la bandera va como
// icono al lado del input, no dentro de su texto.
//
// Antes esto devolvia `${emoji} ${nombre}` y ese texto era el value de un
// <input>. En Windows el emoji de bandera no existe en la fuente y el campo
// se leia literalmente "co Colombia" (reportado por el usuario viendo el
// planificador). Dentro de un input no cabe una imagen, asi que el texto se
// queda limpio y la bandera se dibuja superpuesta al lado.
function etiquetaPais(codigo, lang) {
  if (!codigo) return "Todo el mundo";
  return nombrePais(codigo, lang);
}

export default function SelectorAeropuerto({
  value, // iata seleccionado (string)
  paisInicial = "", // ISO 2-letras opcional para pre-filtrar
  onChange, // (aeropuerto | null) => void
  placeholder = "Ciudad, aeropuerto o IATA…",
  ariaLabel,
  className = "",
  lang = "es",
  // filtroPais=false: modo BUSQUEDA LIBRE, sin el campo de pais y sin quedarse
  // anclado al pais de lo ultimo que elegiste.
  //
  // El componente nacio para el planificador, donde eliges tu ORIGEN y tiene
  // sentido que pais y aeropuerto queden consistentes. Pero /ofertas lo usa
  // para buscar DESTINOS, y ahi el anclaje rompia la funcion entera: elegias
  // Madrid, el selector se quedaba en "España", y al buscar "Cancún" respondia
  // "Ningún aeropuerto coincide en España". O sea, solo se podia buscar una
  // ciudad por sesion y la segunda busqueda siempre fallaba.
  filtroPais = true,
  // CIUDADES SIN AEROPUERTO en la busqueda principal.
  //
  // Este buscador va sobre el catalogo IATA, asi que una ciudad mediana sin
  // aeropuerto no existe para el. Escribir "York" ofrecia York (Pensilvania) y
  // Nueva York, pero NO York de Inglaterra — que es la que casi cualquiera
  // esta buscando. Solo aparecia en un segundo buscador plegado, "¿Tu ciudad
  // no tiene aeropuerto?", que habia que descubrir y que ni siquiera
  // autocompletaba: habia que pulsar un boton.
  //
  // Con esto activado, el geocodificador se consulta en paralelo y sus
  // ciudades se ofrecen debajo de los aeropuertos, marcadas como lo que son.
  // Va tras un prop y no siempre porque en /ofertas no tiene sentido: alli se
  // buscan destinos de VUELO, y una ciudad sin aeropuerto no es un destino.
  incluirSinAeropuerto = false,
}) {
  const [catalogo, setCatalogo] = useState([]);

  // ----- Aeropuerto (campo derecho) -----
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const inputRef = useRef(null);
  const cajaAptRef = useRef(null);

  // ----- País (campo izquierdo, también typeahead) -----
  const [paisFiltro, setPaisFiltro] = useState(paisInicial);
  const [textoPais, setTextoPais] = useState(""); // lo que el usuario tipea o etiqueta del seleccionado
  const [abiertoPais, setAbiertoPais] = useState(false);
  const [resaltadoPais, setResaltadoPais] = useState(0);
  const paisInputRef = useRef(null);
  const cajaPaisRef = useRef(null);

  // Carga inicial del catálogo (perezosa, una vez por sesión).
  useEffect(() => {
    let vivo = true;
    cargarCatalogo().then((c) => vivo && setCatalogo(c));
    return () => { vivo = false; };
  }, []);

  // Cuando llega value externo (init desde localStorage, etc.), sincroniza
  // input y país filtro a ese aeropuerto.
  useEffect(() => {
    if (!value || !catalogo.length) return;
    const a = catalogo.find((x) => x.iata === value);
    if (a) {
      setTexto(`${a.ciudad} (${a.iata})`);
      if (filtroPais) setPaisFiltro(a.pais);
    }
  }, [value, catalogo]);

  // Sincroniza el texto del campo país a su etiqueta cuando cambia el
  // filtro (a menos que el usuario esté tipeando activamente en él).
  useEffect(() => {
    if (!abiertoPais) {
      setTextoPais(etiquetaPais(paisFiltro, lang));
    }
  }, [paisFiltro, lang, abiertoPais]);

  // Click afuera cierra ambos dropdowns.
  useEffect(() => {
    function onDoc(e) {
      if (cajaAptRef.current && !cajaAptRef.current.contains(e.target)) setAbierto(false);
      if (cajaPaisRef.current && !cajaPaisRef.current.contains(e.target)) {
        setAbiertoPais(false);
        // Si el usuario cerró sin elegir, revierte el texto a la etiqueta
        // del país seleccionado actual.
        setTextoPais(etiquetaPais(paisFiltro, lang));
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [paisFiltro, lang]);

  // Lista de países disponibles (derivada del catálogo, ordenada por
  // nombre localizado). Memoizada.
  const paisesDisponibles = useMemo(() => {
    if (!catalogo.length) return [];
    const set = new Set(catalogo.map((a) => a.pais));
    const arr = [...set].map((cc) => ({ codigo: cc, nombre: nombrePais(cc, lang) }));
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre, lang));
    return arr;
  }, [catalogo, lang]);

  // Países filtrados por lo que el usuario tipea (solo cuando el dropdown
  // está abierto y el texto no es la etiqueta del país ya elegido).
  const paisesFiltrados = useMemo(() => {
    if (!paisesDisponibles.length) return [];
    const etiquetaActual = etiquetaPais(paisFiltro, lang);
    // Si lo que está escrito coincide con la etiqueta del país actual,
    // mostramos toda la lista (para que puedan navegar).
    // Ya no hace falta despegar emojis: etiquetaPais() devuelve solo el nombre.
    const queryReal = textoPais === etiquetaActual ? "" : textoPais.trim();
    const base = buscarPaises(paisesDisponibles, queryReal, 100);
    // Prepend "Todo el mundo" como opción explícita.
    return [{ codigo: "", nombre: "Todo el mundo" }, ...base];
  }, [paisesDisponibles, textoPais, paisFiltro, lang]);

  // Aeropuertos filtrados.
  const resultados = useMemo(
    () => buscarAeropuertos(catalogo, texto, paisFiltro, 20),
    [catalogo, texto, paisFiltro]
  );

  // Ciudades del geocodificador. Se pide con retardo (350 ms desde la ultima
  // tecla) porque cada consulta sale a la red: sin eso serian seis peticiones
  // para escribir "Brujas".
  const [sinApt, setSinApt] = useState([]);
  useEffect(() => {
    if (!incluirSinAeropuerto) { setSinApt([]); return; }
    const q = texto.trim();
    // Tres letras: con dos, cualquier cosa devuelve medio mundo.
    if (q.length < 3) { setSinApt([]); return; }
    let vivo = true;
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/geocodificar?lista=1&ciudad=${encodeURIComponent(q)}`);
        const d = r.ok ? await r.json() : null;
        if (!vivo) return;
        // Fuera las que ya trae el catalogo de aeropuertos: ofrecer Madrid dos
        // veces, una con vuelo y otra sin el, solo confunde.
        const yaHay = new Set(resultados.map((a) => `${norm(a.ciudad)}|${a.pais}`));
        setSinApt(
          (d?.resultados || [])
            .filter((c) => c.ciudad && !yaHay.has(`${norm(c.ciudad)}|${c.iso}`))
            .slice(0, 6)
        );
      } catch {
        if (vivo) setSinApt([]);
      }
    }, 350);
    return () => { vivo = false; clearTimeout(id); };
  }, [texto, incluirSinAeropuerto, resultados]);

  // Lista unica para pintar y para el teclado: aeropuertos primero — son
  // instantaneos y casi siempre lo que se busca — y debajo las ciudades sin
  // aeropuerto.
  const opciones = useMemo(
    () => [
      ...resultados.map((a) => ({ tipo: "apt", a })),
      ...sinApt.map((c) => ({ tipo: "ciudad", c })),
    ],
    [resultados, sinApt]
  );

  // --- handlers país ---
  function elegirPais(codigo) {
    setPaisFiltro(codigo);
    setTextoPais(etiquetaPais(codigo, lang));
    setAbiertoPais(false);
    setResaltadoPais(0);

    // Si el aeropuerto pre-seleccionado NO está en el nuevo país, limpiamos
    // el input de aeropuerto (y notificamos al padre con null) — así el
    // usuario sabe que tiene que elegir otro.
    if (codigo && value) {
      const apt = catalogo.find((a) => a.iata === value);
      if (apt && apt.pais !== codigo) {
        setTexto("");
        onChange?.(null);
      }
    }
    // Abre el dropdown de aeropuertos y mueve el foco ahí para flujo
    // continuo.
    setAbierto(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function onKeyPais(e) {
    if (!abiertoPais && (e.key === "ArrowDown" || e.key === "Enter")) {
      setAbiertoPais(true);
      return;
    }
    if (!abiertoPais) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltadoPais((i) => Math.min(i + 1, paisesFiltrados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltadoPais((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const p = paisesFiltrados[resaltadoPais];
      if (p) elegirPais(p.codigo);
    } else if (e.key === "Escape") {
      setAbiertoPais(false);
      setTextoPais(etiquetaPais(paisFiltro, lang));
    }
  }

  // --- handlers aeropuerto ---
  function elegirAeropuerto(a) {
    setTexto(`${a.ciudad} (${a.iata})`);
    if (filtroPais) {
      setPaisFiltro(a.pais);
      setTextoPais(etiquetaPais(a.pais, lang));
    }
    setAbierto(false);
    onChange?.({
      iata: a.iata,
      ciudad: a.ciudad,
      pais: a.pais,
      // Nombre legible del pais ademas del codigo ISO: quien consume esto
      // suele necesitar "Reino Unido", no "GB".
      paisNombre: nombrePais(a.pais, lang),
      nombre: a.nombre,
    });
  }

  // Ciudad sin aeropuerto. Se propaga con iata vacio y CON coordenadas: quien
  // consume esto ya sabe tratar una parada sin aeropuerto (los tramos salen
  // terrestres), y las coordenadas ahorran una segunda consulta al
  // geocodificador.
  function elegirCiudad(c) {
    setTexto(c.ciudad);
    setAbierto(false);
    onChange?.({
      iata: "",
      ciudad: c.ciudad,
      pais: c.iso,
      paisNombre: nombrePais(c.iso, lang) || c.pais,
      nombre: [c.region, nombrePais(c.iso, lang) || c.pais].filter(Boolean).join(", "),
      lat: c.lat,
      lon: c.lon,
      sinAeropuerto: true,
    });
  }

  function elegirOpcion(o) {
    if (!o) return;
    if (o.tipo === "apt") elegirAeropuerto(o.a);
    else elegirCiudad(o.c);
  }

  function onKeyAeropuerto(e) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "Enter")) {
      setAbierto(true);
      return;
    }
    if (!abierto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => Math.min(i + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      elegirOpcion(opciones[resaltado]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div
      className={`grid grid-cols-1 gap-2 ${filtroPais ? "sm:grid-cols-[1fr_2fr]" : ""} ${className}`}
    >
      {/* ====== Combobox de país ====== */}
      {/* En modo búsqueda libre no se muestra: no hay un "país de salida" que
          elegir, y dejarlo visible además anclaba la búsqueda a ese país. */}
      <div ref={cajaPaisRef} className={`relative ${filtroPais ? "" : "hidden"}`}>
        {/* Bandera del pais elegido, superpuesta sobre el hueco que deja el
            padding izquierdo del input. Se oculta mientras el usuario escribe,
            para no dejar una bandera que ya no corresponde al texto. */}
        {paisFiltro && textoPais === etiquetaPais(paisFiltro, lang) && (
          <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2">
            <Bandera cc={paisFiltro} size={18} />
          </span>
        )}
        <input
          ref={paisInputRef}
          type="text"
          value={textoPais}
          aria-label="País de salida"
          aria-autocomplete="list"
          aria-expanded={abiertoPais}
          autoComplete="off"
          onChange={(e) => {
            setTextoPais(e.target.value);
            setAbiertoPais(true);
            setResaltadoPais(0);
          }}
          onFocus={(e) => {
            setAbiertoPais(true);
            setResaltadoPais(0);
            try { e.target.select(); } catch {}
          }}
          onKeyDown={onKeyPais}
          className={`w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pr-3 text-[16px] sm:text-[14px] font-semibold text-marca-900 outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 ${
            paisFiltro && textoPais === etiquetaPais(paisFiltro, lang) ? "pl-10" : "pl-3"
          }`}
        />
        {abiertoPais && paisesFiltrados.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-[6700] mt-1 max-h-[min(300px,45dvh)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
          >
            {paisesFiltrados.map((p, i) => (
              <li
                key={p.codigo || "todo"}
                role="option"
                aria-selected={i === resaltadoPais}
                onMouseDown={(e) => { e.preventDefault(); elegirPais(p.codigo); }}
                onMouseEnter={() => setResaltadoPais(i)}
                className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[13.5px] ${
                  i === resaltadoPais
                    ? "bg-marca-50 text-marca-900 dark:bg-marca-900/40 dark:text-marca-300"
                    : "text-slate-700 dark:text-slate-200"
                }`}
              >
                <span className="flex w-[18px] shrink-0 justify-center" aria-hidden>{p.codigo ? <Bandera cc={p.codigo} size={18} /> : "🌍"}</span>
                <span className="truncate font-semibold">{p.nombre}</span>
              </li>
            ))}
          </ul>
        )}
        {abiertoPais && paisesFiltrados.length === 0 && (
          <div className="absolute left-0 right-0 top-full z-[6700] mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-500 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Ningún país coincide
          </div>
        )}
      </div>

      {/* ====== Combobox de aeropuerto ====== */}
      <div ref={cajaAptRef} className="relative">
        <input
          ref={inputRef}
          type="text"
          value={texto}
          placeholder={paisFiltro ? `Buscar en ${nombrePais(paisFiltro, lang)}…` : placeholder}
          aria-label={ariaLabel}
          aria-autocomplete="list"
          aria-expanded={abierto}
          autoComplete="off"
          onChange={(e) => {
            setTexto(e.target.value);
            setAbierto(true);
            setResaltado(0);
          }}
          onFocus={(e) => {
            setAbierto(true);
            try { e.target.select(); } catch {}
          }}
          onKeyDown={onKeyAeropuerto}
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] sm:text-[14px] font-semibold text-marca-900 outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
        {abierto && opciones.length > 0 && (
          <ul
            role="listbox"
            className="absolute left-0 right-0 top-full z-[6500] mt-1 max-h-[min(300px,45dvh)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
          >
            {opciones.map((o, i) =>
              o.tipo === "apt" ? (
                <li
                  key={`a-${o.a.iata}-${o.a.pais}-${i}`}
                  role="option"
                  aria-selected={i === resaltado}
                  onMouseDown={(e) => { e.preventDefault(); elegirAeropuerto(o.a); }}
                  onMouseEnter={() => setResaltado(i)}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13.5px] ${
                    i === resaltado
                      ? "bg-marca-50 text-marca-900 dark:bg-marca-900/40 dark:text-marca-300"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="flex w-[18px] shrink-0 justify-center" aria-hidden><Bandera cc={o.a.pais} size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {o.a.ciudad} <span className="text-slate-400">·</span> {nombrePais(o.a.pais, lang)}
                    </div>
                    <div className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                      {o.a.nombre}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                    {o.a.iata}
                  </span>
                </li>
              ) : (
                /* Ciudad sin aeropuerto. La REGION va en la linea de abajo y no
                   es decoracion: es lo que distingue York de Inglaterra de York
                   de Pensilvania, que es exactamente donde fallaba antes. */
                <li
                  key={`c-${o.c.ciudad}-${o.c.iso}-${o.c.lat}-${i}`}
                  role="option"
                  aria-selected={i === resaltado}
                  onMouseDown={(e) => { e.preventDefault(); elegirCiudad(o.c); }}
                  onMouseEnter={() => setResaltado(i)}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13.5px] ${
                    i === resaltado
                      ? "bg-marca-50 text-marca-900 dark:bg-marca-900/40 dark:text-marca-300"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  <span className="flex w-[18px] shrink-0 justify-center" aria-hidden><Bandera cc={o.c.iso} size={18} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">
                      {o.c.ciudad} <span className="text-slate-400">·</span> {nombrePais(o.c.iso, lang) || o.c.pais}
                    </div>
                    <div className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                      {o.c.region || nombrePais(o.c.iso, lang) || o.c.pais}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                    {SIN_APT[lang] || SIN_APT.es}
                  </span>
                </li>
              )
            )}
          </ul>
        )}
        {abierto && texto.length >= 2 && resultados.length === 0 && catalogo.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-[6500] mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-500 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Ningún aeropuerto coincide{paisFiltro ? ` en ${nombrePais(paisFiltro, lang)}` : ""}
          </div>
        )}
      </div>
    </div>
  );
}
