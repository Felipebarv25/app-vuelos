// Relevancia turistica de un POI de OpenStreetMap.
//
// Existe porque la seccion "Los mejores lugares para visitar en X" de las
// fichas de destino decia "Curados por relevancia (Wikipedia + visitas
// reales)" y no curaba NADA: topLugares() leia el JSON precalculado, filtraba
// los que tienen nombre y hacia slice(0, 10) EN ORDEN DE FICHERO. Por eso en
// Cartagena salia el "Estadio Once de Noviembre" entre los mejores lugares:
// esta cuarto en el fichero.
//
// El criterio de entrada del precalculo es "tiene Wikipedia o Wikidata", que
// sirve para descartar ruido pero no distingue un castillo de un estadio de
// futbol: los dos tienen articulo.

// Cosas notables que NO son turismo. Se detectan por ETIQUETA y nunca por
// nombre: "Coliseo" es el Coliseo de Roma y tambien un polideportivo, y el
// nombre no permite distinguirlos. Las etiquetas si.
const NO_TURISTICO = [
  (t) => t.leisure === "stadium" || t.building === "stadium",
  (t) => t.leisure === "sports_centre" || t.leisure === "pitch" || t.leisure === "track",
  (t) => !!t.sport,
  (t) => t.amenity === "hospital" || t.amenity === "clinic",
  (t) => t.amenity === "school" || t.amenity === "college",
  (t) => t.amenity === "prison" || t.amenity === "police" || t.amenity === "fire_station",
  (t) => t.office || t.industrial,
];

// Recintos deportivos que SI se visitan como monumento, por QID de Wikidata
// para que no dependa de como este escrito el nombre.
//
// La lista es corta a proposito y el liston es "se entra a verlo, no a ver un
// partido". Wembley, el Bernabeu o el Allianz Arena tienen visita guiada y
// mucha fama, pero nadie diria que son de lo que hay que ver en Londres,
// Madrid o Munich; estos tres si.
const DEPORTIVO_MONUMENTAL = new Set([
  "Q208811",  // Panathinaiko (Atenas): estadio de marmol, primeros JJ.OO. modernos
  "Q155174",  // Maracana (Rio): visita guiada, top de la ciudad
  "Q133525",  // Nido de Pajaro (Pekin): hito arquitectonico visitable
]);

/**
 * ¿Es notable pero no un sitio al que se va de turismo?
 *
 * Un estadio, un hospital o una universidad pueden tener articulo en
 * Wikipedia y aun asi no ser lo que alguien viene a ver en cuatro dias.
 */
export function esNoTuristico(tags = {}) {
  if (tags.wikidata && DEPORTIVO_MONUMENTAL.has(tags.wikidata)) return false;
  // Excepcion: si ademas esta etiquetado como atraccion turistica o tiene
  // proteccion patrimonial, mandan esas. El Maracana o el Coliseo entran por
  // aqui y no se pierden.
  if (tags.heritage || tags["heritage:operator"]) return false;
  if (tags.tourism === "attraction" && (tags.historic || tags.heritage)) return false;
  return NO_TURISTICO.some((f) => f(tags));
}

/**
 * Ordena y recorta una lista de elementos precalculados.
 *
 * CONSERVA EL ORDEN DEL FICHERO y solo descarta lo no turistico. El primer
 * intento reordenaba con una puntuacion propia y salio peor: en Roma dejaba
 * el Coliseo octavo detras de tres museos, porque un bono a "tourism=museum"
 * pesaba mas que "historic=ruins". El orden del precalculo no es arbitrario
 * —scripts/precomputar-lugares.mjs ordena por sitelinks de Wikidata, o sea
 * por fama medida— y era mejor que cualquier heuristica que yo escribiera
 * encima. Lo unico que le sobraba eran los sitios notables pero no
 * turisticos.
 *
 * Si al filtrar la lista queda raquitica se devuelve la original: media lista
 * es peor que una lista con un estadio al final.
 */
export function mejoresLugares(elements = [], n = 10) {
  const con = (elements || []).filter((e) => e?.tags?.name);
  const buenos = con.filter((e) => !esNoTuristico(e.tags));
  const base = buenos.length >= Math.min(5, con.length) ? buenos : con;
  return base.slice(0, n);
}
