// Página estática por destino. SSG: pre-renderizada en build time para SEO.
// Una URL por ciudad del catálogo (~207) tipo /destino/madrid-espana.
//
// Contenido pensado para Google: H1 con keyword, descripción, datos clave
// (vuelo aprox, costo diario, días sugeridos), Top 10 lugares con foto y
// CTA al planificador real. Schema.org TouristDestination + BreadcrumbList.
import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDestinoPorSlug, getDestinoPorCiudadSlug, TODOS_SLUGS, nombreDestino } from "@/lib/destinos";
import { datosSeoDe, faqsDe } from "@/lib/seoDestinos";
import { fotoCiudad } from "@/lib/fotoCiudad";
import { preciosPorMes } from "@/lib/historialPrecios";
import { iataDe } from "@/lib/iataCiudades";
import { linkTours, linkHoteles, linkVuelos, linkESIM, linkSeguro, linkCivitatis } from "@/lib/afiliados";
import FavToggle from "./FavToggle";
import AlertaPrecio from "@/components/AlertaPrecio";
import MusicaCiudad from "@/components/MusicaCiudad";
import PrecioDual from "@/components/PrecioDual";
import BotonVolver from "@/components/BotonVolver";

const SITIO = "https://anduve-app.vercel.app";

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
  if (!d) return { title: "Destino no encontrado · Anduve" };

  const nombre = nombreDestino(d);
  const title = `Viaje a ${d.ciudad} · Itinerario, vuelos y presupuesto`;
  const description =
    `Planea tu viaje a ${nombre}: vuelo i/v aprox. US$${d.vuelo}, ` +
    `presupuesto diario aprox. US$${d.dia}, top lugares para visitar y ruta día a día. ` +
    `Itinerario gratis con Anduve.`;
  const url = `${SITIO}/destino/${slug}`;
  const urlEn = `${SITIO}/en/destino/${slug}`;

  // OG image: Next genera la propia (1200x630) por convención de archivos
  // (opengraph-image.js). Si queremos usar la foto de Wikipedia, hay que
  // declararla explícitamente. Mantenemos la generada por Next para no
  // depender de Wikipedia en el metadata (más rápido de servir).
  // hreflang: avisa a Google que existe la version EN del mismo destino. Sin
  // esto, Google muestra la pagina espanola a usuarios anglosajones y
  // viceversa, perdiendo rank en ambos lados. x-default = fallback para
  // idiomas no listados (apuntamos a ES, mercado principal).
  return {
    title,
    description,
    alternates: {
      canonical: url,
      languages: {
        "es-CO": url,
        "es": url,
        "en": urlEn,
        "en-US": urlEn,
        "pt": `${SITIO}/pt/destino/${slug}`,
        "pt-BR": `${SITIO}/pt/destino/${slug}`,
        "fr": `${SITIO}/fr/destino/${slug}`,
        "fr-FR": `${SITIO}/fr/destino/${slug}`,
        "x-default": url,
      },
    },
    openGraph: {
      title,
      description,
      url,
      siteName: "Anduve",
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
    // Intento de recuperación: si el slug es solo la ciudad (ej. "paris"),
    // buscamos el slug completo "ciudad-pais" (ej. "paris-francia") y
    // redirigimos. Solo redirige si hay exactamente 1 coincidencia.
    const dPorCiudad = getDestinoPorCiudadSlug(slug);
    if (dPorCiudad) {
      redirect(`/destino/${dPorCiudad.slug}`);
    }
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
  const foto = await fotoCiudad(d.ciudad, d.pais, d.lat, d.lon);
  const iata = iataDe(d.ciudad, d.pais);
  const historial = iata ? await preciosPorMes(iata) : null;

  // Schema.org: ayuda a Google a entender que la página describe un destino.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TouristDestination",
    name: nombre,
    description: `Información de viaje a ${nombre}: vuelos, lugares para visitar y presupuesto sugerido.`,
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

      {/* Breadcrumbs + switch a otros idiomas (refuerza el signal hreflang para Google) */}
      <nav className="mx-auto max-w-4xl px-6 pt-6 text-[13px] text-slate-500">
        <Link href="/" className="hover:text-marca-600">Inicio</Link>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-700">Destinos</span>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="font-semibold text-marca-700 dark:text-marca-300">{nombre}</span>
        <span className="float-right space-x-2">
          <Link href={`/en/destino/${slug}`} className="text-[12px] underline hover:text-marca-600">🇬🇧 EN</Link>
          <Link href={`/pt/destino/${slug}`} className="text-[12px] underline hover:text-marca-600">🇧🇷 PT</Link>
          <Link href={`/fr/destino/${slug}`} className="text-[12px] underline hover:text-marca-600">🇫🇷 FR</Link>
        </span>
      </nav>

      {/* Sin spacer: lo que sigue es el hero a sangre completa y el boton debe
          flotar encima. Un hueco aqui dejaria una banda blanca sobre la foto. */}
      <BotonVolver href="/destino" etiqueta="Volver a destinos" espaciar={false} />

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
          {/* Atribución requerida por la licencia de Wikipedia/Commons (CC-BY/SA) */}
          {foto.articulo && (
            <a
              href={foto.articulo}
              target="_blank"
              rel="noopener nofollow"
              className="absolute bottom-2 right-3 z-10 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium text-white/80 backdrop-blur-sm hover:text-white"
            >
              Foto: Wikipedia · CC-BY/SA
            </a>
          )}
          <div className="relative mx-auto flex h-full max-w-4xl flex-col justify-end px-6 pb-8 pt-12 text-white">
            <div className="flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.18em] text-white/85">
              <span className="text-3xl">{d.bandera}</span>
              <span>Viaja a {d.pais}</span>
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight drop-shadow-md sm:text-5xl">
              Viaje a {d.ciudad}
            </h1>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link
                href={`/?destino=${slug}`}
                className="inline-flex w-fit items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105"
              >
                🗺️ Planear mi viaje a {d.ciudad}
              </Link>
              {iata && (
                <AlertaPrecio
                  ciudad={d.ciudad}
                  pais={d.pais}
                  iata={iata}
                  precioActual={d.vuelo}
                />
              )}
            </div>
          </div>
        </header>
      ) : (
        <header className="mx-auto max-w-4xl px-6 pb-6 pt-6">
          <div className="flex items-center gap-3 text-[14px] font-semibold uppercase tracking-[0.18em] text-marca-500 dark:text-marca-400">
            <span className="text-3xl">{d.bandera}</span>
            <span>Viaja a {d.pais}</span>
            <FavToggle slug={slug} />
          </div>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300 sm:text-5xl">
            Viaje a {d.ciudad}
          </h1>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/?destino=${slug}`}
              className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-marca-500 to-marca-600 px-6 py-3.5 text-base font-bold text-white shadow-marca transition hover:brightness-105"
            >
              🗺️ Planear mi viaje a {d.ciudad}
            </Link>
            {iata && (
              <AlertaPrecio
                ciudad={d.ciudad}
                pais={d.pais}
                iata={iata}
                precioActual={d.vuelo}
              />
            )}
          </div>
        </header>
      )}

      {/* Descripción del destino debajo del hero */}
      <section className="mx-auto max-w-4xl px-6 pt-6">
        <p className="text-lg leading-relaxed text-slate-600">{seo.intro}</p>
      </section>

      {/* Datos clave */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        {/* Precios en USD + moneda local del usuario (feedback 2026-07-11:
            "no sé cuánto representa en mi moneda"). PrecioDual soloLocal
            agrega la linea "≈ X COP" bajo cada monto. */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Dato titulo="Vuelo i/v aprox." valor={`US$ ${d.vuelo}`} sub={<><PrecioDual usd={d.vuelo} soloLocal className="font-bold text-marca-700 dark:text-marca-300" /> · referencial</>} />
          <Dato titulo="Costo diario aprox." valor={`US$ ${d.dia}`} sub={<><PrecioDual usd={d.dia} soloLocal className="font-bold text-marca-700 dark:text-marca-300" /> · por persona</>} />
          <Dato titulo="Días recomendados" valor={diasSugeridos} sub="ideal" />
          <Dato titulo="Presupuesto sugerido" valor={`US$ ${presupuestoSugerido}`} sub={<><PrecioDual usd={presupuestoSugerido} soloLocal className="font-bold text-marca-700 dark:text-marca-300" /> · {diasSugeridos} días, 1 persona</>} />
        </div>
      </section>

      {/* Banda sonora del destino: artistas locales + Top 50 + vibe. Client
          component dentro de la pagina SSR — usa su fallback en español. */}
      <section className="mx-auto max-w-4xl px-6">
        <MusicaCiudad ciudad={d.ciudad} pais={d.pais} />
      </section>

      {/* Mejor época + datos prácticos */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-marca-100 bg-marca-50/40 p-5 dark:border-marca-800 dark:bg-marca-900/20">
            <div className="text-[11px] font-bold uppercase tracking-wide text-marca-600">
              🗓️ Mejor época para viajar
            </div>
            <div className="mt-1.5 text-base leading-relaxed text-slate-700">
              {seo.mejorEpoca}
            </div>
            {seo.evitarEpoca && (
              <div className="mt-2 text-[13px] text-slate-500">
                <b className="text-amber-700 dark:text-amber-300">Evita:</b> {seo.evitarEpoca}.
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
              <div className="mt-3 rounded-xl bg-amber-50 p-3 text-[13px] leading-relaxed text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                <b>💡 ¿Sabías que…?</b> {seo.dato}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Comida típica */}
      {seo.platos?.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
            Comida típica de {d.ciudad}
          </h2>
          <p className="mt-1 text-slate-500">Platos que no te puedes perder.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {seo.platos.map((p) => (
              <span
                key={p}
                className="rounded-full bg-white px-3.5 py-2 text-[14px] font-semibold text-slate-700 ring-1 ring-slate-200 dark:ring-slate-700"
              >
                🍽️ {p}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Cuándo viajar más barato — mediana de precios de vuelo por mes, calculada
          a partir del historial real del detector. Si todavia no hay historial
          para esta ruta, mostramos un estado explicito (en vez de "desaparecer"
          la seccion, que hacia parecer las fichas ricas vs. pobres sin razon). */}
      {!historial && (
        <section className="mx-auto max-w-4xl px-6 py-6">
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-5 dark:border-slate-700 dark:bg-slate-800/60">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
              🕒 Cuándo viajar más barato
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              Todavía estamos recopilando datos de precios para vuelos a{" "}
              <b className="text-marca-700 dark:text-marca-300">{d.ciudad}</b>. Nuestro
              detector consulta esta ruta cada 3 horas; en cuanto haya muestras
              suficientes verás aquí la mediana mes a mes y la mejor temporada
              para volar.
            </p>
            <p className="mt-2 text-[12.5px] text-slate-500">
              Mientras tanto, usa el presupuesto sugerido de arriba como referencia.
            </p>
          </div>
        </section>
      )}
      {historial && (
        <CalendarioPrecios historial={historial} ciudad={d.ciudad} />
      )}

      {/* Top lugares */}
      {lugares.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 py-6">
          <h2 className="text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marca-100 text-sm font-extrabold text-marca-700 dark:bg-marca-900/40 dark:text-marca-300">
                  {i + 1}
                </span>
                <div>
                  <div className="font-bold text-marca-900 dark:text-marca-300">{l.nombre}</div>
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

      {/* Reserva tu viaje: tours, hospedaje y vuelos via afiliados (GetYourGuide,
          Hotellook/Booking, Aviasales). Palanca de monetizacion #1 que faltaba
          en el SSG. Inline en lugar del componente AfiliadosCiudad (que es
          "use client") porque Next.js no deja pasar functions de server a
          client component, y aqui no necesitamos tracking ni i18n. */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-suave">
          <h2 className="text-xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
            Reserva tu viaje a {d.ciudad}
          </h2>
          <p className="mt-1 text-[14px] text-slate-500">
            Tours, hospedaje y vuelos — todo de proveedores que
            usamos nosotros.
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            <a
              href={linkTours({ q: d.ciudad, lat: d.lat, lon: d.lon })}
              target="_blank"
              rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-marca-100 bg-gradient-to-br from-marca-50 to-marca-100/60 p-3.5 text-marca-700 shadow-suave transition hover:brightness-[0.98] dark:border-marca-800 dark:from-marca-900/30 dark:to-marca-900/20 dark:text-marca-300"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🎟️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">Tours y experiencias</div>
                <div className="truncate text-[12.5px] text-slate-500">Tickets sin filas con GetYourGuide</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a
              href={linkCivitatis({ ciudad: d.ciudad })}
              target="_blank"
              rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50 to-amber-50 p-3.5 text-orange-700 shadow-suave transition hover:brightness-[0.98] dark:border-orange-800 dark:from-orange-900/30 dark:to-amber-900/20 dark:text-orange-300"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🧭</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">Civitatis</div>
                <div className="truncate text-[12.5px] text-slate-500">Tours en español · fuerte en LATAM</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a
              href={linkHoteles({ ciudad: d.ciudad, lat: d.lat, lon: d.lon })}
              target="_blank"
              rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 text-emerald-700 shadow-suave transition hover:brightness-[0.98] dark:border-emerald-800 dark:from-emerald-900/30 dark:to-teal-900/20 dark:text-emerald-300"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🛏️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">¿Dónde dormir?</div>
                <div className="truncate text-[12.5px] text-slate-500">Compara Booking + más en Hotellook</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            <a
              href={linkVuelos({ ciudad: d.ciudad, pais: d.pais })}
              target="_blank"
              rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-sky-100 p-3.5 text-sky-700 shadow-suave transition hover:brightness-[0.98] dark:border-sky-800 dark:from-sky-900/30 dark:to-sky-900/20 dark:text-sky-300"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">✈️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">Vuelos baratos</div>
                <div className="truncate text-[12.5px] text-slate-500">Compara en Aviasales</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            {/* eSIM internacional: una de las primeras cosas que el viajero
                necesita al llegar (datos moviles), y la mas cara si la compra
                en el aeropuerto. Airalo via Travelpayouts marker. */}
            <a
              href={linkESIM({ pais: d.pais })}
              target="_blank"
              rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-3.5 text-violet-700 shadow-suave transition hover:brightness-[0.98] dark:border-violet-800 dark:from-violet-900/30 dark:to-purple-900/20 dark:text-violet-300"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">📱</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">eSIM para {d.pais}</div>
                <div className="truncate text-[12.5px] text-slate-500">Datos al instante con Airalo</div>
              </div>
              <span className="text-xl">→</span>
            </a>
            {/* Seguro de viaje: muchas vias europeas/norteamericanas lo piden
                obligatorio (visa Schengen, etc.). EKTA via afiliado. */}
            <a
              href={linkSeguro({ pais: d.pais })}
              target="_blank"
              rel="sponsored noopener"
              className="flex items-center gap-3 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-pink-50 p-3.5 text-rose-700 shadow-suave transition hover:brightness-[0.98] dark:border-rose-800 dark:from-rose-900/30 dark:to-pink-900/20 dark:text-rose-300"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-xl shadow-suave">🛡️</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14.5px] font-bold leading-tight">Seguro de viaje</div>
                <div className="truncate text-[12.5px] text-slate-500">Cobertura médica + cancelación</div>
              </div>
              <span className="text-xl">→</span>
            </a>
          </div>
          <div className="mt-2.5 text-[11px] leading-snug text-slate-400">
            Algunos enlaces son de afiliados: si reservas, podemos ganar una
            comisión sin costo extra para ti.
          </div>
        </div>
      </section>

      {/* FAQ — rankea muy bien en Google */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
          Preguntas frecuentes sobre viajar a {d.ciudad}
        </h2>
        <div className="mt-4 space-y-2.5">
          {faqs.map((f, i) => (
            <details
              key={i}
              className="group rounded-2xl border border-slate-100 bg-white p-4 shadow-suave open:shadow-media"
            >
              <summary className="cursor-pointer list-none text-base font-bold text-marca-900 dark:text-marca-300">
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
            fotos, y precios en vivo de vuelos. Sin instalar nada.
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
      <footer className="mx-auto max-w-4xl px-6 pb-28 text-center text-[12px] text-slate-400 lg:pb-10">
        Datos de OpenStreetMap y Wikipedia · Precios orientativos en USD.
      </footer>

      {/* Sticky CTA (audit E2 - 2026-06-25): el visitante llega desde Google,
          lee el destino y se va sin convertir. Esta barra le ofrece accionar
          en cualquier momento del scroll. Linkea al home con ?q=Ciudad,Pais
          que dispara la busqueda y arma el itinerario. Hidden en print. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgba(0,0,0,0.08)] backdrop-blur-md print:hidden dark:border-slate-700 dark:bg-slate-900/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Empezar a planear
            </div>
            <div className="truncate text-[14px] font-bold text-slate-900 dark:text-slate-100">
              {d.ciudad}, {d.pais}
            </div>
          </div>
          <Link
            href={`/?q=${encodeURIComponent(`${d.ciudad}, ${d.pais}`)}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-md bg-marca-700 px-4 py-2.5 text-[13px] font-semibold text-white shadow-cta transition hover:bg-marca-800"
          >
            Planear este viaje
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
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
      <h2 className="text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
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
            className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-3 transition hover:border-marca-200 hover:bg-marca-50 dark:hover:border-marca-700 dark:hover:bg-marca-900/30"
          >
            <span className="text-2xl">{o.bandera}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold text-marca-900 dark:text-marca-300">{o.ciudad}</div>
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
          Ver todos los destinos →
        </Link>
      </div>
    </section>
  );
}

const MESES_CORTO = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function CalendarioPrecios({ historial, ciudad }) {
  const { meses, mejor, peor } = historial;
  const min = mejor.precio;
  const max = peor.precio;
  const rango = max - min || 1;

  const porAnio = {};
  for (const m of meses) {
    const anio = m.ym.slice(0, 4);
    const mes = Number(m.ym.slice(5, 7)) - 1;
    if (!porAnio[anio]) porAnio[anio] = Array(12).fill(null);
    porAnio[anio][mes] = m;
  }
  const anios = Object.keys(porAnio).sort();

  function colorCelda(precio) {
    const t = (precio - min) / rango;
    if (t <= 0.25) return "bg-emerald-100 text-emerald-800 ring-emerald-200";
    if (t <= 0.5) return "bg-emerald-50 text-emerald-700 ring-emerald-100";
    if (t <= 0.75) return "bg-amber-50 text-amber-700 ring-amber-100";
    return "bg-red-50 text-red-700 ring-red-100";
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-6">
      <h2 className="text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">
        ¿Cuándo es más barato volar a {ciudad}?
      </h2>
      <p className="mt-1 text-slate-500">
        Precio mediano de vuelo i/v por mes según nuestro detector (últimos 90 días).
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-lg">✨</span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Más barato</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-emerald-700">US$ {mejor.precio}</span>
              <span className="text-[13px] font-semibold text-emerald-600">{mejor.label}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-lg">📈</span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-red-700">Más caro</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-extrabold text-red-700">US$ {peor.precio}</span>
              <span className="text-[13px] font-semibold text-red-600">{peor.label}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-suave">
        <table className="w-full min-w-[640px] border-collapse text-center">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">Año</th>
              {MESES_CORTO.map((m) => (
                <th key={m} className="px-1 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {anios.map((anio) => (
              <tr key={anio} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-2 text-left text-[13px] font-extrabold text-marca-900">{anio}</td>
                {porAnio[anio].map((celda, i) => (
                  <td key={i} className="px-1 py-1.5">
                    {celda ? (
                      <div
                        className={`mx-auto w-fit rounded-lg px-2 py-1.5 text-[12px] font-bold ring-1 ${colorCelda(celda.precio)} ${celda.mejor ? "ring-2 ring-emerald-500" : ""} ${celda.peor ? "ring-2 ring-red-400" : ""}`}
                        title={`${celda.label}: US$${celda.precio} (${celda.muestras} consultas)`}
                      >
                        ${celda.precio}
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-300">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Barato
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-amber-50 ring-1 ring-amber-100" /> Normal
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded bg-red-50 ring-1 ring-red-100" /> Caro
        </span>
        <span className="ml-auto text-slate-400">
          Datos del detector · precios en USD ida y vuelta
        </span>
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
      <div className="mt-1 text-2xl font-extrabold text-marca-900 dark:text-marca-300">{valor}</div>
      {sub && <div className="mt-0.5 text-[11.5px] text-slate-500">{sub}</div>}
    </div>
  );
}
