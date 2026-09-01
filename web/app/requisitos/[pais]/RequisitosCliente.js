"use client";
import SelectorPais from "@/components/SelectorPais";
// Isla cliente de la página /requisitos/<pais>. Maneja:
//   1) Cargar el dataset de visas (645 KB) bajo demanda.
//   2) Elegir la nacionalidad del visitante (default: la que tenga en
//      localStorage, si ya la eligió en RequisitosViaje.js).
//   3) Mostrar el requisito de visa para (nacionalidad → destino).

import { useEffect, useState } from "react";
import {
  cargarVisas,
  nombrePais,
  interpretarVisa,
} from "@/lib/requisitos";

const COLORES = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300",
  amber: "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300",
  rose: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-300",
  slate: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300",
};

const ETIQUETA = {
  sinvisa: "Sin visa requerida",
  sinvisaDias: "Sin visa hasta {n} días",
  llegada: "Visa a la llegada",
  evisa: "E-visa (tramitar online antes)",
  eta: "Autorización electrónica (eTA)",
  requerida: "Visa requerida (tramítala antes)",
  noadmision: "Acceso restringido / no admitido",
  mismopais: "Mismo país (no aplica)",
  desconocido: "Sin información clara — verifica con el consulado",
};

export default function RequisitosCliente({ destinoIso, destinoNombre }) {
  const [visas, setVisas] = useState(null);
  const [nacionalidad, setNacionalidad] = useState("CO");

  // Cargar nacionalidad guardada en localStorage (compartida con
  // RequisitosViaje.js de la home, así no se pierde la preferencia).
  useEffect(() => {
    try {
      const guardada = localStorage.getItem("anduve_nac");
      if (guardada) setNacionalidad(guardada);
    } catch {}
  }, []);

  // Guardar la nacionalidad al cambiarla (para que persista en el modal
  // de la home la próxima vez).
  function cambiarNacionalidad(cc) {
    setNacionalidad(cc);
    try { localStorage.setItem("anduve_nac", cc); } catch {}
  }

  // Cargar el dataset de visas (645 KB) bajo demanda.
  useEffect(() => {
    let vivo = true;
    cargarVisas().then((v) => vivo && setVisas(v));
    return () => { vivo = false; };
  }, []);

  const req = visas?.[nacionalidad]?.[destinoIso];
  const info = interpretarVisa(req);
  const nacNombre = nombrePais(nacionalidad);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-suave dark:border-slate-700 dark:bg-slate-800">
      <h2 className="flex items-center gap-2 text-base font-extrabold text-slate-800 dark:text-slate-100">
        <span aria-hidden="true">🛂</span> Visa según tu pasaporte
      </h2>

      <label className="mt-3 flex flex-wrap items-center gap-2 text-[13px] text-slate-500 dark:text-slate-400">
        Tu pasaporte:
        {/* Mismo caso que en RequisitosViaje: el <select> listaba ~199 países
            con el código ISO por nombre. Ahora se escribe y filtra. */}
        <SelectorPais
          value={nacionalidad}
          onChange={cambiarNacionalidad}
          className="min-w-[190px]"
        />
      </label>

      {/* Resultado de la visa */}
      <div className={`mt-4 rounded-xl border p-4 ${info?.color ? COLORES[info.color] : COLORES.slate}`}>
        {!visas ? (
          <div className="text-sm text-slate-500">Cargando información…</div>
        ) : info ? (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide opacity-70">
              {nacNombre} → {destinoNombre}
            </div>
            <div className="mt-1 text-xl font-extrabold leading-tight">
              {info.tipo === "sinvisaDias"
                ? ETIQUETA.sinvisaDias.replace("{n}", info.dias)
                : ETIQUETA[info.tipo] || ETIQUETA.desconocido}
            </div>
            <p className="mt-2 text-[13px] opacity-90">
              Esta información proviene del{" "}
              <a
                href="https://www.passportindex.org/"
                target="_blank"
                rel="noopener nofollow"
                className="underline hover:opacity-100"
              >
                Passport Index
              </a>{" "}
              (datos abiertos). Las políticas pueden cambiar sin previo aviso —
              verifica siempre con el consulado del destino antes de comprar el vuelo.
            </p>
          </div>
        ) : (
          <div className="text-[13px]">
            Sin información disponible para este pasaporte. Verifica con el
            consulado de {destinoNombre} en tu país.
          </div>
        )}
      </div>

      {/* Pasaporte: regla general */}
      <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[13px] text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">
        <b>📔 Pasaporte:</b> debe tener al menos <b>6 meses de vigencia</b> al
        momento de entrar (regla general; algunos países piden 3 meses).
        Confirma con la aerolínea antes de embarcar.
      </div>
    </div>
  );
}
