// Motor de itinerario multi-día.
// Reparte los lugares elegidos en N días, respetando un presupuesto de horas
// por día y sumando los tiempos de visita + desplazamiento entre puntos.

import { distanciaMetros, minutosCaminando, recomendarTransporte } from "./rutas";
import { ordenarPorCercania } from "./rutas";

// Estima minutos de desplazamiento entre dos puntos (sin llamar a la red:
// rápido para construir el plan; el detalle fino lo da Google Maps al tocar).
function minutosDesplazamiento(metros) {
  if (metros < 1100) return Math.max(5, minutosCaminando(metros));
  // Transporte público: factor aproximado + espera fija.
  return Math.round(metros / 400) + 8; // ~ velocidad media puerta a puerta
}

// Construye los días del itinerario.
// Parámetros:
//   lugares: array con {nombre, coord, minutos, ...}
//   opciones: { dias, horasPorDia, inicio (coord o null) }
export function construirItinerario(lugares, opciones) {
  const { dias = 3, horasPorDia = 8, inicio = null } = opciones;
  const presupuesto = horasPorDia * 60;

  // Ordenar geográficamente para que cada día sea compacto.
  const ordenados = ordenarPorCercania(lugares, inicio);

  const nuevoDia = () => ({
    paradas: [],
    minutosUsados: 0,
    minutosVisita: 0,
    minutosTraslado: 0,
  });

  // Añade un lugar a un día (calculando traslado desde la última parada).
  function agregar(dia, lugar) {
    const visita = lugar.minutos || 60;
    const ref = dia.paradas.length ? dia.paradas[dia.paradas.length - 1].coord : null;
    const metros = ref ? distanciaMetros(ref, lugar.coord) : 0;
    const traslado = ref ? minutosDesplazamiento(metros) : 0;
    dia.paradas.push({
      ...lugar,
      traslado,
      metros: Math.round(metros),
      transporte: recomendarTransporte(metros),
    });
    dia.minutosUsados += traslado + visita;
    dia.minutosVisita += visita;
    dia.minutosTraslado += traslado;
  }

  function cabe(dia, lugar) {
    const visita = lugar.minutos || 60;
    const ref = dia.paradas.length ? dia.paradas[dia.paradas.length - 1].coord : null;
    const metros = ref ? distanciaMetros(ref, lugar.coord) : 0;
    const traslado = ref ? minutosDesplazamiento(metros) : 0;
    return dia.minutosUsados + traslado + visita <= presupuesto;
  }

  // ESTRATEGIA DE OPTIMIZACIÓN (evitar zigzags):
  // La ruta ya viene ordenada por cercanía (vecino más cercano). La cortamos en
  // `dias` segmentos justo por los SALTOS MÁS GRANDES entre paradas consecutivas.
  // Así, una excursión lejana (p. ej. Guatapé a ~50 km de Medellín) queda aislada
  // en su propio día y cada día es geográficamente COMPACTO (mínimo tiempo en
  // traslados), en vez de ir y volver entre zonas lejanas el mismo día.
  const gaps = [];
  for (let i = 1; i < ordenados.length; i++) {
    gaps.push({ i, d: distanciaMetros(ordenados[i - 1].coord, ordenados[i].coord) });
  }
  const numCortes = Math.max(0, Math.min(dias - 1, gaps.length));
  const cortes = gaps
    .slice()
    .sort((a, b) => b.d - a.d)
    .slice(0, numCortes)
    .map((g) => g.i)
    .sort((a, b) => a - b);

  const segmentos = [];
  let ini = 0;
  for (const c of cortes) {
    segmentos.push(ordenados.slice(ini, c));
    ini = c;
  }
  segmentos.push(ordenados.slice(ini));

  // Llenar cada día respetando el presupuesto de horas; lo que no cabe va aparte.
  const plan = [];
  const sobrantes = [];
  for (const seg of segmentos) {
    const dia = nuevoDia();
    for (const lugar of seg) {
      if (cabe(dia, lugar)) agregar(dia, lugar);
      else sobrantes.push(lugar);
    }
    plan.push(dia);
  }
  while (plan.length < dias) plan.push(nuevoDia());

  // Reubicar sobrantes SOLO en un día cuyo grupo quede cerca (≤20 km). Si la
  // única opción está lejos, se descarta la parada: preferimos una ruta compacta
  // a meter un lugar que obligue a cruzar la región (evita el zigzag).
  const MAX_REUBIC = 20000;
  for (const lugar of sobrantes) {
    let mejor = -1;
    let mejorDist = Infinity;
    for (let j = 0; j < plan.length; j++) {
      if (!cabe(plan[j], lugar)) continue;
      const ref = plan[j].paradas.length
        ? plan[j].paradas[plan[j].paradas.length - 1].coord
        : lugar.coord; // día vacío: puede iniciar un grupo nuevo
      const dd = distanciaMetros(ref, lugar.coord);
      if (dd < mejorDist) {
        mejorDist = dd;
        mejor = j;
      }
    }
    if (mejor >= 0 && mejorDist <= MAX_REUBIC) agregar(plan[mejor], lugar);
  }

  return plan.slice(0, dias);
}

// Agrega un lugar al final de un día concreto, calculando su traslado desde
// la última parada. Devuelve un NUEVO plan (no muta el original).
export function agregarLugarADia(plan, diaIdx, lugar) {
  const nuevo = plan.map((d, i) =>
    i === diaIdx ? { ...d, paradas: d.paradas.slice() } : d
  );
  const dia = nuevo[diaIdx];
  const ref = dia.paradas.length ? dia.paradas[dia.paradas.length - 1].coord : null;
  const metros = ref ? distanciaMetros(ref, lugar.coord) : 0;
  const traslado = ref ? minutosDesplazamiento(metros) : 0;
  const visita = lugar.minutos || 60;
  dia.paradas.push({
    ...lugar,
    traslado,
    metros: Math.round(metros),
    transporte: recomendarTransporte(metros),
  });
  dia.minutosUsados = (dia.minutosUsados || 0) + traslado + visita;
  dia.minutosVisita = (dia.minutosVisita || 0) + visita;
  dia.minutosTraslado = (dia.minutosTraslado || 0) + traslado;
  return nuevo;
}

// Resumen legible de un día.
export function resumenDia(dia) {
  const h = Math.floor(dia.minutosUsados / 60);
  const m = dia.minutosUsados % 60;
  return {
    totalTexto: `${h}h ${m}m`,
    visitaTexto: `${Math.floor(dia.minutosVisita / 60)}h ${dia.minutosVisita % 60}m`,
    trasladoTexto: `${dia.minutosTraslado} min`,
    paradas: dia.paradas.length,
  };
}

// Optimiza el orden de las paradas de UN día usando 2-opt (mejora iterativa
// sobre la ruta existente hasta que no hay swap que reduzca la distancia total).
// Devuelve un NUEVO plan (no muta). inicio = [lat, lon] del hospedaje/GPS.
export function optimizarRutaDia(plan, diaIdx, inicio = null) {
  const nuevo = plan.map((d, i) =>
    i === diaIdx ? { ...d, paradas: d.paradas.map((p) => ({ ...p })) } : d
  );
  const paradas = nuevo[diaIdx].paradas;
  if (paradas.length < 3) return recalcularTraslados(nuevo, diaIdx, inicio);

  const coords = paradas.map((p) => p.coord);
  const n = coords.length;
  const origen = inicio || coords[0];

  function distTotal(order) {
    let d = distanciaMetros(origen, coords[order[0]]);
    for (let i = 1; i < order.length; i++)
      d += distanciaMetros(coords[order[i - 1]], coords[order[i]]);
    return d;
  }

  let order = paradas.map((_, i) => i);
  let mejoro = true;
  while (mejoro) {
    mejoro = false;
    for (let i = 0; i < n - 1; i++) {
      for (let j = i + 1; j < n; j++) {
        const nueva = order.slice();
        nueva.splice(i, j - i + 1, ...order.slice(i, j + 1).reverse());
        if (distTotal(nueva) < distTotal(order)) {
          order = nueva;
          mejoro = true;
        }
      }
    }
  }

  nuevo[diaIdx].paradas = order.map((i) => paradas[i]);
  return recalcularTraslados(nuevo, diaIdx, inicio);
}

// Mueve una parada de un día a otro. Devuelve un NUEVO plan.
export function moverParadaADia(plan, origenDia, paradaIdx, destinoDia) {
  const nuevo = plan.map((d) => ({ ...d, paradas: d.paradas.slice() }));
  const [parada] = nuevo[origenDia].paradas.splice(paradaIdx, 1);
  nuevo[destinoDia].paradas.push(parada);
  const p1 = recalcularTraslados(nuevo, origenDia);
  return recalcularTraslados(p1, destinoDia);
}

// Sube o baja una parada dentro de su día (delta: -1 = subir, +1 = bajar).
export function reordenarParada(plan, diaIdx, paradaIdx, delta) {
  const nuevoIdx = paradaIdx + delta;
  const nuevo = plan.map((d, i) =>
    i === diaIdx ? { ...d, paradas: d.paradas.slice() } : d
  );
  const arr = nuevo[diaIdx].paradas;
  if (nuevoIdx < 0 || nuevoIdx >= arr.length) return plan;
  [arr[paradaIdx], arr[nuevoIdx]] = [arr[nuevoIdx], arr[paradaIdx]];
  return recalcularTraslados(nuevo, diaIdx);
}

// Recalcula traslados/metros/transporte de TODAS las paradas de un día
// (tras reordenar, mover, optimizar). Devuelve el plan actualizado.
function recalcularTraslados(plan, diaIdx, inicio = null) {
  const dia = plan[diaIdx];
  let minutosTraslado = 0;
  let minutosVisita = 0;
  for (let i = 0; i < dia.paradas.length; i++) {
    const p = dia.paradas[i];
    const visita = p.minutos || 60;
    minutosVisita += visita;
    if (i === 0) {
      const metros = inicio ? distanciaMetros(inicio, p.coord) : 0;
      const traslado = inicio ? minutosDesplazamiento(metros) : 0;
      p.traslado = traslado;
      p.metros = Math.round(metros);
      p.transporte = recomendarTransporte(metros);
      minutosTraslado += traslado;
    } else {
      const prev = dia.paradas[i - 1].coord;
      const metros = distanciaMetros(prev, p.coord);
      const traslado = minutosDesplazamiento(metros);
      p.traslado = traslado;
      p.metros = Math.round(metros);
      p.transporte = recomendarTransporte(metros);
      minutosTraslado += traslado;
    }
  }
  dia.minutosTraslado = minutosTraslado;
  dia.minutosVisita = minutosVisita;
  dia.minutosUsados = minutosTraslado + minutosVisita;
  return plan;
}

// Formatea minutos como "1h 20m" o "45 min".
export function fmtMin(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
