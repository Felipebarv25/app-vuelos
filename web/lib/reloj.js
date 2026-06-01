// Lógica del "cronómetro de itinerario": compara el tiempo planeado contra el
// tiempo real transcurrido y dice si el viajero va adelantado o atrasado.

// Dado el plan de un día y el índice de la parada actual + la hora de inicio,
// calcula el estado de tiempo.
export function estadoTiempo(dia, indiceActual, horaInicioMs, ahoraMs) {
  // Minutos planeados hasta COMPLETAR la parada actual.
  let planeado = 0;
  for (let i = 0; i <= indiceActual && i < dia.paradas.length; i++) {
    const p = dia.paradas[i];
    planeado += (p.traslado || 0) + (p.minutos || 60);
  }
  const transcurrido = Math.round((ahoraMs - horaInicioMs) / 60000);
  const diferencia = transcurrido - planeado; // + = atrasado, - = adelantado

  let estado = "en_hora";
  if (diferencia > 15) estado = "atrasado";
  else if (diferencia < -15) estado = "adelantado";

  return { planeado, transcurrido, diferencia, estado };
}

export function textoEstado(est) {
  const abs = Math.abs(est.diferencia);
  if (est.estado === "atrasado")
    return { emoji: "🔴", texto: `Vas ${abs} min atrasado`, color: "#dc2626" };
  if (est.estado === "adelantado")
    return { emoji: "🟢", texto: `Vas ${abs} min adelantado`, color: "#16a34a" };
  return { emoji: "🟡", texto: "Vas en hora", color: "#ca8a04" };
}
