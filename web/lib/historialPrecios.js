// Estadísticas de precios por mes usando el historial que produce el detector
// (datos/historial.csv en la raíz del repo). Se LEE EN BUILD por las páginas
// SSG de /destino/<slug>, sin ningún costo en runtime — los datos quedan
// embebidos en el HTML pre-renderizado.
//
// Devuelve por IATA (BOG→destino) la mediana de precio por mes de salida,
// con etiquetas legibles ("ene 2026", etc.) ya calculadas para el render.
import { promises as fs } from "fs";
import path from "path";

const CSV_PATH = path.join(process.cwd(), "..", "datos", "historial.csv");
const MESES_ES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function mediana(nums) {
  if (!nums.length) return null;
  const ord = [...nums].sort((a, b) => a - b);
  const m = ord.length;
  return m % 2 ? ord[(m - 1) / 2] : Math.round((ord[m / 2 - 1] + ord[m / 2]) / 2);
}

// Origen por defecto cuando quien llama no sabe desde dónde vuela el lector:
// las páginas SEO de /destino/<slug> son estáticas y no conocen al visitante.
// Son los hubs de Colombia, el mercado principal de la app. La página DEBE
// decir desde dónde son esos precios; mezclar mercados no es opción porque el
// calendario muestra precios absolutos y un MAD→Barcelona de US$50 junto a un
// BOG→Barcelona de US$600 daría una cifra que no le sirve a nadie.
export const ORIGENES_POR_DEFECTO = ["BOG", "MDE", "CLO", "CTG"];

// Caché por conjunto de orígenes: antes era una sola y el filtro estaba fijo
// dentro del parseo, así que /alertas/[id] no podía pedir otros orígenes.
const CACHE = new Map();

// Lee el CSV y devuelve {IATA: {"YYYY-MM": [precios]}} para los orígenes
// pedidos. Solo los últimos 90 días.
async function cargarBruto(origenes) {
  const clave = [...origenes].sort().join(",");
  if (CACHE.has(clave)) return CACHE.get(clave);
  let txt;
  try {
    txt = await fs.readFile(CSV_PATH, "utf8");
  } catch {
    CACHE.set(clave, {});
    return {};
  }
  const lineas = txt.split(/\r?\n/);
  if (lineas.length < 2) {
    CACHE.set(clave, {});
    return {};
  }
  // Cabecera: timestamp,origen,destino,fecha_ida,fecha_vuelta,precio,moneda,aerolinea
  const datos = {};
  const corte = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  for (let i = 1; i < lineas.length; i++) {
    const fila = lineas[i].split(",");
    if (fila.length < 7) continue;
    const ts = new Date(fila[0]);
    if (isNaN(ts.getTime()) || ts < corte) continue;
    const origen = fila[1];
    const destino = fila[2];
    const ida = fila[3];
    const precio = Number(fila[5]);
    if (!destino || !ida || !precio || precio <= 0) continue;
    if (!origenes.includes(origen)) continue;
    const ym = ida.slice(0, 7); // "YYYY-MM"
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    if (!datos[destino]) datos[destino] = {};
    if (!datos[destino][ym]) datos[destino][ym] = [];
    datos[destino][ym].push(precio);
  }
  CACHE.set(clave, datos);
  return datos;
}

// Devuelve para un IATA destino: { meses: [{ym, label, precio, mejor:bool}], mejor:{ym,precio,label}, peor:{...} }
// O null si no hay datos.
export async function preciosPorMes(iata, origenes = ORIGENES_POR_DEFECTO) {
  const lista = Array.isArray(origenes) && origenes.length ? origenes : ORIGENES_POR_DEFECTO;
  const bruto = await cargarBruto(lista);
  const porMes = bruto[iata];
  if (!porMes) return null;

  // Agregar por mediana y filtrar meses con muestras escasas (<2).
  const filas = Object.entries(porMes)
    .map(([ym, precios]) => ({
      ym,
      muestras: precios.length,
      precio: mediana(precios),
    }))
    .filter((f) => f.muestras >= 2 && f.precio != null)
    .sort((a, b) => a.ym.localeCompare(b.ym));

  if (filas.length < 2) return null;

  const min = Math.min(...filas.map((f) => f.precio));
  const max = Math.max(...filas.map((f) => f.precio));
  const conLabel = filas.map((f) => {
    const m = Number(f.ym.slice(5, 7)) - 1;
    const y = f.ym.slice(2, 4);
    return {
      ...f,
      label: `${MESES_ES[m] || ""} ${y}`,
      mejor: f.precio === min,
      peor: f.precio === max,
    };
  });
  const mejor = conLabel.find((f) => f.mejor);
  const peor = conLabel.find((f) => f.peor);
  return { meses: conLabel, mejor, peor };
}

