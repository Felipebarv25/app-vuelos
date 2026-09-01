"use client";
// Combobox typeahead sobre el catálogo de 207 destinos de la app.
//
// Existe porque ese catálogo se ofrecía en <select> nativos: 207 opciones
// seguidas, sin forma de escribir para filtrar. En el comparador había TRES de
// esos seguidos, y en el planificador de ruta uno con las ciudades agrupadas
// por región — encontrar "Oporto" era bajar a mano por toda la lista.
//
// Mismo comportamiento que SelectorAeropuerto y SelectorPais para que los tres
// se sientan iguales: búsqueda sin acentos, orden por calidad de coincidencia
// (exacta, empieza por, contiene), navegación con teclado, 16px en móvil para
// que iOS no haga zoom al enfocar, y alto de lista adaptable al teclado.
import { useEffect, useMemo, useRef, useState } from "react";
import { DESTINOS_PRESUPUESTO } from "@/lib/presupuesto";

const norm = (s) =>
  (s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

// Índice normalizado. Se calcula una vez por catálogo, no en cada pulsación.
const _indices = new WeakMap();
function indexar(catalogo) {
  if (_indices.has(catalogo)) return _indices.get(catalogo);
  const idx = catalogo.map((d) => ({ ...d, _ciudad: norm(d.ciudad), _pais: norm(d.pais) }));
  idx.sort((a, b) => a.ciudad.localeCompare(b.ciudad, "es"));
  _indices.set(catalogo, idx);
  return idx;
}

function buscar(catalogo, query, limite = 40) {
  const CATALOGO = indexar(catalogo);
  const q = norm(query);
  if (!q) return CATALOGO.slice(0, limite);

  const exactos = [];
  const empieza = [];
  const contiene = [];
  for (const d of CATALOGO) {
    if (d._ciudad === q) exactos.push(d);
    else if (d._ciudad.startsWith(q)) empieza.push(d);
    else if (d._ciudad.includes(q) || d._pais.includes(q)) contiene.push(d);
  }
  const cmp = (a, b) => a.ciudad.localeCompare(b.ciudad, "es");
  return [...exactos.sort(cmp), ...empieza.sort(cmp), ...contiene.sort(cmp)].slice(0, limite);
}

/**
 * @param {object} p
 * @param {string} p.value        clave del destino elegido ("" = ninguno)
 * @param {function} p.claveDe    (destino) => clave, para casar con `value`
 * @param {function} p.onChange   (destino|null) => void
 * @param {boolean} [p.permitirVacio]  muestra la opción de quitar la selección
 * @param {Array} [p.catalogo]    lista de destinos; por defecto el del
 *        presupuesto. El comparador pasa DESTINOS_SEO porque necesita el slug.
 */
export default function SelectorCiudad({
  catalogo = DESTINOS_PRESUPUESTO,
  value = "",
  claveDe = (d) => `${d.ciudad}|${d.pais}`,
  onChange,
  permitirVacio = false,
  placeholder = "Escribe una ciudad…",
  etiquetaVacio = "— Sin elegir —",
  ariaLabel,
  className = "",
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const cajaRef = useRef(null);
  const inputRef = useRef(null);

  const elegido = useMemo(
    () => (value ? catalogo.find((d) => claveDe(d) === value) || null : null),
    [value, claveDe, catalogo]
  );

  // El texto sigue al valor elegido mientras el usuario no esté escribiendo.
  useEffect(() => {
    if (!abierto) setTexto(elegido ? `${elegido.ciudad}, ${elegido.pais}` : "");
  }, [elegido, abierto]);

  const resultados = useMemo(
    () => (abierto ? buscar(catalogo, texto) : []),
    [abierto, texto, catalogo]
  );

  // Cerrar al hacer clic fuera.
  useEffect(() => {
    function fuera(e) {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  function elegir(d) {
    onChange?.(d);
    setTexto(d ? `${d.ciudad}, ${d.pais}` : "");
    setAbierto(false);
  }

  function onKey(e) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "Enter")) {
      setAbierto(true);
      setResaltado(0);
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
      const d = resultados[resaltado];
      if (d) elegir(d);
    } else if (e.key === "Escape") {
      setAbierto(false);
      setTexto(elegido ? `${elegido.ciudad}, ${elegido.pais}` : "");
    }
  }

  return (
    <div ref={cajaRef} className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        aria-label={ariaLabel || placeholder}
        value={texto}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setResaltado(0); }}
        onFocus={(e) => { setAbierto(true); setResaltado(0); try { e.target.select(); } catch {} }}
        onKeyDown={onKey}
        className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
      />

      {abierto && (
        <ul
          role="listbox"
          className="absolute left-0 right-0 top-full z-[6600] mt-1 max-h-[min(300px,45dvh)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          {permitirVacio && (
            <li
              role="option"
              aria-selected={false}
              onMouseDown={(e) => { e.preventDefault(); elegir(null); }}
              className="cursor-pointer px-3 py-2 text-[13.5px] italic text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-700"
            >
              {etiquetaVacio}
            </li>
          )}
          {resultados.map((d, i) => (
            <li
              key={`${d.ciudad}|${d.pais}`}
              role="option"
              aria-selected={i === resaltado}
              onMouseDown={(e) => { e.preventDefault(); elegir(d); }}
              onMouseEnter={() => setResaltado(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[13.5px] ${
                i === resaltado
                  ? "bg-marca-50 text-marca-900 dark:bg-marca-900/40 dark:text-marca-300"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <span className="text-base" aria-hidden>{d.bandera}</span>
              <span className="truncate font-semibold">{d.ciudad}</span>
              <span className="truncate text-slate-400">· {d.pais}</span>
            </li>
          ))}
          {resultados.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-slate-500 dark:text-slate-400">
              Ninguna ciudad coincide
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
