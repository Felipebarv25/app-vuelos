// Página estática por destino. SSG: pre-renderizada en build time para SEO.
// Una URL por ciudad del catálogo (~80) tipo /destino/madrid-espana.
//
// Contenido pensado para Google: H1 con keyword, descripción, datos clave
// (vuelo aprox, costo diario, días sugeridos), Top 10 lugares con foto y
// CTA al planificador real. Schema.org TouristDestination + BreadcrumbList.
import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { getDestinoPorSlug, TODOS_SLUGS, nombreDestino } from "@/lib/destinos";
import { datosSeoDe, faqsDe } from "@/lib/seoDestinos";
import { fotoCiudad } from "@/lib/fotoCiudad";
import FavToggle from "./FavToggle";

const SITIO = "https://app-vuelos-mfos.vercel.app";

// SSG: lista de slugs a pre-renderizar en build.
export async function generateStaticParams() {
  return TODOS_SLUGS.map((slug) => ({ slug }));
}

// Lee el JSON precalculado del FS (build time). Devuelve los Top N lugares.
async function topLugares(slug, n = 10) {
  try {
    const p = path.join(process.cwd(), "public", "lugares", `${slug}.json`);
    const raw = await fs.readFile(p, "utf8");
    const data = JSON.parse(raw);
    const els = (data.elements || []).filter((e) => e?.tags?.name).slice(0, n);
    return els.map((e) => ({
      nombre: e.tags.name,
      tipo: e.tags.tourism || e.tags.historic || e.tags.amenity || "",
      lat: e.lat,
      lon: e.lon,
    }));
  } catch {
    return [];
  }
}

// SEO: metadatos por destino.
export async function generateMetadata({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  if (!d) return { title: "Destino no encontrado · Viajero 360" };

  const nombre = nombreDestino(d);
  const title = `Viaje a ${d.ciudad} desde Colombia · Itinerario y precios`;
  const description =
    `Planea tu viaje a ${nombre}: vuelos desde Bogotá y Medellín desde US$${d.vuelo}, ` +
    `presupuesto diario aprox. US$${d.dia}, top lugares para visitar y ruta día a día. ` +
    `Itinerario gratis con Viajero 360.`;
  const url = `${SITIO}/destino/${slug}`;

  // OG image: Next genera la propia (1200x630) por convención de archivos
  // (opengraph-image.js). Si queremos usar la foto de Wikipedia, hay que
  // declararla explícitamente. Mantenemos la generada por Next para no
  // depender de Wikipedia en el metadata (más rápido de servir).
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "Viajero 360",
      type: "website",
      locale: "es_CO",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PaginaDestino({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  if (!d) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-3xl font-extrabold">Destino no encontrado</h1>
        <p className="mt-2 text-slate-600">
          <Link href="/" className="text-marca-600 underline">Volver al inicio</Link>
        </p>
      </main>
    );
  }

  const nombre = nombreDestino(d);
  const lugares = d.tienePrecalc ? await topLugares(slug, 10) : [];
  const diasSugeridos = d.region === "europa" || d.region === "asia" ? 10 : 7;
  const presupuestoSugerido = d.vuelo + d.dia * diasSugeridos;
  const seo = datosSeoDe(d);
  const faqs = faqsDe(d);
  const foto = await fotoCiudad(d.ciudad, d.pais);

  // Schema.org: ayuda a Google a entender que la página describe un destino.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: nombre,
    description: `Información de viaje a ${nombre} desde Colombia: vuelos, lugares para visitar y presupuesto sugerido.`,
    url: `${SITIO}/destino/${slug}`,
    geo: { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lon },
    address: { "@type": "PostalAddress", addressCountry: d.pais },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: SITIO },
      { "@type": "ListItem", position: 2, name: "Destinos", item: `${SITIO}/destino` },
      { "@type": "ListItem", position: 3, name: nombre, item: `${SITIO}/destino/${slug}` },
    ],
  };
  // FAQPage schema: Google muestra las FAQs como rich snippets bajo el resultado
  // (mucho más espacio en SERP y mejor CTR).
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <main className="bg-slate-50">
      {/* Schema.org para que Google entienda el contenido */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />

      {/* Breadcrumbs */}
      <nav className="mx-auto max-w-4xl px-6 pt-6 text-[13px] text-slate-500">
        <Link href="/" className="hover:text-marca-600">Inicio</Link>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-700">Destinos</span>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="font-semibold text-marca-700">{nombre}</span>
      </nav>

      {/* Hero: foto real de Wikipedia con overlay; fallback al gradiente si no
          se pudo conseguir foto. */}
      {foto?.url ? (
        <header className="relative h-[420px] w-full overflow-hidden sm:h-[480px]">
          <img
            src={foto.url}
            alt={`${d.ciudad}, ${d.pais}`}
            className="absolute inset-0 h-full w-full object-cover"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <FavToggle slug={slug} conFoto={true} />
          <div className="relative mx-auto flex h-full max-w-4xl flex-col justify-end px-6 pb-8 pt-12 text-white">
            <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <span className="text-3xl">{d.bandera}</span>
              <span>Viaja a {d.pais}</span>
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight drop-shadow-md sm:text-5xl">
              Viaje a {d.ciudad} desde Colombia
            </h1>
            <Link
              href={`/?destino=${slug}`}
              className="mt-4 inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105"
            >
              🗺️ Planear mi viaje a {d.ciudad}
            </Link>
          </div>
        </header>
      ) : (
        <header className="mx-auto max-w-4xl px-6 pb-6 pt-6">
          <div className="flex items-center gap-3 text-[14px] font-semibold uppercase tracking-[0.18em] text-marca-500">
            <span className="text-3xl">{d.bandera}</span>
            <span>Viaja a {d.pais}</span>
            <FavToggle slug={slug} />
          </div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-marca-900 sm:text-5xl">
            Viaje a {d.ciudad} desde Colombia
          </h1>
          <Link
            href={`/?destino=${slug}`}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-marca-500 to-marca-600 px-6 py-3.5 text-base font-bold text-white shadow-marca transition hover:brightness-105"
          >
            🗺️ Planear mi viaje a {d.ciudad}
          </Link>
        </header>
      )}

      {/* Descripción del destino debajo del hero */}
      <section className="mx-auto max-w-4xl px-6 pt-6">
        <p className="text-lg leading-relaxed text-slate-600">{seo.intro}</p>
      </section>

      {/* Datos clave */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato titulo="Vuelo i/v desde Colombia" valor={`US$ ${d.vuelo}`} sub="aprox." />
          <Dato titulo="Costo diario aprox." valor={`US$ ${d.dia}`} sub="por persona" />
          <Dato titulo="Días recomendados" valor={diasSugeridos} sub="ideal" />
          <Dato titulo="Presupuesto sugerido" valor={`US$ ${presupuestoSugerido}`} sub={`${diasSugeridos} días, 1 persona`} />
        </div>
      </section>

      {/* Mejor época + datos prácticos */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-marca-100 bg-marca-50/40 p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-marca-600">
              🗓️ Mejor época para viajar
            </div>
            <div className="mt-1.5 text-base leading-relaxed text-slate-700">
              {seo.mejorEpoca}
            </div>
            {seo.evitarEpoca && (
              <div className="mt-2 text-[13px] text-slate-500">
                <b className="text-amber-700">Evita:</b> {seo.evitarEpoca}.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              ℹ️ Datos prácticos
            </div>
            <dl className="mt-2 grid grid-cols-1 gap-1.5 text-[14px] text-slate-600">
              <div className="flex gap-2"><dt className="font-semibold text-slate-500">Idioma:</dt><dd>{seo.idioma}</dd></div>
              <div className="flex gap-2"><dt className="font-semibold text-slate-500">Moneda:</dt><dd>{seo.moneda}</dd></div>
            </dl>
            {seo.dato && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800">
                <b>💡 ¿Sabías que…?</b> {seo.dato}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Comida típica */}
      {seo.platos?.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">
            Comida típica de {d.ciudad}
          </h2>
          <p className="mt-1 text-slate-500">Platos que no te puedes perder.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {seo.platos.map((p) => (
              <span
                key={p}
                className="rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200"
              >
                🍽️ {p}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Top lugares */}
      {lugares.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">
            Los mejores lugares para visitar en {d.ciudad}
          </h2>
          <p className="mt-1 text-slate-500">
            Curados por relevancia (Wikipedia + visitas reales) y listos para tu itinerario.
          </p>
          <ol className="mt-4 space-y-2.5">
            {lugares.map((l, i) => (
              <li
                key={l.nombre + i}
                className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-suave"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marca-100 text-sm font-extrabold text-marca-700">
                  {i + 1}
                </span>
                <div>
                  <div className="font-bold text-marca-900">{l.nombre}</div>
                  {l.tipo && (
                    <div className="mt-0.5 text-[12.5px] capitalize text-slate-500">
                      {l.tipo.replace(/_/g, " ")}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* FAQ — rankea muy bien en Google */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">
          Preguntas frecuentes sobre viajar a {d.ciudad}
        </h2>
        <div className="mt-4 space-y-2.5">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-suave open:shadow-media"
            >
              <summary className="cursor-pointer list-none text-base font-bold text-marca-900">
                <span className="inline-flex items-center gap-2">
                  <span className="text-marca-600 transition group-open:rotate-90">▸</span>
                  {f.q}
                </span>
              </summary>
              <p className="mt-2 pl-5 text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Otros destinos relacionados (linking interno) */}
      <OtrosDestinos region={d.region} actualSlug={slug} />

      {/* CTA inferior */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 p-8 text-white shadow-media">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            ¿Listo para armar tu itinerario en {d.ciudad}?
          </h2>
          <p className="mt-2 max-w-2xl text-white/85">
            Te repartimos los lugares día por día, con tiempos reales de transporte,
            fotos, y precios en vivo de vuelos desde Colombia. Sin instalar nada.
          </p>
          <Link
            href={`/?destino=${slug}`}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105"
          >
            🗺️ Empezar mi viaje a {d.ciudad}
          </Link>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="mx-auto max-w-4xl px-6 pb-10 text-center text-[12px] text-slate-400">
        Datos de OpenStreetMap y Wikipedia · Precios orientativos en USD.
      </footer>
    </main>
  );
}

// Linking interno: muestra 6 destinos de la misma región (los más baratos)
// excluyendo el actual. Refuerza la autoridad del catálogo en Google.
import { DESTINOS_SEO } from "@/lib/destinos";

function OtrosDestinos({ region, actualSlug }) {
  const otros = DESTINOS_SEO.filter((x) => x.region === region && x.slug !== actualSlug)
    .sort((a, b) => a.vuelo - b.vuelo)
    .slice(0, 6);
  if (!otros.length) return null;
  return (
    <section className="mx-auto max-w-4xl px-6 py-6">
      <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">
        Otros destinos cercanos
      </h2>
      <p className="mt-1 text-slate-500">
        Si te gusta este destino, mira también:
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {otros.map((o) => (
          <Link
            key={o.slug}
            href={`/destino/${o.slug}`}
            className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-marca-200 hover:bg-marca-50"
          >
            <span className="text-2xl">{o.bandera}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold text-marca-900">{o.ciudad}</div>
              <div className="truncate text-[11.5px] text-slate-500">desde US$ {o.vuelo}</div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-4">
        <Link
          href="/destino"
          className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-marca-600 hover:underline"
        >
          Ver los 80 destinos →
        </Link>
      </div>
    </section>
  );
}

function Dato({ titulo, valor, sub }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {titulo}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-marca-900">{valor}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-slate-500">{sub}</div>}
    </div>
  );
}
