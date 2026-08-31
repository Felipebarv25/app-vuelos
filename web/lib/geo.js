// Geolocalización aproximada por IP, compartida por toda la app.
//
// Existe porque /api/geo se estaba pidiendo una y otra vez en la misma carga:
// AlertaPrecio se renderiza UNA VEZ POR TARJETA de oferta, y cada instancia
// lanzaba su propio fetch. Medido en producción en /ofertas: ~25 llamadas
// idénticas para responder siempre lo mismo. Con seis componentes distintos
// llamándolo, el problema solo crece.
//
// Una única promesa compartida por sesión de página: el primero que llama
// dispara la petición y todos los demás esperan ese mismo resultado.
// Mismo patrón que cargarCatalogo() en SelectorAeropuerto.

let _promesa = null;

/**
 * @returns {Promise<{pais: string, ciudad: string, region: string}|null>}
 *   null si la petición falla; nunca lanza.
 */
export function obtenerGeo() {
  if (_promesa) return _promesa;
  _promesa = fetch("/api/geo")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  return _promesa;
}
