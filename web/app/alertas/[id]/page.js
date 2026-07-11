// Detalle de una alerta de precio del usuario. Server component (SSR) que lee
// la alerta de KV + el historial de precios del detector (datos/historial.csv)
// y arma una tabla mes-por-mes con el mejor precio resaltado, promedio de los
// ultimos 90 dias, y ahorro estimado por mes vs ese promedio.
//
// Acceso: /alertas/<id> donde <id> es el hash hex de 16 chars que genera
// crearAlerta. URL casi imposible de adivinar (~10^19 combinaciones), por lo
// que NO requerimos auth — quien tenga el link la ve. Si en el futuro se
// quiere endurecer, comparar a.email vs sesion.

import Link from "next/link";
import { leerAlerta } from "@/lib/alertas";
import { preciosPorMes } from "@/lib/historialPrecios";
import NavTop from "@/components/NavTop";
import BotonVolver from "@/components/BotonVolver";
import FooterAnduve from "@/components/FooterAnduve";
import BottomTabBar from "@/components/BottomTabBar";

export const dynamic = "force-dynamic";

export default async function AlertaDetalle({ params }) {
  const { id } = await params;
  const alerta = await leerAlerta(id);

  if (!alerta) {
    return (
      <div className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-900 md:pb-0">
        <NavTop />
        <main className="mx-auto max-w-2xl px-4 py-16 text-center">
          <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
            Alerta no encontrada
          </h1>
          <p className="mt-2 text-[14px] text-slate-600 dark:text-slate-400">
            Esta alerta ya no existe o expiró (las alertas viven 6 meses).
          </p>
          <Link href="/" className="mt-6 inline-flex rounded-md bg-marca-700 px-4 py-2 text-[13px] font-semibold text-white hover:bg-marca-800">
            Volver al inicio
          </Link>
        </main>
        <BottomTabBar />
      </div>
    );
  }

  const datos = await preciosPorMes(alerta.iata);
  const tieneDatos = datos && datos.meses && datos.meses.length >= 2;

  // Calculos para resumen — promedio y comparacion vs umbral.
  let promedio = null;
  let ahorroVsPromedio = null;
  if (tieneDatos) {
    promedio = Math.round(datos.meses.reduce((s, m) => s + m.precio, 0) / datos.meses.length);
    ahorroVsPromedio = promedio - datos.mejor.precio;
  }

  const fmt = (n) => "US$ " + Math.round(n).toLocaleString("en-US");

  return (
    <div className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-900 md:pb-0">
      <NavTop />
      <BotonVolver />

      <main className="mx-auto max-w-3xl px-4 py-8 lg:px-8 lg:py-10">
        {/* Breadcrumb / volver */}
        <div className="mb-3 text-[12.5px] text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-marca-600">Inicio</Link>
          <span className="mx-1.5 text-slate-300">/</span>
          <span className="text-slate-700 dark:text-slate-300">Alerta</span>
        </div>

        {/* Cabecera con datos del destino + estado de la alerta */}
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
          Alerta de precio
        </div>
        <h1 className="text-[26px] font-extrabold tracking-tight text-slate-900 lg:text-[32px] dark:text-slate-100">
          {alerta.ciudad}, {alerta.pais}
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13.5px] text-slate-600 dark:text-slate-400">
          <span>
            Te avisamos cuando el vuelo baje de <b className="text-slate-900 dark:text-slate-100">{fmt(alerta.umbral)}</b>
          </span>
          {alerta.activa ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              · Activa
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11.5px] font-bold uppercase tracking-wider text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              · Disparada (pausada)
            </span>
          )}
        </div>

        {/* Filtro anti-spam (2026-06-29): solo emails cuando precio esta al
            menos 20% bajo el promedio historico. Hace visible al usuario el
            criterio adicional para que entienda por que no recibe spam. */}
        {tieneDatos && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span>
              Solo te avisamos si el precio está al menos <b>20% bajo el promedio</b>{" "}
              (≤ <b>{fmt(Math.round(promedio * 0.80))}</b>). Filtro anti-spam.
            </span>
          </div>
        )}

        {/* Estado: sin datos */}
        {!tieneDatos && (
          <div className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
            <div className="text-[15px] font-bold text-slate-900 dark:text-slate-100">
              Aún no tenemos suficiente historial para esta ruta
            </div>
            <p className="mt-1.5 text-[13.5px] text-slate-600 dark:text-slate-400">
              El detector escanea precios cada 3 horas. En unos días tendremos suficientes muestras para
              mostrarte el mejor mes y el promedio. Tu alerta sigue activa — te llegará un email cuando
              baje de {fmt(alerta.umbral)}.
            </p>
          </div>
        )}

        {/* Con datos: stats + tabla */}
        {tieneDatos && (
          <>
            {/* 3 stat cards arriba */}
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <StatCard label="Mejor precio histórico" valor={fmt(datos.mejor.precio)} sub={`En ${datos.mejor.label}`} destacado />
              <StatCard label="Promedio últimos 90 días" valor={fmt(promedio)} sub="Mediana por mes" />
              <StatCard label="Tu umbral" valor={fmt(alerta.umbral)} sub={alerta.umbral >= datos.mejor.precio ? "Ya alcanzado alguna vez" : `Te faltan ${fmt(datos.mejor.precio - alerta.umbral)}`} />
            </div>

            {/* Recomendacion principal */}
            <div className={`mt-5 rounded-lg border p-4 text-[13.5px] leading-relaxed ${
              ahorroVsPromedio > 0
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
            }`}>
              <div className="font-bold">
                Mejor mes para volar: <span className="capitalize">{datos.mejor.label}</span> · {fmt(datos.mejor.precio)}
              </div>
              <p className="mt-1">
                {ahorroVsPromedio > 0 ? (
                  <>
                    Eso es <b>{fmt(ahorroVsPromedio)} menos</b> que el promedio
                    ({Math.round((ahorroVsPromedio / promedio) * 100)}% de ahorro).
                  </>
                ) : (
                  "Precios uniformes — no hay un mes claramente más barato."
                )}
                {datos.mejor.precio <= alerta.umbral &&
                  " Y ya ha estado por debajo de tu umbral — si vuelve a aparecer, te avisamos por email."}
              </p>
            </div>

            {/* Tabla por mes */}
            <h2 className="mt-8 text-[16px] font-bold text-slate-900 dark:text-slate-100">
              Precios por mes
            </h2>
            <p className="mt-1 text-[12.5px] text-slate-500 dark:text-slate-400">
              Mediana de precio observado por mes desde Colombia (BOG/MDE). El mes más barato está resaltado.
            </p>
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
              <table className="w-full text-[13.5px]">
                <thead className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Mes</th>
                    <th className="px-3 py-2.5 text-right">Mediana</th>
                    <th className="px-3 py-2.5 text-right">vs promedio</th>
                    <th className="px-3 py-2.5 text-right">Ahorro vs promedio</th>
                  </tr>
                </thead>
                <tbody>
                  {datos.meses.map((m) => {
                    const diff = m.precio - promedio;
                    const pct = promedio ? Math.round((diff / promedio) * 100) : 0;
                    return (
                      <tr
                        key={m.ym}
                        className={`border-b border-slate-100 last:border-b-0 dark:border-slate-700 ${
                          m.mejor ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5 font-medium capitalize text-slate-900 dark:text-slate-100">
                          {m.label}
                          {m.mejor && (
                            <span className="ml-2 rounded-sm bg-emerald-700 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
                              Más barato
                            </span>
                          )}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${m.mejor ? "font-bold text-emerald-800 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}>
                          {fmt(m.precio)}
                        </td>
                        <td className={`px-3 py-2.5 text-right tabular-nums ${
                          diff < 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : diff > 0
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-slate-400"
                        }`}>
                          {diff === 0 ? "—" : (diff > 0 ? "+" : "") + pct + "%"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {diff < 0 ? fmt(-diff) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-[11.5px] text-slate-400">
              Datos del detector propio de Anduve. Solo meses con ≥2 muestras se incluyen.
            </p>
          </>
        )}
      </main>

      <FooterAnduve />
      <BottomTabBar />
    </div>
  );
}

function StatCard({ label, valor, sub, destacado = false }) {
  return (
    <div className={`rounded-xl border p-4 ${
      destacado
        ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30"
        : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
    }`}>
      <div className={`text-[10.5px] font-semibold uppercase tracking-wider ${
        destacado
          ? "text-emerald-700 dark:text-emerald-400"
          : "text-slate-500 dark:text-slate-400"
      }`}>
        {label}
      </div>
      <div className={`mt-1 text-[22px] font-extrabold tabular-nums tracking-tight ${
        destacado
          ? "text-emerald-900 dark:text-emerald-200"
          : "text-slate-900 dark:text-slate-100"
      }`}>
        {valor}
      </div>
      {sub && (
        <div className={`mt-0.5 text-[12px] ${
          destacado
            ? "text-emerald-700/80 dark:text-emerald-300/80"
            : "text-slate-500 dark:text-slate-400"
        }`}>
          {sub}
        </div>
      )}
    </div>
  );
}
