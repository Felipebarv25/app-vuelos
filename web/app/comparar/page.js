// Comparador de destinos lado a lado. SSG: pre-renderiza una página vacía con
// SEO, y el cliente (ComparadorCliente) maneja la lógica de selección.
import ComparadorCliente from "./ComparadorCliente";

const SITIO = "https://app-vuelos-mfos.vercel.app";

export const metadata = {
  title: "Comparar destinos para viajar desde Colombia · Viajero 360",
  description:
    "Compara hasta 3 destinos lado a lado: vuelo desde Colombia, costo diario, presupuesto sugerido y lo que ofrece cada ciudad. Decide a dónde viajar con datos.",
  alternates: { canonical: `${SITIO}/comparar` },
  openGraph: {
    title: "Comparar destinos para viajar desde Colombia",
    description:
      "Vuelo, presupuesto, idioma y comida — todo lado a lado para elegir tu próximo viaje.",
    url: `${SITIO}/comparar`,
    siteName: "Viajero 360",
    type: "website",
    locale: "es_CO",
  },
};

export default function PaginaComparar() {
  return (
    <main className="bg-slate-50 pb-12">
      <header className="mx-auto max-w-6xl px-6 pt-8">
        <div className="text-[12px] font-semibold uppercase tracking-[0.22em] text-marca-500">
          Herramienta
        </div>
        <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-marca-900 sm:text-5xl">
          Comparar destinos
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-slate-600">
          Elige hasta 3 ciudades y mira lado a lado lo que cuesta llegar, cuánto
          se gasta por día y qué te ofrece cada una. Decide con datos.
        </p>
      </header>
      <ComparadorCliente />
    </main>
  );
}
