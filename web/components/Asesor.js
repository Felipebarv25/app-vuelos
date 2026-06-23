"use client";
import { useEffect, useRef, useState } from "react";
import { construirRuta, REGIONES, MONEDAS } from "@/lib/presupuesto";
import { Icono } from "./Icono";

// Asesor de viajes (modo GRATIS): chat guiado por botones que usa NUESTRO motor
// de rutas/presupuesto. Cero costo, todo en el código (sin IA).
export default function Asesor({ t = (k) => k, usuario, onPlanear, onAbrirPresupuesto }) {
  const [abierto, setAbierto] = useState(false);
  // El modo IA (ChatIA) está desactivado por ahora: solo mostramos la guía
  // gratis (sin costo). Para reactivarlo: recuperar el componente ChatIA del
  // historial de git, restaurar el conmutador de modo aquí y configurar
  // ANTHROPIC_API_KEY en Vercel.
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  });

  return (
    <>
      {!abierto && (
        <button
          onClick={() => setAbierto(true)}
          className="fixed bottom-5 right-5 z-[3500] flex items-center gap-2 rounded-full bg-gradient-to-r from-marca-500 to-marca-700 px-5 py-3.5 text-white shadow-[0_10px_30px_rgba(15,118,110,.45)] transition hover:brightness-110"
        >
          <Icono nombre="compass" size={20} />
          <span className="text-sm font-bold">{t("asesorBoton")}</span>
        </button>
      )}

      {abierto && (
        <div className="fixed inset-x-0 bottom-0 z-[3500] flex justify-center sm:inset-auto sm:bottom-5 sm:right-5">
          <div className="animar-subir flex h-[78vh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(0,0,0,.3)] dark:bg-slate-800 sm:h-[580px] sm:rounded-3xl sm:shadow-[0_20px_50px_rgba(0,0,0,.3)]">
            {/* Cabecera */}
            <div className="bg-gradient-to-br from-marca-600 to-marca-800 px-4 py-3.5 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15"><Icono nombre="compass" size={18} /></span>
                  <div>
                    <div className="text-[15px] font-bold leading-tight">{t("asesorTitulo")}</div>
                    <div className="text-[11px] text-white/80">{t("asesorModoGuia")}</div>
                  </div>
                </div>
                <button onClick={() => setAbierto(false)} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15"><Icono nombre="x" size={16} /></button>
              </div>
            </div>

            <GuiaGratis t={t} usuario={usuario} onPlanear={onPlanear} onAbrirPresupuesto={onAbrirPresupuesto} cerrar={() => setAbierto(false)} finRef={finRef} />
          </div>
        </div>
      )}
    </>
  );
}

// ---------- Burbuja ----------
function Burbuja({ role, children }) {
  const esUsuario = role === "user";
  return (
    <div className={`flex ${esUsuario ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[88%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
          esUsuario ? "bg-gradient-to-r from-marca-500 to-marca-600 text-white" : "border border-slate-100 bg-white text-slate-700 shadow-suave"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

// ---------- MODO GRATIS: guía por botones con nuestro motor ----------
function GuiaGratis({ t, usuario, onPlanear, onAbrirPresupuesto, cerrar, finRef }) {
  const nombre = usuario?.nombre ? `, ${usuario.nombre}` : "";
  const [historia, setHistoria] = useState([{ de: "bot", texto: t("guiaSaludo").replace("{nombre}", nombre) }]);
  const [paso, setPaso] = useState("region");
  const [datos, setDatos] = useState({ region: "europa", montoCOP: 10000000, dias: 10 });
  const [semilla, setSemilla] = useState(0);

  const PRESUPUESTOS = [
    ["3.000.000", 3000000], ["6.000.000", 6000000], ["10.000.000", 10000000],
    ["15.000.000", 15000000], ["20.000.000", 20000000],
  ];
  const DIAS = [7, 10, 14, 21];

  function push(b) { setHistoria((h) => [...h, b]); }
  function fmtUsd(v) { return "US$ " + Math.round(v).toLocaleString("en-US"); }
  function fmtCop(usd) { return "$ " + Math.round(usd / MONEDAS.COP.aUsd).toLocaleString("es-CO") + " COP"; }

  function elegirRegion(k) {
    push({ de: "user", texto: REGIONES[k] });
    setDatos((d) => ({ ...d, region: k }));
    push({ de: "bot", texto: t("guiaPreguntaPresupuesto") });
    setPaso("presupuesto");
  }
  function elegirPresupuesto(label, monto) {
    push({ de: "user", texto: label + " COP" });
    setDatos((d) => ({ ...d, montoCOP: monto }));
    push({ de: "bot", texto: t("guiaPreguntaDias") });
    setPaso("dias");
  }
  function elegirDias(n) {
    push({ de: "user", texto: `${n} ${t("dias").toLowerCase()}` });
    const datos2 = { ...datos, dias: n };
    setDatos(datos2);
    mostrarRuta(datos2, 0);
  }
  function mostrarRuta(d, sem) {
    const presupuestoUsd = d.montoCOP * MONEDAS.COP.aUsd;
    const ruta = construirRuta({ presupuestoUsd, dias: d.dias, personas: 1, region: d.region, semilla: sem });
    if (!ruta || !ruta.ciudades.length) {
      push({ de: "bot", texto: t("guiaSinRuta") });
      setPaso("fin");
      return;
    }
    const lineas = ruta.ciudades.map((c, i) => `  ${i + 1}. ${c.bandera} ${c.ciudad} — ${c.diasAqui} ${t("presupRutaDias")}`).join("\n");
    const texto =
      `${t("guiaAquiRuta")}\n\n${ruta.ciudades.map((c) => c.ciudad).join(" → ")}\n${lineas}\n\n` +
      `✈️ ${t("presupVueloIntl")}: ${fmtUsd(ruta.desglose.vueloIntl)}\n` +
      `🧳 Total: ${fmtUsd(ruta.total)}  (${fmtCop(ruta.total)})\n` +
      (ruta.cabe ? `💚 ${t("presupTeSobra")} ${fmtUsd(ruta.sobra)}` : `💸 ${t("presupTeFalta")} ${fmtUsd(-ruta.sobra)}`);
    push({ de: "bot", texto, ruta });
    setPaso("resultado");
  }
  function otraRuta() {
    const s = semilla + 1; setSemilla(s);
    push({ de: "user", texto: "🔄 " + t("presupOtraRuta") });
    mostrarRuta(datos, s);
  }
  function planearRuta(ruta) {
    onPlanear?.(`${ruta.entrada.ciudad}, ${ruta.entrada.pais}`);
    cerrar?.();
  }
  function reiniciar() {
    setHistoria([{ de: "bot", texto: t("guiaSaludo").replace("{nombre}", nombre) }]);
    setPaso("region"); setSemilla(0);
  }

  const ultimaRuta = [...historia].reverse().find((b) => b.ruta)?.ruta;

  return (
    <>
      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
        {historia.map((b, i) => (
          <Burbuja key={i} role={b.de === "user" ? "user" : "bot"}>{b.texto}</Burbuja>
        ))}
        <div ref={finRef} />
      </div>

      {/* Opciones (chips) según el paso */}
      <div className="border-t border-slate-100 bg-white p-3">
        {paso === "region" && (
          <Chips opciones={Object.entries(REGIONES).map(([k, n]) => ({ label: n, run: () => elegirRegion(k) }))} />
        )}
        {paso === "presupuesto" && (
          <Chips opciones={PRESUPUESTOS.map(([label, monto]) => ({ label: "$ " + label, run: () => elegirPresupuesto(label, monto) }))} />
        )}
        {paso === "dias" && (
          <Chips opciones={DIAS.map((n) => ({ label: `${n} ${t("dias").toLowerCase()}`, run: () => elegirDias(n) }))} />
        )}
        {paso === "resultado" && ultimaRuta && (
          <div className="flex flex-wrap gap-2">
            <Boton onClick={otraRuta} sec>🔄 {t("presupOtraRuta")}</Boton>
            <Boton onClick={() => planearRuta(ultimaRuta)}>🗺️ {t("presupPlanear")}</Boton>
            <Boton onClick={() => { onAbrirPresupuesto?.(); cerrar?.(); }} sec>💰 {t("guiaVerPresupuesto")}</Boton>
            <Boton onClick={reiniciar} sec>↩️ {t("guiaReiniciar")}</Boton>
          </div>
        )}
        {paso === "fin" && (
          <div className="flex flex-wrap gap-2">
            <Boton onClick={reiniciar} sec>↩️ {t("guiaReiniciar")}</Boton>
            <Boton onClick={() => { onAbrirPresupuesto?.(); cerrar?.(); }}>💰 {t("guiaVerPresupuesto")}</Boton>
          </div>
        )}
      </div>
    </>
  );
}

function Chips({ opciones }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opciones.map((o, i) => (
        <button
          key={i}
          onClick={o.run}
          className="rounded-full border border-marca-200 bg-marca-50 px-3.5 py-2 text-[13px] font-semibold text-marca-700 transition hover:bg-marca-100 dark:border-marca-800 dark:bg-marca-900/30 dark:text-marca-300 dark:hover:bg-marca-900/40"
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Boton({ onClick, children, sec }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition ${
        sec ? "border-[1.5px] border-slate-200 bg-white text-marca-700 hover:bg-slate-50" : "bg-gradient-to-r from-marca-500 to-marca-600 text-white shadow-marca"
      }`}
    >
      {children}
    </button>
  );
}
