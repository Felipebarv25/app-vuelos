// Coordenadas por codigo IATA, para las paradas que llegan sin ubicar.
//
// POR QUE HACE FALTA
//
// Al elegir un AEROPUERTO, SelectorAeropuerto no emite lat/lon: solo lo hace
// la rama de "ciudad sin aeropuerto". PlanRuta lo resuelve despues con
// coordsCuradas() y, si falla, con /api/geocodificar. Cuando los dos fallan la
// parada se queda con lat: null y el mapa la dejaba DESAPARECER en silencio.
//
// Birmingham es el caso real: el catalogo no la tiene curada y el
// geocodificador devuelve {"encontrado":false} para ("Birmingham","GB"),
// comprobado contra produccion. La ruta se dibujaba sin ella y nada avisaba.
//
// POR QUE UN JSON APARTE Y NO UNA TABLA EN EL BUNDLE
//
// Son 6.756 aeropuertos (161 KB). Meterlos en el bundle se lo cobraria a
// TODOS los visitantes para resolver un caso que casi nunca ocurre. Vive en
// /public y se pide UNA vez, solo cuando hay alguna parada sin coordenadas.
//
// Generado desde Wikidata (P238 = codigo IATA, P625 = coordenadas), filtrado a
// los IATA que aparecen en public/aeropuertos.json. De los 6.987 del catalogo
// quedan 231 sin coordenadas: para esos, la parada se lista como "sin ubicar",
// que es justo lo que antes no pasaba.

// La misma trampa que en el mapa: Number(null) es 0 y Number.isFinite(0) es
// true, asi que una parada con lat: null se daba por ubicada y no se
// rellenaba nunca. Se rechaza lo vacio ANTES de convertir.
const tieneCoord = (v) =>
  v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v));

let _promesa = null;

/** Carga (una sola vez por sesion) la tabla IATA -> [lat, lon]. */
export function cargarCoordsIATA() {
  if (_promesa) return _promesa;
  _promesa = fetch("/aeropuertos-coords.json")
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}));
  return _promesa;
}

/**
 * Rellena lat/lon de las paradas que no las traen, usando su IATA.
 *
 * Devuelve SIEMPRE un array del mismo largo y en el mismo orden: quien lo
 * consume sigue teniendo el itinerario completo, con o sin coordenadas.
 */
export async function ubicarPorIATA(paradas) {
  const faltan = (paradas || []).some(
    (p) => !tieneCoord(p?.lat) && /^[A-Za-z]{3}$/.test(p?.iata || "")
  );
  if (!faltan) return paradas || [];

  const tabla = await cargarCoordsIATA();
  return (paradas || []).map((p) => {
    if (tieneCoord(p?.lat) && tieneCoord(p?.lon)) return p;
    const c = tabla[String(p?.iata || "").toUpperCase()];
    return c ? { ...p, lat: c[0], lon: c[1], ubicadaPorIATA: true } : p;
  });
}
