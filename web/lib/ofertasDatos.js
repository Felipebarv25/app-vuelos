// Carga compartida de /ofertas.json (lo que produce el detector de precios).
//
// Tres consumidores: el componente Ofertas, MiniOfertas y la propia página
// /ofertas (que necesita saber hasta qué fecha hay datos para acotar el
// selector). Una sola promesa por carga, mismo patrón que lib/geo.js.
let _promesa = null;

/**
 * ISO-2 a partir del emoji de bandera del detector.
 *
 * ofertas.json trae `bandera` como emoji y NO trae el codigo de pais. El
 * emoji no se ve en Windows —Segoe UI Emoji no incluye banderas—, asi que
 * MiniOfertas pintaba "co Cartagena" y "ES Madrid" en el home. El emoji son
 * dos indicadores regionales, y U+1F1E6 es la A: restando ese desfase se
 * recuperan las dos letras sin tocar el detector ni el JSON.
 */
function isoDeEmoji(emoji) {
  const cp = [...String(emoji || "")].map((c) => c.codePointAt(0));
  if (cp.length !== 2 || cp.some((c) => c < 0x1f1e6 || c > 0x1f1ff)) return "";
  return cp.map((c) => String.fromCharCode(c - 0x1f1e6 + 65)).join("").toLowerCase();
}

export function obtenerOfertas() {
  if (_promesa) return _promesa;
  _promesa = fetch("/ofertas.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (!d) return { rutas: [] };
      // Se normaliza AQUI y no en cada componente: son tres consumidores y
      // hasta ahora cada uno pintaba la bandera a su manera.
      return { ...d, rutas: (d.rutas || []).map((r) => ({ ...r, iso: r.iso || isoDeEmoji(r.bandera) })) };
    })
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
