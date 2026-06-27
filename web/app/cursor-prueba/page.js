"use client";
// Pagina TEMPORAL para que el usuario pruebe los 4 cursores candidatos y
// elija el favorito. Una vez elegido, esta pagina se borra y el cursor
// elegido se aplica globalmente desde globals.css.
//
// Acceso: https://anduve-app.vercel.app/cursor-prueba
// Hotspot decidido por la naturaleza de cada cursor:
//  - flecha: punta arriba-izq (4, 2)
//  - resto (caminante, brujula, avion): centro (16, 16)
import { useEffect, useState } from "react";

const OPCIONES = [
  {
    id: "caminante",
    nombre: "Caminante",
    desc: "El walker del logo. Brand signature absoluto.",
    hotspot: [16, 16],
    file: "/cursors/caminante.svg",
  },
  {
    id: "brujula",
    nombre: "Brújula",
    desc: "Iconografía de exploración. Lee perfecto a 24px.",
    hotspot: [16, 16],
    file: "/cursors/brujula.svg",
  },
  {
    id: "flecha",
    nombre: "Flecha + punto coral",
    desc: "Flecha clásica con acento coral. Profesional y discreto.",
    hotspot: [4, 2],
    file: "/cursors/flecha.svg",
  },
  {
    id: "avion",
    nombre: "Avión de papel",
    desc: "Sensación de movimiento. Cuerpo teal, sombra coral.",
    hotspot: [3, 4],
    file: "/cursors/avion.svg",
  },
];

export default function CursorPrueba() {
  const [seleccion, setSeleccion] = useState(null);

  // Aplica el cursor al <html> para que cubra toda la pagina (incluyendo el
  // body y los hijos por herencia). Al desmontar, limpia.
  useEffect(() => {
    if (!seleccion) {
      document.documentElement.style.cursor = "";
      return;
    }
    const opt = OPCIONES.find((o) => o.id === seleccion);
    if (opt) {
      document.documentElement.style.cursor = `url('${opt.file}') ${opt.hotspot[0]} ${opt.hotspot[1]}, auto`;
    }
    return () => {
      document.documentElement.style.cursor = "";
    };
  }, [seleccion]);

  const opcionActiva = OPCIONES.find((o) => o.id === seleccion);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 dark:bg-slate-900">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
          Página de prueba · cursor
        </div>
        <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          Prueba los 4 cursores Anduve
        </h1>
        <p className="mb-6 max-w-2xl text-[14px] leading-relaxed text-slate-600 dark:text-slate-400">
          Click en cada opción para activarla. Mueve el mouse por toda la página
          y prueba en los botones, links e inputs de abajo para ver cómo se
          siente. Cuando tengas tu favorito, dímelo en el chat y aplico esa
          opción globalmente en la app (y borro esta página de prueba).
        </p>

        {/* Selector de cursor */}
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {OPCIONES.map((o) => {
            const activo = seleccion === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setSeleccion(o.id)}
                className={`rounded-xl border-2 p-4 text-left transition ${
                  activo
                    ? "border-marca-700 bg-marca-50 dark:border-marca-400 dark:bg-marca-900/30"
                    : "border-slate-200 bg-white hover:border-marca-300 dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-slate-50 dark:bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={o.file} alt={o.nombre} width="48" height="48" />
                </div>
                <div className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
                  {o.nombre}
                </div>
                <div className="mt-0.5 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                  {o.desc}
                </div>
                {activo && (
                  <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-marca-700 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-white">
                    Activo
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Indicador del cursor activo */}
        <div className="mb-6 rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] dark:border-slate-700 dark:bg-slate-800">
          <span className="text-slate-500 dark:text-slate-400">Cursor actual: </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">
            {opcionActiva ? opcionActiva.nombre : "Sistema (sin cambios)"}
          </span>
          {opcionActiva && (
            <button
              onClick={() => setSeleccion(null)}
              className="ml-3 text-[12px] text-marca-700 underline-offset-2 hover:underline dark:text-marca-300"
            >
              Quitar (volver al sistema)
            </button>
          )}
        </div>

        {/* Demo: elementos interactivos para probar el cursor */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-[15px] font-bold text-slate-900 dark:text-slate-100">
            Área de prueba — interactúa con estos elementos
          </h2>

          {/* Botones */}
          <div className="mb-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Botones
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="rounded-md bg-marca-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-marca-800">
                Botón primario
              </button>
              <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:border-marca-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200">
                Botón secundario
              </button>
              <button className="rounded-md bg-coral-500 px-4 py-2 text-[13px] font-semibold text-white hover:opacity-90" style={{ backgroundColor: "#f4734d" }}>
                Botón coral
              </button>
            </div>
          </div>

          {/* Links */}
          <div className="mb-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Links
            </div>
            <p className="text-[13.5px] leading-relaxed text-slate-700 dark:text-slate-300">
              Este es un párrafo con{" "}
              <a href="#" className="text-marca-700 underline underline-offset-2 dark:text-marca-300">
                un enlace de ejemplo
              </a>{" "}
              en el medio para que pruebes el cursor sobre texto y links. También
              hay <a href="#" className="text-marca-700 underline underline-offset-2 dark:text-marca-300">otro link aquí</a> y{" "}
              <a href="#" className="text-marca-700 underline underline-offset-2 dark:text-marca-300">otro más</a>.
            </p>
          </div>

          {/* Cards */}
          <div className="mb-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Cards
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {["París", "Tokio", "Buenos Aires"].map((c) => (
                <button
                  key={c}
                  className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-marca-400 hover:bg-white dark:border-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
                >
                  <div className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">{c}</div>
                  <div className="text-[11.5px] text-slate-500 dark:text-slate-400">Card de muestra</div>
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="mb-5">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Input de texto
            </div>
            <input
              type="text"
              placeholder="Escribe algo aquí…"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-[14px] outline-none focus:border-marca-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Nota: en inputs de texto el cursor cambia al I-beam del sistema (correcto, no se sobrescribe).
            </p>
          </div>

          {/* Lista de scroll */}
          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Texto largo (para mover el cursor)
            </div>
            <div className="max-h-32 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 text-[12.5px] leading-relaxed text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
              Anduve es un planificador de viajes que te dice a dónde puedes ir
              según tu presupuesto. Te muestra rutas multiciudad con vuelos
              reales, días recomendados, transporte entre ciudades (AVE, Eurostar,
              FlixBus), hospedaje, comida y extras. Funciona desde cualquier
              hub aéreo del mundo gracias al catálogo IATA mundial. La idea de
              fondo es: en vez de buscar destinos uno por uno, escribe cuánto
              tienes y descubre todo lo que cabe. El cursor que estás probando
              ahora mismo va a ser el que verán todos los usuarios de la app,
              así que tómate tu tiempo en evaluarlo bien antes de elegir.
            </div>
          </div>
        </section>

        <div className="mt-8 text-center text-[12px] text-slate-500">
          Cuando decidas, escribe en el chat:{" "}
          <span className="font-mono font-semibold text-marca-700 dark:text-marca-300">
            "Elijo el cursor [nombre]"
          </span>
          {" "}— borro esta página y aplico la elección globalmente.
        </div>
      </div>
    </main>
  );
}
