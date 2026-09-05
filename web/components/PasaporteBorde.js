"use client";
// El pasaporte, asomado al borde de la portada.
//
// POR QUE UNA CINTA Y NO LA TARJETA
//
// La tarjeta del pasaporte ocupaba media pantalla en el home para contar algo
// que casi siempre cabe en cinco banderas. Aqui se queda solo el ASOMO: una
// cinta pegada al borde derecho con las banderas de lo que ya conociste, y
// una flecha que despliega el mapa entero cuando de verdad quieres mirarlo.
//
// Es la misma idea de un cajon: se ve el tirador todo el tiempo y el
// contenido solo cuando hace falta. Y en el borde tiene otra ventaja — no
// compite con nada: no empuja el hero hacia abajo ni se lleva el sitio de lo
// que el viajero vino a hacer.
//
// POR QUE VUELVE A LEER AL CERRAR
//
// Dentro del panel se puede anadir un pais o una ciudad, y eso lo guarda el
// componente Pasaporte por su cuenta. La cinta no se entera, asi que al
// cerrar se relee. Es una peticion mas, solo cuando el panel se abrio.

import { useEffect, useState } from "react";
import Bandera from "./Bandera";
import { Icono } from "./Icono";
import { nombrePaisMostrar } from "@/lib/paisesNombres";
import { cargarPasaporte } from "@/lib/pasaporte";
import Pasaporte from "./Pasaporte";

// Cuantas banderas se ven antes del "+N". Ocho es lo que cabe sin que la
// cinta llegue a la mitad de la pantalla en un movil de 667 px de alto.
const TOPE = 8;

export default function PasaporteBorde({ t, lang = "es", usuario = null }) {
  const [paises, setPaises] = useState(null); // null = cargando
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    let vivo = true;
    cargarPasaporte(usuario).then((r) => {
      if (vivo) setPaises(r.paises);
    });
    return () => {
      vivo = false;
    };
  }, [usuario]);

  // Escape cierra, como cualquier panel.
  useEffect(() => {
    if (!abierto) return;
    const onTecla = (e) => {
      if (e.key === "Escape") cerrar();
    };
    document.addEventListener("keydown", onTecla);
    return () => document.removeEventListener("keydown", onTecla);
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    cargarPasaporte(usuario).then((r) => setPaises(r.paises));
  }

  if (paises === null) return null; // sin parpadeo: o hay datos o no hay cinta

  // Mismo orden que dentro de la tarjeta: por fecha de registro y, a igualdad,
  // alfabetico. Si cambiara aqui, las banderas bailarian al abrir el panel.
  const orden = Object.entries(paises)
    .sort(
      (a, b) =>
        (a[1].desde || "").localeCompare(b[1].desde || "") ||
        nombrePaisMostrar(a[0], lang).localeCompare(nombrePaisMostrar(b[0], lang))
    )
    .map(([cc]) => cc);

  const n = orden.length;
  const visibles = orden.slice(0, TOPE);
  const resto = n - visibles.length;

  return (
    <>
      {/* LA CINTA. Pegada al borde, sin margen a la derecha: parte de la
          gracia es que se vea CORTADA por el filo de la pantalla, que es lo
          que promete que hay algo mas al abrirla. */}
      <div className="absolute right-0 top-24 z-[900] print:hidden lg:top-28">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label={`${t("paisesTit")} — ${n}`}
          aria-expanded={abierto}
          className="group flex flex-col items-center gap-2 rounded-l-2xl border border-r-0 border-white/25 bg-black/30 py-3 pl-2.5 pr-2 text-white shadow-lg backdrop-blur-md transition hover:bg-black/45"
        >
          <span className="flex items-center gap-1 text-[11px] font-extrabold leading-none tabular-nums">
            <Icono nombre="map" size={12} />
            {n}
          </span>

          {n === 0 ? (
            // Sin paises todavia: la cinta tiene que INVITAR, no desaparecer.
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
              <Icono nombre="plus" size={14} />
            </span>
          ) : (
            <span className="flex flex-col gap-1.5">
              {visibles.map((cc) => (
                <span key={cc} title={nombrePaisMostrar(cc, lang)} className="block">
                  <Bandera cc={cc} size={20} />
                </span>
              ))}
            </span>
          )}

          {resto > 0 && (
            <span className="text-[10px] font-bold leading-none text-white/75">+{resto}</span>
          )}

          {/* La flecha: un chevron girado. Se separa un poco al pasar por
              encima, que es la manera barata de decir "esto se abre". */}
          <span className="transition-transform group-hover:-translate-x-0.5">
            <Icono nombre="chevronDown" size={16} className="rotate-90" />
          </span>
        </button>
      </div>

      {/* EL PANEL: la tarjeta completa, tal cual, sin una segunda version que
          mantener. */}
      {abierto && (
        <div
          className="fixed inset-0 z-[3000] overflow-y-auto bg-slate-900/70 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={t("paisesTit")}
          onClick={cerrar}
        >
          <div
            className="animar-subir mx-auto w-full max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={cerrar}
                aria-label={t("cerrar")}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/30"
              >
                <Icono nombre="x" size={18} />
              </button>
            </div>
            {/* Pasaporte trae su propio margen inferior (es una seccion del
                home); dentro del panel sobra. */}
            <div className="[&>section]:mb-0">
              <Pasaporte t={t} lang={lang} usuario={usuario} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
