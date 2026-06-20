// Página índice /destino: cataloga los 80+ destinos del SEO agrupados por
// región, con filtros y enlace directo a cada landing. Fortalece el linking
// interno (todas las /destino/<slug> son alcanzables desde una página) y
// mejora rankeo en Google ("dónde viajar barato", "destinos baratos").
import Link from "next/link";
import { DESTINOS_SEO } from "@/lib/destinos";
import IndiceFavoritos from "./IndiceFavoritos";

const SITIO = "https://app-vuelos-mfos.vercel.app";

const REGIONES_META = {
  sudamerica: { titulo: "Sudamérica", emoji: "🌎" },
  norteamerica: { titulo: "Norte y Centroamérica", emoji: "🌎" },
  europa: { titulo: "Europa", emoji: "🇪🇺" },
  asia: { titulo: "Asia", emoji: "🌏" },
  africa: { titulo: "África", emoji: "🌍" },
  oceania: { titulo: "Oceanía", emoji: "🌏" },
};

export const metadata = {
  title: "Destinos internacionales · Itinerarios, vuelos y presupuesto · Viajero 360",
  description:
    "80 destinos en Sudamérica, Europa, Asia, África y Oceanía con vuelo i/v aproximado, presupuesto diario y los mejores lugares para visitar. Planea tu viaje gratis.",
  alternates: { canonical: `${SITIO}/destino` },
  openGraph: {
    title: "Destinos internacionales · Itinerarios y presupuesto · Viajero 360",
    description:
      "Catálogo de 80 destinos con vuelo i/v aproximado, presupuesto sugerido y top lugares.",
    url: `${SITIO}/destino`,
    siteName: "Viajero 360",
    type: "website",
    locale: "es",
  },
};

export default function IndiceDestinos() {
  // Agrupar por región y ordenar dentro por vuelo asc (más baratos arriba).
  const porRegion = {};
  for (const d of DESTINOS_SEO) {
    if (!porRegion[d.region]) porRegion[d.region] = [];
    porRegion[d.region].push(d);
  }
  for (const r of Object.keys(porRegion)) {
    porRegion[r].sort((a, b) => a.vuelo - b.vuelo);
  }

  const ordenRegiones = ["sudamerica", "norteamerica", "europa", "asia", "africa", "oceania"];
  const total = DESTINOS_SEO.length;

  // CollectionPage + ItemList schema para que Google entienda el catálogo.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Destinos internacionales",
    url: `${SITIO}/destino`,
    description:
      "Catálogo de destinos internacionales con presupuesto, vuelo i/v aproximado y lugares destacados.",
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: total,
      itemListElement: DESTINOS_SEO.slice(0, 30).map((d, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITIO}/destino/${d.slug}`,
        name: `${d.ciudad}, ${d.pais}`,
      })),
    },
  };

  return (
    <main className="bg-slate-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <IndiceFavoritos />

      <nav className="mx-auto max-w-6xl px-6 pt-6 text-[13px] text-slate-500">
        <Link href="/" className="hover:text-marca-600">Inicio</Link>
        <span className="mx-1.5 text-slate-300 dark:text-slate-600">/</span>
        <span className="font-semibold text-marca-700 dark:text-marca-300">Destinos</span>
      </nav>

      <header className="mx-auto max-w-6xl px-6 pb-2 pt-6">
        <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-marca-500 dark:text-marca-400">
          Catálogo
        </div>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300 sm:text-5xl">
          {total} destinos para tu próximo viaje
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-slate-600">
          Vuelo i/v aproximado, presupuesto diario y los mejores
          lugares para visitar. Toca cualquier destino para ver el itinerario completo.
        </p>
        <Link
          href="/comparar"
          className="mt-4 inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-marca-200 bg-white px-4 py-2 text-[13.5px] font-bold text-marca-700 transition hover:bg-marca-50 dark:border-marca-800 dark:text-marca-300 dark:hover:bg-marca-900/30"
        >
          ⚖️ Comparar destinos lado a lado →
        </Link>
      </header>

      {/* Chips de salto a cada región (anchor links) */}
      <div className="mx-auto max-w-6xl overflow-x-auto px-6 py-4">
        <div className="flex gap-2">
          {ordenRegiones
            .filter((r) => porRegion[r]?.length)
            .map((r) => {
              const meta = REGIONES_META[r];
              return (
                <a
                  key={r}
                  href={`#${r}`}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-[13.5px] font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:ring-marca-300 dark:ring-slate-700 dark:hover:ring-marca-600"
                >
                  <span>{meta.emoji}</span> {meta.titulo}
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
                    {porRegion[r].length}
                  </span>
                </a>
              );
            })}
        </div>
      </div>

      {/* Secciones por región */}
      {ordenRegiones
        .filter((r) => porRegion[r]?.length)
        .map((r) => {
          const meta = REGIONES_META[r];
          return (
            <section key={r} id={r} className="mx-auto max-w-6xl px-6 py-6">
              <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
                <span>{meta.emoji}</span> {meta.titulo}
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {porRegion[r].map((d) => (
                  <Link
                    key={d.slug}
                    href={`/destino/${d.slug}`}
                    className="group flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-suave transition hover:-translate-y-0.5 hover:shadow-media"
                  >
                    <span className="text-3xl">{d.bandera}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-extrabold text-marca-900 group-hover:text-marca-600 dark:text-marca-300 dark:group-hover:text-marca-400">
                        {d.ciudad}
                      </div>
                      <div className="truncate text-[12.5px] text-slate-500">{d.pais}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] font-semibold text-slate-400">desde</div>
                      <div className="text-[14px] font-extrabold text-marca-700 dark:text-marca-300">US$ {d.vuelo}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}

      {/* CTA final */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 p-8 text-white shadow-media">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            ¿No sabes adónde ir?
          </h2>
          <p className="mt-2 max-w-2xl text-white/85">
            Cuéntanos tu presupuesto y te mostramos los destinos que caben con
            vuelo, hospedaje y comida incluidos.
          </p>
          <Link
            href="/?presupuesto=1"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105"
          >
            💰 Ver destinos por presupuesto
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-[12px] text-slate-400">
        Datos de OpenStreetMap y Wikipedia · Precios orientativos en USD.
      </footer>
    </main>
  );
}
