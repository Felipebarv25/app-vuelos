"use client";
import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/track";
import {
  calcularDestinos,
  construirRuta,
  ciudadesDeRegion,
  llaveCiudad,
  diasPosibles,
  REGIONES,
  MONEDAS,
} from "@/lib/presupuesto";

// Módulo "¿Adónde puedo ir con mi presupuesto?".
// Dos modos:
//  - Un destino: lista de ciudades que caben en el presupuesto.
//  - Ruta multiciudad: arma una ruta de varias ciudades dentro del presupuesto,
//    con botón para regenerar otra ruta.
export default function Presupuesto({ onElegirCiudad, onCerrar, t = (k) => k }) {
  const [modo, setModo] = useState("ruta"); // "ruta" | "destino"
  const [monto, setMonto] = useState(10000000); // 10M COP por defecto
  const [moneda, setMoneda] = useState("COP");
  const [dias, setDias] = useState(10);
  const [personas, setPersonas] = useState(1);
  const [region, setRegion] = useState("europa");
  const [detalle, setDetalle] = useState(null);

  // Ruta
  const [inicio, setInicio] = useState(""); // llaveCiudad de la ciudad de salida
  const [semilla, setSemilla] = useState(0);

  // Modo destino: buscador de texto.
  const [buscarDestino, setBuscarDestino] = useState("");

  // Ruta: ciudades excluidas (las que el usuario no quiere en su ruta).
  const [excluidos, setExcluidos] = useState([]);

  const presupuestoUsd = monto * MONEDAS[moneda].aUsd;

  // Métrica: registra el presupuesto + región usados (2s tras dejar de cambiar,
  // para no contar cada tecla). Alimenta el panel privado.
  useEffect(() => {
    if (!presupuestoUsd) return;
    const id = setTimeout(
      () => track("presupuesto", { usd: Math.round(presupuestoUsd), region }),
      2000
    );
    return () => clearTimeout(id);
  }, [presupuestoUsd, region]);

  const resultados = useMemo(
    () => calcularDestinos({ presupuestoUsd, dias, personas, region }),
    [presupuestoUsd, dias, personas, region]
  );
  const caben = resultados.filter((r) => r.cabe);

  const ciudadesRegion = useMemo(() => ciudadesDeRegion(region), [region]);

  const ruta = useMemo(
    () =>
      construirRuta({ presupuestoUsd, dias, personas, region, inicio, semilla, excluir: excluidos }),
    [presupuestoUsd, dias, personas, region, inicio, semilla, excluidos]
  );

  // Nombre legible de una ciudad excluida (a partir de su llave).
  const nombreLlave = (k) => k.split("|")[0];

  function fmtUsd(v) {
    return "US$ " + Math.round(v).toLocaleString("en-US");
  }
  function fmtLocal(usd) {
    const m = MONEDAS[moneda];
    const val = usd / m.aUsd;
    return m.simbolo + " " + Math.round(val).toLocaleString("es-CO");
  }

  return (
    <div className="fixed inset-0 z-[4000] flex items-end justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="animar-subir flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-[0_-12px_40px_rgba(0,0,0,.35)]">
        {/* Cabecera */}
        <div className="bg-gradient-to-br from-marca-600 via-marca-700 to-marca-900 px-5 pb-4 pt-5 text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Viajero 360
              </div>
              <div className="mt-0.5 text-xl font-extrabold tracking-tight">{t("presupTitulo")}</div>
            </div>
            <button
              onClick={onCerrar}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-base text-white transition hover:bg-white/25"
            >
              ✕
            </button>
          </div>

          {/* Conmutador de modo */}
          <div className="mt-4 grid grid-cols-2 gap-1 rounded-2xl bg-black/15 p-1">
            {[
              ["ruta", t("presupModoRuta")],
              ["destino", t("presupModoDestino")],
            ].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setModo(k)}
                className={`rounded-xl py-2 text-sm font-bold transition ${
                  modo === k ? "bg-white text-marca-700 shadow" : "text-white/85"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Cuerpo scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Controles comunes */}
          <div className="grid gap-3">
            <div>
              <Label>{t("presupTuPresup")}</Label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(Math.max(0, +e.target.value))}
                  className="flex-1 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-[15px] outline-none focus:border-marca-400"
                />
                <select
                  value={moneda}
                  onChange={(e) => setMoneda(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-[15px] outline-none"
                >
                  {Object.keys(MONEDAS).map((k) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div className="mt-1 text-xs text-slate-500">≈ {fmtUsd(presupuestoUsd)}</div>
            </div>

            <div className="flex gap-3">
              <label className="flex-1">
                <Label>{t("dias")}</Label>
                <select
                  value={dias}
                  onChange={(e) => setDias(+e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none"
                >
                  {Array.from({ length: 60 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label className="flex-1">
                <Label>{t("presupPersonas")}</Label>
                <select
                  value={personas}
                  onChange={(e) => setPersonas(+e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <Label>{t("presupRegion")}</Label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(REGIONES).map(([k, nombre]) => (
                  <button
                    key={k}
                    onClick={() => { setRegion(k); setInicio(""); setSemilla(0); setExcluidos([]); }}
                    className={`rounded-full px-3.5 py-2 text-[13px] font-semibold transition ${
                      region === k
                        ? "bg-marca-600 text-white shadow"
                        : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-marca-300"
                    }`}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Solo modo ruta: ciudad de salida */}
            {modo === "ruta" && (
              <div>
                <Label>{t("presupDesdeCiudad")}</Label>
                <select
                  value={inicio}
                  onChange={(e) => { setInicio(e.target.value); setSemilla(0); }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[15px] outline-none"
                >
                  <option value="">⭐ {t("recomendado")}</option>
                  {ciudadesRegion.map((c) => (
                    <option key={llaveCiudad(c)} value={llaveCiudad(c)}>
                      {c.bandera} {c.ciudad}, {c.pais}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ---------- MODO RUTA ---------- */}
          {modo === "ruta" && (
            <div className="mt-5">
              {!ruta || ruta.ciudades.length === 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-800">
                  {t("presupNoRuta")}
                </div>
              ) : (
                <RutaCard
                  ruta={ruta}
                  t={t}
                  fmtUsd={fmtUsd}
                  fmtLocal={fmtLocal}
                  onOtra={() => setSemilla((s) => s + 1)}
                  onPlanear={() => onElegirCiudad?.(ruta.entrada)}
                  onPlanearCiudad={(c) => onElegirCiudad?.(c)}
                  onExcluir={(c) =>
                    setExcluidos((x) =>
                      x.includes(llaveCiudad(c)) ? x : [...x, llaveCiudad(c)]
                    )
                  }
                />
              )}

              {/* Ciudades excluidas: fichas para volver a incluirlas */}
              {excluidos.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[12px] font-semibold text-slate-500">
                    {t("presupExcluidas")}:
                  </span>
                  {excluidos.map((k) => (
                    <button
                      key={k}
                      onClick={() => setExcluidos((x) => x.filter((y) => y !== k))}
                      className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-medium text-slate-600 transition hover:bg-slate-200"
                    >
                      {nombreLlave(k)} <span className="text-slate-400">↩</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---------- MODO DESTINO ---------- */}
          {modo === "destino" && (
            <div className="mt-5">
              <div className="flex items-center justify-between rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 px-4 py-3.5">
                <div>
                  <div className="text-2xl font-extrabold text-emerald-700">{caben.length}</div>
                  <div className="text-xs text-slate-500">{t("presupDestinos")}</div>
                </div>
                <div className="text-right text-[13px] text-slate-500">
                  {dias} {t("dias").toLowerCase()} · {personas}{" "}
                  {personas > 1 ? t("presupPersonasP") : t("presupPersonaS")}
                </div>
              </div>

              <input
                value={buscarDestino}
                onChange={(e) => setBuscarDestino(e.target.value)}
                placeholder={t("presupBuscarCiudad")}
                className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-[14px] outline-none focus:border-marca-400"
              />

              <div className="mt-3 space-y-2.5">
                {resultados
                  .filter((d) => {
                    const q = buscarDestino.trim().toLowerCase();
                    if (!q) return true;
                    return (d.ciudad + " " + d.pais).toLowerCase().includes(q);
                  })
                  .map((d) => (
                  <div
                    key={llaveCiudad(d)}
                    className={`rounded-2xl border bg-white p-3.5 transition ${
                      d.cabe ? "border-emerald-200" : "border-slate-100 opacity-60"
                    }`}
                  >
                    <div
                      className="flex cursor-pointer items-center gap-3"
                      onClick={() => setDetalle(detalle === llaveCiudad(d) ? null : llaveCiudad(d))}
                    >
                      <span className="text-2xl">{d.bandera}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 font-bold">
                          {d.ciudad}
                          {d.cabe && (
                            <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">✓</span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500">{d.pais}</div>
                      </div>
                      <div className="text-right">
                        <div className={`text-[15px] font-extrabold ${d.cabe ? "text-emerald-600" : "text-slate-400"}`}>
                          {fmtUsd(d.total)}
                        </div>
                        <div className="text-[11px] text-slate-400">{fmtLocal(d.total)}</div>
                      </div>
                    </div>

                    {detalle === llaveCiudad(d) && (
                      <div className="animar-subir mt-3 border-t border-dashed border-slate-200 pt-3">
                        <Fila nombre={t("presupVuelo")} valor={fmtUsd(d.desglose.vuelo)} />
                        <Fila nombre={t("presupHospedaje")} valor={fmtUsd(d.desglose.hospedaje)} />
                        <Fila nombre={t("presupComida")} valor={fmtUsd(d.desglose.comida)} />
                        <Fila nombre={t("presupTransporte")} valor={fmtUsd(d.desglose.transporte)} />
                        <Fila nombre={t("presupExtras")} valor={fmtUsd(d.desglose.extras)} />
                        {d.cabe ? (
                          <div className="mt-1.5 text-xs font-semibold text-emerald-600">
                            {t("presupTeSobra")} {fmtUsd(d.sobra)} · {t("presupAlcanza")}{" "}
                            {diasPosibles(d, presupuestoUsd, personas)} {t("dias").toLowerCase()}
                          </div>
                        ) : (
                          <div className="mt-1.5 text-xs font-semibold text-red-600">
                            {t("presupTeFalta")} {fmtUsd(-d.sobra)}
                          </div>
                        )}
                        <button
                          onClick={() => onElegirCiudad?.(d)}
                          className="mt-3 w-full rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-2.5 text-sm font-bold text-white shadow-marca"
                        >
                          🗺️ {t("presupPlanear")}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 text-[11px] leading-relaxed text-slate-400">{t("presupAviso")}</div>
        </div>
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-slate-500">{children}</div>;
}

function Fila({ nombre, valor }) {
  return (
    <div className="flex justify-between py-1 text-[13px] text-slate-600">
      <span>{nombre}</span>
      <b className="text-slate-800">{valor}</b>
    </div>
  );
}

// Tarjeta de la ruta multiciudad: línea de tiempo de ciudades + resumen + desglose.
function RutaCard({ ruta, t, fmtUsd, fmtLocal, onOtra, onPlanear, onPlanearCiudad, onExcluir }) {
  const { ciudades, desglose, total, cabe, sobra, diasTotales } = ruta;
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-suave">
      {/* Encabezado de la ruta */}
      <div className="border-b border-slate-100 px-4 pb-3 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-marca-500">
              {t("presupRutaTitulo")}
            </div>
            <div className="mt-0.5 text-[15px] font-bold text-slate-800">
              {ciudades.map((c) => c.ciudad).join(" → ")}
            </div>
          </div>
          <span className="text-2xl">{ciudades[0]?.bandera}</span>
        </div>
        <div className="mt-2 flex gap-4 text-[12.5px] text-slate-500">
          <span><b className="text-slate-700">{ciudades.length}</b> {t("presupRutaCiudades")}</span>
          <span><b className="text-slate-700">{diasTotales}</b> {t("presupRutaDias")}</span>
        </div>
      </div>

      {/* Línea de tiempo de ciudades */}
      <div className="px-4 py-3">
        {ciudades.map((c, i) => (
          <div key={llaveCiudad(c)}>
            {i > 0 && (
              <div className="flex items-center gap-2 py-1 pl-3 text-[12px] text-slate-400">
                <span className="text-slate-300">│</span>
                <span>✈️ {fmtUsd(c.salto)} · {c.km.toLocaleString("es-CO")} km</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-marca-600 text-xs font-bold text-white">
                {i + 1}
              </div>
              <button
                onClick={() => onPlanearCiudad?.(c)}
                className="group flex flex-1 items-center gap-2 text-left"
              >
                <div className="flex-1">
                  <div className="font-bold text-slate-800 group-hover:text-marca-600">
                    {c.bandera} {c.ciudad}
                  </div>
                  <div className="text-xs text-slate-500">{c.pais}</div>
                </div>
                <span className="text-[11px] font-bold text-marca-600 opacity-0 transition group-hover:opacity-100">
                  🗺️ {t("presupPlanear")}
                </span>
              </button>
              <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {c.diasAqui} {t("presupRutaDias")}
              </div>
              {ciudades.length > 1 && (
                <button
                  onClick={() => onExcluir?.(c)}
                  title={t("presupExcluir")}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-300 transition hover:bg-red-50 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desglose de costos */}
      <div className="border-t border-slate-100 px-4 py-3">
        <Fila nombre={"✈️ " + t("presupVueloIntl")} valor={fmtUsd(desglose.vueloIntl)} />
        <Fila nombre={"🚄 " + t("presupEntreCiudades")} valor={fmtUsd(desglose.saltos)} />
        <Fila nombre={"🏨 " + t("presupHospedaje")} valor={fmtUsd(desglose.hospedaje)} />
        <Fila nombre={"🍽️ " + t("presupComida")} valor={fmtUsd(desglose.comida)} />
        <Fila nombre={"🚇 " + t("presupTransporte")} valor={fmtUsd(desglose.transporte)} />
        <Fila nombre={"🎟️ " + t("presupExtras")} valor={fmtUsd(desglose.extras)} />
      </div>

      {/* Total */}
      <div className={`flex items-center justify-between px-4 py-3 ${cabe ? "bg-emerald-50" : "bg-red-50"}`}>
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500">Total</div>
          <div className={`text-xl font-extrabold ${cabe ? "text-emerald-700" : "text-red-600"}`}>
            {fmtUsd(total)}
          </div>
          <div className="text-[11px] text-slate-400">{fmtLocal(total)}</div>
        </div>
        <div className="text-right text-[13px] font-semibold">
          {cabe ? (
            <span className="text-emerald-600">💚 {t("presupTeSobra")} {fmtUsd(sobra)}</span>
          ) : (
            <span className="text-red-600">💸 {t("presupTeFalta")} {fmtUsd(-sobra)}</span>
          )}
        </div>
      </div>

      {/* Acciones */}
      <div className="flex gap-2 border-t border-slate-100 p-3">
        <button
          onClick={onOtra}
          className="flex-1 rounded-xl border-[1.5px] border-marca-100 bg-white py-3 text-sm font-bold text-marca-700 transition hover:bg-marca-50"
        >
          🔄 {t("presupOtraRuta")}
        </button>
        <button
          onClick={onPlanear}
          className="flex-1 rounded-xl bg-gradient-to-r from-marca-500 to-marca-600 py-3 text-sm font-bold text-white shadow-marca"
        >
          🗺️ {t("presupPlanear")}
        </button>
      </div>
    </div>
  );
}
