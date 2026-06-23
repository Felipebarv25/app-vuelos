"use client";
// Badge de estado de apertura para un POI con campo `horario` (OSM
// opening_hours). QW1. Si el lugar no tiene horario o no se puede parsear,
// el componente no renderiza nada (fail silent).
import { estadoApertura } from "@/lib/horarioOSM";

export default function BadgeApertura({ lugar, huso, t = (k) => k }) {
  if (!lugar?.horario || !huso) return null;
  const est = estadoApertura(lugar.horario, huso);
  if (!est) return null;
  if (est.estado === "siempre") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        🟢 {t("horario247") || "Abierto 24h"}
      </span>
    );
  }
  if (est.estado === "abierto") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        🟢 {(t("horarioAbierto") || "Abierto") + " · " + (t("horarioCierra") || "cierra") + " " + est.cierra}
      </span>
    );
  }
  // cerrado
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-1.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-900/30 dark:text-rose-300">
      🔴 {est.abre
        ? (t("horarioCerrado") || "Cerrado") + " · " + (t("horarioAbre") || "abre") + " " + est.abre
        : (t("horarioCerrado") || "Cerrado")}
    </span>
  );
}
