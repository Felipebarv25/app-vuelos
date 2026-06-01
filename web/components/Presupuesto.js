"use client";
import { useMemo, useState } from "react";
import {
  calcularDestinos,
  diasPosibles,
  REGIONES,
  MONEDAS,
} from "@/lib/presupuesto";

// Módulo "¿Adónde puedo ir con mi presupuesto?".
// El usuario pone su presupuesto, días, personas y región → ve qué destinos
// caben, con desglose de costos. Al elegir uno, puede planear su itinerario.
export default function Presupuesto({ onElegirCiudad, onCerrar, t = (k) => k }) {
  const [monto, setMonto] = useState(10000000); // 10M COP por defecto
  const [moneda, setMoneda] = useState("COP");
  const [dias, setDias] = useState(7);
  const [personas, setPersonas] = useState(1);
  const [region, setRegion] = useState("todas");
  const [detalle, setDetalle] = useState(null);

  const presupuestoUsd = monto * MONEDAS[moneda].aUsd;

  const resultados = useMemo(
    () => calcularDestinos({ presupuestoUsd, dias, personas, region }),
    [presupuestoUsd, dias, personas, region]
  );

  const caben = resultados.filter((r) => r.cabe);

  function fmtUsd(v) {
    return "US$ " + Math.round(v).toLocaleString("en-US");
  }
  function fmtLocal(usd) {
    const m = MONEDAS[moneda];
    const val = usd / m.aUsd;
    return m.simbolo + " " + Math.round(val).toLocaleString("es-CO");
  }

  return (
    <div style={fondo}>
      <div style={hoja} className="animar-subir">
        {/* Cabecera */}
        <div style={cab}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 19, fontWeight: 800 }}>💰 {t("presupTitulo")}</div>
            <button onClick={onCerrar} style={cerrar}>✕</button>
          </div>
          <div style={{ fontSize: 13, opacity: 0.92, marginTop: 2 }}>
            {t("presupSub")}
          </div>
        </div>

        <div style={{ padding: 16 }}>
          {/* Controles */}
          <div style={{ display: "grid", gap: 12 }}>
            <div>
              <div style={lbl}>{t("presupTuPresup")}</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="number"
                  value={monto}
                  onChange={(e) => setMonto(Math.max(0, +e.target.value))}
                  style={{ ...input, flex: 1 }}
                />
                <select value={moneda} onChange={(e) => setMoneda(e.target.value)} style={input}>
                  {Object.entries(MONEDAS).map(([k, m]) => (
                    <option key={k} value={k}>{k}</option>
                  ))}
                </select>
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                ≈ {fmtUsd(presupuestoUsd)}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <label style={{ flex: 1 }}>
                <div style={lbl}>📅 {t("dias")}</div>
                <select value={dias} onChange={(e) => setDias(+e.target.value)} style={{ ...input, width: "100%" }}>
                  {[3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 21, 30].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
              <label style={{ flex: 1 }}>
                <div style={lbl}>👥 {t("presupPersonas")}</div>
                <select value={personas} onChange={(e) => setPersonas(+e.target.value)} style={{ ...input, width: "100%" }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>

            <div>
              <div style={lbl}>🌍 {t("presupRegion")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {Object.entries(REGIONES).map(([k, nombre]) => (
                  <button
                    key={k}
                    onClick={() => setRegion(k)}
                    style={{
                      ...chip,
                      background: region === k ? "var(--azul)" : "var(--gris)",
                      color: region === k ? "#fff" : "var(--azul-osc)",
                    }}
                  >
                    {nombre}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div style={resumen}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "var(--verde)" }}>
                {caben.length}
              </div>
              <div style={{ fontSize: 12, color: "#475569" }}>{t("presupDestinos")}</div>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "right" }}>
              {dias} {t("dias").toLowerCase()} · {personas} {personas > 1 ? t("presupPersonasP") : t("presupPersonaS")}
            </div>
          </div>

          {/* Lista de destinos */}
          <div style={{ marginTop: 8 }}>
            {resultados.map((d) => (
              <div
                key={d.ciudad}
                style={{
                  ...card,
                  opacity: d.cabe ? 1 : 0.5,
                  borderColor: d.cabe ? "#bbf7d0" : "var(--borde)",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
                  onClick={() => setDetalle(detalle === d.ciudad ? null : d.ciudad)}
                >
                  <span style={{ fontSize: 26 }}>{d.bandera}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                      {d.ciudad}
                      {d.cabe && <span style={badge}>✓</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>{d.pais}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: d.cabe ? "var(--verde)" : "#94a3b8" }}>
                      {fmtUsd(d.total)}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{fmtLocal(d.total)}</div>
                  </div>
                </div>

                {/* Desglose expandible */}
                {detalle === d.ciudad && (
                  <div style={desglose} className="animar-subir">
                    <Fila icono="✈️" nombre={t("presupVuelo")} valor={fmtUsd(d.desglose.vuelo)} />
                    <Fila icono="🏨" nombre={t("presupHospedaje")} valor={fmtUsd(d.desglose.hospedaje)} />
                    <Fila icono="🍽️" nombre={t("presupComida")} valor={fmtUsd(d.desglose.comida)} />
                    <Fila icono="🚇" nombre={t("presupTransporte")} valor={fmtUsd(d.desglose.transporte)} />
                    <Fila icono="🎟️" nombre={t("presupExtras")} valor={fmtUsd(d.desglose.extras)} />
                    {d.cabe ? (
                      <div style={{ fontSize: 12, color: "var(--verde)", marginTop: 6, fontWeight: 600 }}>
                        💚 {t("presupTeSobra")} {fmtUsd(d.sobra)} · {t("presupAlcanza")}{" "}
                        {diasPosibles(d, presupuestoUsd, personas)} {t("dias").toLowerCase()}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6, fontWeight: 600 }}>
                        💸 {t("presupTeFalta")} {fmtUsd(-d.sobra)}
                      </div>
                    )}
                    <button
                      onClick={() => onElegirCiudad?.(d)}
                      style={btnPlanear}
                    >
                      🗺️ {t("presupPlanear")} {d.ciudad} →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 10, lineHeight: 1.5 }}>
            {t("presupAviso")}
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({ icono, nombre, valor }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
      <span>{icono} {nombre}</span>
      <b>{valor}</b>
    </div>
  );
}

const fondo = { position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", zIndex: 4000, display: "flex", alignItems: "flex-end", justifyContent: "center" };
const hoja = { background: "#fff", width: "100%", maxWidth: 560, maxHeight: "94vh", overflowY: "auto", borderRadius: "20px 20px 0 0", boxShadow: "0 -8px 30px rgba(0,0,0,.3)" };
const cab = { background: "linear-gradient(135deg,#16a34a,#15803d)", color: "#fff", padding: "18px 16px", position: "sticky", top: 0, zIndex: 2 };
const cerrar = { width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.25)", color: "#fff", fontSize: 16 };
const lbl = { fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 };
const input = { padding: "11px 12px", borderRadius: 10, border: "1px solid var(--borde)", fontSize: 15, outline: "none", background: "#fff" };
const chip = { border: "none", padding: "8px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600 };
const resumen = { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 16px", marginTop: 16 };
const card = { border: "1px solid var(--borde)", borderRadius: 12, padding: 12, marginBottom: 8 };
const badge = { marginLeft: 8, background: "var(--verde)", color: "#fff", fontSize: 11, padding: "1px 7px", borderRadius: 999, fontWeight: 700, verticalAlign: "middle" };
const desglose = { marginTop: 10, paddingTop: 10, borderTop: "1px dashed var(--borde)" };
const btnPlanear = { width: "100%", marginTop: 10, padding: "11px", borderRadius: 10, border: "none", background: "var(--azul)", color: "#fff", fontWeight: 700, fontSize: 14 };
