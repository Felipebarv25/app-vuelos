import { detectarZigzag, evaluarTramo } from "@/lib/rutaViva";

function n(v, fallback = null) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function key(p) { return `${String(p?.ciudad || "").trim().toLowerCase()}|${String(p?.pais || "").trim().toLowerCase()}`; }
function uniqueStops(stops) { const seen = new Set(); return (Array.isArray(stops) ? stops : []).filter((p) => { const k = key(p); if (!k || seen.has(k)) return false; seen.add(k); return true; }); }

function crearEvaluador() {
  const cache = new Map();
  return (a, b) => {
    const k = `${key(a)}>${key(b)}`;
    if (cache.has(k)) return cache.get(k);
    const t = evaluarTramo({ desde: a, hasta: b }) || {};
    const out = { desde: a.ciudad, hasta: b.ciudad, medio: t.medio || null, precio: n(t.precio), puertaAPuerta_h: n(t.puertaAPuerta_h ?? t.duracion_h), duracion_h: n(t.duracion_h), fuente: t.fuente || "sin_dato", km: n(t.km) };
    cache.set(k, out);
    return out;
  };
}

function evaluarOrden(stops, evaluar) {
  const tramos = []; let precio = 0; let horas = 0; let distancia = 0;
  for (let i = 0; i < stops.length - 1; i++) { const t = evaluar(stops[i], stops[i + 1]); tramos.push(t); precio += t.precio || 0; horas += t.puertaAPuerta_h || 0; distancia += t.km || 0; }
  return { tramos, precio, horas, distancia };
}

function permutationsForMiddle(stops) {
  if (stops.length <= 3) return [stops];
  const first = stops[0]; const last = stops[stops.length - 1]; const middle = stops.slice(1, -1);
  if (middle.length > 7) return null;
  const out = [];
  function walk(prefix, rest) { if (!rest.length) { out.push([first, ...prefix, last]); return; } for (let i = 0; i < rest.length; i++) walk([...prefix, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)]); }
  walk([], middle); return out;
}

export function optimizarViaje(paradas, { maxStops = 8 } = {}) {
  const original = uniqueStops(paradas);
  if (original.length < 3) return { hayAlternativa: false, motivo: "muy-pocas-paradas", original, recomendado: original };
  const evaluar = crearEvaluador();
  const base = evaluarOrden(original, evaluar);
  const candidatos = permutationsForMiddle(original);
  if (!candidatos) {
    const zig = detectarZigzag(original, 12);
    return { hayAlternativa: Boolean(zig?.hayZigzag), motivo: "ruta-grande", original, recomendado: zig?.paradasOptimizadas || original, comparacion: { original: base, recomendado: base, ahorroPrecio: 0, ahorroHoras: 0 }, ahorro: null, zigzag: zig, maxStops };
  }
  let mejor = base; let mejorStops = original;
  for (const candidate of candidatos.slice(0, 5040)) {
    const score = evaluarOrden(candidate, evaluar);
    const scoreTotal = score.horas + score.precio * 0.035 + score.distancia * 0.001;
    const bestTotal = mejor.horas + mejor.precio * 0.035 + mejor.distancia * 0.001;
    if (scoreTotal + 0.05 < bestTotal) { mejor = score; mejorStops = candidate; }
  }
  const ahorroPrecio = base.precio - mejor.precio; const ahorroHoras = base.horas - mejor.horas;
  const cambio = original.map(key).join(">"); const nuevo = mejorStops.map(key).join(">");
  const hay = cambio !== nuevo && (ahorroHoras > 0.25 || ahorroPrecio > Math.max(15, base.precio * 0.05));
  return { hayAlternativa: hay, original, recomendado: hay ? mejorStops : original, comparacion: { original: base, recomendado: hay ? mejor : base, ahorroPrecio: Math.round(ahorroPrecio), ahorroHoras: Math.round(ahorroHoras * 10) / 10 }, razon: hay ? (ahorroHoras >= 1 && ahorroPrecio >= 15 ? "Reduce tiempo y coste de desplazamiento." : ahorroHoras >= 1 ? "Reduce de forma apreciable el tiempo de desplazamiento." : "Reduce el coste estimado manteniendo una ruta más eficiente.") : "La ruta actual ya es suficientemente eficiente con los datos disponibles.", maxStops };
}
