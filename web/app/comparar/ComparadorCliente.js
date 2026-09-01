"use client";
// Comparador interactivo: 3 selects con todos los destinos del catálogo y una
// tabla horizontal con las filas clave (vuelo, costo diario, presupuesto 7d/14d,
// región, idioma, moneda, comida típica). Highlight verde para el mejor valor
// de cada fila (más barato, más días, etc.).
import { useMemo, useState } from "react";
import Link from "next/link";
import { DESTINOS_SEO, nombreDestino } from "@/lib/destinos";
import { datosSeoDe } from "@/lib/seoDestinos";
import { Icono } from "@/components/Icono";
import SelectorCiudad from "@/components/SelectorCiudad";

const SLOTS = 3;

// Lista pre-ordenada para los selects (alfabético por nombre legible).
const DESTINOS_ORDEN = [...DESTINOS_SEO].sort((a, b) =>
  a.ciudad.localeCompare(b.ciudad, "es")
);

// Defaults inteligentes: las 3 ciudades mas baratas del catalogo por costo total
// de un viaje de 7 dias (vuelo + 7 dias de gasto). Mucho mas util al aterrizar
// que un Madrid/Tokio/Mexico hard-codeado, y le habla a un viajero colombiano
// con presupuesto. Se calcula una vez al cargar el modulo.
const DEFAULTS_MAS_BARATOS = (() => {
  const conCosto = DESTINOS_SEO.map((d) => ({ slug: d.slug, total: d.vuelo + d.dia * 7 }));
  conCosto.sort((a, b) => a.total - b.total);
  return conCosto.slice(0, 3).map((x) => x.slug);
})();

export default function ComparadorCliente() {
  // Slug por slot. Defaults dinamicos: las 3 ciudades mas baratas para 7 dias.
  const [slots, setSlots] = useState(DEFAULTS_MAS_BARATOS);

  const destinos = useMemo(
    () => slots.map((s) => DESTINOS_SEO.find((d) => d.slug === s) || null),
    [slots]
  );

  // Datos enriquecidos por slot (para filas como idioma, moneda, comida).
  const seos = useMemo(() => destinos.map((d) => (d ? datosSeoDe(d) : null)), [destinos]);

  // Métricas calculadas para destacar el mejor por fila.
  const presup7 = destinos.map((d) => (d ? d.vuelo + d.dia * 7 : null));
  const presup14 = destinos.map((d) => (d ? d.vuelo + d.dia * 14 : null));

  const minDe = (arr) => {
    const validos = arr.filter((v) => v != null);
    return validos.length ? Math.min(...validos) : null;
  };

  const minVuelo = minDe(destinos.map((d) => d?.vuelo));
  const minDia = minDe(destinos.map((d) => d?.dia));
  const min7 = minDe(presup7);
  const min14 = minDe(presup14);

  function cambiarSlot(idx, slug) {
    setSlots((s) => s.map((x, i) => (i === idx ? slug : x)));
  }

  return (
    <section className="mx-auto mt-6 max-w-6xl px-6">
      {/* Selectores */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {slots.map((slug, i) => {
          const d = destinos[i];
          return (
            <div key={i} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
              <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Destino {i + 1}
              </label>
              {/* Antes era un <select> con los 207 destinos seguidos, y había
                  TRES en fila: para llegar a "Oporto" tocaba bajar a mano por
                  toda la lista. Ahora se escribe y filtra. */}
              <SelectorCiudad
                className="mt-1.5"
                catalogo={DESTINOS_ORDEN}
                value={slug}
                claveDe={(d) => d.slug}
                onChange={(d) => cambiarSlot(i, d ? d.slug : "")}
                permitirVacio
                placeholder="Escribe una ciudad…"
                ariaLabel={`Destino ${i + 1}`}
              />
              {d && (
                <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-marca-50 p-3 dark:bg-marca-900/30">
                  <span className="text-3xl">{d.bandera}</span>
                  <div className="min-w-0">
                    <div className="truncate text-base font-extrabold text-marca-900 dark:text-marca-300">
                      {d.ciudad}
                    </div>
                    <div className="truncate text-[12px] text-slate-500">{d.pais}</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabla horizontal */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-suave">
        <table className="w-full text-left text-[14px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 dark:bg-slate-800/60">
              <th className="px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                Criterio
              </th>
              {destinos.map((d, i) => (
                <th
                  key={i}
                  className="px-4 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500"
                >
                  {d ? nombreDestino(d) : `Destino ${i + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-slate-700">
            <Fila
              titulo="Vuelo i/v aprox."
              valores={destinos.map((d) => (d ? `US$ ${d.vuelo}` : "—"))}
              destacar={destinos.map((d) => d?.vuelo === minVuelo && minVuelo != null)}
            />
            <Fila
              titulo="Costo diario aproximado"
              valores={destinos.map((d) => (d ? `US$ ${d.dia}` : "—"))}
              destacar={destinos.map((d) => d?.dia === minDia && minDia != null)}
            />
            <Fila
              titulo="Presupuesto 7 días"
              valores={destinos.map((_, i) => (presup7[i] != null ? `US$ ${presup7[i]}` : "—"))}
              destacar={presup7.map((v) => v === min7 && min7 != null)}
            />
            <Fila
              titulo="Presupuesto 14 días"
              valores={destinos.map((_, i) => (presup14[i] != null ? `US$ ${presup14[i]}` : "—"))}
              destacar={presup14.map((v) => v === min14 && min14 != null)}
            />
            <Fila
              titulo="Región"
              valores={destinos.map((d) => (d ? regionNombre(d.region) : "—"))}
            />
            <Fila
              titulo="Idioma"
              valores={seos.map((s) => s?.idioma || "—")}
            />
            <Fila
              titulo="Moneda"
              valores={seos.map((s) => s?.moneda || "—")}
            />
            <Fila
              titulo="Mejor época"
              valores={seos.map((s) => s?.mejorEpoca || "—")}
            />
            <Fila
              titulo="Comida típica"
              valores={seos.map((s) =>
                s?.platos?.length ? s.platos.slice(0, 4).join(" · ") : "—"
              )}
            />
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-100">
              <td className="px-4 py-3"></td>
              {destinos.map((d, i) => (
                <td key={i} className="px-4 py-3">
                  {d ? (
                    <Link
                      href={`/destino/${d.slug}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-marca-600 px-3 py-2 text-[12.5px] font-bold text-white shadow-marca transition hover:brightness-105"
                    >
                      <Icono nombre="map" size={13} /> Ver detalle
                    </Link>
                  ) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        Valores orientativos en USD para un turista de gama media. Vuelos
        aproximados desde Bogotá/Medellín; confirma el precio real en cada
        página de destino.
      </p>
    </section>
  );
}

function Fila({ titulo, valores, destacar }) {
  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-3 font-semibold text-slate-500">{titulo}</td>
      {valores.map((v, i) => (
        <td
          key={i}
          className={`px-4 py-3 ${destacar?.[i] ? "bg-emerald-50 font-bold text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300" : ""}`}
        >
          {v}
          {destacar?.[i] && (
            <span className="ml-1 text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              · mejor
            </span>
          )}
        </td>
      ))}
    </tr>
  );
}

function regionNombre(r) {
  return r === "sudamerica" ? "Sudamérica"
    : r === "norteamerica" ? "Norte y Centroamérica"
    : r === "europa" ? "Europa"
    : r === "asia" ? "Asia"
    : r === "africa" ? "África"
    : r === "oceania" ? "Oceanía"
    : "—";
}
