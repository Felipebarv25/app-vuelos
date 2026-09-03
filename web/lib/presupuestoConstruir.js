// Construye el presupuesto de un viaje: de paradas y tramos a lineas de gasto.
//
// Separado de presupuestoLineas.js a proposito: alli vive el MODELO (que es
// una linea, que campos tiene, como se agrupan) y aqui la POLITICA (que
// lineas genera un viaje y con que numeros). El modelo lo usan los dos modos
// de planificacion; la politica se puede discutir y ajustar sin tocarlo.

import { REPARTO_DIARIO } from "./presupuesto";
import {
  linkVuelos,
  linkTren,
  linkBus,
  linkTransporte,
  linkCarro,
  linkHoteles,
  linkCivitatis,
  linkESIM,
  linkSeguro,
} from "./afiliados";
import { costoDiario } from "./rutaViva";
import {
  BASES,
  TASA_TURISTICA,
  crearLinea,
  diasPorCiudad,
  montoEfectivo,
  montoUSD,
  agruparPorCategoria,
  normalizarClave as norm,
  nivelDe,
  NIVEL_POR_DEFECTO,
} from "./presupuestoLineas";

const fmt = (n) => `US$${Math.round(n).toLocaleString("es-CO")}`;

// De donde se reserva cada tramo.
//
// Los enlaces y los IDs de afiliado ya existian y el asesor ya los usaba; el
// planificador manual no. Tenia "Ver como llegar" (informativo) y "Buscar
// precio real", y de ninguna de sus lineas se podia reservar — justo la parte
// del producto que paga el producto.
//
// El criterio es el mismo de afiliados.js: si no hay ID configurado el enlace
// lleva igual al buscador, solo que sin comision. Nunca un boton muerto.
function reservaDeTramo(t) {
  const desde = t.desde?.ciudad || "";
  const hasta = t.hasta?.ciudad || "";
  switch (t.medio) {
    case "vuelo":
      return {
        proveedor: "Aviasales",
        url: linkVuelos({ ciudad: hasta, pais: t.hasta?.paisNombre || "" }),
      };
    case "tren":
      return { proveedor: "Omio", url: linkTren({ desde, hasta }) };
    case "bus":
      return { proveedor: "Omio", url: linkBus({ desde, hasta }) };
    case "carro":
      return {
        proveedor: "Discover Cars",
        url: linkCarro({ ciudad: desde, pais: t.desde?.paisNombre || "" }),
      };
    // El ferry no tiene agregador propio configurado: Rome2Rio si lo vende, y
    // es el unico que cubre rutas fuera de Europa sin configurar nada.
    default:
      return { proveedor: "Rome2Rio", url: linkTransporte({ desde, hasta }) };
  }
}

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
  // NIVEL DE GASTO: "mochilero" | "medio" | "comodo".
  nivel = NIVEL_POR_DEFECTO,
  // Tasas para sumar lineas en monedas distintas. Sin ellas todo se trata
  // como dolares, que es lo que pasaba antes de que existieran las visas.
  porUsd = {},
} = {}) {
  const n = Math.max(1, Math.round(Number(viajeros) || 1));
  const nv = nivelDe(nivel);
  // Etiqueta del nivel para las formulas: cada cifra dice con que nivel se
  // calculo, porque el mismo viaje da tres presupuestos distintos y sin eso
  // una linea suelta no se puede auditar.
  const etiquetaNivel = { mochilero: "mochilero", medio: "medio", comodo: "cómodo" }[nv.clave];
  const lineas = [];
  const ciudades = diasPorCiudad(paradas);
  const nochesTotal = ciudades.reduce((s, c) => s + c.noches, 0);
  const diasTotal = ciudades.reduce((s, c) => s + c.dias, 0) || 1;
  const habitaciones = Math.ceil(n / BASES.personasPorHabitacion);

  const conAeropuerto = paradas.filter((p) => p.iata);
  const hayLargoRadio = tramos.some(
    (t) => t.medio === "vuelo" && (t.largo != null ? !!t.largo : (t.km || 0) >= 3000)
  );

  // ---- 1. Transporte: una linea por tramo ---------------------------------
  tramos.forEach((t, i) => {
    if (t.fuente === "misma-ciudad") return;
    // El que llama puede DECIR que el tramo es de largo radio. Lo necesita el
    // asesor: sus saltos no traen kilometros, pero el vuelo de entrada sabe
    // perfectamente que es intercontinental.
    const largo = t.largo != null ? !!t.largo : (t.km || 0) >= 3000;
    // EL PRECIO REAL NO SE TOCA CON EL NIVEL.
    //
    // Es una tarifa de mercado detectada, la mas barata que hay: multiplicarla
    // por un factor de nivel la convierte en un numero inventado con pinta de
    // dato. Lo que cambia con el nivel es lo que compras ALREDEDOR del vuelo
    // — equipaje, asiento, clase —, y eso va en sus propias lineas.
    //
    // Los tramos ESTIMADOS si escalan: ya son una estimacion, y un mochilero
    // toma el bus nocturno donde el nivel comodo vuela.
    const escala = t.fuente === "detectado" || t.fuente === "curado" ? 1 : nv.tramoEstimado;
    const precioTramo = Math.round((t.precio || 0) * escala);
    lineas.push(
      crearLinea({
        id: `tramo_${i}`,
        concepto: `${t.desde?.ciudad || "?"} → ${t.hasta?.ciudad || "?"}`,
        categoria: largo ? "transporte_internacional" : "transporte_entre_ciudades",
        monto: precioTramo * n,
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
            : escala === 1
            ? `${fmt(precioTramo)} × ${n} ${n === 1 ? "persona" : "personas"}`
            : `${fmt(t.precio || 0)} × ${escala} (nivel ${etiquetaNivel}) × ${n}`,
        fuente:
          t.fuente === "detectado"
            ? "Precio real detectado (Travelpayouts)"
            : t.fuente === "curado"
            ? "Tarifa curada a mano"
            : `Estimado por distancia (${(t.km || 0).toLocaleString("es-CO")} km)`,
        monetizable: true,
        proveedorAfiliado: reservaDeTramo(t).proveedor,
        urlAfiliado: reservaDeTramo(t).url,
        nota: t.fuente === "incluido" ? "El vuelo de ida ya trae la vuelta." : "",
      })
    );
  });

  // ---- 2. Lo que rodea al vuelo y nadie presupuesta ------------------------
  if (hayLargoRadio) {
    lineas.push(
      crearLinea({
        id: "equipaje",
        concepto:
          nv.clave === "mochilero"
            ? "Equipaje (solo de mano)"
            : nv.clave === "comodo"
            ? "Equipaje facturado (2 maletas + asiento)"
            : "Equipaje facturado",
        categoria: "transporte_internacional",
        monto: nv.equipaje * n,
        porPersona: true,
        formula:
          nv.equipaje > 0
            ? `${fmt(nv.equipaje)} ida y vuelta × ${n}`
            : "Viajar con lo de mano, nivel mochilero",
        fuente:
          nv.equipaje > 0
            ? "Base típica de equipaje facturado en vuelo de largo radio"
            : "En el nivel mochilero no se factura maleta",
        nota:
          nv.equipaje > 0
            ? "Si viajas solo con equipaje de mano, pon 0."
            : "En 0 a propósito: con equipaje de mano no se paga.",
      })
    );

    // Mejora de clase: solo en el nivel comodo, y se cobra el SALTO sobre la
    // tarifa detectada, no un billete entero. En largo radio la premium
    // economy sale del orden de 2,2 veces la economica.
    const tramoLargo = tramos.find(
      (t) => t.medio === "vuelo" && (t.largo != null ? !!t.largo : (t.km || 0) >= 3000)
    );
    if (nv.mejoraClase > 0 && tramoLargo?.precio > 0) {
      lineas.push(
        crearLinea({
          id: "mejora_clase",
          concepto: "Mejora a premium economy",
          categoria: "transporte_internacional",
          monto: Math.round(tramoLargo.precio * nv.mejoraClase) * n,
          porPersona: true,
          formula: `${fmt(tramoLargo.precio)} × ${nv.mejoraClase} × ${n}`,
          fuente: "La premium economy de largo radio cuesta ~2,2× la económica",
          nota: "Es el salto sobre la tarifa económica, no el billete completo.",
        })
      );
    }
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
        monto: nv.trasladoAeropuerto * trayectos * habitaciones,
        formula: `${trayectos} trayectos × ${fmt(nv.trasladoAeropuerto)} (nivel ${etiquetaNivel})`,
        fuente:
          nv.clave === "mochilero"
            ? "Bus lanzadera o transporte público al aeropuerto"
            : nv.clave === "comodo"
            ? "Traslado privado puerta a puerta"
            : "Base típica de bus lanzadera o taxi compartido",
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
    // El nivel cambia la CATEGORIA del hospedaje, que es el rubro que mas se
    // mueve de los tres: un dormitorio compartido cuesta como un 40% de un
    // hotel de 3 estrellas, y un 4-5 estrellas mas del doble.
    const porNoche = Math.round(dia * REPARTO_DIARIO.hospedaje * nv.hospedaje);
    const tipoHospedaje =
      nv.clave === "mochilero"
        ? "Hostal o dormitorio"
        : nv.clave === "comodo"
        ? "Hotel 4-5★"
        : "Hotel 3★ o apartamento";
    if (c.noches > 0) {
      lineas.push(
        crearLinea({
          id: `hosp_${norm(c.ciudad)}`,
          concepto: `${tipoHospedaje} en ${c.ciudad}`,
          categoria: "hospedaje",
          monto: porNoche * c.noches * habitaciones,
          base: "noche",
          porPersona: false,
          ciudad: c.ciudad,
          formula: `${c.noches} ${c.noches === 1 ? "noche" : "noches"} × ${fmt(porNoche)} × ${habitaciones} ${habitaciones === 1 ? "habitación" : "habitaciones"}`,
          fuente: `${fuenteDia} · nivel ${etiquetaNivel}`,
          monetizable: true,
          proveedorAfiliado: "Booking / Hotellook",
          // Ciudad, pais Y coordenadas: con el nombre a secas el buscador del
          // afiliado resolvia "York" como Nueva York.
          // Las estrellas van al buscador del afiliado: si el presupuesto es
          // de hostal, ensenar hoteles de cinco estrellas es perder el clic.
          urlAfiliado: linkHoteles({
            ciudad: c.ciudad,
            pais: c.pais,
            lat: c.lat,
            lon: c.lon,
            estrellas: nv.estrellas,
          }),
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
          // La tasa municipal casi siempre escala con la categoria del hotel.
          monto: Math.round((tasa || 0) * nv.tasaTuristica) * c.noches * n,
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
    // Cada rubro con SU factor, no con uno global.
    //
    // Comer en mercado no baja al 40% de comer en restaurante: baja a la
    // mitad, porque el ingrediente cuesta lo que cuesta. Y el transporte
    // publico apenas se mueve — el metro vale igual para todos —, asi que es
    // justo el que un factor unico castigaria mas.
    const detalleNivel = {
      mochilero: {
        comida: "Mercado, comida de calle y cocinar",
        local: "Metro y bus, sin taxis",
        activ: "Lo gratis primero, alguna entrada",
      },
      medio: {
        comida: "Mezcla de restaurante y supermercado",
        local: "Transporte público y algún taxi",
        activ: "Una actividad de pago al día",
      },
      comodo: {
        comida: "Restaurante a diario",
        local: "Taxis y traslados privados",
        activ: "Tours guiados y experiencias",
      },
    }[nv.clave];

    const porDia = [
      ["comida", "alimentacion", `Comer en ${c.ciudad}`, REPARTO_DIARIO.comida, nv.comida, detalleNivel.comida],
      ["local", "transporte_local", `Moverte en ${c.ciudad}`, REPARTO_DIARIO.transporte, nv.transporte, detalleNivel.local],
      ["activ", "actividades", `Salir y ver en ${c.ciudad}`, REPARTO_DIARIO.extras, nv.actividades, detalleNivel.activ],
    ];
    for (const [pre, cat, concepto, prop, factor, detalle] of porDia) {
      const unit = Math.round(dia * prop * factor);
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
          fuente: `${fuenteDia} · ${detalle}`,
          monetizable: cat === "actividades",
          proveedorAfiliado: cat === "actividades" ? "Civitatis" : null,
          urlAfiliado: cat === "actividades" ? linkCivitatis({ ciudad: c.ciudad }) : null,
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
      monto: Math.round(nv.seguroDia * diasTotal * n),
      base: "dia",
      porPersona: true,
      formula: `${diasTotal} días × ${fmt(nv.seguroDia)} × ${n}`,
      fuente:
        nv.clave === "mochilero"
          ? "Seguro básico: cobertura médica mínima Schengen"
          : nv.clave === "comodo"
          ? "Seguro amplio: cancelación, equipaje y cobertura alta"
          : "Base típica de seguro de viaje internacional",
      monetizable: true,
      proveedorAfiliado: "EKTA",
      urlAfiliado: linkSeguro({ pais: ciudades[0]?.pais || "", dias: diasTotal }),
      nota: "Obligatorio para el espacio Schengen.",
    })
  );
  lineas.push(
    crearLinea({
      id: "esim",
      concepto: "eSIM o plan de datos",
      categoria: "varios",
      monto: nv.esim * n,
      porPersona: true,
      formula: `${fmt(nv.esim)} × ${n}`,
      fuente:
        nv.clave === "mochilero"
          ? "Plan de datos mínimo, wifi donde se pueda"
          : nv.clave === "comodo"
          ? "Plan de datos amplio, sin racionar"
          : "Base típica de plan de datos regional",
      monetizable: true,
      proveedorAfiliado: "Airalo",
      // El pais del primer DESTINO, no el de casa: la eSIM se compra para
      // donde vas.
      urlAfiliado: linkESIM({
        pais: ciudades[0]?.pais || "",
        iso2: ciudades[0]?.iso || "",
      }),
    })
  );
  const cargas = Math.floor(diasTotal / BASES.diasPorCarga);
  lineas.push(
    crearLinea({
      id: "lavanderia",
      concepto: "Lavandería",
      categoria: "varios",
      monto: cargas * nv.lavanderiaPorCarga * habitaciones,
      formula:
        cargas > 0
          ? `${cargas} ${cargas === 1 ? "carga" : "cargas"} × ${fmt(nv.lavanderiaPorCarga)}`
          : `Viaje corto (${diasTotal} días): no hace falta`,
      fuente: "Una carga cada 7 días",
    })
  );

  // ---- 5. Colchon ---------------------------------------------------------
  // Va al final porque se calcula SOBRE lo anterior, incluidas las lineas que
  // el usuario haya pisado a mano: si baja el hotel, baja tambien el colchon.
  const todas = [...lineas, ...(extras || []).filter(Boolean)];
  // En dolares, no en "el numero que lleve cada linea": las visas vienen en
  // libras y en euros, y sumarlas a pelo con los hoteles daria una cifra sin
  // significado.
  const subtotal = todas.reduce((s, l) => s + montoUSD(l, overrides, porUsd), 0);
  const gastoEnDestino = todas
    .filter((l) =>
      ["hospedaje", "alimentacion", "transporte_local", "actividades"].includes(l.categoria)
    )
    .reduce((s, l) => s + montoUSD(l, overrides, porUsd), 0);

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

  const total = todas.reduce((s, l) => s + montoUSD(l, overrides, porUsd), 0);

  return {
    lineas: todas,
    nivel: nv.clave,
    total,
    totalPorPersona: Math.round(total / n),
    viajeros: n,
    habitaciones,
    noches: nochesTotal,
    dias: diasTotal,
    porCategoria: agruparPorCategoria(todas, overrides, porUsd),
  };
}
