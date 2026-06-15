"use client";
import { linkTours, linkHoteles, linkVuelos, linkESIM, linkSeguro } from "@/lib/afiliados";
import { track } from "@/lib/track";
import { Icono } from "./Icono";

// CTA reutilizable de reserva (tarjeta con icono, texto y flecha).
function CtaReserva({ href, icono, titulo, desc, tipo, color = "marca" }) {
  const tono = {
    marca: "from-marca-50 to-marca-100/60 border-marca-100 text-marca-700",
    emerald: "from-emerald-50 to-teal-50 border-emerald-100 text-emerald-700",
    sky: "from-sky-50 to-sky-100 border-sky-100 text-sky-700",
    violet: "from-violet-50 to-purple-50 border-violet-100 text-violet-700",
    rose: "from-rose-50 to-pink-50 border-rose-100 text-rose-700",
  }[color];
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener"
      onClick={() => track("afiliado_clic", { cat: tipo })}
      className={`flex items-center gap-3 rounded-2xl border bg-gradient-to-br p-3.5 shadow-suave transition hover:brightness-[0.98] ${tono}`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-suave">
        <Icono nombre={icono} size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14.5px] font-bold leading-tight">{titulo}</div>
        <div className="truncate text-[12.5px] text-slate-500">{desc}</div>
      </div>
      <Icono nombre="arrowRight" size={18} />
    </a>
  );
}

// Bloque "Reserva tu viaje" para mostrar bajo el itinerario de una ciudad:
// experiencias (GetYourGuide), hoteles (Booking) y vuelos (Aviasales).
export function AfiliadosCiudad({ ciudad, t = (k) => k }) {
  if (!ciudad?.nombre) return null;
  const nombre = ciudad.nombre;
  const lat = ciudad.lat;
  const lon = ciudad.lon;
  return (
    <div className="mt-3.5 rounded-2xl border border-slate-100 bg-white p-4 shadow-suave">
      <div className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-marca-900"><Icono nombre="luggage" size={16} /> {t("afTitulo")} · {nombre}</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <CtaReserva
          href={linkTours({ q: nombre, lat, lon })}
          icono="ticket"
          titulo={t("afTours")}
          desc={t("afToursDesc")}
          tipo="tours"
          color="marca"
        />
        <CtaReserva
          href={linkHoteles({ ciudad: nombre, lat, lon })}
          icono="bed"
          titulo={t("afHoteles")}
          desc={t("afHotelesDesc")}
          tipo="hotel"
          color="emerald"
        />
        <CtaReserva
          href={linkVuelos({ ciudad: nombre, pais: ciudad.pais })}
          icono="plane"
          titulo={t("afVuelos")}
          desc={t("afVuelosDesc")}
          tipo="vuelo"
          color="sky"
        />
        {/* eSIM + Seguro: los dos productos que TODO viajero internacional
            necesita y que mejor convierten cuando se ofrecen en contexto
            (esta planeando un viaje, no buscando comparativas en frio). */}
        <CtaReserva
          href={linkESIM({ pais: ciudad.pais })}
          icono="phone"
          titulo={t("afESIM")}
          desc={t("afESIMDesc")}
          tipo="esim"
          color="violet"
        />
        <CtaReserva
          href={linkSeguro({ pais: ciudad.pais })}
          icono="shield"
          titulo={t("afSeguro")}
          desc={t("afSeguroDesc")}
          tipo="seguro"
          color="rose"
        />
      </div>
      <div className="mt-2.5 text-[11px] leading-snug text-slate-400">{t("afNota")}</div>
    </div>
  );
}

// Botón contextual para el panel de detalle de un lugar: tours cerca de ESE punto.
export function BotonTourLugar({ lugar, ciudad, t = (k) => k }) {
  if (!lugar?.coord) return null;
  const href = linkTours({
    q: ciudad?.nombre || lugar.nombre,
    lat: lugar.coord[0],
    lon: lugar.coord[1],
  });
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener"
      onClick={() => track("afiliado_clic", { cat: "tour_lugar" })}
      className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-acento-400 to-acento-600 px-3.5 py-2 text-[13px] font-bold text-white shadow-suave transition hover:brightness-105"
    >
      <Icono nombre="ticket" size={15} /> {t("afTourCerca")}
    </a>
  );
}
