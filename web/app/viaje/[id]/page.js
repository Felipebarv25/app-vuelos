// Vista pública de un itinerario compartido. Lee el JSON guardado en Vercel KV
// con el id corto y muestra el plan día por día en modo solo lectura.
// El visitante NO necesita login. Si quiere editar/recrear, hay un CTA que lo
// lleva a la app principal con la ciudad cargada.
import Link from "next/link";
import { kvGet } from "../../api/compartido/route";

export const dynamic = "force-dynamic";

async function obtenerViaje(id) {
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  return await kvGet(`compartido:${id}`);
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const v = await obtenerViaje(id);
  if (!v?.ciudad) {
    return { title: "Itinerario no encontrado · Viajero 360" };
  }
  const titulo = `Itinerario en ${v.ciudad.nombre} · Viajero 360`;
  return {
    title: titulo,
    description: `Plan de viaje a ${v.ciudad.nombre} con paradas día por día.`,
    robots: { index: false, follow: false }, // links únicos no indexables
  };
}

function fmtMin(m) {
  if (!m) return "";
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

export default async function PaginaViajeCompartido({ params }) {
  const { id } = await params;
  const v = await obtenerViaje(id);

  if (!v?.ciudad) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-20 text-center">
        <div className="text-6xl">🧳</div>
        <h1 className="mt-3 text-3xl font-extrabold text-marca-900">
          Itinerario no disponible
        </h1>
        <p className="mt-2 text-slate-600">
          El enlace expiró o no es válido. Puedes crear tu propio plan gratis.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-marca-500 to-marca-600 px-6 py-3.5 text-base font-bold text-white shadow-marca"
        >
          🗺️ Crear mi itinerario
        </Link>
      </main>
    );
  }

  const ciudad = v.ciudad;
  const paradas = v.seleccion || [];
  const totalParadas = paradas.length;
  const dias = v.dias || 1;
  const fechas = v.fechaInicio && v.fechaFin ? `${v.fechaInicio} → ${v.fechaFin}` : null;

  return (
    <main className="bg-slate-50">
      {/* Hero */}
      <header className="bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 px-6 pb-8 pt-10 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">
            Itinerario compartido
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">
            Plan de viaje a {ciudad.nombre}
          </h1>
          <p className="mt-1 text-white/85">{ciudad.pais}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
              📍 {totalParadas} paradas
            </span>
            <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
              📅 {dias} {dias === 1 ? "día" : "días"}
            </span>
            {fechas && (
              <span className="rounded-full bg-white/15 px-3 py-1 font-semibold">
                🗓️ {fechas}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Lista de paradas */}
      <section className="mx-auto max-w-3xl px-6 py-8">
        {totalParadas === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
            Este itinerario no tiene paradas guardadas.
          </div>
        ) : (
          <>
            <h2 className="text-xl font-extrabold tracking-tight text-marca-900">
              Paradas seleccionadas
            </h2>
            <ol className="mt-4 space-y-2.5">
              {paradas.map((p, i) => (
                <li
                  key={p.id || i}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-suave"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-marca-400 to-marca-600 text-sm font-extrabold text-white">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-marca-900">{p.nombre}</div>
                    {p.categoria && (
                      <div className="mt-0.5 text-[12.5px] text-slate-500">
                        {p.categoria}
                        {p.minutos ? ` · ${fmtMin(p.minutos)} sugeridos` : ""}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </>
        )}
      </section>

      {/* CTA: planificar/editar */}
      <section className="mx-auto max-w-3xl px-6 py-8">
        <div className="rounded-3xl bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 p-7 text-white shadow-media">
          <h2 className="text-2xl font-extrabold sm:text-3xl">
            ¿Quieres armar uno igual?
          </h2>
          <p className="mt-2 text-white/85">
            Crea tu propio itinerario gratis con mapa, GPS, transporte, fotos y
            precios de vuelos desde Colombia.
          </p>
          <Link
            href={`/?q=${encodeURIComponent(`${ciudad.nombre}, ${ciudad.pais}`)}`}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-bold text-marca-700 shadow-marca"
          >
            🗺️ Crear mi propio itinerario
          </Link>
        </div>
      </section>

      <footer className="mx-auto max-w-3xl px-6 pb-10 text-center text-[12px] text-slate-400">
        Viajero 360 · Datos de OpenStreetMap y Wikipedia
      </footer>
    </main>
  );
}
