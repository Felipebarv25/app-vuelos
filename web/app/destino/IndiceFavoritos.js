"use client";
// Sección "Mis favoritos" que aparece arriba del catálogo si el usuario tiene
// destinos guardados. Sincroniza con la nube si hay sesión Google, sino con
// localStorage. Mientras no haya favs, no muestra nada (no ensucia el index).
import Link from "next/link";
import { useApp } from "@/lib/AppContext";
import { useFavoritos } from "@/lib/favoritos";
import { DESTINOS_SEO } from "@/lib/destinos";
import { Icono } from "@/components/Icono";

export default function IndiceFavoritos() {
  const { usuario } = useApp();
  const { slugs, listo } = useFavoritos(usuario);

  if (!listo || slugs.length === 0) return null;

  const favs = slugs
    .map((s) => DESTINOS_SEO.find((d) => d.slug === s))
    .filter(Boolean);

  if (favs.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-4">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-rose-100 p-2 text-rose-600">
          <Icono nombre="heart" size={16} />
        </span>
        <h2 className="text-lg font-extrabold text-marca-900">
          Tus favoritos
          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 align-middle text-[11px] font-bold text-rose-700">
            {favs.length}
          </span>
        </h2>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {favs.map((d) => (
          <Link
            key={d.slug}
            href={`/destino/${d.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5 transition hover:border-rose-200 hover:bg-rose-50"
          >
            <span className="text-2xl">{d.bandera}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14.5px] font-extrabold text-marca-900">
                {d.ciudad}
              </div>
              <div className="truncate text-[12px] text-slate-500">{d.pais}</div>
            </div>
            <div className="text-[12px] font-bold text-marca-700">US$ {d.vuelo}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
