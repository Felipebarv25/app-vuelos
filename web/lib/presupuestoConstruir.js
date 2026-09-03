// Construye el presupuesto de un viaje: de paradas y tramos a lineas de gasto.
//
// Separado de presupuestoLineas.js a proposito: alli vive el MODELO (que es
// una linea, que campos tiene, como se agrupan) y aqui la POLITICA (que
// lineas genera un viaje y con que numeros). El modelo lo usan los dos modos
// de planificacion; la politica se puede discutir y ajustar sin tocarlo.

import { REPARTO_DIARIO } from "./presupuesto";
import { costoDiario } from "./rutaViva";
import {
  BASES,
  TASA_TURISTICA,
  crearLinea,
  diasPorCiudad,
  montoEfectivo,
  agruparPorCategoria,
  normalizarClave as norm,
} from "./presupuestoLineas";

const fmt = (n) => `US$${Math.round(n).toLocaleString("es-CO")}`;

/**
 * Arma TODAS las lineas de un viaje.
 *
 * @param {object} p
 * @param {Array}  p.paradas   [{ciudad, pais, paisNombre, iata, noches, region}]
 * @param {Array}  p.tramos    salida de evaluarTramo(), con desde/hasta
 * @param {number} p.viajeros
 * @param {object} p.overrides { [idLinea]: monto } — lo que el usuario fijo a mano
 * @param {object} p.ajustes   { contingenciaPct, margenCambiarioPct }
 * @param {Array}  p.extras    lineas de fuera (visas, ETIAS...) que se suman tal cual
 */
export function construirPresupuesto({
  paradas = [],
  tramos = [],
  viajeros = 1,
  overrides = {},
  ajustes = {},
  extras = [],
} = {}) {
  const n = Math.max(1, Math.round(Number(viajeros) || 1));
  const lineas = [];
  const ciudades = diasPorCiudad(paradas);
  const nochesTotal = ciudades.reduce((s, c) => s + c.noches, 0);
  const diasTotal = ciudades.reduce((s, c) => s + c.dias, 0) || 1;
  const habitaciones = Math.ceil(n / BASES.personasPorHabitacion);

  const conAeropuerto = paradas.filter((p) => p.iata);
  const hayLargoRadio = tramos.some((t) => t.medio === "vuelo" && (t.km || 0) >= 3000);

  // ---- 1. Transporte: una linea por tramo ---------------------------------
  tramos.forEach((t, i) => {
    if (t.fuente === "misma-ciudad") return;
    const largo = (t.km || 0) >= 3000;
    lineas.push(
      crearLinea({
        id: `tramo_${i}`,
        concepto: `${t.desde?.ciudad || "?"} → ${t.hasta?.ciudad || "?"}`,
        categoria: largo ? "transporte_internacional" : "transporte_entre_ciudades",
        monto: (t.precio || 0) * n,
        base: "tramo",
        porPersona: true,
        confianza:
          t.fuente === "detectado"
            ? "real_detectado"
            : t.fuente === "curado"
            ? "verificado_manual"
            : "estimado",
        formula:
          t.fuente === "incluido"
            ? "Ya cubierto por el billete de ida y vuelta"
            : `${fmt(t.precio || 0)} × ${n} ${n === 1 ? "persona" : "personas"}`,
        fuente:
          t.fuente === "detectado"
            ? "Precio real detectado (Travelpayouts)"
            : t.fuente === "curado"
            ? "Tarifa curada a mano"
            : `Estimado por distancia (${(t.km || 0).toLocaleString("es-CO")} km)`,
        monetizable: true,
        nota: t.fuente === "incluido" ? "El vuelo de ida ya trae la vuelta." : "",
      })
    );
  });

  // ---- 2. Lo que rodea al vuelo y nadie presupuesta ------------------------
  if (hayLargoRadio) {
    lineas.push(
      crearLinea({
        id: "equipaje",
        concepto: "Equipaje facturado",
        categoria: "transporte_internacional",
        monto: BASES.equipajeLargoRadio * n,
        porPersona: true,
        formula: `${fmt(BASES.equipajeLargoRadio)} ida y vuelta × ${n}`,
        fuente: "Base típica de equipaje facturado en vuelo de largo radio",
        nota: "Si viajas solo con equipaje de mano, pon 0.",
      })
    );
    lineas.push(
      crearLinea({
        id: "tasas_aereas",
        concepto: "Tasas aeroportuarias",
        categoria: "transporte_internacional",
        monto: 0,
        confianza: "verificado_manual",
        formula: "Ya incluidas en la tarifa",
        fuente: "Las tarifas que mostramos son finales, con tasas incluidas",
        // Aparece en cero A PROPOSITO. Una linea que no esta deja al viajero
        // preguntandose si se olvido; una en cero con nota le dice que ya
        // esta contada. Es la diferencia entre omitir y responder.
        nota: "En 0 a propósito: no se omite, es que ya está pagada arriba.",
      })
    );
  }
  if (conAeropuerto.length) {
    const trayectos = conAeropuerto.length * 2;
    lineas.push(
      crearLinea({
        id: "traslado_aeropuerto",
        concepto: "Traslados aeropuerto ↔ centro",
        categoria: "transporte_local",
        monto: BASES.trasladoAeropuerto * trayectos * habitaciones,
        formula: `${trayectos} trayectos × ${fmt(BASES.trasladoAeropuerto)}`,
        fuente: "Base típica de bus lanzadera o taxi compartido",
        nota: "Se va en grupo, así que no se multiplica por viajero.",
      })
    );
  }

  // ---- 3. Ciudad por ciudad -----------------------------------------------
  for (const c of ciudades) {
    if (c.noches <= 0 && c.dias <= 0) continue;
    const cd = costoDiario(c.ciudad, c.pais, c.region);
    const dia = cd.usd;
    const fuenteDia =
      cd.fuente === "ciudad"
        ? `Costo de vida de ${c.ciudad}`
        : cd.fuente === "pais"
        ? `Mediana de ${c.pais} (sin dato de la ciudad)`
        : cd.fuente === "region"
        ? "Mediana de la región"
        : "Media global (sin dato del país)";

    // HOSPEDAJE: por noche y por HABITACION.
    //
    // Aqui estaba el error que mas se notaba con dos viajeros: se multiplicaba
    // por persona, asi que un viaje en pareja duplicaba la cuenta del hotel.
    // Una habitacion cuesta lo que cuesta, la duerma uno o la duerman dos.
    const porNoche = Math.round(dia * REPARTO_DIARIO.hospedaje);
    if (c.noches > 0) {
      lineas.push(
        crearLinea({
          id: `hosp_${norm(c.ciudad)}`,
          concepto: `Hospedaje en ${c.ciudad}`,
          categoria: "hospedaje",
          monto: porNoche * c.noches * habitaciones,
          base: "noche",
          porPersona: false,
          ciudad: c.ciudad,
          formula: `${c.noches} ${c.noches === 1 ? "noche" : "noches"} × ${fmt(porNoche)} × ${habitaciones} ${habitaciones === 1 ? "habitación" : "habitaciones"}`,
          fuente: fuenteDia,
          monetizable: true,
          nota:
            n > 1
              ? `${n} viajeros en ${habitaciones} ${habitaciones === 1 ? "habitación" : "habitaciones"}: la habitación no se paga dos veces.`
              : "",
        })
      );

      const tasa = TASA_TURISTICA[norm(c.ciudad)];
      lineas.push(
        crearLinea({
          id: `tasa_${norm(c.ciudad)}`,
          concepto: `Tasa turística en ${c.ciudad}`,
          categoria: "hospedaje",
          monto: (tasa || 0) * c.noches * n,
          base: "noche",
          porPersona: true,
          ciudad: c.ciudad,
          confianza: tasa != null ? "verificado_manual" : "estimado",
          formula: tasa
            ? `${c.noches} × ${fmt(tasa)} × ${n}`
            : "Esta ciudad no cobra tasa turística",
          fuente: tasa != null ? "Tarifa municipal publicada" : "Sin dato para esta ciudad",
          nota:
            tasa == null
              ? "No tenemos el dato: se cobra al llegar al hotel, pregúntalo."
              : "",
        })
      );
    }

    // COMIDA, TRANSPORTE LOCAL Y ACTIVIDADES: por DIA, no por noche.
    //
    // Este era el otro error silencioso, y el mas caro de los dos. El motor
    // viejo multiplicaba todo por noches: un viaje de tres noches pagaba tres
    // dias de comida cuando se comen cuatro. Sobre veinte noches, eso es un
    // dia entero de gasto que no aparecia por ningun lado.
    const porDia = [
      ["comida", "alimentacion", `Comer en ${c.ciudad}`, REPARTO_DIARIO.comida],
      ["local", "transporte_local", `Moverte en ${c.ciudad}`, REPARTO_DIARIO.transporte],
      ["activ", "actividades", `Salir y ver en ${c.ciudad}`, REPARTO_DIARIO.extras],
    ];
    for (const [pre, cat, concepto, prop] of porDia) {
      const unit = Math.round(dia * prop);
      lineas.push(
        crearLinea({
          id: `${pre}_${norm(c.ciudad)}`,
          concepto,
          categoria: cat,
          monto: unit * c.dias * n,
          base: "dia",
          porPersona: true,
          ciudad: c.ciudad,
          formula: `${c.dias} ${c.dias === 1 ? "día" : "días"} × ${fmt(unit)} × ${n}`,
          fuente: fuenteDia,
          monetizable: cat === "actividades",
        })
      );
    }
  }

  // ---- 4. Lo que siempre aparece y nunca se presupuesta --------------------
  lineas.push(
    crearLinea({
      id: "seguro",
      concepto: "Seguro de viaje",
      categoria: "pre_viaje",
      monto: Math.round(BASES.seguroDia * diasTotal * n),
      base: "dia",
      porPersona: true,
      formula: `${diasTotal} días × ${fmt(BASES.seguroDia)} × ${n}`,
      fuente: "Base típica de seguro de viaje internacional",
      nota: "Obligatorio para el espacio Schengen.",
    })
  );
  lineas.push(
    crearLinea({
      id: "esim",
      concepto: "eSIM o plan de datos",
      categoria: "varios",
      monto: BASES.esim * n,
      porPersona: true,
      formula: `${fmt(BASES.esim)} × ${n}`,
      fuente: "Base típica de plan de datos regional",
    })
  );
  const cargas = Math.floor(diasTotal / BASES.diasPorCarga);
  lineas.push(
    crearLinea({
      id: "lavanderia",
      concepto: "Lavandería",
      categoria: "varios",
      monto: cargas * BASES.lavanderiaPorCarga * habitaciones,
      formula:
        cargas > 0
          ? `${cargas} ${cargas === 1 ? "carga" : "cargas"} × ${fmt(BASES.lavanderiaPorCarga)}`
          : `Viaje corto (${diasTotal} días): no hace falta`,
      fuente: "Una carga cada 7 días",
    })
  );

  // ---- 5. Colchon ---------------------------------------------------------
  // Va al final porque se calcula SOBRE lo anterior, incluidas las lineas que
  // el usuario haya pisado a mano: si baja el hotel, baja tambien el colchon.
  const todas = [...lineas, ...(extras || []).filter(Boolean)];
  const subtotal = todas.reduce((s, l) => s + montoEfectivo(l, overrides), 0);
  const gastoEnDestino = todas
    .filter((l) =>
      ["hospedaje", "alimentacion", "transporte_local", "actividades"].includes(l.categoria)
    )
    .reduce((s, l) => s + montoEfectivo(l, overrides), 0);

  todas.push(
    crearLinea({
      id: "comision_cambio",
      concepto: "Comisiones de cambio y cajero",
      categoria: "varios",
      monto: Math.round(gastoEnDestino * BASES.comisionCambioPct),
      formula: `${Math.round(BASES.comisionCambioPct * 100)}% del gasto en destino (${fmt(gastoEnDestino)})`,
      fuente: "Comisión típica de tarjeta o retiro en cajero en el extranjero",
    })
  );

  const pctCont = ajustes.contingenciaPct ?? BASES.contingenciaPct;
  const pctFx = ajustes.margenCambiarioPct ?? BASES.margenCambiarioPct;
  todas.push(
    crearLinea({
      id: "contingencia",
      concepto: "Colchón para imprevistos",
      categoria: "colchon",
      monto: Math.round(subtotal * pctCont),
      formula: `${Math.round(pctCont * 100)}% sobre ${fmt(subtotal)}`,
      fuente: "Ajustable: súbelo si el viaje es largo o vas justo",
    })
  );
  todas.push(
    crearLinea({
      id: "margen_cambiario",
      concepto: "Margen por si se mueve el dólar",
      categoria: "colchon",
      monto: Math.round(subtotal * pctFx),
      formula: `${Math.round(pctFx * 100)}% sobre ${fmt(subtotal)}`,
      fuente: "El peso se mueve entre que planeas y que viajas",
    })
  );

  const total = todas.reduce((s, l) => s + montoEfectivo(l, overrides), 0);

  return {
    lineas: todas,
    total,
    totalPorPersona: Math.round(total / n),
    viajeros: n,
    habitaciones,
    noches: nochesTotal,
    dias: diasTotal,
    porCategoria: agruparPorCategoria(todas, overrides),
  };
}
