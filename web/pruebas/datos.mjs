// Pruebas de CALIDAD DE DATO, no de funcionalidad.
//
// Lo que se fija aqui no es "que la app funcione": es que Anduve no pueda
// afirmar mas de lo que sabe. Cada caso nace de un defecto real encontrado en
// la auditoria del Proceso 11.
import fs from "node:fs";

const ok = [];
const mal = [];
const comprobar = (nombre, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  (bien ? ok : mal).push(`${bien ? "OK " : "MAL"} ${nombre} -> ${JSON.stringify(real)}${bien ? "" : "  (esperaba " + JSON.stringify(esperado) + ")"}`);
};

const { compararTransporte } = await import("../lib/comparadorTransporte.js");
const { evaluarTramo } = await import("../lib/rutaViva.js");

// --------------------------------------------------------------- PROCEDENCIA
//
// El contrato del que depende el ensamblado del tramo en /api/viaje-canonico:
// una alternativa ESTIMADA no sabe quien la opera y por eso deja el operador
// vacio. Si alguien rellenara ese hueco "para que quede bonito", el tramo
// volveria a poder decir "Vuelo · LNER".
const EDI = { ciudad: "Edimburgo", pais: "Reino Unido", paisNombre: "Reino Unido", lat: 55.9533, lon: -3.1883 };
const LON = { ciudad: "Londres", pais: "Reino Unido", paisNombre: "Reino Unido", lat: 51.5074, lon: -0.1278 };
const comp = compararTransporte(EDI, LON, { nivel: "medio", prioridad: "equilibrado" });

comprobar("Edimburgo→Londres ofrece varias opciones", comp.alternativas.length >= 2, true);
comprobar(
  "ninguna opcion ESTIMADA se atribuye un operador",
  comp.alternativas.filter((a) => a.fuente === "estimado" && a.operador).map((a) => `${a.medio}:${a.operador}`),
  []
);
comprobar(
  "la opcion CURADA si lo lleva",
  comp.alternativas.filter((a) => a.fuente === "curado").every((a) => Boolean(a.operador)),
  true
);

// El defecto tal cual era: `recomendada.operador || t.operador`. Se reproduce
// el ensamblado viejo y el nuevo sobre los datos reales de este tramo.
const principal = evaluarTramo({ desde: EDI, hasta: LON });
const recomendada = comp.alternativas.find((a) => a.recomendado);
const viejo = { medio: recomendada.medio, operador: recomendada.operador || principal.operador };
const nuevo = { medio: recomendada.medio, operador: recomendada.operador || "" };
const mismoMedio = recomendada.medio === principal.medio;
comprobar(
  "el ensamblado VIEJO mezclaba medio y operador (por eso se cambio)",
  !mismoMedio && viejo.operador === principal.operador && Boolean(principal.operador),
  true
);
comprobar("el ensamblado NUEVO no inventa operador", nuevo.operador, "");

// Un tramo sin coordenadas no puede inventarse un precio.
const sinCoords = evaluarTramo({ desde: { ciudad: "X", pais: "Reino Unido" }, hasta: { ciudad: "Y", pais: "Reino Unido" } });
comprobar("sin coordenadas -> sin-datos", sinCoords.fuente, "sin-datos");
comprobar("sin coordenadas -> precio null, no 0", sinCoords.precio, null);

// ------------------------------------------------- FECHA DEL DATO MIGRATORIO
//
// 199 pasaportes de reglas de visa viajaban sin decir de cuando son.
const visas = JSON.parse(fs.readFileSync(new URL("../public/requisitos/visas.json", import.meta.url), "utf8"));
comprobar("visas.json declara su fecha", Boolean(visas._meta?.verificado), true);
comprobar("declara desde cuando no cambian las reglas", Boolean(visas._meta?.cambiado), true);
comprobar("declara su fuente", Boolean(visas._meta?.fuente), true);
comprobar("_meta no se cuela como pasaporte", Object.keys(visas).filter((k) => k.length !== 2), ["_meta"]);
comprobar("los pasaportes siguen accesibles", visas.CO?.ES, "90");
comprobar("cuenta de pasaportes coherente", Object.keys(visas).length - 1, visas._meta.pasaportes);

// ---------------------------------------------- LA FRESCURA QUE SE PROMETE
//
// El detector corre ~5,7 veces al dia (mediana 4,2 h, maximo medido 7,5 h),
// no cada hora. Prometer "cada hora" en la portada era falso.
const idiomas = fs.readFileSync(new URL("../lib/idiomas.js", import.meta.url), "utf8");
for (const [etiqueta, aguja] of [["es", "cada hora"], ["en", "every hour"], ["pt", "a cada hora"], ["fr", "toutes les heures"]]) {
  comprobar(`ningun texto promete escaneo horario (${etiqueta})`, idiomas.includes(aguja), false);
}

console.log([...ok, ...mal].join("\n"));
console.log(`\n${ok.length} correctas, ${mal.length} fallidas`);
process.exit(mal.length ? 1 : 0);
