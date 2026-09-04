// Destinos a los que NO se vuela: hay que aterrizar en otra ciudad y seguir
// por tierra.
//
// El catalogo de presupuesto le pone `vuelo` a los 207 destinos por igual, asi
// que Guatape mostraba "Vuelo i/v US$ 120" como si tuviera aeropuerto. No lo
// tiene: se vuela a Medellin y se sigue dos horas en carro. El precio no esta
// mal —es lo que cuesta llegar— pero la etiqueta si, y el usuario no puede
// saber que le falta un traslado.
//
// ES UNA LISTA CURADA, NO EXHAUSTIVA, y no se puede derivar del repositorio:
//
//   - aeropuertos.json no trae coordenadas, asi que no hay forma de medir "el
//     aeropuerto mas cercano".
//   - Cruzar por nombre falla con los exonimos: el catalogo dice "London" y
//     "Tokyo" donde nosotros decimos "Londres" y "Tokio", asi que el cruce
//     marcaba como "sin aeropuerto" a Londres, Tokio y Sidney.
//   - IATA_CIUDAD solo cubre 81 de los 207: es la tabla para pedir precios en
//     vivo, no un censo de aeropuertos. Bogota tampoco esta.
//
// Cada entrada se comprobo contra aeropuertos.json: la ciudad NO aparece y la
// puerta de entrada SI, con el IATA que se anota. Que un destino no este aqui
// NO afirma que tenga aeropuerto; afirma que no lo hemos verificado.
//
// Popayan estaba en el reporte del usuario y se comprobo que SI tiene
// aeropuerto (PPN, Guillermo Leon Valencia), asi que no entra.
export const SIN_AEROPUERTO = {
  // Colombia
  "Guatapé|Colombia": { via: "Medellín", iata: "MDE", horas: 2 },
  "Villa de Leyva|Colombia": { via: "Bogotá", iata: "BOG", horas: 3 },
  "Salento|Colombia": { via: "Pereira", iata: "PEI", horas: 1 },
  "Barichara|Colombia": { via: "Bucaramanga", iata: "BGA", horas: 2.5 },
  // Resto de Latinoamerica
  "San Pedro de Atacama|Chile": { via: "Calama", iata: "CJC", horas: 1.5 },
  "Paracas|Perú": { via: "Pisco", iata: "PIO", horas: 0.5 },
};

/** @returns {{via:string, iata:string, horas:number}|null} */
export function sinAeropuerto(ciudad, pais) {
  return SIN_AEROPUERTO[`${ciudad}|${pais}`] || null;
}
