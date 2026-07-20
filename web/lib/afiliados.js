// Enlaces de afiliado (monetización). Funciona DESDE YA: mientras los IDs estén
// vacíos, los botones llevan al sitio normal del proveedor (sin comisión). En
// cuanto pegues tus IDs aquí, los mismos botones empiezan a generar comisión.
//
// Cómo conseguir cada ID (son IDs públicos de seguimiento, NO contraseñas):
//   • getYourGuide → regístrate en https://partner.getyourguide.com → "partner_id"
//   • bookingAid   → afíliate en https://www.booking.com/affiliate-program/ → "aid"
//   • travelpayouts→ regístrate en https://www.travelpayouts.com → tu "marker"
//                    (sirve para vuelos Aviasales, eSIM y seguros)
export const AFILIADOS = {
  getYourGuide: "RGTCZOH", // partner_id de GetYourGuide (tours/experiencias)
  civitatis: "",           // ID afiliado Civitatis (https://www.civitatis.com/es/afiliados/)
                           // Fuerte en LATAM y España. Comisión ~10%. Si vacío, link normal sin comisión.
  bookingAid: "",          // p.ej. "1234567" (Booking.com → afíliate para activarlo)
  travelpayouts: "734652", // marker de Travelpayouts — sirve para Aviasales (vuelos),
                            //   Hotellook (hoteles), Airalo eSIM y EKTA seguro.
  airaloPartner: "",       // Airalo Partners (https://airalo.com/affiliate-program) -
                            // si lo dejas vacio, el link de eSIM lleva al store normal.
  ektaPartner: "",         // EKTA Insurance (https://ektatraveling.com/partners) -
                            // si lo dejas vacio, lleva al sitio normal.
  // trs (traffic source) de Travelpayouts: SIN el, los redirects tp.media
  // responden "traffic_source is not valid" (bug reportado 2026-07-11).
  // Se saca del dashboard de Travelpayouts (Tools -> Links, el numero "trs").
  // Mientras este vacio, eSIM/seguro enlazan DIRECTO a Airalo/EKTA (funciona,
  // sin comision) en vez de a un redirect roto.
  tpTrs: "",
};

// ¿Hay al menos un programa configurado? (para decidir si mostrar la nota de afiliados)
export function hayAfiliados() {
  return Boolean(AFILIADOS.getYourGuide || AFILIADOS.bookingAid || AFILIADOS.travelpayouts);
}

// Tours y experiencias (GetYourGuide). Si pasas lat/lon, centra la búsqueda
// alrededor de ese punto (ideal para "tours cerca de este lugar").
export function linkTours({ q = "", lat, lon } = {}) {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (lat != null && lon != null) {
    p.set("lc_la", String(lat));
    p.set("lc_lo", String(lon));
  }
  if (AFILIADOS.getYourGuide) p.set("partner_id", AFILIADOS.getYourGuide);
  const qs = p.toString();
  return `https://www.getyourguide.com/s/${qs ? `?${qs}` : ""}`;
}

// Hoteles. Si hay AID propio de Booking, va directo a Booking; si no, usa
// Hotellook (Travelpayouts) con tu marker — compara Booking y otros y genera
// comisión SIN necesidad de un programa de afiliados aparte de Booking.
export function linkHoteles({ ciudad = "", lat, lon } = {}) {
  if (AFILIADOS.bookingAid) {
    const p = new URLSearchParams();
    if (ciudad) p.set("ss", ciudad);
    if (lat != null && lon != null) {
      p.set("latitude", String(lat));
      p.set("longitude", String(lon));
    }
    p.set("aid", AFILIADOS.bookingAid);
    return `https://www.booking.com/searchresults.html?${p.toString()}`;
  }
  // Hotellook (Travelpayouts) con tu marker.
  const p = new URLSearchParams();
  if (ciudad) p.set("destination", ciudad);
  if (AFILIADOS.travelpayouts) p.set("marker", AFILIADOS.travelpayouts);
  return `https://search.hotellook.com/?${p.toString()}`;
}

// Vuelos (Aviasales / Travelpayouts) hacia un destino (por texto: ciudad/país).
export function linkVuelos({ ciudad = "", pais = "" } = {}) {
  const destino = [ciudad, pais].filter(Boolean).join(", ");
  const p = new URLSearchParams();
  if (destino) p.set("destination", destino);
  if (AFILIADOS.travelpayouts) p.set("marker", AFILIADOS.travelpayouts);
  return `https://www.aviasales.com/?${p.toString()}`;
}

// Comparar el mismo trayecto en Google Vuelos (sin API, abrimos la búsqueda
// con texto libre — Google la entiende y prellena origen/destino/fechas).
// Útil porque a veces Google encuentra ofertas que Aviasales/Travelpayouts no.
export function linkGoogleFlights({
  ciudad = "",
  pais = "",
  origen = "Bogotá",
  fechaIda = "",
  fechaVuelta = "",
} = {}) {
  const destino = [ciudad, pais].filter(Boolean).join(" ");
  const fechas = [fechaIda, fechaVuelta].filter(Boolean).join(" ");
  const q = `vuelos desde ${origen} a ${destino}${fechas ? " " + fechas : ""}`.trim();
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(q)}`;
}

// eSIM internacional (Airalo). Cuando llegas a otro país, comprar una eSIM en
// el aeropuerto es 3-5x más caro que comprarla online por adelantado. Airalo
// vende eSIMs por país con tarifas baratas y activación instantánea. Comisión:
// ~10% del precio (afiliado Travelpayouts si usas tu marker, o programa propio
// Airalo Partners si tienes ID).
export function linkESIM({ pais = "", iso2 = "" } = {}) {
  const p = new URLSearchParams();
  if (pais) p.set("q", pais);
  // Airalo no tiene URL pública con marker; usamos Travelpayouts widget que
  // redirige a Airalo con la comisión. Si el usuario ha activado Airalo Partners
  // (afiliado directo), prevalece ese.
  if (AFILIADOS.airaloPartner) {
    return `https://www.airalo.com/?partner_id=${encodeURIComponent(AFILIADOS.airaloPartner)}${iso2 ? `&country=${iso2}` : ""}`;
  }
  // Redirect afiliado tp.media SOLO si hay marker Y trs (sin trs el redirect
  // muere en "traffic_source is not valid" — mejor link directo sin comision
  // que un link roto).
  if (AFILIADOS.travelpayouts && AFILIADOS.tpTrs) {
    return `https://tp.media/r?marker=${AFILIADOS.travelpayouts}&trs=${AFILIADOS.tpTrs}&p=4115&u=https%3A%2F%2Fwww.airalo.com%2F&campaign_id=541`;
  }
  return "https://www.airalo.com/";
  return `https://www.airalo.com/${iso2 ? `?country=${iso2.toLowerCase()}` : ""}`;
}

// Seguro de viaje (EKTA Traveling — la mayoría de empresas latinas confían en
// ellos, soporte en español). Cubre cancelación, equipaje, salud en el extranjero.
// Comisión: ~15% para EKTA Partners. Sin ID, lleva al sitio normal.
export function linkSeguro({ pais = "", dias = 7 } = {}) {
  if (AFILIADOS.ektaPartner) {
    const p = new URLSearchParams();
    if (pais) p.set("country", pais);
    p.set("partner", AFILIADOS.ektaPartner);
    return `https://ektatraveling.com/?${p.toString()}`;
  }
  // Redirect afiliado tp.media SOLO si hay marker Y trs (ver nota en linkESIM).
  if (AFILIADOS.travelpayouts && AFILIADOS.tpTrs) {
    return `https://tp.media/r?marker=${AFILIADOS.travelpayouts}&trs=${AFILIADOS.tpTrs}&p=5095&u=https%3A%2F%2Fektatraveling.com%2F&campaign_id=121`;
  }
  return "https://ektatraveling.com/";
}

// Tour cerca de UN punto especifico del itinerario (lat/lon). Es el formato
// que mejor convierte: el usuario ya esta en "modo planeacion del dia" cuando
// ve la parada, y el tour es contextual a ese sitio.
export function linkTourCerca({ nombre = "", ciudad = "", lat, lon } = {}) {
  return linkTours({
    q: nombre || ciudad,
    lat,
    lon,
  });
}

// Civitatis: tours y experiencias en español, fuerte en LATAM y Europa.
// Búsqueda por ciudad; si hay ID de afiliado, se agrega como parámetro.
export function linkCivitatis({ ciudad = "", q = "" } = {}) {
  const busqueda = q || ciudad;
  const slug = busqueda
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  let url = `https://www.civitatis.com/es/${slug}/`;
  if (AFILIADOS.civitatis) url += `?aid=${encodeURIComponent(AFILIADOS.civitatis)}`;
  return url;
}

// Civitatis contextual a un lugar específico (busca actividades en esa ciudad).
export function linkCivitatisCerca({ ciudad = "", nombre = "" } = {}) {
  return linkCivitatis({ ciudad, q: ciudad });
}
