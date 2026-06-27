"use client";
// Pagina TEMPORAL para comparar visualmente las 3 propuestas de organizacion
// del home post-login. El usuario alterna entre A/B/C y elige una.
//
// Acceso: https://anduve-app.vercel.app/diseno-prueba
// Despues de la eleccion se borra esta pagina y se implementa la elegida en
// el home real.
import { useState } from "react";

const OPCIONES = [
  { id: "A", label: "A. Rutas separadas + nav top", esfuerzo: "Alto", recomendada: true },
  { id: "B", label: "B. Tabs en la home", esfuerzo: "Medio", recomendada: false },
  { id: "C", label: "C. Sticky nav + anclas", esfuerzo: "Bajo", recomendada: false },
];

// Datos mock representativos para que los mockups se sientan reales.
const DESTINOS_MOCK = [
  { ciudad: "Madrid", pais: "España", img: "linear-gradient(135deg, #fcb045 0%, #fd1d1d 50%, #833ab4 100%)" },
  { ciudad: "Tokio", pais: "Japón", img: "linear-gradient(135deg, #2c3e50 0%, #4ca1af 100%)" },
  { ciudad: "París", pais: "Francia", img: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" },
  { ciudad: "Buenos Aires", pais: "Argentina", img: "linear-gradient(135deg, #1d976c 0%, #93f9b9 100%)" },
];

const OFERTAS_MOCK = [
  { ruta: "BOG → Madrid", precio: "US$ 620", descuento: "−18%", fecha: "6 nov – 28 nov" },
  { ruta: "BOG → Lisboa", precio: "US$ 590", descuento: "−22%", fecha: "15 oct – 5 nov" },
  { ruta: "MDE → Roma", precio: "US$ 780", descuento: "−12%", fecha: "20 nov – 10 dic" },
];

export default function DisenoPrueba() {
  const [opcion, setOpcion] = useState("A");

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {/* Barra superior del playground */}
      <div className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
              Página de prueba · diseño
            </div>
            <div className="text-[14px] font-bold text-slate-900 dark:text-slate-100">
              Compara las 3 propuestas de organización
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {OPCIONES.map((o) => (
              <button
                key={o.id}
                onClick={() => setOpcion(o.id)}
                className={`rounded-md border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  opcion === o.id
                    ? "border-marca-700 bg-marca-700 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-marca-400 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
                }`}
              >
                {o.label}
                {o.recomendada && (
                  <span className="ml-1.5 inline-flex items-center rounded-sm bg-amber-100 px-1 text-[9px] font-bold uppercase text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
                    ★ rec
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Mockup activo */}
      <div className="mx-auto max-w-6xl px-4 py-6">
        {opcion === "A" && <MockupA />}
        {opcion === "B" && <MockupB />}
        {opcion === "C" && <MockupC />}
      </div>

      {/* Footer con instruccion */}
      <div className="border-t border-slate-200 bg-white px-4 py-6 dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto max-w-3xl text-center text-[13px] text-slate-600 dark:text-slate-400">
          Cuando decidas, escribe en el chat:{" "}
          <span className="font-mono font-semibold text-marca-700 dark:text-marca-300">"Elijo la opción A/B/C"</span>
          {" "}— borro esta página de prueba y aplico la elegida en el home real.
        </div>
      </div>
    </div>
  );
}

// ============= MOCKUP A: Rutas separadas + nav top =============
function MockupA() {
  return (
    <div className="space-y-4">
      <NotaMockup
        titulo="A. Rutas separadas con navegación superior"
        texto="Home limpio con SOLO el hero del presupuesto + 3 cards de entrada a secciones independientes. Cada sección tiene su propia URL (/destinos, /ofertas, /mis-viajes). Top nav con los nombres."
        pros={["Cada sección compartible vía URL", "Mejor SEO — /ofertas indexable en Google", "Hero del presupuesto sin competencia visual", "Móvil: navegación clara"]}
        cons={["Más trabajo: 3 rutas nuevas", "Requiere refactor del rendering actual"]}
      />

      {/* Mockup visual */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700">
        {/* Top bar simulada */}
        <div className="relative h-[420px] overflow-hidden bg-gradient-to-br from-marca-800 via-marca-700 to-marca-900">
          <div className="absolute inset-0 bg-[url('/landing-hero-1.jpg')] bg-cover bg-center opacity-30" />
          <div className="relative flex h-full flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2 rounded-md bg-marca-950/30 px-3 py-1.5 text-[13px] font-bold text-white backdrop-blur-sm">
                <span>ANDU</span><span className="text-coral-400" style={{ color: "#f4734d" }}>VE</span>
              </div>
              {/* NAV NUEVO */}
              <div className="flex items-center gap-1">
                <button className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white/90 hover:bg-white/10">Destinos</button>
                <button className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white/90 hover:bg-white/10">Ofertas</button>
                <button className="rounded-md px-3 py-1.5 text-[13px] font-medium text-white/90 hover:bg-white/10">Mis viajes</button>
                <div className="mx-2 h-5 w-px bg-white/20" />
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-marca-200 text-[11px] font-bold text-marca-800">F</div>
              </div>
            </div>
            {/* Hero */}
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <div className="mb-3 text-[12px] font-medium text-white/80">Buenos días, Felipe 👋</div>
              <h1 className="mb-4 text-[28px] font-extrabold text-white">¿Cuánto presupuesto tienes para tu viaje?</h1>
              <div className="flex w-full max-w-md gap-2 rounded-lg bg-white p-2 shadow-lg">
                <input value="$ 10.000.000" disabled className="flex-1 bg-transparent px-2 text-[18px] font-semibold text-slate-900" />
                <button className="rounded-md bg-marca-700 px-4 py-2 text-[13px] font-semibold text-white">Ver opciones →</button>
              </div>
            </div>
          </div>
        </div>

        {/* Body con 3 cards de entrada */}
        <div className="bg-slate-50 px-6 py-10 dark:bg-slate-900">
          <div className="mx-auto max-w-3xl">
            <div className="mb-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
              O explora sin pensar en presupuesto
            </div>
            <div className="mx-auto mb-6 h-px w-12 bg-slate-300 dark:bg-slate-600" />
            <div className="grid gap-3 sm:grid-cols-3">
              <CardEntradaA icono="globe" titulo="Destinos populares" subtitulo="80+ ciudades del mundo" cta="Ver destinos →" />
              <CardEntradaA icono="plane" titulo="Vuelos baratos" subtitulo="Detectados cada 3 h" cta="Ver ofertas →" />
              <CardEntradaA icono="bookmark" titulo="Mis viajes" subtitulo="3 guardados" cta="Ver mis viajes →" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CardEntradaA({ icono, titulo, subtitulo, cta }) {
  return (
    <div className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-5 transition hover:border-marca-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-marca-50 text-marca-700 dark:bg-marca-900/30 dark:text-marca-300">
        <Icono nombre={icono} />
      </div>
      <div className="text-[14px] font-bold text-slate-900 dark:text-slate-100">{titulo}</div>
      <div className="mt-0.5 text-[12px] text-slate-500 dark:text-slate-400">{subtitulo}</div>
      <div className="mt-3 text-[12.5px] font-semibold text-marca-700 dark:text-marca-300 group-hover:underline">{cta}</div>
    </div>
  );
}

// ============= MOCKUP B: Tabs en la home =============
function MockupB() {
  const [tab, setTab] = useState("destinos");
  return (
    <div className="space-y-4">
      <NotaMockup
        titulo="B. Tabs en la misma página"
        texto="Hero del presupuesto fijo arriba. Debajo, una barra de tabs con [Destinos · Ofertas · Mis viajes]. El contenido cambia en sitio sin navegar de página."
        pros={["Más rápido de construir", "Switching instantáneo entre secciones", "Una sola URL — simple"]}
        cons={["No comparte vía URL (a menos que usemos hash)", "Sin beneficio SEO independiente", "Móvil: hero + tabs ocupan mucha pantalla"]}
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700">
        {/* Hero más bajo (200px en vez de 420) */}
        <div className="relative h-[280px] overflow-hidden bg-gradient-to-br from-marca-800 via-marca-700 to-marca-900">
          <div className="absolute inset-0 bg-[url('/landing-hero-1.jpg')] bg-cover bg-center opacity-30" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between px-6 py-4">
              <div className="flex items-center gap-2 rounded-md bg-marca-950/30 px-3 py-1.5 text-[13px] font-bold text-white backdrop-blur-sm">
                <span>ANDU</span><span style={{ color: "#f4734d" }}>VE</span>
              </div>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-marca-200 text-[11px] font-bold text-marca-800">F</div>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
              <h1 className="mb-3 text-[22px] font-extrabold text-white">¿Cuánto presupuesto tienes?</h1>
              <div className="flex w-full max-w-md gap-2 rounded-lg bg-white p-2">
                <input value="$ 10.000.000" disabled className="flex-1 bg-transparent px-2 text-[16px] font-semibold text-slate-900" />
                <button className="rounded-md bg-marca-700 px-3 py-1.5 text-[12px] font-semibold text-white">Ver opciones</button>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-200 bg-white px-6 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex gap-6">
            {[
              ["destinos", "Destinos populares"],
              ["ofertas", "Vuelos baratos"],
              ["misviajes", "Mis viajes"],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`relative py-3.5 text-[13px] font-semibold transition ${
                  tab === k ? "text-marca-700 dark:text-marca-300" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {label}
                {tab === k && <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-marca-700 dark:bg-marca-400" />}
              </button>
            ))}
          </div>
        </div>

        {/* Contenido del tab */}
        <div className="bg-slate-50 p-6 dark:bg-slate-900">
          {tab === "destinos" && <GrillaDestinosMock />}
          {tab === "ofertas" && <GrillaOfertasMock />}
          {tab === "misviajes" && <ListaMisViajesMock />}
        </div>
      </div>
    </div>
  );
}

// ============= MOCKUP C: Sticky nav + anclas =============
function MockupC() {
  return (
    <div className="space-y-4">
      <NotaMockup
        titulo="C. Sticky pill nav + scroll anclado"
        texto="Todo sigue en la misma página, pero aparece un menú flotante en la parte superior con [Presupuesto · Destinos · Ofertas]. Click en cualquiera hace scroll suave a esa sección."
        pros={["Mínimo cambio del código actual", "Una sola página: simple", "30 min de implementación"]}
        cons={["Sigue siendo scroll largo en móvil", "El usuario no sabe a priori qué hay sin scrollear", "Menos sensación de \"app organizada\""]}
      />

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-md dark:border-slate-700">
        {/* Sticky pill nav simulado dentro del mockup */}
        <div className="border-b border-slate-200 bg-white px-6 py-2 dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto inline-flex gap-1 rounded-full border border-slate-200 bg-slate-50 p-1 text-[12px] dark:border-slate-700 dark:bg-slate-700">
            <button className="rounded-full bg-marca-700 px-3 py-1 font-semibold text-white">Presupuesto</button>
            <button className="rounded-full px-3 py-1 font-medium text-slate-600 dark:text-slate-300">Destinos</button>
            <button className="rounded-full px-3 py-1 font-medium text-slate-600 dark:text-slate-300">Ofertas</button>
          </div>
        </div>

        {/* Hero */}
        <div className="relative h-[280px] overflow-hidden bg-gradient-to-br from-marca-800 via-marca-700 to-marca-900">
          <div className="absolute inset-0 bg-[url('/landing-hero-1.jpg')] bg-cover bg-center opacity-30" />
          <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
            <div className="mb-2 text-[11px] font-medium text-white/80">Sección: Presupuesto</div>
            <h1 className="mb-3 text-[22px] font-extrabold text-white">¿Cuánto presupuesto tienes?</h1>
            <div className="flex w-full max-w-md gap-2 rounded-lg bg-white p-2">
              <input value="$ 10.000.000" disabled className="flex-1 bg-transparent px-2 text-[16px] font-semibold text-slate-900" />
              <button className="rounded-md bg-marca-700 px-3 py-1.5 text-[12px] font-semibold text-white">Ver opciones</button>
            </div>
          </div>
        </div>

        {/* Sección destinos */}
        <div className="border-t-4 border-marca-700 bg-slate-50 px-6 py-6 dark:bg-slate-900">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">Sección anclada</div>
          <h2 className="mb-4 text-[16px] font-bold text-slate-900 dark:text-slate-100">Destinos populares</h2>
          <GrillaDestinosMock />
        </div>

        {/* Sección ofertas */}
        <div className="border-t-4 border-marca-700 bg-white px-6 py-6 dark:bg-slate-800">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">Sección anclada</div>
          <h2 className="mb-4 text-[16px] font-bold text-slate-900 dark:text-slate-100">Vuelos baratos detectados</h2>
          <GrillaOfertasMock />
        </div>

        <div className="bg-slate-50 px-6 py-4 text-center text-[11px] text-slate-400 dark:bg-slate-900">
          ... y así sucesivamente bajando con scroll
        </div>
      </div>
    </div>
  );
}

// ============= Componentes compartidos =============
function GrillaDestinosMock() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DESTINOS_MOCK.map((d) => (
        <div key={d.ciudad} className="overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="h-24" style={{ background: d.img }} />
          <div className="p-2.5">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{d.ciudad}</div>
            <div className="text-[11px] text-slate-500">{d.pais}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function GrillaOfertasMock() {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {OFERTAS_MOCK.map((o) => (
        <div key={o.ruta} className="rounded-md border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{o.ruta}</div>
            <span className="rounded-sm bg-emerald-100 px-1.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">{o.descuento}</span>
          </div>
          <div className="mt-1 text-[16px] font-bold text-slate-900 dark:text-slate-100">{o.precio}</div>
          <div className="text-[11px] text-slate-500">{o.fecha}</div>
        </div>
      ))}
    </div>
  );
}

function ListaMisViajesMock() {
  return (
    <div className="space-y-2">
      {["Mochilear por Europa · 12 días", "Tokio + Kioto · 8 días", "Italia romántica · 7 días"].map((t) => (
        <div key={t} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
          <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">{t}</div>
          <button className="text-[11.5px] font-medium text-marca-700 dark:text-marca-300">Abrir →</button>
        </div>
      ))}
    </div>
  );
}

function NotaMockup({ titulo, texto, pros, cons }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">{titulo}</div>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-600 dark:text-slate-400">{texto}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">A favor</div>
          <ul className="space-y-0.5 text-[12px] text-slate-700 dark:text-slate-300">
            {pros.map((p) => <li key={p} className="flex gap-1.5"><span className="text-emerald-600">+</span>{p}</li>)}
          </ul>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">En contra</div>
          <ul className="space-y-0.5 text-[12px] text-slate-700 dark:text-slate-300">
            {cons.map((c) => <li key={c} className="flex gap-1.5"><span className="text-rose-600">−</span>{c}</li>)}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Icono({ nombre }) {
  const props = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  if (nombre === "globe") return (<svg {...props}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>);
  if (nombre === "plane") return (<svg {...props}><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z" /></svg>);
  if (nombre === "bookmark") return (<svg {...props}><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>);
  return null;
}
