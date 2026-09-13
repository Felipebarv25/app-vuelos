// Los precios del detector, leidos desde el servidor.
//
// obtenerPreciosReales() (lib/preciosVuelos) pide /ofertas.json con una ruta
// relativa: eso solo funciona en el navegador. En servidor no hay origen al
// que colgarla, asi que el fichero se lee del disco.
//
// El PARSEO no se repite: se reutiliza construirMapaOfertas, el mismo que usa
// el cliente. Aqui solo cambia de donde llega el JSON.
//
// Vivia dentro de /api/descubrir. Sale a lib/ en cuanto un segundo endpoint
// —el analisis de viaje, para comparar aeropuertos de salida— necesito lo
// mismo: dos copias de una lectura de fichero son dos sitios donde olvidarse
// del try/catch.
import path from "path";
import { promises as fs } from "fs";
import { construirMapaOfertas } from "./preciosVuelos";

// El Root Directory del despliegue es web/, asi que public/ofertas.json esta
// a mano tanto en local como en produccion.
const RUTA = path.join(process.cwd(), "public", "ofertas.json");

let _cache;

/**
 * Devuelve el mapa destino -> { porOrigen, mejor }. Si el fichero no esta o no
 * se puede leer devuelve {} y quien llame seguira con los precios estimados
 * del catalogo: peor dato, nunca dato inventado.
 */
export async function cargarOfertasServidor() {
  if (_cache !== undefined) return _cache;
  try {
    _cache = construirMapaOfertas(JSON.parse(await fs.readFile(RUTA, "utf8")));
  } catch {
    _cache = {};
  }
  return _cache;
}
