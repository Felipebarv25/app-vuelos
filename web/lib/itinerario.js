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

  let d = 0;
  let anterior = inicio;

  for (const lugar of ordenados) {
    const visita = lugar.minutos || 60;

    // Buscar un día (desde el actual) donde quepa.
    let colocado = false;
    for (let intento = 0; intento < dias; intento++) {
      const diaIdx = (d + intento) % dias;
      const dia = plan[diaIdx];
      const refAnterior = dia.paradas.length
        ? dia.paradas[dia.paradas.length - 1].coord
        : inicio;

      const metros = refAnterior ? distanciaMetros(refAnterior, lugar.coord) : 0;
      const traslado = refAnterior ? minutosDesplazamiento(metros) : 0;

      if (dia.minutosUsados + traslado + visita <= presupuesto) {
        const trans = recomendarTransporte(metros);
        dia.paradas.push({
          ...lugar,
          traslado,
          metros: Math.round(metros),
          transporte: trans,
        });
        dia.minutosUsados += traslado + visita;
        dia.minutosVisita += visita;
        dia.minutosTraslado += traslado;
        colocado = true;
        d = diaIdx; // continuar llenando este día
        anterior = lugar.coord;
        break;
      }
    }
    // Si no cupo en ningún día, se descarta (sobran lugares para el tiempo dado).
    if (!colocado) continue;
  }

  return plan;
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
