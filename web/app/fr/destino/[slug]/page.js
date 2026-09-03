// Version française de la landing destination. SEO i18n avec hreflang.
// Réutilise datosSeoDe et faqsDe avec lang="fr".

import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { getDestinoPorSlug, TODOS_SLUGS, nombreDestino } from "@/lib/destinos";
import { datosSeoDe, faqsDe } from "@/lib/seoDestinos";
import { fotoCiudad } from "@/lib/fotoCiudad";
import { linkTours, linkHoteles, linkVuelos } from "@/lib/afiliados";
import FavToggle from "../../../destino/[slug]/FavToggle";
import NavTop from "@/components/NavTop";
import Bandera from "@/components/Bandera";

const SITIO = "https://anduve-app.vercel.app";

export async function generateStaticParams() {
  return TODOS_SLUGS.map((slug) => ({ slug }));
}

async function topLugares(slug, n = 10) {
  try {
    const p = path.join(process.cwd(), "public", "lugares", `${slug}.json`);
    const raw = await fs.readFile(p, "utf8");
    const data = JSON.parse(raw);
    const els = (data.elements || []).filter((e) => e?.tags?.name).slice(0, n);
    return els.map((e) => ({ nombre: e.tags.name, tipo: e.tags.tourism || e.tags.historic || e.tags.amenity || "", lat: e.lat, lon: e.lon }));
  } catch { return []; }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  if (!d) return { title: "Destination introuvable · Anduve" };
  const nombre = nombreDestino(d);
  const title = `Voyage à ${d.ciudad} · itinéraire, prix et conseils`;
  const description =
    `Planifiez votre voyage à ${nombre} : vols dès US$${d.vuelo}, budget quotidien ~US$${d.dia}/jour, ` +
    `meilleurs lieux à visiter et itinéraire jour par jour. Planificateur gratuit Anduve.`;
  const url = `${SITIO}/fr/destino/${slug}`;
  const urlEs = `${SITIO}/destino/${slug}`;
  const urlEn = `${SITIO}/en/destino/${slug}`;
  const urlPt = `${SITIO}/pt/destino/${slug}`;
  return {
    title, description,
    alternates: { canonical: url, languages: { "es-CO": urlEs, "es": urlEs, "en": urlEn, "en-US": urlEn, "pt": urlPt, "fr": url, "fr-FR": url, "x-default": urlEs } },
    openGraph: { title, description, url, siteName: "Anduve", type: "website", locale: "fr_FR" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DestinoFr({ params }) {
  const { slug } = await params;
  const d = getDestinoPorSlug(slug);
  if (!d) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        {/* Tambien aqui: la rama de "no encontrado" es una pagina a la que
            se llega por enlace, y se veia sin marca ni navegacion. */}
        <NavTop />
        <h1 className="text-3xl font-extrabold">Destination introuvable</h1>
        <p className="mt-2 text-slate-600"><Link href="/fr" className="text-marca-600 underline">Retour à l'accueil</Link></p>
      </main>
    );
  }

  const nombre = nombreDestino(d);
  const lugares = d.tienePrecalc ? await topLugares(slug, 10) : [];
  const diasSugeridos = d.region === "europa" || d.region === "asia" ? 10 : 7;
  const presup = d.vuelo + d.dia * diasSugeridos;
  const seo = datosSeoDe(d, "fr");
  const faqs = faqsDe(d, "fr");
  const foto = await fotoCiudad(d.ciudad, d.pais, d.lat, d.lon);

  const jsonLd = { "@context": "https://schema.org", "@type": "TouristDestination", name: nombre, description: `Informations de voyage pour ${nombre}.`, url: `${SITIO}/fr/destino/${slug}`, geo: { "@type": "GeoCoordinates", latitude: d.lat, longitude: d.lon }, address: { "@type": "PostalAddress", addressCountry: d.pais } };
  const breadcrumbs = { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITIO}/fr` },
    { "@type": "ListItem", position: 2, name: "Destinations", item: `${SITIO}/fr/destino` },
    { "@type": "ListItem", position: 3, name: nombre, item: `${SITIO}/fr/destino/${slug}` },
  ]};
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) };

  return (
    <main className="bg-slate-50">
      {/* Header con el logo: estas landings SEO se veian sin marca arriba a la
          izquierda y sin salida al resto de la app. */}
      <NavTop active="destinos" />

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      <nav className="mx-auto max-w-4xl px-6 pt-6 text-[13px] text-slate-500">
        <Link href="/fr" className="hover:text-marca-600">Accueil</Link>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-700">Destinations</span>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="font-semibold text-marca-700">{nombre}</span>
        <span className="float-right space-x-2">
          <Link href={`/destino/${slug}`} className="inline-flex items-center gap-1 text-[12px] underline hover:text-marca-600"><Bandera cc="ES" size={14} /> ES</Link>
          <Link href={`/en/destino/${slug}`} className="inline-flex items-center gap-1 text-[12px] underline hover:text-marca-600"><Bandera cc="GB" size={14} /> EN</Link>
          <Link href={`/pt/destino/${slug}`} className="inline-flex items-center gap-1 text-[12px] underline hover:text-marca-600"><Bandera cc="BR" size={14} /> PT</Link>
        </span>
      </nav>

      {foto?.url ? (
        <header className="relative h-[420px] w-full overflow-hidden sm:h-[480px]">
          <img src={foto.url} alt={`${d.ciudad}, ${d.pais}`} className="absolute inset-0 h-full w-full object-cover" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
          <FavToggle slug={slug} conFoto={true} />
          <div className="relative mx-auto flex h-full max-w-4xl flex-col justify-end px-6 pb-8 pt-12 text-white">
            <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <span className="text-3xl">{d.bandera}</span><span>Voyage à {d.pais}</span>
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight drop-shadow-md sm:text-5xl">Voyage à {d.ciudad}</h1>
            <Link href={`/?destino=${slug}`} className="mt-4 inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105">🗺️ Planifier mon voyage à {d.ciudad}</Link>
          </div>
        </header>
      ) : (
        <header className="mx-auto max-w-4xl px-6 pb-6 pt-6">
          <div className="flex items-center gap-3 text-[14px] font-semibold uppercase tracking-[0.18em] text-marca-500">
            <span className="text-3xl">{d.bandera}</span><span>Voyage à {d.pais}</span><FavToggle slug={slug} />
          </div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-marca-900 sm:text-5xl">Voyage à {d.ciudad}</h1>
          <Link href={`/?destino=${slug}`} className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-marca-500 to-marca-600 px-6 py-3.5 text-base font-bold text-white shadow-marca transition hover:brightness-105">🗺️ Planifier mon voyage à {d.ciudad}</Link>
        </header>
      )}

      <section className="mx-auto max-w-4xl px-6 pt-6"><p className="text-lg leading-relaxed text-slate-600">{seo.intro}</p></section>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato titulo="Vol A/R" valor={`US$ ${d.vuelo}`} sub="approx." />
          <Dato titulo="Coût journalier" valor={`US$ ${d.dia}`} sub="par personne" />
          <Dato titulo="Jours recommandés" valor={diasSugeridos} sub="idéal" />
          <Dato titulo="Budget suggéré" valor={`US$ ${presup}`} sub={`${diasSugeridos} jours, 1 personne`} />
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-marca-100 bg-marca-50/40 p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-marca-600">🗓️ Meilleure période</div>
            <div className="mt-1.5 text-base leading-relaxed text-slate-700">{seo.mejorEpoca}</div>
            {seo.evitarEpoca && <div className="mt-2 text-[13px] text-slate-500"><b className="text-amber-700">Évitez :</b> {seo.evitarEpoca}.</div>}
          </div>
          <div className="rounded-2xl border border-slate-100 bg-white p-5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">ℹ️ Infos pratiques</div>
            <dl className="mt-2 grid grid-cols-1 gap-1.5 text-[14px] text-slate-600">
              <div className="flex gap-2"><dt className="font-semibold text-slate-500">Langue :</dt><dd>{seo.idioma}</dd></div>
              <div className="flex gap-2"><dt className="font-semibold text-slate-500">Monnaie :</dt><dd>{seo.moneda}</dd></div>
            </dl>
            {seo.dato && <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800"><b>💡 Le saviez-vous ?</b> {seo.dato}</div>}
          </div>
        </div>
      </section>

      {seo.platos?.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">Spécialités de {d.ciudad}</h2>
          <p className="mt-1 text-slate-500">Plats à ne pas manquer.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {seo.platos.map((p) => <span key={p} className="rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200">🍽️ {p}</span>)}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-suave">
          <h2 className="text-xl font-extrabold tracking-tight text-marca-900">Réservez votre voyage à {d.ciudad}</h2>
          <p className="mt-1 text-[14px] text-slate-500">Visites, hébergement et vols via des partenaires de confiance.</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <a href={linkTours({ q: d.ciudad, lat: d.lat, lon: d.lon })} target="_blank" rel="sponsored noopener" className="flex items-center gap-3 rounded-2xl border border-marca-100 bg-gradient-to-br from-marca-50 to-marca-100/60 p-3.5 text-marca-700 shadow-suave transition hover:brightness-[0.98]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🎟️</span>
              <div className="min-w-0 flex-1"><div className="text-[14.5px] font-bold leading-tight">Visites et activités</div><div className="truncate text-[12.5px] text-slate-500">Billets coupe-file via GetYourGuide</div></div><span className="text-xl">→</span>
            </a>
            <a href={linkHoteles({ ciudad: d.ciudad, pais: d.pais, lat: d.lat, lon: d.lon })} target="_blank" rel="sponsored noopener" className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 text-emerald-700 shadow-suave transition hover:brightness-[0.98]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🛏️</span>
              <div className="min-w-0 flex-1"><div className="text-[14.5px] font-bold leading-tight">Où dormir</div><div className="truncate text-[12.5px] text-slate-500">Comparez Booking + Hotellook</div></div><span className="text-xl">→</span>
            </a>
            <a href={linkVuelos({ ciudad: d.ciudad, pais: d.pais })} target="_blank" rel="sponsored noopener" className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-sky-100 p-3.5 text-sky-700 shadow-suave transition hover:brightness-[0.98]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">✈️</span>
              <div className="min-w-0 flex-1"><div className="text-[14.5px] font-bold leading-tight">Vols pas chers</div><div className="truncate text-[12.5px] text-slate-500">Comparez sur Aviasales</div></div><span className="text-xl">→</span>
            </a>
          </div>
          <div className="mt-2.5 text-[11px] leading-snug text-slate-400">Certains liens sont des liens d'affiliation : si vous réservez, nous pouvons percevoir une commission sans coût supplémentaire.</div>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-marca-900">Questions fréquentes sur {d.ciudad}</h2>
        <div className="mt-4 space-y-2.5">
          {faqs.map((f, i) => (
            <details key={i} className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-suave open:shadow-media">
              <summary className="cursor-pointer list-none text-base font-bold text-marca-900"><span className="inline-flex items-center gap-2"><span className="text-marca-600 transition group-open:rotate-90">▸</span>{f.q}</span></summary>
              <p className="mt-2 pl-5 text-[14.5px] leading-relaxed text-slate-600">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="rounded-3xl bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 p-8 text-white shadow-media">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Prêt à planifier votre itinéraire à {d.ciudad} ?</h2>
          <p className="mt-2 max-w-2xl text-white/85">Nous répartissons les lieux jour par jour avec temps de trajet réels, photos et prix en direct. Sans installation.</p>
          <Link href={`/?destino=${slug}`} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105">🗺️ Commencer mon voyage à {d.ciudad}</Link>
        </div>
      </section>

      <footer className="mx-auto max-w-4xl px-6 pb-10 text-center text-[12px] text-slate-400">Données d'OpenStreetMap et Wikipédia · Prix indicatifs en USD.</footer>
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
