// /en/destino — English destinations index. SSG: lists all ~80 cities with
// flag, name and a quick flight estimate. Same data as the Spanish index,
// just localized labels.
import Link from "next/link";
import { DESTINOS_SEO } from "@/lib/destinos";
import NavTop from "@/components/NavTop";

const SITIO = "https://anduve-app.vercel.app";

export const metadata = {
  title: "All destinations · Anduve",
  description:
    "Explore 80 destinations with rough flight prices and suggested daily budget. Plan your trip in 5 minutes.",
  alternates: {
    canonical: `${SITIO}/en/destino`,
    languages: {
      es: `${SITIO}/destino`,
      en: `${SITIO}/en/destino`,
      "x-default": `${SITIO}/destino`,
    },
  },
};

export default function DestinosIndexEn() {
  const porRegion = DESTINOS_SEO.reduce((acc, d) => {
    if (!acc[d.region]) acc[d.region] = [];
    acc[d.region].push(d);
    return acc;
  }, {});
  const ordenRegiones = [
    ["sudamerica", "South America"],
    ["norteamerica", "North & Central America"],
    ["europa", "Europe"],
    ["asia", "Asia"],
    ["africa", "Africa"],
    ["oceania", "Oceania"],
  ];

  return (
    <main className="bg-slate-50 pb-12">
      {/* Header con el logo: esta landing SEO se veia sin marca arriba a la
          izquierda y sin salida al resto de la app. */}
      <NavTop active="destinos" />

      <header className="mx-auto max-w-6xl px-6 pt-10">
        <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-marca-500">
          Catalog
        </div>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-marca-900 sm:text-5xl">
          All destinations
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          {DESTINOS_SEO.length} cities with rough flight prices and suggested daily budget,
          ready to plan your trip.
        </p>
        <div className="mt-3 text-[12px] text-slate-500">
          <Link href="/destino" className="underline hover:text-marca-600">🇪🇸 Ver en español</Link>
        </div>
      </header>

      {ordenRegiones.map(([key, label]) => {
        const lista = (porRegion[key] || []).sort((a, b) => a.vuelo - b.vuelo);
        if (!lista.length) return null;
        return (
          <section key={key} className="mx-auto max-w-6xl px-6 py-6">
            <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">{label}</h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {lista.map((d) => (
                <Link
                  key={d.slug}
                  href={`/en/destino/${d.slug}`}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-marca-200 hover:bg-marca-50"
                >
                  <span className="text-2xl">{d.bandera}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13.5px] font-bold text-marca-900">{d.ciudad}</div>
                    <div className="truncate text-[11.5px] text-slate-500">from US$ {d.vuelo}</div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
