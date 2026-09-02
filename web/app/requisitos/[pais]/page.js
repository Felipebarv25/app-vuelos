// Página interna /requisitos/<iso-pais> — visa + salud por destino.
// SSG: una página por país que tenga entrada en web/data/salud-paises.json.
// La info de salud viene del dataset (refrescado mensualmente por cron).
// La info de visa la consulta el componente cliente (depende de la
// nacionalidad del usuario, que vive en localStorage o se elige aquí).

import Link from "next/link";
import salud from "@/data/salud-paises.json";
import { PAISES_ISO } from "@/lib/paisesISO";
import { FIEBRE_AMARILLA } from "@/lib/requisitos";
import RequisitosCliente from "./RequisitosCliente";
import NavTop from "@/components/NavTop";

const SITIO = "https://anduve-app.vercel.app";

// Pre-render una página por cada ISO con datos de salud.
export async function generateStaticParams() {
  return Object.keys(salud)
    .filter((k) => k !== "_meta")
    .map((iso) => ({ pais: iso.toLowerCase() }));
}

export async function generateMetadata({ params }) {
  const { pais } = await params;
  const iso = pais?.toUpperCase();
  const info = salud[iso];
  if (!info) return { title: "Requisitos de viaje · Anduve" };
  const nombre = info.pais;
  return {
    title: `Requisitos para viajar a ${nombre} · Visa, vacunas y salud · Anduve`,
    description: `Información completa para viajar a ${nombre}: visa según tu pasaporte, vacunas recomendadas, riesgos sanitarios, calidad del agua y números de emergencia.`,
    alternates: { canonical: `${SITIO}/requisitos/${iso.toLowerCase()}` },
    openGraph: {
      title: `Requisitos para viajar a ${nombre}`,
      description: `Visa, vacunas, salud y emergencias para tu viaje a ${nombre}. Información referencial actualizada.`,
      url: `${SITIO}/requisitos/${iso.toLowerCase()}`,
      siteName: "Anduve",
      type: "website",
    },
  };
}

function Bloque({ titulo, icono, children, tono = "slate" }) {
  const colores = {
    slate: "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/60",
    rose: "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20",
    amber: "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20",
    emerald: "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20",
    marca: "border-marca-100 bg-marca-50/50 dark:border-marca-800 dark:bg-marca-900/20",
  };
  return (
    <section className={`rounded-2xl border p-5 ${colores[tono] || colores.slate}`}>
      <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-800 dark:text-slate-100">
        <span aria-hidden="true">{icono}</span> {titulo}
      </h2>
      <div className="mt-3 space-y-2 text-[14.5px] leading-relaxed text-slate-700 dark:text-slate-300">
        {children}
      </div>
    </section>
  );
}

function ListaConBullets({ items }) {
  if (!items || items.length === 0) return <p className="text-slate-500">Sin información específica.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2">
          <span className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function PaginaRequisitos({ params }) {
  const { pais } = await params;
  const iso = pais?.toUpperCase();
  const info = salud[iso];

  if (!info) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-16 text-center">
        {/* Tambien aqui: la rama de "no encontrado" es una pagina a la que
            se llega por enlace, y se veia sin marca ni navegacion. */}
        <NavTop />
        <h1 className="text-3xl font-extrabold text-marca-900">País sin datos</h1>
        <p className="mt-2 text-slate-600">
          Todavía no tenemos información de requisitos para este destino.{" "}
          <Link href="/" className="text-marca-600 underline">Volver al inicio</Link>
        </p>
      </main>
    );
  }

  const bandera = PAISES_ISO[iso]?.bandera || "🌍";
  const nombre = info.pais;
  const tieneFiebreAmarilla = FIEBRE_AMARILLA.has(iso);
  const vacunasEstandar = salud._meta?.schema?.vacunas_estandar || "Vacunas estándar al día.";

  // Schema.org TravelAction para SEO.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAction",
    name: `Requisitos para viajar a ${nombre}`,
    description: `Visa, vacunas y salud para viajar a ${nombre}.`,
    toLocation: { "@type": "Country", name: nombre, identifier: iso },
  };

  return (
    <main className="bg-slate-50 pb-12 dark:bg-slate-900">
      {/* Header con el logo: sin esto la pagina se veia sin marca arriba a
          la izquierda y sin salida a otra seccion. */}
      <NavTop />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Breadcrumb */}
      <nav className="mx-auto max-w-4xl px-6 pt-6 text-[13px] text-slate-500">
        <Link href="/" className="hover:text-marca-600">Inicio</Link>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="text-slate-700 dark:text-slate-300">Requisitos</span>
        <span className="mx-1.5 text-slate-300">/</span>
        <span className="font-semibold text-marca-700 dark:text-marca-300">{nombre}</span>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-4xl px-6 pb-2 pt-6">
        <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-marca-500 dark:text-marca-400">
          Requisitos de entrada
        </div>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300 sm:text-5xl">
          <span className="mr-3 text-4xl">{bandera}</span>
          Viajar a {nombre}
        </h1>
        <p className="mt-3 max-w-3xl text-lg text-slate-600 dark:text-slate-400">
          Toda la información que necesitas para preparar tu viaje:
          visa según tu pasaporte, vacunas, riesgos sanitarios y números de
          emergencia. Datos referenciales, verifica antes de volar.
        </p>
      </header>

      {/* Visa — isla cliente porque depende de la nacionalidad seleccionada */}
      <section className="mx-auto max-w-4xl px-6 py-4">
        <RequisitosCliente destinoIso={iso} destinoNombre={nombre} />
      </section>

      {/* Salud / vacunas / riesgos */}
      <section className="mx-auto max-w-4xl space-y-3 px-6 py-4">
        <Bloque titulo="Vacunas recomendadas" icono="💉" tono="emerald">
          <p className="text-[13px] italic text-slate-500 dark:text-slate-400">
            Antes de cualquier viaje internacional: {vacunasEstandar}
          </p>
          <div className="mt-2">
            <div className="text-[12px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Adicionales para {nombre}
            </div>
            <ListaConBullets items={info.vacunas_recomendadas} />
          </div>
          {info.vacunas_especiales?.length > 0 && (
            <div className="mt-3">
              <div className="text-[12px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                Especiales (según itinerario)
              </div>
              <ListaConBullets items={info.vacunas_especiales} />
            </div>
          )}
          {info.vacunas_obligatorias?.length > 0 && (
            <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-800 dark:bg-rose-900/20">
              <div className="text-[12px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-400">
                Obligatorias / pueden exigirse
              </div>
              <ListaConBullets items={info.vacunas_obligatorias} />
            </div>
          )}
        </Bloque>

        {tieneFiebreAmarilla && (
          <Bloque titulo="Fiebre amarilla" icono="🦟" tono="amber">
            <p>
              {nombre} está en una zona donde puede exigirse <b>certificado
              internacional de vacunación contra fiebre amarilla</b> según el
              país desde el que viajes y las zonas que visites dentro de {nombre}.
              Consulta con tu médico al menos 10 días antes del viaje.
            </p>
          </Bloque>
        )}

        {info.riesgos?.length > 0 && (
          <Bloque titulo="Riesgos sanitarios" icono="⚠️" tono="rose">
            <ListaConBullets items={info.riesgos} />
          </Bloque>
        )}

        {info.agua && (
          <Bloque titulo="Agua y alimentación" icono="💧" tono="slate">
            <p>{info.agua}</p>
          </Bloque>
        )}

        {info.emergencias && Object.keys(info.emergencias).length > 0 && (
          <Bloque titulo="Números de emergencia" icono="🚨" tono="marca">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {Object.entries(info.emergencias).map(([k, v]) => (
                <div
                  key={k}
                  className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800"
                >
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                    {k.replace(/_/g, " ")}
                  </div>
                  <div className="mt-0.5 font-extrabold tracking-tight text-marca-700 dark:text-marca-300">
                    {v}
                  </div>
                </div>
              ))}
            </div>
          </Bloque>
        )}

        {info.notas && (
          <Bloque titulo="Notas prácticas" icono="📝" tono="slate">
            <p>{info.notas}</p>
          </Bloque>
        )}

        {/* Extracto de Wikipedia si el scraper lo trajo */}
        {info.enriquecido_desde_fuentes?.wikipedia?.extracto && (
          <Bloque titulo={`Contexto sanitario en ${nombre}`} icono="📚" tono="slate">
            <p className="text-[14px] leading-relaxed">
              {info.enriquecido_desde_fuentes.wikipedia.extracto}…
            </p>
            <p className="mt-2 text-[12px] text-slate-500">
              Extracto de Wikipedia (
              <a
                href={info.enriquecido_desde_fuentes.wikipedia.url}
                target="_blank"
                rel="noopener nofollow"
                className="underline hover:text-marca-600"
              >
                ver artículo completo
              </a>
              ), consultado el {info.enriquecido_desde_fuentes.wikipedia.consultado}.
            </p>
          </Bloque>
        )}
      </section>

      {/* Disclaimer + fuentes + última actualización */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
          <b>⚠️ Aviso importante.</b> {salud._meta?.disclaimer || "Información referencial; verifica con tu médico y el consulado del destino antes de viajar."}
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 text-[12px] text-slate-500 sm:grid-cols-2">
          <div>
            <b className="text-slate-600 dark:text-slate-400">Última actualización de esta ficha:</b>{" "}
            {info.actualizado || "—"}
          </div>
          <div>
            <b className="text-slate-600 dark:text-slate-400">Fuentes:</b>{" "}
            {(info.fuentes || []).join(" · ")}
          </div>
        </div>
      </section>

      {/* CTA a la app */}
      <section className="mx-auto max-w-4xl px-6 py-6">
        <div className="rounded-3xl bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 p-7 text-white shadow-media">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            ¿Listo para armar tu itinerario en {nombre}?
          </h2>
          <p className="mt-2 text-white/85">
            Día a día con mapa, transporte y precios de vuelo en vivo desde tu aeropuerto.
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca transition hover:brightness-105"
          >
            🗺️ Planear mi viaje
          </Link>
        </div>
      </section>
    </main>
  );
}
