// Carga compartida de /ofertas.json (lo que produce el detector de precios).
//
// Tres consumidores: el componente Ofertas, MiniOfertas y la propia página
// /ofertas (que necesita saber hasta qué fecha hay datos para acotar el
// selector). Una sola promesa por carga, mismo patrón que lib/geo.js.
let _promesa = null;

export function obtenerOfertas() {
  if (_promesa) return _promesa;
  _promesa = fetch("/ofertas.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d || { rutas: [] })
    .catch(() => ({ rutas: [] }));
  return _promesa;
}

/**
 * Primer y último día de salida con datos. El detector solo explora los
 * próximos config.MESES_A_EXPLORAR meses (hoy 6), así que fuera de esa ventana
 * no hay NADA que mostrar — y el selector de fechas debe impedir elegir ahí en
 * vez de devolver una lista vacía sin explicación.
 * @returns {{min: string, max: string}|null} fechas ISO "YYYY-MM-DD"
 */
export function ventanaDeFechas(data) {
  const rutas = data?.rutas || [];
  let min = null;
  let max = null;
  for (const r of rutas) {
    const ida = r.fecha_ida;
    if (!ida) continue;
    if (!min || ida < min) min = ida;
    // La ventana llega hasta la VUELTA más lejana: si el último vuelo sale el
    // 26 de febrero y vuelve el 8 de marzo, marzo sigue siendo elegible.
    const tope = r.fecha_vuelta && r.fecha_vuelta > ida ? r.fecha_vuelta : ida;
    if (!max || tope > max) max = tope;
  }
  return min && max ? { min, max } : null;
}
