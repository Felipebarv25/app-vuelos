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

  const plan = Array.from({ length: dias }, () => ({
    paradas: [],
    minutosUsados: 0,
    minutosVisita: 0,
    minutosTraslado: 0,
  }));

  // Función para añadir un lugar a un día concreto (calculando traslado).
  function agregar(dia, lugar) {
    const visita = lugar.minutos || 60;
    const esPrimera = dia.paradas.length === 0;
    const refAnterior = esPrimera ? null : dia.paradas[dia.paradas.length - 1].coord;
    const metros = refAnterior ? distanciaMetros(refAnterior, lugar.coord) : 0;
    const traslado = refAnterior ? minutosDesplazamiento(metros) : 0;
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
    const esPrimera = dia.paradas.length === 0;
    const refAnterior = esPrimera ? null : dia.paradas[dia.paradas.length - 1].coord;
    const metros = refAnterior ? distanciaMetros(refAnterior, lugar.coord) : 0;
    const traslado = refAnterior ? minutosDesplazamiento(metros) : 0;
    return dia.minutosUsados + traslado + visita <= presupuesto;
  }

  // Estrategia: dividir la lista (ya ordenada geográficamente) en N bloques
  // contiguos —uno por día— para que cada día sea compacto Y ningún día quede
  // vacío. Cada bloque se llena respetando el presupuesto de horas; lo que no
  // cabe en su día se intenta colocar en los días siguientes con hueco.
  const porDia = Math.ceil(ordenados.length / dias);
  const sobrantes = [];

  for (let dIdx = 0; dIdx < dias; dIdx++) {
    const dia = plan[dIdx];
    const desde = dIdx * porDia;
    const hasta = Math.min(desde + porDia, ordenados.length);
    for (let i = desde; i < hasta; i++) {
      const lugar = ordenados[i];
      if (cabe(dia, lugar)) agregar(dia, lugar);
      else sobrantes.push(lugar);
    }
  }

  // Reubicar sobrantes en cualquier día con hueco (de día 1 en adelante).
  for (const lugar of sobrantes) {
    for (let dIdx = 0; dIdx < dias; dIdx++) {
      if (cabe(plan[dIdx], lugar)) {
        agregar(plan[dIdx], lugar);
        break;
      }
    }
  }

  return plan;
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

// Formatea minutos como "1h 20m" o "45 min".
export function fmtMin(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}
