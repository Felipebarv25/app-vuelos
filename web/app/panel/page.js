"use client";
import { useEffect, useState } from "react";

// Panel privado de métricas (solo para el dueño). Protegido por contraseña.
// Ruta: /panel

// Código ISO de país -> emoji de bandera (regional indicators).
function bandera(cc) {
  if (!cc || cc.length !== 2) return "🌍";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}
const PAISES = {
  CO: "Colombia", US: "Estados Unidos", ES: "España", MX: "México", AR: "Argentina",
  PE: "Perú", CL: "Chile", BR: "Brasil", EC: "Ecuador", FR: "Francia", IT: "Italia",
  DE: "Alemania", GB: "Reino Unido", CA: "Canadá", PA: "Panamá", VE: "Venezuela",
  UY: "Uruguay", BO: "Bolivia", PT: "Portugal", NL: "Países Bajos", JP: "Japón",
};
const nombrePais = (cc) => `${bandera(cc)} ${PAISES[cc] || cc}`;

// Tarjeta de indicador.
function Kpi({ etiqueta, valor, color = "text-marca-700" }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
      <div className={`text-[26px] font-extrabold tracking-tight ${color}`}>{valor}</div>
      <div className="mt-0.5 text-[12.5px] text-slate-500">{etiqueta}</div>
    </div>
  );
}

// Lista de barras horizontales (rankings).
function Barras({ titulo, datos, formato = (n) => n, color = "bg-marca-500", vacio = "Sin datos aún" }) {
  const max = Math.max(1, ...datos.map((d) => d.valor));
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
      <div className="mb-3 text-sm font-bold text-marca-900">{titulo}</div>
      {datos.length === 0 ? (
        <div className="py-4 text-center text-[13px] text-slate-400">{vacio}</div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {datos.map((d, i) => (
            <div key={i}>
              <div className="mb-0.5 flex items-center justify-between gap-2 text-[12.5px]">
                <span className="truncate text-slate-700">{formato(d.nombre)}</span>
                <span className="shrink-0 font-bold text-slate-500">{d.valor}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${(d.valor / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Gráfica de barras verticales (visitas por día).
function PorDia({ serie }) {
  const max = Math.max(1, ...serie.map((d) => d.visitas));
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
      <div className="mb-3 text-sm font-bold text-marca-900">Visitas por día (últimos 30)</div>
      <div className="flex h-40 items-end gap-[3px]">
        {serie.map((d, i) => (
          <div key={i} className="group relative flex-1" title={`${d.dia}: ${d.visitas}`}>
            <div
              className="w-full rounded-t bg-gradient-to-t from-marca-400 to-marca-600 transition-all hover:from-marca-500 hover:to-marca-700"
              style={{ height: `${Math.max(2, (d.visitas / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-slate-400">
        <span>{serie[0]?.dia?.slice(5)}</span>
        <span>{serie[serie.length - 1]?.dia?.slice(5)}</span>
      </div>
    </div>
  );
}

export default function Panel() {
  const [clave, setClave] = useState("");
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function cargar(c) {
    setCargando(true);
    setError("");
    try {
      const r = await fetch(`/api/panel?clave=${encodeURIComponent(c)}`);
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || "No se pudo cargar.");
        setDatos(null);
        if (r.status === 401) sessionStorage.removeItem("v360_panel");
      } else {
        setDatos(d);
        sessionStorage.setItem("v360_panel", c);
      }
    } catch {
      setError("Error de red.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    const c = sessionStorage.getItem("v360_panel");
    if (c) {
      setClave(c);
      cargar(c);
    }
  }, []);

  // --- Pantalla de acceso ---
  if (!datos) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7fb] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-100 bg-white p-6 shadow-media">
          <div className="text-center text-2xl font-extrabold tracking-tight text-marca-900">📊 Panel</div>
          <p className="mt-1 text-center text-[13px] text-slate-500">Métricas de Viajero 360</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (clave.trim()) cargar(clave.trim());
            }}
            className="mt-5"
          >
            <input
              type="password"
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              placeholder="Contraseña"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-[15px] outline-none focus:border-marca-400"
            />
            <button
              type="submit"
              disabled={cargando}
              className="mt-3 w-full rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 px-4 py-3 text-sm font-bold text-white shadow-marca transition hover:brightness-105 disabled:opacity-60"
            >
              {cargando ? "Entrando…" : "Entrar"}
            </button>
          </form>
          {error && <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-center text-[13px] text-red-600">{error}</div>}
        </div>
      </div>
    );
  }

  // --- Panel ---
  const serie = datos.serie || [];
  const suma = (n) => serie.slice(-n).reduce((a, b) => a + b.visitas, 0);
  const hoy = serie[serie.length - 1]?.visitas || 0;

  return (
    <div className="min-h-screen bg-[#f6f7fb] px-4 py-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-marca-900">📊 Panel de métricas</h1>
            <p className="text-[13px] text-slate-500">Viajero 360 · solo para ti</p>
          </div>
          <button
            onClick={() => {
              sessionStorage.removeItem("v360_panel");
              setDatos(null);
              setClave("");
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] font-semibold text-slate-600 hover:bg-slate-50"
          >
            Salir
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi etiqueta="Visitas hoy" valor={hoy} />
          <Kpi etiqueta="Últimos 7 días" valor={suma(7)} />
          <Kpi etiqueta="Últimos 30 días" valor={suma(30)} />
          <Kpi etiqueta="Visitas totales" valor={datos.visitasTotal} color="text-emerald-600" />
          <Kpi etiqueta="Búsquedas" valor={datos.busquedasTotal} />
          <Kpi etiqueta="Presupuestos" valor={datos.presTotal} color="text-emerald-600" />
        </div>

        {/* Visitas por día */}
        <div className="mt-4">
          <PorDia serie={serie} />
        </div>

        {/* Geografía de visitantes */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Barras titulo="🌎 Países de tus visitantes" datos={datos.geoPais} formato={nombrePais} />
          <Barras titulo="🏙️ Ciudades de tus visitantes" datos={datos.geoCiudad} />
        </div>

        {/* Búsquedas */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Barras titulo="🔎 Ciudades más buscadas" datos={datos.buscCiudad} color="bg-violet-500" />
          <Barras titulo="🔎 Países más buscados" datos={datos.buscPais} color="bg-violet-500" />
        </div>

        {/* Presupuestos */}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Barras titulo="💰 Presupuestos por rango" datos={datos.presRango} color="bg-emerald-500" />
          <Barras titulo="💰 Regiones más consultadas" datos={datos.presRegion} color="bg-emerald-500" />
        </div>

        <div className="mt-6 text-center text-[11px] text-slate-400">
          Datos anónimos y agregados · geolocalización aproximada por IP (Vercel)
        </div>
      </div>
    </div>
  );
}
