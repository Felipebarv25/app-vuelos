"use client";
// Combobox de aeropuertos con typeahead sobre el catálogo IATA completo
// (~7000 aeropuertos del mundo). Carga el JSON bajo demanda la primera vez
// que el campo gana foco — la landing no paga el costo si nadie abre el
// modal de presupuesto.
//
// Match: por IATA exacto (3 letras), por substring en ciudad o por substring
// en nombre del aeropuerto. Score privilegia ciudades que empiezan por el
// término escrito. Ordenado por relevancia, hasta 20 resultados.
//
// Output via onChange: { iata, ciudad, pais (ISO 2-letras), nombre }.
import { useEffect, useMemo, useRef, useState } from "react";

// Bandera emoji desde código ISO de 2 letras (regional indicators).
export function banderaDePais(cc) {
  if (!cc || cc.length !== 2) return "🌍";
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + (cc.charCodeAt(0) - 65),
    base + (cc.charCodeAt(1) - 65)
  );
}

// Singleton del catálogo cargado. Compartido entre instancias.
let _catalogoPromise = null;
async function cargarCatalogo() {
  if (_catalogoPromise) return _catalogoPromise;
  _catalogoPromise = fetch("/aeropuertos.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((arr) =>
      arr.map((a) => ({
        iata: a.i,
        ciudad: a.c,
        pais: a.p,
        nombre: a.n,
        ciudadLower: (a.c || "").toLowerCase(),
        nombreLower: (a.n || "").toLowerCase(),
      }))
    )
    .catch(() => []);
  return _catalogoPromise;
}

// Normaliza para búsqueda: minúsculas + sin tildes.
function norm(s) {
  return (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Filtra y rankea. Devuelve hasta `limite` matches ordenados por score.
// Si `paisFiltro` no es vacío, solo considera aeropuertos de ese país (ISO
// 2-letras), incluso si el query está vacío — en ese caso devuelve los
// primeros del país ordenados por nombre.
function buscar(catalogo, q, paisFiltro = "", limite = 20) {
  // Stripear los paréntesis "(IATA)" — cuando el input muestra la etiqueta
  // formateada "Ciudad (XXX)", el query incluye los paréntesis. Sin esto,
  // un usuario que enfoca el campo con un valor pre-seleccionado nunca
  // vería resultados (el texto literal no matchea ninguna ciudad).
  const limpio = q.replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const t = norm(limpio);
  // Pool inicial: todo el catálogo, o solo el país elegido si hay filtro.
  const pool = paisFiltro
    ? catalogo.filter((a) => a.pais === paisFiltro)
    : catalogo;

  // Sin query y con filtro de país → mostrar los primeros 20 del país.
  if (!t && paisFiltro) {
    return [...pool].sort((a, b) => a.ciudad.localeCompare(b.ciudad, "es")).slice(0, limite);
  }
  if (!t) return [];

  // Si el query original mencionaba un IATA entre paréntesis (ej. "Bogotá
  // (BOG)"), aprovechamos ese hint para subir su match.
  const hintIata = (q.match(/\(([A-Za-z]{3})\)/) || [])[1]?.toUpperCase();
  // IATA exacto = match prioritario.
  if (t.length === 3) {
    const ex = pool.find((a) => a.iata.toLowerCase() === t);
    if (ex) {
      const resto = pool
        .filter((a) => a !== ex && (norm(a.ciudadLower).startsWith(t) || norm(a.nombreLower).includes(t)))
        .slice(0, limite - 1);
      return [ex, ...resto];
    }
  }
  if (hintIata) {
    const ex = pool.find((a) => a.iata === hintIata);
    if (ex) {
      const resto = pool
        .filter((a) => a !== ex && (norm(a.ciudadLower).includes(t) || norm(a.nombreLower).includes(t)))
        .slice(0, limite - 1);
      return [ex, ...resto];
    }
  }
  const scored = [];
  for (const a of pool) {
    const c = norm(a.ciudadLower);
    const n = norm(a.nombreLower);
    let score = 0;
    if (c === t) score = 100;
    else if (c.startsWith(t)) score = 80;
    else if (c.includes(t)) score = 60;
    else if (n.includes(t)) score = 40;
    else if (a.iata.toLowerCase().startsWith(t)) score = 50;
    if (score > 0) scored.push({ a, score });
    if (scored.length > limite * 6) break; // corta temprano para no recorrer 7K cada vez
  }
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limite).map((x) => x.a);
}

// Helper: nombre legible de un país ISO 2-letras usando Intl.DisplayNames.
// Si el navegador no lo soporta, cae al código.
function nombrePais(cc, lang = "es") {
  try {
    const dn = new Intl.DisplayNames([lang], { type: "region" });
    return dn.of(cc) || cc;
  } catch {
    return cc;
  }
}

export default function SelectorAeropuerto({
  value, // iata seleccionado (string)
  paisInicial = "", // ISO 2-letras opcional para pre-filtrar
  onChange, // (aeropuerto) => void  recibe { iata, ciudad, pais, nombre }
  placeholder = "Ciudad, aeropuerto o IATA…",
  ariaLabel,
  className = "",
  lang = "es",
}) {
  const [catalogo, setCatalogo] = useState([]);
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  // Filtro de país. "" = Todo el mundo (sin filtro). Cuando el usuario
  // elige un aeropuerto, se actualiza para reflejar el país elegido.
  const [paisFiltro, setPaisFiltro] = useState(paisInicial);
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Carga inicial cuando se monta (perezosa pero apenas el componente entra
  // al DOM — el modal de Presupuesto solo se monta cuando se abre).
  useEffect(() => {
    let vivo = true;
    cargarCatalogo().then((c) => vivo && setCatalogo(c));
    return () => { vivo = false; };
  }, []);

  // Cuando llega value externo, sincroniza el input con su etiqueta legible.
  useEffect(() => {
    if (!value || !catalogo.length) return;
    const a = catalogo.find((x) => x.iata === value);
    if (a) {
      setTexto(`${a.ciudad} (${a.iata})`);
      // Auto-sync del país filtro a lo que se eligió desde afuera.
      setPaisFiltro(a.pais);
    }
  }, [value, catalogo]);

  // Click afuera cierra el dropdown.
  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Lista de países derivada del catálogo (única, ordenada por nombre
  // localizado). Incluye solo países que tienen al menos un aeropuerto con
  // IATA. Memoizada para evitar recomputo en cada render.
  const paisesDisponibles = useMemo(() => {
    if (!catalogo.length) return [];
    const set = new Set(catalogo.map((a) => a.pais));
    const arr = [...set].map((cc) => ({ codigo: cc, nombre: nombrePais(cc, lang) }));
    arr.sort((a, b) => a.nombre.localeCompare(b.nombre, lang));
    return arr;
  }, [catalogo, lang]);

  // Resultados memoizados — solo recalcula cuando cambia texto, filtro o
  // catálogo. Si hay filtro de país y query vacío, muestra primeros 20 del
  // país.
  const resultados = useMemo(
    () => buscar(catalogo, texto, paisFiltro, 20),
    [catalogo, texto, paisFiltro]
  );

  function cambiarPaisFiltro(codigo) {
    setPaisFiltro(codigo);
    setResaltado(0);
    // Si cambia el filtro a un país distinto al que está en el input, no
    // borramos el texto (el usuario puede querer mantenerlo para edición),
    // pero abrimos la lista para que vean los primeros resultados.
    setAbierto(true);
    // Focus en el input para que el usuario pueda tipear de inmediato.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function elegir(a) {
    setTexto(`${a.ciudad} (${a.iata})`);
    setPaisFiltro(a.pais);
    setAbierto(false);
    onChange?.({ iata: a.iata, ciudad: a.ciudad, pais: a.pais, nombre: a.nombre });
  }

  function onKey(e) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "Enter")) {
      setAbierto(true);
      return;
    }
    if (!abierto) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setResaltado((i) => Math.min(i + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = resultados[resaltado];
      if (a) elegir(a);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Grid 2-col en desktop, stack en móvil: país (filtro) + combobox. */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
        {/* Selector de país — opcional, filtra el typeahead. Si está vacío
            ("Todo el mundo"), no aplica filtro y se busca en todo el catálogo. */}
        <select
          value={paisFiltro}
          onChange={(e) => cambiarPaisFiltro(e.target.value)}
          aria-label="País de salida"
          className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[14px] font-semibold text-marca-900 outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        >
          <option value="">🌍 Todo el mundo</option>
          {paisesDisponibles.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {banderaDePais(p.codigo)} {p.nombre}
            </option>
          ))}
        </select>
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
            // Selecciona todo el texto al enfocar — así si el campo ya tiene
            // un aeropuerto elegido ("New York (JFK)"), tipear lo reemplaza
            // inmediato sin que el usuario tenga que borrar manualmente.
            try { e.target.select(); } catch {}
          }}
          onKeyDown={onKey}
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[14px] font-semibold text-marca-900 outline-none focus:border-marca-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
      </div>
      {abierto && resultados.length > 0 && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-[6500] mt-1 max-h-[300px] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {resultados.map((a, i) => (
            <li
              key={a.iata + a.pais + i}
              role="option"
              aria-selected={i === resaltado}
              onMouseDown={(e) => { e.preventDefault(); elegir(a); }}
              onMouseEnter={() => setResaltado(i)}
              className={`flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13.5px] ${
                i === resaltado
                  ? "bg-marca-50 text-marca-900 dark:bg-marca-900/40 dark:text-marca-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="text-base" aria-hidden>{banderaDePais(a.pais)}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {a.ciudad} <span className="text-slate-400">·</span> {a.pais}
                </div>
                <div className="truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                  {a.nombre}
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {a.iata}
              </span>
            </li>
          ))}
        </ul>
      )}
      {abierto && texto.length >= 2 && resultados.length === 0 && catalogo.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-[6500] mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-500 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400">
          Ningún aeropuerto coincide
        </div>
      )}
    </div>
  );
}
