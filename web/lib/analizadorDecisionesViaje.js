import { evaluarTramo, costoDiario } from "@/lib/rutaViva";

function n(v, fallback = 0) { const x = Number(v); return Number.isFinite(x) ? x : fallback; }
function key(p) { return `${String(p?.ciudad || "").trim().toLowerCase()}|${String(p?.pais || "").trim().toLowerCase()}`; }
function tramo(a, b) {
  const t = evaluarTramo({ desde: a, hasta: b }) || {};
  const precio = Number(t.precio);
  const horas = Number(t.puertaAPuerta_h ?? t.duracion_h);
  return {
    precio: Number.isFinite(precio) ? precio : null,
    horas: Number.isFinite(horas) ? horas : null,
    fuente: t.fuente || "sin_dato",
  };
}
function evaluarRuta(paradas) {
  let precio = 0; let horas = 0; let datos = 0; let faltantes = 0;
  for (let i = 0; i < paradas.length - 1; i++) {
    const t = tramo(paradas[i], paradas[i + 1]);
    if (t.precio == null || t.horas == null) faltantes++;
    precio += t.precio ?? 0;
    horas += t.horas ?? 0;
    if (t.fuente === "detectado" || t.fuente === "curado") datos++;
  }
  return {
    precio: Math.round(precio),
    horas: Math.round(horas * 10) / 10,
    tramosConDatoFiable: datos,
    tramosSinDato: faltantes,
  };
}
function costeEstancia(p) {
  const noches = n(p?.noches);
  if (!noches) return 0;
  return n(costoDiario(p?.ciudad, p?.paisNombre || p?.pais)?.usd) * noches;
}

/**
 * Analiza decisiones que cambian el viaje, no solo el orden de las ciudades.
 * La eliminación de una parada siempre se marca como propuesta: no muta el
 * viaje y deja claro qué noches y coste orientativo podrían liberarse.
 */
export function analizarDecisionesViaje(paradas = []) {
  const original = Array.isArray(paradas) ? paradas.filter(Boolean) : [];
  if (original.length < 2) return { eliminar: [], resumen: "Necesitamos al menos dos ciudades." };

  const base = evaluarRuta(original);
  const eliminar = [];

  for (let i = 1; i < original.length - 1; i++) {
    const stop = original[i];
    const nueva = original.filter((_, idx) => idx !== i);
    const nuevaRuta = evaluarRuta(nueva);
    const noches = n(stop?.noches);
    const estancia = costeEstancia(stop);

    // No ocultamos un aumento del transporte dentro de un supuesto "ahorro".
    // La estancia liberada se muestra por separado y el impacto neto puede ser
    // negativo si los nuevos desplazamientos cuestan más.
    const ahorroTransporte = base.precio - nuevaRuta.precio;
    const impactoNeto = ahorroTransporte + estancia;
    const ahorroHoras = base.horas - nuevaRuta.horas;
    const costeTransporteCambio = nuevaRuta.precio - base.precio;
    const impacto = Math.max(0, Math.round(ahorroHoras * 10)) + Math.max(0, Math.round(Math.abs(impactoNeto) / 10));
    if (impacto < 5) continue;

    // La razon viaja como CODIGO ademas de como frase.
    //
    // La frase en español se queda porque hay consumidores que la usan tal
    // cual (lib/inteligenciaViaje la copia en `porque`). El codigo es lo que
    // permite que el tablero la pinte en ingles, portugues o frances: el
    // motor decide QUE decir, el componente en que idioma decirlo.
    let razonCodigo;
    if (ahorroHoras >= 2 && impactoNeto >= 50) razonCodigo = "simplificaYLibera";
    else if (ahorroHoras >= 2) razonCodigo = "reduceTiempo";
    else if (impactoNeto >= 50) razonCodigo = "liberaPresupuesto";
    else if (impactoNeto < 0) razonCodigo = "liberaNochesPeroCuesta";
    else razonCodigo = "simplificaPoco";
    const razon = {
      simplificaYLibera: `Quitar ${stop.ciudad} simplifica la ruta y puede liberar tiempo y presupuesto.`,
      reduceTiempo: `Quitar ${stop.ciudad} reduce bastante el tiempo de desplazamiento.`,
      liberaPresupuesto: `Quitar ${stop.ciudad} puede liberar presupuesto para el resto del viaje.`,
      liberaNochesPeroCuesta: `Quitar ${stop.ciudad} libera noches, pero aumenta el coste de transporte estimado.`,
      simplificaPoco: `Quitar ${stop.ciudad} simplifica ligeramente el viaje.`,
    }[razonCodigo];

    eliminar.push({
      ciudad: stop.ciudad,
      indice: i,
      rutaResultante: nueva,
      nochesLiberadas: noches,
      costeDiarioEstimado: Math.round(n(costoDiario(stop?.ciudad, stop?.paisNombre || stop?.pais)?.usd)),
      ahorroAlojamientoEstimado: Math.round(estancia),
      ahorroTransporteEstimado: Math.round(ahorroTransporte),
      cambioTransporte: Math.round(costeTransporteCambio),
      impactoNetoEstimado: Math.round(impactoNeto),
      ahorroTotalEstimado: Math.round(Math.max(0, impactoNeto)),
      ahorroHoras: Math.round(ahorroHoras * 10) / 10,
      razon,
      razonCodigo,
      confianza: base.tramosSinDato === 0 ? "media" : "baja",
    });
  }

  eliminar.sort((a, b) => (b.impactoNetoEstimado + b.ahorroHoras * 10) - (a.impactoNetoEstimado + a.ahorroHoras * 10));
  return {
    base,
    eliminar,
    mejorEliminacion: eliminar[0] || null,
    resumen: eliminar[0] ? `La decisión con mayor impacto potencial es revisar ${eliminar[0].ciudad}.` : "No encontramos una eliminación claramente beneficiosa con los datos disponibles.",
  };
}
