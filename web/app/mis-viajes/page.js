"use client";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useApp } from "@/lib/AppContext";
import { listarViajesConEstado, borrarViajeAsync } from "@/lib/viajes";
import { DESTINOS_PRESUPUESTO } from "@/lib/presupuesto";
import { leerLocales, borrarLocal } from "@/lib/rutasLocales";
import NavTop from "@/components/NavTop";
import BotonVolver from "@/components/BotonVolver";
import FooterAnduve from "@/components/FooterAnduve";
import BottomTabBar from "@/components/BottomTabBar";
import { Icono } from "@/components/Icono";
import Bandera from "@/components/Bandera";
import { Logo } from "@/components/Logo";

const Asesor = dynamic(() => import("@/components/Asesor"));

// Los dos planificadores viven AQUI, no en un modal encima del home. Carga
// diferida: entre los dos son ~2.000 lineas y la mayoria de las visitas a esta
// pagina vienen a ver los viajes guardados, no a planear uno nuevo.
const Presupuesto = dynamic(() => import("@/components/Presupuesto"), { ssr: false });
const PlanRuta = dynamic(() => import("@/components/PlanRuta"), { ssr: false });

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

// Lista de viajes multiparada. Es el primer nivel de "Yo ordeno las ciudades":
// aqui se ven todos tus viajes y desde aqui se entra a definir la ruta de cada
// uno. Antes no habia este nivel — el planificador era un formulario suelto,
// solo cabia un itinerario a la vez, y empezar otro obligaba a borrar el que
// tenias.
const conMayuscula = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// Paises de una ruta, en orden y sin repetir. Cada parada guarda el ISO de dos
// letras, asi que la bandera no cuesta ningun dato nuevo.
const paisesDe = (r) => {
  const vistos = [];
  for (const p of r?.paradas || []) {
    const cc = String(p?.pais || "").trim().toLowerCase();
    if (/^[a-z]{2}$/.test(cc) && !vistos.includes(cc)) vistos.push(cc);
  }
  return vistos;
};

function ListaViajes({ t, lang, rutas = [], locales = [], onCrear, onAbrir, onBorrar, onDescartar }) {
  // Los viajes se planean por MES, no por dia. Se lee tambien el campo viejo
  // para que las rutas guardadas antes del cambio sigan mostrando su fecha.
  const fmt = (r) => {
    const m = String(r.mesInicio || r.fechaInicio || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(m)) return t("rutasSinFecha");
    const d = new Date(m + "-01T00:00:00");
    return Number.isNaN(d.getTime())
      ? t("rutasSinFecha")
      : conMayuscula(d.toLocaleDateString(lang, { month: "short", year: "numeric" }));
  };

  const Tarjeta = ({ r, sinGuardar }) => (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-marca-300 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-extrabold text-slate-900 dark:text-slate-100">
          {r.nombre ||
            ((r.paradas || []).length >= 2
              ? `${r.paradas[0].ciudad} → ${r.paradas[r.paradas.length - 1].ciudad}`
              : t("rutaNombrePlaceholder"))}
          {paisesDe(r).length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 align-middle">
              {paisesDe(r).map((cc) => (
                <Bandera key={cc} cc={cc} size={16} />
              ))}
            </span>
          )}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {sinGuardar && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              {t("listaBorrador")}
            </span>
          )}
          <button
            onClick={() => (sinGuardar ? onDescartar(r.uid) : onBorrar(r.id))}
            aria-label={t("misViajesEliminar")}
            className="rounded-full p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/30"
          >
            <Icono nombre="x" size={14} />
          </button>
        </div>
      </div>
      <p className="mt-1 truncate text-[12.5px] text-slate-500 dark:text-slate-400">
        {(r.paradas || []).map((p) => p.ciudad).join(" → ") || "—"}
      </p>
      <p className="mt-1 text-[12px] text-slate-400">
        {fmt(r)} ·{" "}
        {t("rutasNParadas").replace("{n}", (r.paradas || []).length)}
      </p>
      <button
        onClick={() => onAbrir(r)}
        className="mt-3 rounded-full bg-marca-700 px-4 py-1.5 text-[12.5px] font-bold text-white transition hover:bg-marca-800"
      >
        {sinGuardar ? t("listaSeguirEditando") : t("misViajesAbrir")}
      </button>
    </li>
  );

  const hayAlgo = rutas.length > 0 || locales.length > 0;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-marca-700 dark:text-marca-300">
            {t("listaViajesEyebrow")}
          </div>
          <p className="mt-0.5 max-w-lg text-[13px] text-slate-500 dark:text-slate-400">
            {t("listaViajesSub")}
          </p>
        </div>
        <button
          onClick={onCrear}
          className="rounded-full bg-marca-700 px-4 py-2 text-[13px] font-bold text-white shadow-sm transition hover:bg-marca-800"
        >
          + {t("listaCrear")}
        </button>
      </div>

      {!hayAlgo ? (
        <p className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-[13px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
          {t("listaVacia")}
        </p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {locales.map((r) => (
            <Tarjeta key={r.uid} r={r} sinGuardar />
          ))}
          {rutas.map((r) => (
            <Tarjeta key={r.id} r={r} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PaginaMisViajes() {
  const { t, lang, usuario } = useApp();
  const router = useRouter();
  const [viajes, setViajes] = useState([]);
  // Estado real de la nube, para no prometer sincronizacion que no hubo.
  const [nube, setNube] = useState({ sincronizado: false, motivo: null });
  const [cargando, setCargando] = useState(true);
  const [fotos, setFotos] = useState({});
  const [confirmElim, setConfirmElim] = useState(null);
  // "reco" = te armo la ruta desde el presupuesto | "manual" = tu ordenas las ciudades
  // NADA desplegado al entrar.
  //
  // Arrancaba en "reco", asi que abrir "Mis viajes" te plantaba el asesor de
  // presupuesto abierto sin haberlo pedido — y empujaba hacia abajo lo que
  // vienes a ver, que son tus viajes. Los dos modos son opciones, no un
  // estado por defecto: el planificador se abre cuando eliges uno.
  const [modoPlan, setModoPlan] = useState(null);
  // Rutas multiparada. Viven en /api/rutas, un almacen distinto del de
  // /api/viajes (que guarda UNA ciudad por viaje). Esta pagina solo listaba el
  // segundo, asi que una ruta guardada no aparecia en ninguna parte y parecia
  // que se hubiera borrado. El backend siempre soporto 25 por usuario.
  const [rutas, setRutas] = useState([]);
  const [rutaAbierta, setRutaAbierta] = useState(null);
  const [confirmRuta, setConfirmRuta] = useState(null);
  // Viajes a medio armar y sin guardar (uno por cada que hayas empezado). Se
  // listan junto a los guardados para que no queden invisibles: es exactamente
  // lo que se perdia antes.
  const [locales, setLocales] = useState([]);
  const cargadas = useRef(new Set());

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await listarViajesConEstado(usuario);
      if (vivo) {
        setViajes(r.viajes || []);
        setNube({ sincronizado: r.sincronizado, motivo: r.motivo });
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

  // Cabecera con el token de sesion por correo, igual que en PlanRuta: hay
  // usuarios que entran con codigo y no con Google.
  function cabeceras() {
    const h = { "Content-Type": "application/json" };
    try {
      const tk =
        localStorage.getItem("anduve_auth_token") ||
        sessionStorage.getItem("anduve_auth_token");
      if (tk) h.Authorization = `Bearer ${tk}`;
    } catch {}
    return h;
  }

  const cargarRutas = useCallback(async () => {
    try {
      const r = await fetch("/api/rutas", { headers: cabeceras() });
      const d = r.ok ? await r.json() : null;
      setRutas(d?.ok && Array.isArray(d.rutas) ? d.rutas : []);
    } catch {
      setRutas([]);
    }
  }, []);

  useEffect(() => { cargarRutas(); }, [cargarRutas, usuario]);

  // Relee los locales al volver a la lista, para reflejar lo ultimo escrito.
  // Solo se muestran como "sin guardar" los que no tienen copia en el
  // servidor; los que ya se guardaron aparecen una sola vez, como guardados.
  useEffect(() => {
    if (rutaAbierta) return;
    setLocales(leerLocales().filter((x) => !x.id));
  }, [rutaAbierta, rutas]);

  function descartarLocal(uid) {
    borrarLocal(uid);
    setLocales(leerLocales().filter((x) => !x.id));
  }

  async function borrarRuta(id) {
    try {
      await fetch(`/api/rutas?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: cabeceras(),
      });
    } catch {}
    setConfirmRuta(null);
    if (rutaAbierta?.id === id) setRutaAbierta(null);
    cargarRutas();
  }

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
        <div className="mb-8">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
              {t("misViajesEyebrow")}
            </div>
            <h1 className="mt-1 text-[28px] font-extrabold tracking-tight text-slate-900 lg:text-[34px] dark:text-slate-100">
              {t("misViajesH1")}
              {/* El badge sigue al estado REAL, no a que haya sesion. */}
              {!cargando && nube.sincronizado && (
                <span className="ml-3 inline-flex items-center gap-1 align-middle text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  <Icono nombre="check" size={12} /> {t("misViajesSync")}
                </span>
              )}
              {!cargando && !nube.sincronizado && (
                <span
                  title={nube.motivo === "nube-caida" ? t("misViajesSinNubeAyuda") : ""}
                  className="ml-3 inline-flex items-center gap-1 align-middle text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400"
                >
                  <Icono nombre="alert" size={12} />{" "}
                  {nube.motivo === "nube-caida" ? t("misViajesSinNube") : t("misViajesSoloLocal")}
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
        </div>

        {/* ------------------------------------------------------------------
            Planificar un viaje nuevo. Dos planificadores, la misma pagina.

            Antes esto era un modal que se abria encima del home ("Mis viajes"
            en el home ni siquiera navegaba si no tenias viajes guardados: te
            desplegaba el planificador encima). Ahora es contenido de esta
            pagina, con las dos formas de llegar al presupuesto:

              reco   -> pones cuanta plata tienes y te proponemos las ciudades
              manual -> pones tus ciudades en tu orden y calculamos el costo

            Son los flujos inversos, no dos versiones de lo mismo: por eso son
            dos pestanas y no una sola con opciones.
            ------------------------------------------------------------------ */}
        <section id="planificador" className="mb-12 scroll-mt-24">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-marca-700 dark:text-marca-300">
            {t("planEyebrow")}
          </div>
          <h2 className="mt-1 text-[21px] font-extrabold tracking-tight text-slate-900 lg:text-[25px] dark:text-slate-100">
            {t("planTitulo")}
          </h2>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-slate-600 dark:text-slate-400">
            {t("planSub")}
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              // Manual primero: es el modo que la gente usa cuando ya sabe a
              // donde va, y el que el usuario abre siempre.
              ["manual", "map", t("planModoManual"), t("planModoManualSub")],
              ["reco", "compass", t("planModoReco"), t("planModoRecoSub")],
            ].map(([k, icono, titulo, sub]) => (
              <button
                key={k}
                type="button"
                // Segundo clic en el que ya esta abierto: se cierra. Si
                // abrirlo es una decision, cerrarlo tiene que serlo tambien.
                onClick={() => setModoPlan(modoPlan === k ? null : k)}
                aria-pressed={modoPlan === k}
                aria-expanded={modoPlan === k}
                className={`rounded-2xl border-2 p-4 text-left transition ${
                  modoPlan === k
                    ? "border-marca-500 bg-marca-50 dark:border-marca-500 dark:bg-marca-900/30"
                    : "border-slate-200 bg-white hover:border-marca-300 dark:border-slate-700 dark:bg-slate-800"
                }`}
              >
                <span
                  className={`inline-flex items-center gap-2 text-[14.5px] font-extrabold ${
                    modoPlan === k
                      ? "text-marca-800 dark:text-marca-200"
                      : "text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <Icono nombre={icono} size={16} /> {titulo}
                </span>
                <span className="mt-1 block text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                  {sub}
                </span>
              </button>
            ))}
          </div>

          {/* Sin modo elegido no se pinta nada: ni el bloque ni su margen. */}
          {modoPlan && (
          <div className="mt-4">
            {modoPlan === "reco" ? (
              <Presupuesto
                incrustado
                t={t}
                onElegirCiudad={(c) =>
                  router.push(
                    `/?q=${encodeURIComponent(
                      typeof c === "string" ? c : `${c?.ciudad || ""}, ${c?.pais || ""}`,
                    )}`,
                  )
                }
                onCerrar={() => {}}
              />
            ) : rutaAbierta ? (
              /* DETALLE de un viaje: su nombre, sus fechas y su itinerario. */
              <PlanRuta
                t={t}
                lang={lang}
                usuario={usuario}
                rutaInicial={rutaAbierta}
                alGuardar={(r) => { cargarRutas(); setRutaAbierta(r); }}
                onVolver={() => { setRutaAbierta(null); cargarRutas(); }}
                // Remontar al abrir otro viaje: si no, se quedarian las paradas
                // del anterior mezcladas con las nuevas.
                key={rutaAbierta.id || "nueva"}
              />
            ) : (
              /* LISTA de viajes. La ruta se define DENTRO de cada viaje, no en
                 un formulario suelto: antes solo cabia un itinerario a la vez y
                 empezar otro obligaba a borrar el anterior. */
              <ListaViajes
                t={t}
                lang={lang}
                rutas={rutas}
                locales={locales}
                onCrear={() => setRutaAbierta({ nueva: true })}
                onAbrir={(r) => setRutaAbierta(r)}
                onBorrar={(id) => setConfirmRuta(id)}
                onDescartar={descartarLocal}
              />
            )}
          </div>
          )}
        </section>

        {viajesOrdenados.length > 0 && (
          <h2 className="mb-4 text-[17px] font-extrabold text-slate-900 dark:text-slate-100">
            {t("planGuardadosTit")}
          </h2>
        )}

        {/* Cargando */}
        {cargando && (
          <div className="flex flex-col items-center py-16">
            <Logo size={48} animado />
            <p className="mt-4 text-slate-400">{t("misViajesCargando")}</p>
          </div>
        )}

        {/* Sin viajes guardados no se pinta nada aqui.

            Primero hubo un estado vacio "aspiracional" a pantalla completa;
            despues, a peticion del usuario, solo el boton de la cabecera. Al
            verlo montado sobraban los dos: la pagina ya lleva el planificador
            abierto justo encima, con su propio "+ Crear un viaje", asi que
            un tercer boton para lo mismo solo repetia. */}

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
                  <a
                    href="#planificador"
                    className="text-[13px] font-semibold text-marca-700 hover:text-marca-800 dark:text-marca-300"
                  >
                    {t("misViajesInspiCta")} →
                  </a>
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

      {/* Confirmación de borrado de una ruta multiparada */}
      {confirmRuta && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setConfirmRuta(null)}
        >
          <div
            className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[16px] font-bold text-slate-900 dark:text-slate-100">
              {t("misViajesConfirmElim")}
            </h3>
            <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
              {rutas.find((x) => x.id === confirmRuta)?.nombre || ""}
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirmRuta(null)}
                className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                {t("misViajesConfirmNo")}
              </button>
              <button
                onClick={() => borrarRuta(confirmRuta)}
                className="flex-1 rounded-lg bg-red-500 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-red-600"
              >
                {t("misViajesConfirmSi")}
              </button>
            </div>
          </div>
        </div>
      )}

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
          onAbrirPresupuesto={() => {
            setModoPlan("reco");
            document.getElementById("planificador")?.scrollIntoView({ behavior: "smooth" });
          }}
        />
      </div>

      <BottomTabBar />
    </div>
  );
}
