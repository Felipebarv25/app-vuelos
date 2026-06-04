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
  bookingAid: "",          // p.ej. "1234567" (Booking.com → afíliate para activarlo)
  travelpayouts: "734652", // marker de Travelpayouts (vuelos) — ya activo
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

// Hoteles (Booking.com) cerca de una ciudad / punto.
export function linkHoteles({ ciudad = "", lat, lon } = {}) {
  const p = new URLSearchParams();
  if (ciudad) p.set("ss", ciudad);
  if (lat != null && lon != null) {
    p.set("latitude", String(lat));
    p.set("longitude", String(lon));
  }
  if (AFILIADOS.bookingAid) p.set("aid", AFILIADOS.bookingAid);
  return `https://www.booking.com/searchresults.html?${p.toString()}`;
}

// Vuelos (Aviasales / Travelpayouts) hacia un destino (por texto: ciudad/país).
export function linkVuelos({ ciudad = "", pais = "" } = {}) {
  const destino = [ciudad, pais].filter(Boolean).join(", ");
  const p = new URLSearchParams();
  if (destino) p.set("destination", destino);
  if (AFILIADOS.travelpayouts) p.set("marker", AFILIADOS.travelpayouts);
  return `https://www.aviasales.com/?${p.toString()}`;
}
