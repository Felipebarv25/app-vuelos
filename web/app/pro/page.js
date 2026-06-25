// /pro — pagina publica de planes. SEO + CTA. La razon de tener esta
// pagina (vs solo el modal de paywall) es que (a) Google la indexa para
// busquedas tipo "viajero 360 pro precio", (b) se puede compartir con
// amigos/referidos directamente, (c) tiene espacio para la FAQ legal.
import Link from "next/link";
import ProCheckoutBoton from "./ProCheckoutBoton";

const SITIO = "https://anduve-app.vercel.app";

export const metadata = {
  title: "Anduve Pro · planes y precios",
  description:
    "Hazte Pro: viajes ilimitados sincronizados, export PDF, alertas de precios y compartir. Desde US$ 4.99/mes o US$ 24/año. Oferta lanzamiento Lifetime US$ 39.",
  alternates: {
    canonical: `${SITIO}/pro`,
    languages: {
      es: `${SITIO}/pro`,
      "x-default": `${SITIO}/pro`,
    },
  },
  openGraph: {
    title: "Anduve Pro",
    description:
      "Viajes ilimitados, export PDF, alertas y más. Desde US$ 4.99/mes.",
    url: `${SITIO}/pro`,
    siteName: "Anduve",
    type: "website",
    locale: "es_CO",
  },
};

const PLANES = [
  {
    nombre: "Pro Anual",
    precio: "US$ 24",
    periodo: "por año",
    ahorro: "Ahorra 60% vs mensual",
    tipo: "anual",
    destacado: true,
    ventajas: [
      "Viajes ilimitados sincronizados en todos tus dispositivos",
      "Export PDF para tener tu plan offline",
      "Compartir tu viaje con un enlace público",
      "Alertas de precio ilimitadas",
      "Historial completo de precios mes por mes",
      "Sin anuncios",
    ],
  },
  {
    nombre: "Pro Mensual",
    precio: "US$ 4.99",
    periodo: "por mes",
    ahorro: null,
    tipo: "mensual",
    destacado: false,
    ventajas: [
      "Todo lo de Pro mientras esté activo",
      "Cancelas cuando quieras",
    ],
  },
  {
    nombre: "Lifetime",
    precio: "US$ 39",
    periodo: "una sola vez",
    ahorro: "Oferta lanzamiento · primeros 100",
    tipo: "lifetime",
    destacado: false,
    ventajas: [
      "Pro de por vida, sin renovaciones",
      "Mismo acceso que el anual, para siempre",
    ],
  },
];

const FAQS = [
  {
    q: "¿Necesito Pro para usar Anduve?",
    a: "No. Lo más útil es gratis: buscar ciudades, armar itinerario, ver precios reales de vuelo desde tu aeropuerto, 1 viaje guardado, 1 alerta de precio. Pro es para quienes quieren más viajes en simultáneo, PDF, compartir y alertas ilimitadas.",
  },
  {
    q: "¿Cómo pago?",
    a: "Procesamos los pagos con Lemon Squeezy, una plataforma global que acepta Visa, MasterCard, PayPal y Apple/Google Pay. No necesitas cuenta Stripe ni en EE.UU.",
  },
  {
    q: "¿Cómo cancelo si soy mensual o anual?",
    a: "Recibirás un email de Lemon Squeezy tras tu compra con un portal donde puedes cancelar en 1 click. La cancelación cierra la renovación; conservas Pro hasta el final del periodo pagado.",
  },
  {
    q: "¿Y si compro Lifetime y luego ya no me gusta?",
    a: "Tienes 14 días para pedir devolución del 100% por cualquier motivo, sin preguntas. Después de 14 días la compra es definitiva.",
  },
  {
    q: "¿Qué cobertura tiene la oferta de US$ 39 Lifetime?",
    a: "Es para los primeros 100 usuarios que se hagan Pro como apoyo al lanzamiento. Después subirá a US$ 79. Si ya compraste, conservas Pro de por vida.",
  },
  {
    q: "¿Comparten mi información?",
    a: "No vendemos datos. Lo único que guardamos para Pro es tu email asociado a tu suscripción. Para más, revisa nuestra política de privacidad en /privacidad.",
  },
];

export default function PaginaPro() {
  return (
    <main className="bg-slate-50 pb-16">
      <header className="bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 text-white">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <nav className="text-[12px] text-white/70">
            <Link href="/" className="hover:text-white">Inicio</Link>
            <span className="mx-1.5">/</span>
            <span className="text-white">Pro</span>
          </nav>
          <div className="mt-6 max-w-3xl">
            <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/85">
              Anduve Pro
            </div>
            <h1 className="mt-2 text-4xl font-extrabold tracking-tight sm:text-5xl">
              Tu viaje, sin límites.
            </h1>
            <p className="mt-3 max-w-2xl text-[17px] text-white/85">
              Pro te da viajes ilimitados sincronizados, export PDF para llevarte tu plan
              offline, alertas de precio ilimitadas y todo el historial mes a mes.
              Construido para viajeros independientes en cualquier país.
            </p>
          </div>
        </div>
      </header>

      {/* Tabla comparativa rapida */}
      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-white shadow-suave">
          <table className="w-full text-left text-[14px]">
            <thead className="border-b border-slate-100 bg-slate-50/60 dark:bg-slate-800/60">
              <tr>
                <th className="px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  Funcionalidad
                </th>
                <th className="px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-slate-500">Gratis</th>
                <th className="px-5 py-3 text-[12px] font-bold uppercase tracking-wide text-marca-600 dark:text-marca-300">Pro ★</th>
              </tr>
            </thead>
            <tbody className="text-slate-700">
              {[
                ["Buscar ciudades y mapa", "✓", "✓"],
                ["Precio real de vuelo según tu origen", "✓", "✓"],
                ["Calculadora de presupuesto multi-país", "✓", "✓"],
                ["Armar itinerario día por día", "✓", "✓"],
                ["80+ landing pages SEO", "✓", "✓"],
                ["Viajes guardados", "1", "Ilimitados, sincronizados"],
                ["Alertas de precio", "1", "Ilimitadas"],
                ["Export PDF (offline)", "—", "✓"],
                ["Compartir viaje (link público)", "—", "✓"],
                ["Historial completo de precios mensual", "—", "✓"],
                ["Sin anuncios", "—", "✓"],
              ].map(([fn, gratis, pro], i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="px-5 py-3 font-semibold text-slate-600">{fn}</td>
                  <td className="px-5 py-3 text-slate-500">{gratis}</td>
                  <td className="px-5 py-3 font-bold text-marca-700 dark:text-marca-300">{pro}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Planes */}
      <section className="mx-auto max-w-5xl px-6 py-6">
        <h2 className="text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300 sm:text-3xl">
          Elige tu plan
        </h2>
        <p className="mt-2 max-w-2xl text-slate-600">
          Empezamos con precios bajos porque acabamos de lanzar. Cuando crezca la
          comunidad, subimos. Si entras hoy, te lo quedas a este precio.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {PLANES.map((p) => (
            <div
              key={p.tipo}
              className={`relative rounded-2xl border-2 p-6 ${
                p.destacado
                  ? "border-emerald-400 bg-emerald-50/40 shadow-lg dark:border-emerald-700 dark:bg-emerald-900/20"
                  : "border-slate-200 bg-white shadow-suave dark:border-slate-700"
              }`}
            >
              {p.destacado && (
                <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-white">
                  Más popular
                </span>
              )}
              <div className="text-[12px] font-bold uppercase tracking-[0.18em] text-marca-600 dark:text-marca-400">
                {p.nombre}
              </div>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300">{p.precio}</span>
                <span className="pb-1 text-[13px] font-semibold text-slate-500">{p.periodo}</span>
              </div>
              {p.ahorro && (
                <div className={`mt-1 text-[12px] font-bold uppercase tracking-wide ${p.destacado ? "text-emerald-600 dark:text-emerald-300" : "text-amber-600 dark:text-amber-300"}`}>
                  {p.ahorro}
                </div>
              )}
              <ul className="mt-4 space-y-1.5 text-[13.5px] text-slate-600">
                {p.ventajas.map((v, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-emerald-500 dark:text-emerald-400">✓</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
              <ProCheckoutBoton tipo={p.tipo} destacado={p.destacado} />
            </div>
          ))}
        </div>

        <p className="mt-5 text-center text-[12px] text-slate-400">
          ✓ Cancela cuando quieras  ·  ✓ Devolución 14 días  ·  ✓ Pago seguro con Lemon Squeezy
        </p>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-6 py-12">
        <h2 className="text-2xl font-extrabold tracking-tight text-marca-900 dark:text-marca-300 sm:text-3xl">
          Preguntas frecuentes
        </h2>
        <div className="mt-4 space-y-2.5">
          {FAQS.map((f, i) => (
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

        {/* Schema.org FAQPage para Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: FAQS.map((f) => ({
                "@type": "Question",
                name: f.q,
                acceptedAnswer: { "@type": "Answer", text: f.a },
              })),
            }),
          }}
        />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-6 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[14px] font-bold text-marca-700 transition hover:bg-marca-50 dark:text-marca-300 dark:hover:bg-marca-900/30"
        >
          ← Seguir explorando gratis
        </Link>
      </section>
    </main>
  );
}
