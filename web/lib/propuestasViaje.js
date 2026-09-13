// Convierte una busqueda en PROPUESTAS DE VIAJE, no en una lista de vuelos.
//
// QUE NO HACE ESTE FICHERO
//
// No construye rutas. Eso ya lo hace construirRuta() en lib/presupuesto, que
// elige ciudad de entrada, encadena ciudades por cercania, cuesta cada salto
// con la tabla curada de lib/tramos y reparte los dias dentro del presupuesto.
// Ese motor lleva tiempo funcionando y aqui NO se reimplementa: se le pide
// varias rutas y se ordenan.
//
// QUE SI HACE
//
//   1. Pedir varias rutas variando semilla y region.
//   2. Quitar las repetidas.
//   3. Puntuar cada una contra lo que el viajero pidio.
//   4. Clasificar el presupuesto y EXPLICAR por que.
//   5. Conservar la procedencia de cada cifra.
//
// LA REGLA QUE MANDA SOBRE LAS DEMAS
//
// Una propuesta con datos flojos no puede parecer mas precisa que una con
// datos reales. La confianza se calcula aparte de la compatibilidad y no se
// mezclan: un viaje puede encajar perfectamente contigo y estar sostenido por
// estimaciones, y eso hay que poder verlo.

import { construirRuta, llaveCiudad, REGIONES, DESTINOS_PRESUPUESTO } from "./presupuesto";
import { tagsDe } from "./destinosTags";

// Cuantas rutas se piden por region. Cada semilla da una ruta distinta porque
// construirRuta elige al azar entre las ciudades mas cercanas.
const SEMILLAS = 6;
// Regiones que se exploran cuando el viajero dice "todas". No es el catalogo
// entero: son las que tienen suficientes ciudades para armar multiciudad.
const REGIONES_EXPLORABLES = ["europa", "sudamerica", "norteamerica", "asia"];

const pct = (x) => Math.max(0, Math.min(1, x));

/**
 * Procedencia de las cifras de una ruta. Se lee de lo que devuelve
 * construirRuta, no se supone.
 */
function fuentesDe(ruta) {
  const saltos = ruta.ciudades.slice(1);
  const curados = saltos.filter((c) => c.esTramoCurado).length;
  return {
    // El vuelo internacional: consultado de verdad o tabla del catalogo.
    vuelo: ruta.esRealEntrada ? "real" : "estimado",
    // Los saltos entre ciudades: curados (AVE, Eurostar...) o aproximados.
    tramosCurados: curados,
    tramosAprox: saltos.length - curados,
    // Alojamiento y vida diaria SIEMPRE son estimacion: salen del costo
    // diario por ciudad del catalogo, no de una reserva.
    estancia: "estimado",
  };
}

/**
 * Confianza 0-100: cuanto de esta propuesta se apoya en datos y cuanto en
 * estimaciones. No mide si el viaje es bueno; mide si el numero es creible.
 */
function confianzaDe(ruta, fuentes) {
  const saltos = fuentes.tramosCurados + fuentes.tramosAprox;
  // El vuelo internacional pesa mas que los saltos porque suele ser la mitad
  // del presupuesto.
  const vuelo = fuentes.vuelo === "real" ? 1 : 0.45;
  const tramos = saltos ? fuentes.tramosCurados / saltos : 1;
  // La estancia nunca sube de 0,5: es siempre una estimacion, y fingir otra
  // cosa seria justo lo que no queremos.
  const estancia = 0.5;
  return Math.round((vuelo * 0.45 + tramos * 0.3 + estancia * 0.25) * 100);
}

/**
 * Presupuesto: verde, ambar o rojo, y por que.
 *
 * El "por que" no es decorativo. Decir "te pasas por 420.000" sin decir de
 * que obliga al viajero a adivinar donde recortar, y la respuesta casi siempre
 * es la misma: la categoria mas cara del desglose.
 */
function veredictoPresupuesto(ruta, presupuestoUsd) {
  if (!presupuestoUsd) return { estado: "sin-presupuesto", diferencia: 0, culpable: null };
  const diferencia = ruta.total - presupuestoUsd;
  const margen = presupuestoUsd * 0.1;

  // OJO: aqui NO se escribe la frase.
  //
  // Antes se devolvia un motivo ya redactado con la cifra en USD, y la
  // tarjeta lo pintaba tal cual junto a un total en pesos: la misma tarjeta
  // decia $7.351.373 arriba y 3429 USD debajo. El motor calcula en dolares
  // porque es su moneda interna, asi que la frase la compone quien sabe en
  // que moneda esta mirando el viajero.
  if (diferencia <= 0) return { estado: "dentro", diferencia, culpable: null };

  // El culpable: la categoria que mas pesa del desglose. Decir 'te pasas
  // por X' sin decir de que obliga a adivinar donde recortar.
  const partes = [
    ["el vuelo internacional", ruta.desglose.vueloIntl, "vuelo"],
    ["el alojamiento", ruta.desglose.hospedaje, "alojamiento"],
    ["los traslados entre ciudades", ruta.desglose.saltos, "saltos"],
    ["la comida y el día a día", ruta.desglose.comida + ruta.desglose.extras, "comida"],
  ].sort((a, b) => b[1] - a[1]);

  return {
    estado: diferencia <= margen ? "cerca" : "supera",
    diferencia,
    culpable: partes[0][0],
    culpableCodigo: partes[0][2],
  };
}
/**
 * Compatibilidad 0-100 con lo que el viajero pidio.
 *
 * Cada factor solo puntua si hay dato para calcularlo; los que no aplican no
 * cuentan ni a favor ni en contra, para no premiar a una propuesta por lo que
 * no sabemos de ella.
 */
function compatibilidadDe(ruta, busqueda, presupuestoUsd) {
  const factores = [];
  const razones = [];
  // Cada razon se guarda tambien como {codigo, vars}: la tarjeta la redacta
  // en el idioma del viajero. La frase en español se conserva para quien
  // siga consumiendo `razones` tal cual.
  const razonesCodigos = [];

  // 1. Presupuesto. Es una restriccion, no una preferencia: pesa el doble.
  if (presupuestoUsd) {
    const ratio = ruta.total / presupuestoUsd;
    const v = ratio <= 1 ? 1 : pct(1 - (ratio - 1) * 2.5);
    factores.push([v, 2]);
    if (ratio <= 0.85) { razones.push("deja margen sobre tu presupuesto"); razonesCodigos.push({ codigo: "margen" }); }
  }

  // 2. Dias entregados frente a los pedidos. construirRuta recorta dias
  // cuando el dinero no da, y eso el viajero tiene que notarlo en el orden.
  const faltan = Math.max(0, busqueda.dias - ruta.diasTotales);
  const tolerados = busqueda.diasFlex;
  factores.push([faltan <= tolerados ? 1 : pct(1 - (faltan - tolerados) / busqueda.dias), 1.5]);
  if (faltan === 0) { razones.push(`cubre los ${busqueda.dias} días que pediste`); razonesCodigos.push({ codigo: "dias", vars: { n: busqueda.dias } }); }

  // 3. Cuantas ciudades. Sin preferencia explicita, mas ciudades suma poco:
  // no todo el mundo quiere correr.
  const n = ruta.ciudades.length;
  if (busqueda.ciudadesMin || busqueda.ciudadesMax) {
    const min = busqueda.ciudadesMin || 1;
    const max = busqueda.ciudadesMax || 99;
    factores.push([n >= min && n <= max ? 1 : 0.3, 1]);
  } else {
    factores.push([pct((n - 1) / 4) * 0.6 + 0.4, 0.5]);
  }
  if (n >= 4) { razones.push(`recorre ${n} ciudades sin disparar los traslados`); razonesCodigos.push({ codigo: "ciudades", vars: { n } }); }

  // 4. Intereses. Se comparan con los tags que YA tiene cada ciudad en
  // destinosTags — el mismo diccionario que alimenta el perfil del usuario.
  if (busqueda.intereses.length) {
    const tags = new Set(ruta.ciudades.flatMap((c) => tagsDe(c)));
    const coinciden = busqueda.intereses.filter((i) => tags.has(i));
    factores.push([pct(coinciden.length / busqueda.intereses.length), 1.5]);
    if (coinciden.length) { razones.push(`encaja con tu interés por ${coinciden.join(" y ")}`); razonesCodigos.push({ codigo: "intereses", vars: { intereses: coinciden } }); }
  }

  // 5. Ritmo: kilometros por dia. Muchos km en pocos dias es un viaje
  // cansado, lo pida o no.
  const km = ruta.ciudades.reduce((s, c) => s + (c.km || 0), 0);
  if (ruta.diasTotales > 0) {
    const kmDia = km / ruta.diasTotales;
    const techo = busqueda.ritmo === "tranquilo" ? 80 : 160;
    factores.push([kmDia <= techo ? 1 : pct(1 - (kmDia - techo) / (techo * 3)), 1]);
  }

  const peso = factores.reduce((s, [, w]) => s + w, 0);
  const valor = factores.reduce((s, [v, w]) => s + v * w, 0);
  return {
    puntuacion: peso ? Math.round((valor / peso) * 100) : 50,
    razones: razones.slice(0, 3),
    razonesCodigos: razonesCodigos.slice(0, 3),
  };
}

/** Identidad de una ruta: sus ciudades en orden. Sirve para no repetir. */
function huella(ruta) {
  return ruta.ciudades.map((c) => llaveCiudad(c)).join(">");
}

/**
 * Genera y ordena propuestas.
 *
 * `preciosReales` es el mapa de ofertas detectadas; se le pasa tal cual a
 * construirRuta, que decide si hay precio real para cada entrada.
 */
export function generarPropuestas({ busqueda, presupuestoUsd, preciosReales = {}, limite = 8 }) {
  const regiones =
    busqueda.region === "todas" ? REGIONES_EXPLORABLES : [busqueda.region];

  // CIUDADES DE ENTRADA.
  //
  // Por defecto construirRuta elige la entrada mas barata de la region, que
  // desde Colombia acaba siendo casi siempre Lisboa o Madrid. Si el viajero
  // dijo que paises quiere, se le pasa `inicio` con cada ciudad de esos
  // paises: asi "quiero Reino Unido" devuelve Reino Unido, aunque el vuelo
  // a Portugal sea mas barato.
  const entradas = busqueda.paisesPreferidos.length
    ? DESTINOS_PRESUPUESTO.filter((d) => busqueda.paisesPreferidos.includes(String(d.iso || "").toLowerCase()))
        .sort((a, b) => a.vuelo - b.vuelo)
        .slice(0, 4)
        .map((d) => llaveCiudad(d))
    : [undefined];

  const crudas = [];
  for (const region of regiones) {
    for (const inicio of entradas) {
    for (let semilla = 0; semilla < SEMILLAS; semilla++) {
      const ruta = construirRuta({
        // Sin presupuesto declarado se explora con un techo alto: el viajero
        // que no pone cifra quiere ver que hay, no que no hay nada.
        presupuestoUsd: presupuestoUsd || 99999,
        dias: busqueda.dias,
        personas: busqueda.viajeros,
        region,
        semilla,
        preciosReales,
        origen: busqueda.origen,
        origenes: busqueda.origenes,
        ritmo: busqueda.ritmo,
        inicio,
      });
      if (ruta && ruta.ciudades?.length) crudas.push(ruta);
    }
    }
  }

  const vistas = new Set();
  const propuestas = [];
  for (const ruta of crudas) {
    const h = huella(ruta);
    if (vistas.has(h)) continue;
    // Paises excluidos: se descarta la ruta entera, no se le quita la ciudad,
    // porque quitarla cambiaria el reparto de dias y el coste que ya calculo
    // el motor.
    if (busqueda.paisesExcluidos.length && ruta.ciudades.some((c) => busqueda.paisesExcluidos.includes(String(c.iso || "").toLowerCase()))) continue;
    vistas.add(h);

    const fuentes = fuentesDe(ruta);
    const confianza = confianzaDe(ruta, fuentes);
    const presupuesto = veredictoPresupuesto(ruta, presupuestoUsd);
    const compat = compatibilidadDe(ruta, busqueda, presupuestoUsd);

    propuestas.push({
      id: h,
      region: ruta.region,
      regionNombre: REGIONES[ruta.region] || ruta.region,
      // La ruta tal cual la devolvio el motor: ciudades con dias, saltos,
      // medio de transporte y si el tramo es curado.
      ciudades: ruta.ciudades.map((c) => ({
        ciudad: c.ciudad,
        pais: c.pais,
        iso: c.iso,
        bandera: c.bandera,
        lat: c.lat,
        lon: c.lon,
        dias: c.diasAqui,
        saltoUsd: c.salto || 0,
        km: c.km || 0,
        medio: c.medioTramo || null,
        operador: c.operadorTramo || null,
        duracionH: c.duracionTramoH ?? null,
        tramoCurado: Boolean(c.esTramoCurado),
      })),
      entrada: { ciudad: ruta.entrada.ciudad, pais: ruta.entrada.pais, iso: ruta.entrada.iso },
      diasTotales: ruta.diasTotales,
      diasPedidos: ruta.diasPedidos,
      necesarioParaDiasPedidos: ruta.necesarioParaDiasPedidos,
      desglose: ruta.desglose,
      totalUsd: ruta.total,
      kmTotales: ruta.ciudades.reduce((s, c) => s + (c.km || 0), 0),
      fuentes,
      confianza,
      presupuesto,
      compatibilidad: compat.puntuacion,
      razones: compat.razones,
      razonesCodigos: compat.razonesCodigos,
      vueloReal: ruta.vueloRealEntrada || null,
    });
  }

  return propuestas.sort((a, b) => ordenar(a, b, "compatible")).slice(0, limite);
}

/**
 * Criterios de orden. El unico que no es obvio es "valor": coste por dia y
 * por ciudad, que es lo que de verdad compara dos viajes distintos.
 */
export const ORDENES = {
  compatible: "Más compatible conmigo",
  barato: "Más barato",
  valor: "Mejor relación calidad/precio",
  ciudades: "Más ciudades",
  comodo: "Más cómodo",
  rapido: "Menos desplazamiento",
};

export function ordenar(a, b, criterio) {
  switch (criterio) {
    case "barato":
      return a.totalUsd - b.totalUsd;
    case "ciudades":
      return b.ciudades.length - a.ciudades.length || a.totalUsd - b.totalUsd;
    case "valor": {
      const v = (p) => p.totalUsd / Math.max(1, p.diasTotales) / Math.max(1, p.ciudades.length);
      return v(a) - v(b);
    }
    case "comodo":
      // Menos kilometros por dia = menos horas de traslado.
      return a.kmTotales / Math.max(1, a.diasTotales) - b.kmTotales / Math.max(1, b.diasTotales);
    case "rapido":
      return a.kmTotales - b.kmTotales;
    case "compatible":
    default:
      // A igual compatibilidad manda la CONFIANZA, no el precio: entre dos
      // viajes que encajan igual, gana el que esta mejor sostenido por datos.
      return b.compatibilidad - a.compatibilidad || b.confianza - a.confianza;
  }
}

/**
 * Traduce una propuesta al cuerpo que espera POST /api/rutas, que es el que
 * crea un viaje de verdad.
 *
 * Aqui esta el puente del que depende todo el proceso: sin esto, descubrir un
 * viaje no sirve de nada porque el viajero tendria que teclear las diez
 * paradas a mano.
 *
 * IDA Y VUELTA: la ruta del motor es una cadena de ciudades. Un viaje real
 * empieza y acaba en casa, asi que se abre con el origen, se pasa por las
 * ciudades y se cierra volviendo por la ciudad de entrada —que es donde esta
 * el vuelo internacional— y de ahi a casa. Por eso la ciudad de entrada
 * APARECE DOS VECES, y tiene que seguir apareciendo: es el viaje de
 * referencia (…→ Edimburgo → Londres → Madrid → Medellín) y ninguna de las
 * dos apariciones sobra.
 */
export function propuestaAViaje(propuesta, busqueda, ciudadOrigen) {
  const paradas = [];
  const empuja = (p) => paradas.push(p);

  if (ciudadOrigen) {
    empuja({ ciudad: ciudadOrigen.ciudad, pais: ciudadOrigen.iso, iata: ciudadOrigen.iata, lat: ciudadOrigen.lat ?? null, lon: ciudadOrigen.lon ?? null, noches: 0 });
  }
  for (const c of propuesta.ciudades) {
    empuja({ ciudad: c.ciudad, pais: String(c.iso || "").toLowerCase(), iata: "", lat: c.lat ?? null, lon: c.lon ?? null, noches: c.dias });
  }
  // Regreso: por la ciudad de entrada si la ruta no acaba ya en ella.
  const ultima = propuesta.ciudades[propuesta.ciudades.length - 1];
  const entrada = propuesta.ciudades[0];
  if (entrada && ultima && entrada.ciudad !== ultima.ciudad) {
    empuja({ ciudad: entrada.ciudad, pais: String(entrada.iso || "").toLowerCase(), iata: "", lat: entrada.lat ?? null, lon: entrada.lon ?? null, noches: 0 });
  }
  if (ciudadOrigen) {
    empuja({ ciudad: ciudadOrigen.ciudad, pais: ciudadOrigen.iso, iata: ciudadOrigen.iata, lat: ciudadOrigen.lat ?? null, lon: ciudadOrigen.lon ?? null, noches: 0 });
  }

  return {
    nombre: `Mi viaje a ${propuesta.entrada.pais}`,
    paradas,
    viajeros: busqueda.viajeros,
    mesInicio: busqueda.mes || "",
    fechaIda: busqueda.fechaIda || "",
    moneda: "USD",
    monedaVista: busqueda.moneda || "COP",
    nivel: busqueda.nivel,
    pasaporte: busqueda.pais || "CO",
  };
}
