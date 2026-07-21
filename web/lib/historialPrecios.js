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

let CACHE = null;
let CACHE_COMPLETO = null;

// Lee el CSV una vez y devuelve {IATA: {"YYYY-MM": [precios]}}.
// Solo guarda los últimos 90 días (consultas frescas) y solo origen BOG/MDE.
async function cargarBruto() {
  if (CACHE) return CACHE;
  let txt;
  try {
    txt = await fs.readFile(CSV_PATH, "utf8");
  } catch {
    CACHE = {};
    return CACHE;
  }
  const lineas = txt.split(/\r?\n/);
  if (lineas.length < 2) {
    CACHE = {};
    return CACHE;
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
    if (origen !== "BOG" && origen !== "MDE") continue;
    const ym = ida.slice(0, 7); // "YYYY-MM"
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    if (!datos[destino]) datos[destino] = {};
    if (!datos[destino][ym]) datos[destino][ym] = [];
    datos[destino][ym].push(precio);
  }
  CACHE = datos;
  return CACHE;
}

async function cargarCompleto() {
  if (CACHE_COMPLETO) return CACHE_COMPLETO;
  let txt;
  try {
    txt = await fs.readFile(CSV_PATH, "utf8");
  } catch {
    CACHE_COMPLETO = {};
    return CACHE_COMPLETO;
  }
  const lineas = txt.split(/\r?\n/);
  if (lineas.length < 2) { CACHE_COMPLETO = {}; return CACHE_COMPLETO; }
  // {destino: {"YYYY-MM": {precio, origen, ida, vuelta, aerolinea, escalas_ida, escalas_vuelta, visto}}}
  const datos = {};
  for (let i = 1; i < lineas.length; i++) {
    const fila = lineas[i].split(",");
    if (fila.length < 7) continue;
    const visto = fila[0];
    const origen = fila[1];
    const destino = fila[2];
    const ida = fila[3];
    const vuelta = fila[4];
    const precio = Number(fila[5]);
    const aerolinea = (fila[7] || "").trim();
    const escalas_ida = fila[8] != null && fila[8] !== "" ? Number(fila[8]) : null;
    const escalas_vuelta = fila[9] != null && fila[9] !== "" ? Number(fila[9]) : null;
    if (!destino || !ida || !precio || precio <= 0) continue;
    const ym = ida.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    if (!datos[destino]) datos[destino] = {};
    const actual = datos[destino][ym];
    if (!actual || precio < actual.precio) {
      datos[destino][ym] = { precio, origen, ida, vuelta, aerolinea, escalas_ida, escalas_vuelta, visto };
    }
  }
  CACHE_COMPLETO = datos;
  return CACHE_COMPLETO;
}

// Devuelve para un IATA destino: { meses: [{ym, label, precio, mejor:bool}], mejor:{ym,precio,label}, peor:{...} }
// O null si no hay datos.
export async function preciosPorMes(iata) {
  const bruto = await cargarBruto();
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

export async function vuelosMasBaratosPorMes(iata) {
  const bruto = await cargarCompleto();
  const porMes = bruto[iata];
  if (!porMes) return null;
  const filas = Object.entries(porMes)
    .map(([ym, v]) => {
      const m = Number(ym.slice(5, 7)) - 1;
      const y = ym.slice(0, 4);
      return { ym, anio: y, label: `${MESES_ES[m] || ""} ${y.slice(2)}`, ...v };
    })
    .sort((a, b) => a.ym.localeCompare(b.ym));
  if (!filas.length) return null;
  const precios = filas.map((f) => f.precio);
  const promedioGlobal = Math.round(precios.reduce((s, p) => s + p, 0) / precios.length);
  return { vuelos: filas, promedio: promedioGlobal };
}
