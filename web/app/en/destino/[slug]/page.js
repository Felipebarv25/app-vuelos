// English version of the destination landing page. SEO i18n with hreflang:
// the Spanish (default) and English versions cross-link to each other so
// Google can serve the right language to each user.
//
// Reuses the same data helpers (datosSeoDe, faqsDe) with lang="en" — the SEO
// content has been professionally translated in lib/seoDestinos.js.

import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { getDestinoPorSlug, TODOS_SLUGS, nombreDestino } from "@/lib/destinos";
import { datosSeoDe, faqsDe } from "@/lib/seoDestinos";
import { fotoCiudad } from "@/lib/fotoCiudad";
import { preciosPorMes } from "@/lib/historialPrecios";
import { iataDe } from "@/lib/iataCiudades";
import { linkTours, linkHoteles, linkVuelos } from "@/lib/afiliados";
import FavToggle from "../../../destino/[slug]/FavToggle";

const SITIO = "https://anduve-app.vercel.app";

// SSG: pre-render the same 80 destinations as Spanish.
export async function generateStaticParams() {
  return TODOS_SLUGS.map((slug) => ({ slug }));
}

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

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  if (!d) return { title: "Destination not found · Anduve" };

  const nombre = nombreDestino(d);
  const title = `Travel to ${d.ciudad} · Itinerary, prices and tips`;
  const description =
    `Plan your trip to ${nombre}: flights from US$${d.vuelo}, ~US$${d.dia}/day average daily ` +
    `budget, top places to visit and day-by-day route. Free planner with Anduve.`;
  const url = `${SITIO}/en/destino/${slug}`;
  const urlEs = `${SITIO}/destino/${slug}`;

  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        "es-CO": urlEs,
        "es": urlEs,
        "en": url,
        "en-US": url,
        "pt": `${SITIO}/pt/destino/${slug}`,
        "pt-BR": `${SITIO}/pt/destino/${slug}`,
        "fr": `${SITIO}/fr/destino/${slug}`,
        "fr-FR": `${SITIO}/fr/destino/${slug}`,
        "x-default": urlEs, // default goes to Spanish (primary market today)
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Anduve",
      type: "website",
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DestinationPage({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  if (!d) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="text-3xl font-extrabold">Destination not found</h1>
        <p className="mt-2 text-slate-600">
          <Link href="/en" className="text-marca-600 underline">Back to home</Link>
        </p>
      </main>
    );
  }

  const nombre = nombreDestino(d);
  const lugares = d.tienePrecalc ? await topLugares(slug, 10) : [];
  const diasSugeridos = d.region === "europa" || d.region === "asia" ? 10 : 7;
  const presupuestoSugerido = d.vuelo + d.dia * diasSugeridos;
  const seo = datosSeoDe(d, "en");
  const faqs = faqsDe(d, "en");
  const foto = await fotoCiudad(d.ciudad, d.pais);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: nombre,
    description: `Travel information for ${nombre}: flights, places to visit and suggested budget.`,
    url: `${SITIO}/en/destino/${slug}`,
    geo: { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lon },
    address: { "@type": "PostalAddress", addressCountry: d.pais },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITIO}/en` },
      { "@type": "ListItem", position: 2, name: "Destinations", item: `${SITIO}/en/destino` },
      { "@type": "ListItem", position: 3, name: nombre, item: `${SITIO}/en/destino/${slug}` },
    ],
  };
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* Language switcher: visible link to ES version for users who want it */}
      <nav className="mx-auto max-w-4xl px-6 pt-6 text-[13px] text-slate-500">
        <Link href="/en" className="hover:text-marca-600">Home</Link>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-700">Destinations</span>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="font-semibold text-marca-700">{nombre}</span>
        <span className="float-right space-x-2">
          <Link href={`/destino/${slug}`} className="text-[12px] underline hover:text-marca-600">🇪🇸 ES</Link>
          <Link href={`/pt/destino/${slug}`} className="text-[12px] underline hover:text-marca-600">🇧🇷 PT</Link>
          <Link href={`/fr/destino/${slug}`} className="text-[12px] underline hover:text-marca-600">🇫🇷 FR</Link>
        </span>
      </nav>

      {/* Hero */}
      {foto?.url ? (
        <header className="relative h-[420px] w-full overflow-hidden sm:h-[480px]">
          <img src={foto.url} alt={`${d.ciudad}, ${d.pais}`} className="absolute inset-0 h-full w-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <FavToggle slug={slug} conFoto={true} />
          <div className="relative mx-auto flex h-full max-w-4xl flex-col justify-end px-6 pb-8 pt-12 text-white">
            <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <span className="text-3xl">{d.bandera}</span>
              <span>Travel to {d.pais}</span>
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight drop-shadow-md sm:text-5xl">
              Travel to {d.ciudad}
            </h1>
            <Link href={`/?destino=${slug}`} className="mt-4 inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105">
              🗺️ Plan my trip to {d.ciudad}
            </Link>
          </div>
        </header>
      ) : (
        <header className="mx-auto max-w-4xl px-6 pb-6 pt-6">
          <div className="flex items-center gap-3 text-[14px] font-semibold uppercase tracking-[0.18em] text-marca-500">
            <span className="text-3xl">{d.bandera}</span>
            <span>Travel to {d.pais}</span>
            <FavToggle slug={slug} />
          </div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-marca-900 sm:text-5xl">
            Travel to {d.ciudad}
          </h1>
          <Link href={`/?destino=${slug}`} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-marca-500 to-marca-600 px-6 py-3.5 text-base font-bold text-white shadow-marca transition hover:brightness-105">
            🗺️ Plan my trip to {d.ciudad}
          </Link>
        </header>
      )}

      <section className="mx-auto max-w-4xl px-6 pt-6">
        <p className="text-lg leading-relaxed text-slate-600">{seo.intro}</p>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato titulo="Round-trip flight" valor={`US$ ${d.vuelo}`} sub="approx." />
          <Dato titulo="Daily cost" valor={`US$ ${d.dia}`} sub="per person" />
          <Dato titulo="Days recommended" valor={diasSugeridos} sub="ideal" />
          <Dato titulo="Suggested budget" valor={`US$ ${presupuestoSugerido}`} sub={`${diasSugeridos} days, 1 person`} />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-marca-100 bg-marca-50/40 p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-marca-600">🗓️ Best time to travel</div>
            <div className="mt-1.5 text-base leading-relaxed text-slate-700">{seo.mejorEpoca}</div>
            {seo.evitarEpoca && (
              <div className="mt-2 text-[13px] text-slate-500">
                <b className="text-amber-700">Avoid:</b> {seo.evitarEpoca}.
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">ℹ️ Quick facts</div>
            <dl className="mt-2 grid grid-cols-1 gap-1.5 text-[14px] text-slate-600">
              <div className="flex gap-2"><dt className="font-semibold text-slate-500">Language:</dt><dd>{seo.idioma}</dd></div>
              <div className="flex gap-2"><dt className="font-semibold text-slate-500">Currency:</dt><dd>{seo.moneda}</dd></div>
            </dl>
            {seo.dato && (
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800">
                <b>💡 Did you know?</b> {seo.dato}
              </div>
            )}
          </div>
        </div>
      </section>

      {seo.platos?.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">Local food in {d.ciudad}</h2>
          <p className="mt-1 text-slate-500">Dishes you shouldn't miss.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {seo.platos.map((p) => (
              <span key={p} className="rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200">
                🍽️ {p}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Affiliate block: tours, lodging, flights */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-suave">
          <h2 className="text-xl font-extrabold tracking-tight text-marca-900">Book your trip to {d.ciudad}</h2>
          <p className="mt-1 text-[14px] text-slate-500">Tours, lodging and flights from trusted partners we use ourselves.</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <a href={linkTours({ q: d.ciudad, lat: d.lat, lon: d.lon })} target="_blank" rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-marca-100 bg-gradient-to-br from-marca-50 to-marca-100/60 p-3.5 text-marca-700 shadow-suave transition hover:brightness-[0.98]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🎟️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">Tours & experiences</div>
                <div className="truncate text-[12.5px] text-slate-500">Skip-the-line tickets via GetYourGuide</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a href={linkHoteles({ ciudad: d.ciudad, lat: d.lat, lon: d.lon })} target="_blank" rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 text-emerald-700 shadow-suave transition hover:brightness-[0.98]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🛏️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">Where to stay</div>
                <div className="truncate text-[12.5px] text-slate-500">Compare Booking + more on Hotellook</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a href={linkVuelos({ ciudad: d.ciudad, pais: d.pais })} target="_blank" rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-sky-100 p-3.5 text-sky-700 shadow-suave transition hover:brightness-[0.98]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">✈️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">Cheap flights</div>
                <div className="truncate text-[12.5px] text-slate-500">Compare on Aviasales</div>
              </div>
              <span className="text-xl">→</span>
            </a>
          </div>
          <div className="mt-2.5 text-[11px] leading-snug text-slate-400">
            Some links are affiliate links: if you book, we may earn a commission at no extra cost to you.
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">FAQ about traveling to {d.ciudad}</h2>
        <div className="mt-4 space-y-2.5">
          {faqs.map((f, i) => (
            <details key={i} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-suave open:shadow-media">
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

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 p-8 text-white shadow-media">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Ready to plan your {d.ciudad} itinerary?</h2>
          <p className="mt-2 max-w-2xl text-white/85">
            We split the places day by day with real transit times, photos, and live flight prices.
            No install needed.
          </p>
          <Link href={`/?destino=${slug}`} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105">
            🗺️ Start my trip to {d.ciudad}
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-6 pb-10 text-center text-[12px] text-slate-400">
        Data from OpenStreetMap and Wikipedia · Prices in USD, indicative.
      </footer>
    </main>
  );
}

function Dato({ titulo, valor, sub }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{titulo}</div>
      <div className="mt-1 text-2xl font-extrabold text-marca-900">{valor}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-slate-500">{sub}</div>}
    </div>
  );
}
