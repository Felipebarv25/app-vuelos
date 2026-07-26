"use client";
// Chip/banner del home post-login para exponer las alertas de precio ANTES
// de que el usuario entre en una ciudad (audit 2026-06-29: cero visibilidad
// hasta que estas dentro de un destino).
//
// Estados:
//   - Sin usuario / loading: no renderiza nada.
//   - >= 1 alertas activas: chip discreto con contador y link a /ofertas.
//   - 0 alertas: banner invitacion con link a /ofertas para crear la primera.
//
// El fetch corre en el efecto (post-mount), no bloquea el paint inicial.

import Link from "next/link";
import { useApp } from "@/lib/AppContext";
import { Icono } from "./Icono";

export default function AlertasChip() {
  // Las alertas vienen del contexto, no de un fetch propio: antes este chip
  // pedia la lista una sola vez al montar y ningun sitio lo avisaba, asi que al
  // crear o borrar una alerta seguia mostrando el numero viejo hasta recargar.
  const { t, usuario, alertas } = useApp();

  if (!usuario || alertas == null) return null;

  // Se cuentan TODAS las alertas, no solo las `activa !== false`. `activa: false`
  // solo significa que esa alerta ya envio su email (anti-spam), no que el
  // usuario la apagara. Con el filtro, el titulo decia "3 alertas" mientras el
  // subtitulo de abajo enumeraba "Buenos Aires · Madrid · Barcelona +2" — o sea
  // 5: el mismo banner se contradecia.
  const total = alertas.length;

  if (total === 0) {
    return (
      <Link
        href="/ofertas"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100/60 px-4 py-3 text-left transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-suave dark:border-amber-800/50 dark:from-amber-900/20 dark:to-amber-800/10"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-400/30 text-amber-800 dark:text-amber-300">
          <Icono nombre="bell" size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-amber-900 dark:text-amber-200">
            {t("alertasChipSinTit")}
          </div>
          <div className="text-[12px] text-amber-800/80 dark:text-amber-300/70">
            {t("alertasChipSinSub")}
          </div>
        </div>
        <span className="shrink-0 text-[12.5px] font-bold text-amber-800 dark:text-amber-300">
          {t("alertasChipSinCta")} →
        </span>
      </Link>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800/50 dark:bg-emerald-900/20">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400/30 text-emerald-800 dark:text-emerald-300">
        <Icono nombre="bell" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13.5px] font-bold text-emerald-900 dark:text-emerald-200">
          {total} {total === 1 ? t("alertasChipConTitUno") : t("alertasChipConTitVarias")}
        </div>
        <div className="truncate text-[12px] text-emerald-800/80 dark:text-emerald-300/70">
          {alertas.slice(0, 3).map((a) => a.ciudad).join(" · ")}
          {alertas.length > 3 ? ` +${alertas.length - 3}` : ""}
        </div>
      </div>
      <Link
        href="/ofertas"
        className="shrink-0 rounded-full bg-white/70 px-3 py-1.5 text-[12px] font-bold text-emerald-800 ring-1 ring-emerald-200 transition hover:bg-white hover:ring-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-200 dark:ring-emerald-800"
      >
        {t("alertasChipConCta")} →
      </Link>
    </div>
  );
}
