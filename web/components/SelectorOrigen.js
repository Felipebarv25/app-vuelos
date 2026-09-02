"use client";
// Combobox del PUNTO DE PARTIDA de /ofertas.
//
// Antes esto era solo una fila de chips con los paises que tenian rutas
// detectadas hoy. Servia como referencia rapida, pero no dejaba escribir: para
// salir de Madrid habia que reconocer el chip entre diez, y si el pais no
// estaba escaneado no aparecia en ninguna parte.
//
// Ahora se puede escribir (pais, ciudad o codigo IATA) Y se conservan los
// chips populares debajo, que es como el usuario lo pidio: "un menu donde le
// pueda escribir pero que tambien tenga puntos de partida famosos como
// referencia, asi como ya esta".
//
// El buscador cubre los ~60 paises de PAISES_ORIGEN, no solo los escaneados,
// pero NUNCA finge cobertura: cada opcion dice si tiene ofertas ya detectadas
// o si habria que buscarla en vivo.
import { useEffect, useMemo, useRef, useState } from "react";
import Bandera from "./Bandera";
import { PAISES_ORIGEN } from "@/lib/paisesOrigen";
import { aliasBusqueda, normalizar } from "@/lib/paisesNombres";

const norm = (s) => normalizar(s || "");

// Indice de busqueda: se arma una vez al importar. Cada pais aporta una fila
// propia y una fila por hub, para que "Medellin", "MDE" y "Colombia" lleven
// todas a algo util.
const CATALOGO = (() => {
  const filas = [];
  for (const [cc, info] of Object.entries(PAISES_ORIGEN || {})) {
    const aliasPais = [...new Set([...aliasBusqueda(cc), norm(info.nombre)])];
    filas.push({
      tipo: "pais",
      clave: cc,
      cc,
      titulo: info.nombre,
      alias: aliasPais,
    });
    for (const h of info.hubs || []) {
      filas.push({
        tipo: "hub",
        clave: h.iata,
        cc,
        titulo: h.ciudad,
        sub: info.nombre,
        // La ciudad se busca por nombre y por IATA; el pais tambien, para que
        // escribir "colombia" ofrezca sus ciudades ademas del pais entero.
        alias: [norm(h.ciudad), h.iata.toLowerCase(), ...aliasPais],
      });
    }
  }
  return filas;
})();

// Calidad de coincidencia: 3 exacta, 2 empieza por, 1 contiene, null sin match.
function calidad(fila, q) {
  let mejor = null;
  for (const a of fila.alias) {
    if (a === q) return 3;
    if (a.startsWith(q)) mejor = Math.max(mejor ?? 0, 2);
    else if (a.includes(q)) mejor = Math.max(mejor ?? 0, 1);
  }
  return mejor;
}

export default function SelectorOrigen({
  value = "todos",
  onChange,
  paisesConRutas = [],
  rutasPorHub = {},
  origenes = {},
  t = (k) => k,
  className = "",
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const cajaRef = useRef(null);
  const listaRef = useRef(null);

  // Cuantas ofertas tiene hoy cada opcion. 0 = habria que buscarla en vivo.
  const conteo = useMemo(() => {
    const m = {};
    for (const p of paisesConRutas) m[p.cc] = p.n;
    for (const [iata, n] of Object.entries(rutasPorHub || {})) m[iata] = n;
    return m;
  }, [paisesConRutas, rutasPorHub]);

  const opciones = useMemo(() => {
    const q = norm(texto);
    const puntuadas = [];
    for (const f of CATALOGO) {
      const c = q ? calidad(f, q) : 1;
      if (c === null) continue;
      puntuadas.push({ ...f, _q: c, _n: conteo[f.clave] || 0 });
    }
    puntuadas.sort((a, b) => {
      if (b._q !== a._q) return b._q - a._q;                 // mejor coincidencia
      const ta = a._n > 0 ? 1 : 0;
      const tb = b._n > 0 ? 1 : 0;
      if (ta !== tb) return tb - ta;                          // con ofertas primero
      if (b._n !== a._n) return b._n - a._n;                  // mas ofertas primero
      if (a.tipo !== b.tipo) return a.tipo === "pais" ? -1 : 1;
      return a.titulo.localeCompare(b.titulo, "es");
    });
    return puntuadas.slice(0, 40);
  }, [texto, conteo]);

  // Etiqueta del valor elegido, para mostrarla cuando el campo no esta en uso.
  const etiquetaActual = useMemo(() => {
    if (!value || value === "todos") return "";
    const f = CATALOGO.find((x) => x.clave === value);
    if (!f) return origenes[value] || value;
    return f.tipo === "hub" ? `${origenes[f.clave] || f.titulo}, ${f.sub}` : f.titulo;
  }, [value, origenes]);

  useEffect(() => {
    if (!abierto) setTexto("");
  }, [abierto]);

  useEffect(() => {
    function fuera(e) {
      if (cajaRef.current && !cajaRef.current.contains(e.target)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  // Mantener a la vista la fila resaltada al navegar con el teclado.
  useEffect(() => {
    const li = listaRef.current?.children?.[resaltado + 1];
    if (li?.scrollIntoView) li.scrollIntoView({ block: "nearest" });
  }, [resaltado, abierto]);

  function elegir(clave) {
    onChange?.(clave);
    setAbierto(false);
    setTexto("");
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
      setResaltado((i) => Math.min(i + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setResaltado((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const f = opciones[resaltado];
      if (f) elegir(f.clave);
    } else if (e.key === "Escape") {
      setAbierto(false);
      setTexto("");
    }
  }

  const banderaActual = value && value !== "todos"
    ? CATALOGO.find((x) => x.clave === value)?.cc || ""
    : "";

  return (
    <div ref={cajaRef} className={`relative ${className}`}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-slate-400">
          {!abierto && banderaActual ? (
            <Bandera cc={banderaActual} size={18} />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          )}
        </span>
        <input
          type="text"
          role="combobox"
          aria-expanded={abierto}
          aria-autocomplete="list"
          aria-label={t("origenLabel")}
          value={abierto ? texto : etiquetaActual}
          placeholder={abierto || value === "todos" ? t("origenPlaceholder") : t("origenTodos")}
          autoComplete="off"
          onChange={(e) => { setTexto(e.target.value); setAbierto(true); setResaltado(0); }}
          onFocus={() => { setAbierto(true); setTexto(""); setResaltado(0); }}
          onKeyDown={onKey}
          className="w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-10 pr-3 text-[16px] font-semibold text-marca-900 outline-none focus:border-marca-400 sm:text-[14px] dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
        />
      </div>

      {abierto && (
        <ul
          ref={listaRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-[6600] mt-1 max-h-[min(320px,45dvh)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-800"
        >
          <li
            role="option"
            aria-selected={value === "todos"}
            onMouseDown={(e) => { e.preventDefault(); elegir("todos"); }}
            className="cursor-pointer border-b border-slate-100 px-3 py-2 text-[13.5px] font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {t("origenTodos")}
          </li>
          {opciones.map((f, i) => (
            <li
              key={`${f.tipo}-${f.clave}`}
              role="option"
              aria-selected={f.clave === value}
              onMouseDown={(e) => { e.preventDefault(); elegir(f.clave); }}
              onMouseEnter={() => setResaltado(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-[13.5px] ${
                i === resaltado
                  ? "bg-marca-50 text-marca-900 dark:bg-marca-900/40 dark:text-marca-200"
                  : "text-slate-700 dark:text-slate-200"
              }`}
            >
              <Bandera cc={f.cc} size={18} />
              <span className={`truncate ${f.tipo === "pais" ? "font-bold" : "font-semibold"}`}>
                {f.tipo === "hub" ? origenes[f.clave] || f.titulo : f.titulo}
              </span>
              {f.tipo === "hub" && (
                <>
                  <span className="shrink-0 font-mono text-[11px] text-slate-400">{f.clave}</span>
                  <span className="truncate text-slate-400">· {f.sub}</span>
                </>
              )}
              <span className="ml-auto shrink-0 text-[11px] font-semibold">
                {f._n > 0 ? (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                    {f._n === 1 ? t("origenUnaOferta") : t("origenNOfertas").replace("{n}", f._n)}
                  </span>
                ) : (
                  <span className="text-slate-400">{t("origenEnVivo")}</span>
                )}
              </span>
            </li>
          ))}
          {opciones.length === 0 && (
            <li className="px-3 py-2 text-[13px] text-slate-500 dark:text-slate-400">
              {t("origenSinResultados")}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
