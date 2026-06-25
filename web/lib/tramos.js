// Tabla curada de TRAMOS de transporte entre ciudades de la ruta.
// El detector y Travelpayouts cubren vuelos intl pero NO trenes/buses, que en
// Europa son frecuentemente la opción más barata y cómoda. Esta tabla codifica
// rangos reales para los tramos más comunes (curados manualmente con datos
// públicos de Renfe, SNCF, Trenitalia, FlixBus, Eurostar, etc).
//
// Precios en USD POR PERSONA, ida sencilla, comprando con 2+ semanas de
// anticipación. Cerca de la fecha pueden subir bastante. La UI marca esto
// con un disclaimer honesto: "estimado · varía con anticipación".
//
// Para tramos NO curados, costoTramoReal() cae a un estimado geométrico por
// distancia (la heurística vieja), marcando esCurado=false.

// Llave bidireccional para que "Madrid|España→Barcelona|España" y
// "Barcelona|España→Madrid|España" devuelvan lo mismo.
function llaveBi(a, b) {
  const ka = `${a.ciudad}|${a.pais}`;
  const kb = `${b.ciudad}|${b.pais}`;
  return ka < kb ? `${ka}→${kb}` : `${kb}→${ka}`;
}

// medio: tren | bus | vuelo | ferry
// duracion_h: tiempo total puerta a puerta aproximado
// precio_usd: rango realista por persona con 2 sem de anticipación (mediana)
// operador: nombre de marca cuando ayuda (AVE, TGV, Eurostar...)
const TRAMOS = {
  // ----------------- España -----------------
  "Madrid|España→Barcelona|España": { medio: "tren", operador: "AVE", precio_usd: 65, duracion_h: 2.5 },
  "Madrid|España→Sevilla|España": { medio: "tren", operador: "AVE", precio_usd: 55, duracion_h: 2.5 },
  "Madrid|España→Valencia|España": { medio: "tren", operador: "AVE", precio_usd: 45, duracion_h: 1.8 },
  "Barcelona|España→Valencia|España": { medio: "tren", operador: "Euromed", precio_usd: 40, duracion_h: 3 },
  "Madrid|España→Lisboa|Portugal": { medio: "bus", operador: "ALSA", precio_usd: 35, duracion_h: 9 },
  "Lisboa|Portugal→Oporto|Portugal": { medio: "tren", operador: "Alfa Pendular", precio_usd: 30, duracion_h: 2.8 },
  "Madrid|España→Oporto|Portugal": { medio: "bus", operador: "ALSA", precio_usd: 45, duracion_h: 8 },
  "Barcelona|España→Madrid|España": null, // generada por llaveBi

  // ----------------- Francia / UK -----------------
  "París|Francia→Londres|Reino Unido": { medio: "tren", operador: "Eurostar", precio_usd: 140, duracion_h: 2.4 },
  "París|Francia→Bruselas|Bélgica": { medio: "tren", operador: "Thalys", precio_usd: 70, duracion_h: 1.6 },
  "París|Francia→Ámsterdam|Países Bajos": { medio: "tren", operador: "Thalys", precio_usd: 110, duracion_h: 3.4 },
  "París|Francia→Niza|Francia": { medio: "tren", operador: "TGV", precio_usd: 75, duracion_h: 6 },
  "París|Francia→Lyon|Francia": { medio: "tren", operador: "TGV", precio_usd: 60, duracion_h: 2 },
  "París|Francia→Berlín|Alemania": { medio: "tren", operador: "ICE", precio_usd: 130, duracion_h: 8.5 },
  "París|Francia→Milán|Italia": { medio: "tren", operador: "TGV/Frecciarossa", precio_usd: 90, duracion_h: 7 },
  "Niza|Francia→Milán|Italia": { medio: "tren", operador: "Intercity", precio_usd: 40, duracion_h: 5 },

  // ----------------- Italia -----------------
  "Roma|Italia→Florencia|Italia": { medio: "tren", operador: "Frecciarossa", precio_usd: 50, duracion_h: 1.5 },
  "Roma|Italia→Milán|Italia": { medio: "tren", operador: "Frecciarossa", precio_usd: 70, duracion_h: 3.2 },
  "Roma|Italia→Venecia|Italia": { medio: "tren", operador: "Frecciarossa", precio_usd: 80, duracion_h: 4 },
  "Roma|Italia→Nápoles|Italia": { medio: "tren", operador: "Frecciarossa", precio_usd: 40, duracion_h: 1.2 },
  "Milán|Italia→Venecia|Italia": { medio: "tren", operador: "Frecciarossa", precio_usd: 40, duracion_h: 2.5 },
  "Florencia|Italia→Venecia|Italia": { medio: "tren", operador: "Frecciarossa", precio_usd: 50, duracion_h: 2.1 },
  "Florencia|Italia→Milán|Italia": { medio: "tren", operador: "Frecciarossa", precio_usd: 50, duracion_h: 1.8 },
  "Florencia|Italia→Roma|Italia": null,

  // ----------------- Centro Europa -----------------
  "Berlín|Alemania→Múnich|Alemania": { medio: "tren", operador: "ICE", precio_usd: 85, duracion_h: 4 },
  "Berlín|Alemania→Praga|Chequia": { medio: "tren", operador: "EC", precio_usd: 50, duracion_h: 4.5 },
  "Berlín|Alemania→Ámsterdam|Países Bajos": { medio: "tren", operador: "ICE/IC", precio_usd: 95, duracion_h: 6.5 },
  "Berlín|Alemania→Varsovia|Polonia": { medio: "tren", operador: "EIC", precio_usd: 55, duracion_h: 6.5 },
  "Múnich|Alemania→Praga|Chequia": { medio: "bus", operador: "FlixBus", precio_usd: 25, duracion_h: 4.5 },
  "Múnich|Alemania→Viena|Austria": { medio: "tren", operador: "Railjet", precio_usd: 60, duracion_h: 4 },
  "Praga|Chequia→Viena|Austria": { medio: "tren", operador: "Railjet", precio_usd: 35, duracion_h: 4 },
  "Praga|Chequia→Budapest|Hungría": { medio: "tren", operador: "EC", precio_usd: 40, duracion_h: 7 },
  "Viena|Austria→Budapest|Hungría": { medio: "tren", operador: "Railjet", precio_usd: 30, duracion_h: 2.5 },
  "Viena|Austria→Praga|Chequia": null,
  "Budapest|Hungría→Praga|Chequia": null,

  // ----------------- Norte de Europa -----------------
  "Ámsterdam|Países Bajos→Bruselas|Bélgica": { medio: "tren", operador: "IC", precio_usd: 35, duracion_h: 2 },
  "Bruselas|Bélgica→París|Francia": null,
  "Copenhague|Dinamarca→Estocolmo|Suecia": { medio: "tren", operador: "SJ", precio_usd: 80, duracion_h: 5 },

  // ----------------- UK -----------------
  "Londres|Reino Unido→Edimburgo|Reino Unido": { medio: "tren", operador: "LNER", precio_usd: 90, duracion_h: 4.4 },

  // ----------------- Mediterráneo / Grecia / Turquía -----------------
  "Atenas|Grecia→Estambul|Turquía": { medio: "vuelo", operador: "low-cost", precio_usd: 90, duracion_h: 1.7 },

  // ----------------- Sudamérica -----------------
  "Lima|Perú→Cusco|Perú": { medio: "vuelo", operador: "LATAM/Sky", precio_usd: 90, duracion_h: 1.4 },
  "Lima|Perú→Arequipa|Perú": { medio: "vuelo", operador: "LATAM/Sky", precio_usd: 75, duracion_h: 1.5 },
  "Cusco|Perú→Arequipa|Perú": { medio: "bus", operador: "Cruz del Sur", precio_usd: 25, duracion_h: 10 },
  "Buenos Aires|Argentina→Mendoza|Argentina": { medio: "vuelo", operador: "Aerolíneas", precio_usd: 100, duracion_h: 1.7 },
  "Santiago|Chile→Buenos Aires|Argentina": { medio: "vuelo", operador: "LATAM", precio_usd: 130, duracion_h: 2.2 },
  "Santiago|Chile→Mendoza|Argentina": { medio: "bus", operador: "varios", precio_usd: 45, duracion_h: 7 },
  "São Paulo|Brasil→Río de Janeiro|Brasil": { medio: "bus", operador: "Cometa", precio_usd: 40, duracion_h: 6 },
  "Buenos Aires|Argentina→Montevideo|Uruguay": { medio: "ferry", operador: "Buquebús", precio_usd: 100, duracion_h: 2.5 },

  // ----------------- Asia (rutas frecuentes) -----------------
  "Tokio|Japón→Kioto|Japón": { medio: "tren", operador: "Shinkansen", precio_usd: 95, duracion_h: 2.3 },
  "Tokio|Japón→Osaka|Japón": { medio: "tren", operador: "Shinkansen", precio_usd: 100, duracion_h: 2.5 },
  "Osaka|Japón→Kioto|Japón": { medio: "tren", operador: "JR", precio_usd: 6, duracion_h: 0.5 },
  "Bangkok|Tailandia→Phuket|Tailandia": { medio: "vuelo", operador: "AirAsia/Lion", precio_usd: 50, duracion_h: 1.4 },
  "Pekín|China→Shanghái|China": { medio: "tren", operador: "Fuxing", precio_usd: 90, duracion_h: 4.5 },
  "Dubái|Emiratos Árabes→Abu Dabi|Emiratos Árabes": { medio: "bus", operador: "RTA", precio_usd: 10, duracion_h: 1.8 },
};

// Genera los espejos inversos (Barcelona→Madrid = Madrid→Barcelona) UNA vez al
// cargar el módulo. Los `null` en el objeto fuente son placeholders para que
// quede claro qué tramos están cubiertos en ambas direcciones.
const TRAMOS_NORMALIZADOS = (() => {
  const out = {};
  for (const [k, v] of Object.entries(TRAMOS)) {
    if (!v) continue;
    const [izq, der] = k.split("→");
    out[`${izq}→${der}`] = v;
    out[`${der}→${izq}`] = v; // inverso
  }
  return out;
})();

// Devuelve el costo + medio + duración real para un tramo entre dos ciudades,
// o un fallback geométrico por km si no tenemos curado el tramo. SIEMPRE
// retorna un objeto (nunca null) para que construirRuta lo use sin checks.
// El campo `esCurado` permite a la UI mostrar el chip "estimado · varía con
// anticipación" cuando no es real, o "AVE · 2h 30" cuando sí lo es.
export function costoTramoReal(a, b, km) {
  const llave = `${a.ciudad}|${a.pais}→${b.ciudad}|${b.pais}`;
  const curado = TRAMOS_NORMALIZADOS[llave];
  if (curado) {
    return {
      precio: curado.precio_usd,
      medio: curado.medio,
      operador: curado.operador,
      duracion_h: curado.duracion_h,
      esCurado: true,
    };
  }
  // Fallback geométrico (la heurística vieja). Sirve para tramos no comunes
  // donde NO tenemos cifra de mercado. Mostrar la etiqueta "aprox" en la UI.
  let precio, medio, dur;
  if (km < 300)       { precio = 30;  medio = "bus";   dur = km / 60; }
  else if (km < 700)  { precio = 60;  medio = "tren";  dur = km / 100; }
  else if (km < 1500) { precio = 110; medio = "vuelo"; dur = 2 + km / 800; }
  else if (km < 3000) { precio = 180; medio = "vuelo"; dur = 3 + km / 800; }
  else                { precio = 300; medio = "vuelo"; dur = 4 + km / 800; }
  return {
    precio,
    medio,
    operador: null,
    duracion_h: Math.round(dur * 10) / 10,
    esCurado: false,
  };
}

// Formato de duración para la UI: "2h 30 min" / "45 min" / "9 h"
export function fmtDuracion(h) {
  if (!h || h <= 0) return "";
  if (h < 1) return `${Math.round(h * 60)} min`;
  const horas = Math.floor(h);
  const min = Math.round((h - horas) * 60);
  if (min === 0) return `${horas} h`;
  return `${horas} h ${min} min`;
}
