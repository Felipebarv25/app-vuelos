"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/AppContext";
import { listarViajesAsync, borrarViajeAsync } from "@/lib/viajes";
import { DESTINOS_PRESUPUESTO } from "@/lib/presupuesto";
import NavTop from "@/components/NavTop";
import BotonVolver from "@/components/BotonVolver";
import FooterAnduve from "@/components/FooterAnduve";
import BottomTabBar from "@/components/BottomTabBar";
import { Icono } from "@/components/Icono";
import { Logo } from "@/components/Logo";

const Asesor = dynamic(() => import("@/components/Asesor"));

const RE_MALA =
  /escudo|coat[_ ]?of[_ ]?arms|flag|bandera|seal|sello|logo|emblem|crest|mapa|map[_ .]|locator|montage|collage|blason/i;

async function fetchFoto(ciudad, pais) {
  for (const url of [
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ciudad)}`,
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(`${ciudad}, ${pais}`)}`,
    `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ciudad)}`,
  ]) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const d = await r.json();
      const img = d.thumbnail?.source;
      if (!img) continue;
      try {
        if (RE_MALA.test(decodeURIComponent(img))) continue;
      } catch {}
      return img.replace(/\/\d+px-/, "/640px-");
    } catch {}
  }
  return null;
}

function estadoViaje(v) {
  if (!v.fechaInicio || !v.fechaFin) return { tipo: "guardado" };
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const inicio = new Date(v.fechaInicio + "T00:00:00");
  const fin = new Date(v.fechaFin + "T00:00:00");
  if (hoy < inicio) {
    const dias = Math.ceil((inicio - hoy) / 86400000);
    return { tipo: "proximo", dias };
  }
  if (hoy <= fin) return { tipo: "en_curso" };
  return { tipo: "completado" };
}

const GRADS = [
  "from-emerald-600 to-teal-800",
  "from-blue-600 to-indigo-800",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-800",
  "from-violet-600 to-purple-800",
  "from-cyan-500 to-blue-700",
];

function BadgeEstado({ estado, t }) {
  const cfg = {
    proximo: {
      bg: "bg-emerald-500/90 text-white",
      icon: "compass",
      label: t("misViajesProximo"),
    },
    en_curso: {
      bg: "bg-amber-400/90 text-amber-950",
      icon: "play",
      label: t("misViajesEnCurso"),
    },
    completado: {
      bg: "bg-white/20 text-white/90",
      icon: "check",
      label: t("misViajesCompletado"),
    },
  };
  const c = cfg[estado.tipo];
  if (!c) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide backdrop-blur-sm ${c.bg}`}
    >
      <Icono nombre={c.icon} size={11} /> {c.label}
    </span>
  );
}

function ContadorRegresivo({ estado, t }) {
  if (estado.tipo === "en_curso")
    return (
      <p className="mt-1.5 text-[12px] font-semibold text-amber-300">
        {t("misViajesEnCurso")}
      </p>
    );
  if (estado.tipo !== "proximo") return null;
  const texto =
    estado.dias === 0
      ? t("misViajesHoy")
      : estado.dias === 1
        ? t("misViajesManana")
        : t("misViajesDiasN").replace("{n}", estado.dias);
  return (
    <p className="mt-1.5 text-[12px] font-semibold text-emerald-300">
      {texto}
    </p>
  );
}

export default function PaginaMisViajes() {
  const { t, lang, usuario } = useApp();
  const router = useRouter();
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [fotos, setFotos] = useState({});
  const [confirmElim, setConfirmElim] = useState(null);
  const cargadas = useRef(new Set());

  useEffect(() => {
    let vivo = true;
    (async () => {
      const v = await listarViajesAsync(usuario);
      if (vivo) {
        setViajes(v || []);
        setCargando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [usuario]);

  useEffect(() => {
    if (!viajes.length) return;
    let vivo = true;
    for (const v of viajes) {
      const key = v.ciudad?.nombre;
      if (!key || cargadas.current.has(key)) continue;
      cargadas.current.add(key);
      fetchFoto(key, v.ciudad?.pais || "").then((url) => {
        if (vivo && url) setFotos((p) => ({ ...p, [key]: url }));
      });
    }
    return () => {
      vivo = false;
    };
  }, [viajes]);

  function reabrir(v) {
    const q = v.ciudad?.nombre
      ? `${v.ciudad.nombre}, ${v.ciudad.pais || ""}`
      : "";
    router.push(`/?q=${encodeURIComponent(q)}`);
  }

  async function confirmarEliminar() {
    if (!confirmElim) return;
    const nuevos = await borrarViajeAsync(usuario, confirmElim);
    setViajes(nuevos || []);
    setConfirmElim(null);
  }

  const nombresViajes = useMemo(
    () => new Set(viajes.map((v) => v.ciudad?.nombre)),
    [viajes],
  );

  const inspiracion = useMemo(
    () =>
      DESTINOS_PRESUPUESTO.filter((d) => !nombresViajes.has(d.ciudad))
        .sort(() => 0.5 - Math.random())
        .slice(0, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nombresViajes],
  );

  const viajesOrdenados = useMemo(() => {
    const ord = { en_curso: 0, proximo: 1, guardado: 2, completado: 3 };
    return [...viajes].sort(
      (a, b) =>
        (ord[estadoViaje(a).tipo] ?? 2) - (ord[estadoViaje(b).tipo] ?? 2),
    );
  }, [viajes]);

  return (
    <div className="min-h-screen bg-slate-50 pb-16 dark:bg-slate-900 md:pb-0">
      <NavTop active="misviajes" />
      <BotonVolver />

      <main className="mx-auto max-w-5xl px-4 py-8 lg:px-8 lg:py-10">
        {/* Cabecera */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
              {t("misViajesEyebrow")}
            </div>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900 lg:text-[34px] dark:text-slate-100">
              {t("misViajesH1")}
              {usuario?.google && (
                <span className="ml-3 inline-flex items-center gap-1 align-middle text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <Icono nombre="check" size={12} /> {t("misViajesSync")}
                </span>
              )}
            </h1>
            <p className="mt-1.5 text-[13.5px] text-slate-600 dark:text-slate-400">
              {viajes.length > 0
                ? (viajes.length === 1
                    ? t("misViajesContador1")
                    : t("misViajesContadorN")
                  ).replace("{n}", viajes.length)
                : t("misViajesVacioSub")}
            </p>
          </div>
          <Link
            href="/?presupuesto=1"
            className="rounded-full bg-marca-700 px-5 py-2.5 text-[13px] font-semibold text-white shadow-md transition hover:bg-marca-800 hover:shadow-lg"
          >
            {t("misViajesPlanearNuevo")}
          </Link>
        </div>

        {/* Cargando */}
        {cargando && (
          <div className="flex flex-col items-center py-16">
            <Logo size={48} animado />
            <p className="mt-4 text-slate-400">{t("misViajesCargando")}</p>
          </div>
        )}

        {/* Estado vacío aspiracional */}
        {!cargando && viajes.length === 0 && (
          <div className="flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-800/60">
            <div className="relative mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-marca-100 to-emerald-100 dark:from-marca-900/40 dark:to-emerald-900/30">
                <Logo size={44} animado />
              </div>
            </div>
            <h2 className="text-[20px] font-extrabold text-slate-900 dark:text-slate-100">
              {t("misViajesVacioTitulo")}
            </h2>
            <p className="mt-2 max-w-md text-[14px] leading-relaxed text-slate-500 dark:text-slate-400">
              {t("misViajesVacioMsg")}
            </p>
            <Link
              href="/?presupuesto=1"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-marca-700 px-6 py-3 text-[14px] font-semibold text-white shadow-md transition hover:bg-marca-800 hover:shadow-lg"
            >
              <Icono nombre="compass" size={16} />
              {t("misViajesEmpezar")}
            </Link>

            {inspiracion.length > 0 && (
              <div className="mt-10 w-full">
                <p className="mb-4 text-[12px] font-semibold uppercase tracking-widest text-slate-400">
                  {t("misViajesInspiTit")}
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {inspiracion.map((d, i) => (
                    <Link
                      key={d.ciudad}
                      href={`/?q=${encodeURIComponent(`${d.ciudad}, ${d.pais}`)}`}
                      className="group relative aspect-[4/3] overflow-hidden rounded-xl"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${GRADS[i % GRADS.length]} transition-transform duration-500 group-hover:scale-110`}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-white">
                        <span className="text-2xl">{d.bandera}</span>
                        <span className="mt-1.5 text-[14px] font-extrabold drop-shadow">
                          {d.ciudad}
                        </span>
                        <span className="text-[12px] font-medium opacity-80">
                          {d.pais}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Grid de tarjetas postales */}
        {!cargando && viajesOrdenados.length > 0 && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {viajesOrdenados.map((v, i) => {
                const estado = estadoViaje(v);
                const foto = fotos[v.ciudad?.nombre];
                return (
                  <article
                    key={v.id}
                    className="group relative overflow-hidden rounded-2xl shadow-md ring-1 ring-slate-200/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:ring-slate-700/60"
                  >
                    {/* Foto / gradiente */}
                    <div className="relative aspect-[3/2] overflow-hidden">
                      {foto ? (
                        <img
                          src={foto}
                          alt={v.ciudad?.nombre || ""}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                          loading="lazy"
                        />
                      ) : (
                        <div
                          className={`h-full w-full bg-gradient-to-br ${GRADS[i % GRADS.length]}`}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                      {/* Badge de estado */}
                      {estado.tipo !== "guardado" && (
                        <div className="absolute left-3 top-3">
                          <BadgeEstado estado={estado} t={t} />
                        </div>
                      )}

                      {/* Botón eliminar: X en esquina */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmElim(v.id);
                        }}
                        aria-label={t("misViajesEliminar")}
                        className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/40 text-white/70 opacity-70 backdrop-blur-sm transition-all hover:bg-red-500/80 hover:text-white sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        <Icono nombre="x" size={13} />
                      </button>

                      {/* Info del destino */}
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <h3 className="text-[22px] font-extrabold leading-tight text-white drop-shadow-md lg:text-[24px]">
                          {v.ciudad?.nombre}
                        </h3>
                        <p className="mt-0.5 text-[13px] font-medium text-white/80">
                          {v.ciudad?.pais}
                          {v.fechaInicio && v.fechaFin && (
                            <span className="ml-1.5">
                              ·{" "}
                              {new Date(
                                v.fechaInicio + "T00:00:00",
                              ).toLocaleDateString(lang, {
                                day: "numeric",
                                month: "short",
                              })}
                              –
                              {new Date(
                                v.fechaFin + "T00:00:00",
                              ).toLocaleDateString(lang, {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          )}
                          {!v.fechaInicio && v.dias && (
                            <span className="ml-1.5">
                              · {v.dias} {t("dias").toLowerCase()}
                            </span>
                          )}
                        </p>
                        <ContadorRegresivo estado={estado} t={t} />
                      </div>
                    </div>

                    {/* Barra inferior */}
                    <div className="flex items-center justify-between bg-white px-4 py-3 dark:bg-slate-800">
                      <span className="text-[12px] text-slate-400 dark:text-slate-500">
                        {v.seleccion?.length
                          ? `${v.seleccion.length} ${t("misViajesLugares")}`
                          : ""}
                      </span>
                      <button
                        onClick={() => reabrir(v)}
                        className="rounded-full bg-marca-700 px-4 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-marca-800 hover:shadow-md"
                      >
                        {t("misViajesAbrir")}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {/* Sección de inspiración (pocos viajes) */}
            {viajes.length <= 2 && inspiracion.length > 0 && (
              <div className="mt-10">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-[17px] font-extrabold text-slate-900 dark:text-slate-100">
                      {t("misViajesInspiTit")}
                    </h2>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400">
                      {t("misViajesInspiSub").replace(
                        "{n}",
                        DESTINOS_PRESUPUESTO.length,
                      )}
                    </p>
                  </div>
                  <Link
                    href="/?presupuesto=1"
                    className="text-[13px] font-semibold text-marca-700 hover:text-marca-800 dark:text-marca-300"
                  >
                    {t("misViajesInspiCta")} →
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {inspiracion.map((d, i) => (
                    <Link
                      key={d.ciudad}
                      href={`/?q=${encodeURIComponent(`${d.ciudad}, ${d.pais}`)}`}
                      className="group relative aspect-[4/3] overflow-hidden rounded-xl shadow-sm ring-1 ring-slate-200/60 transition hover:shadow-md dark:ring-slate-700/60"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${GRADS[i % GRADS.length]} transition-transform duration-500 group-hover:scale-110`}
                      />
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-white">
                        <span className="text-2xl">{d.bandera}</span>
                        <span className="mt-1.5 text-[14px] font-extrabold drop-shadow">
                          {d.ciudad}
                        </span>
                        <span className="text-[12px] font-medium opacity-80">
                          {d.pais}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal de confirmación de eliminación */}
      {confirmElim && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmElim(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500 dark:bg-red-900/30 dark:text-red-400">
              <Icono nombre="trash" size={22} />
            </div>
            <h3 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">
              {t("misViajesConfirmElim")}
            </h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              {viajes.find((x) => x.id === confirmElim)?.ciudad?.nombre || ""}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmElim(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {t("misViajesConfirmNo")}
              </button>
              <button
                onClick={confirmarEliminar}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-600"
              >
                {t("misViajesConfirmSi")}
              </button>
            </div>
          </div>
        </div>
      )}

      <FooterAnduve />

      <div className="print:hidden">
        <Asesor
          t={t}
          usuario={usuario}
          onPlanear={(q) => router.push(`/?q=${encodeURIComponent(q)}`)}
          onAbrirPresupuesto={() => router.push("/?presupuesto=1")}
        />
      </div>

      <BottomTabBar />
    </div>
  );
}
