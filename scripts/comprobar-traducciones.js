#!/usr/bin/env node
// Componentes que llaman a t("...") sin recibir `t`.
//
// Existe porque un t() dentro de un subcomponente tumbo /mis-viajes en
// produccion:
//
//   2026-09  el boton "Reservar" del desglose de presupuesto usaba
//            t("lineaReservar") dentro del componente Linea, que no recibe
//            `t` — solo lo recibe el componente exportado. En produccion eso
//            es un ReferenceError en el render y la pagina entera cae con
//            "Application error: a client-side exception has occurred".
//
// Lo que duele es que paso todos los filtros. `next build` compila sin una
// queja, porque `t` es un identificador libre y eso no es un error de
// sintaxis. Y comprobar-referencias.js tampoco lo ve, porque solo revisa
// nombres usados en JSX (<Componente>) y `t` no es uno.
//
// Va aparte y no dentro de comprobar-referencias.js a proposito: aquel busca
// una cosa (componentes sin importar) y esta busca otra, y mezclarlas haria
// mas dificil entender que grita cada cual.
//
// NO es un analisis de ambito completo, que seria otro programa. Es el caso
// concreto que se repite en este repositorio: CADA texto de la interfaz pasa
// por t(), asi que olvidarse de pasarlo es el error facil de cometer y caro
// de descubrir.
//
//   node scripts/comprobar-traducciones.js
//
// Sale con codigo 1 si encuentra algo, para encadenarlo antes de un push.

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "web");
const CARPETAS = ["app", "components"];

const RE_FUNCION =
  /(?:^|\n)\s*(?:export\s+default\s+|export\s+)?function\s+([A-Z][\w$]*)\s*\(\s*\{([\s\S]*?)\}\s*(?:=\s*\{\s*\}\s*)?\)/g;

const LLAMA_A_T = /\bt\(\s*["'`]/;

/** ¿La lista de props incluye `t`? Acepta `t`, `t = ...`, `t,` y `...resto`. */
function recibeT(props) {
  if (/\.\.\./.test(props)) return true; // con rest props no se puede afirmar nada
  return /(^|[,{\s])t\s*(?:=|,|$|\})/.test(props.trim());
}

function revisar(archivo) {
  const src = fs.readFileSync(archivo, "utf8");
  const fallos = [];

  for (const m of src.matchAll(RE_FUNCION)) {
    const nombre = m[1];
    if (recibeT(m[2])) continue;

    // Cuerpo: de donde acaba la firma hasta la siguiente funcion de nivel
    // superior. Aproximado, pero suficiente: lo que se busca es una llamada a
    // t() dentro de un componente que no lo tiene.
    const desde = m.index + m[0].length;
    const resto = src.slice(desde);
    const sig = resto.search(/\n(?:export\s+)?(?:default\s+)?function\s/);
    const cuerpo = sig === -1 ? resto : resto.slice(0, sig);
    if (!LLAMA_A_T.test(cuerpo)) continue;

    // El caso normal en este repositorio: `t` sale de useApp() DENTRO del
    // cuerpo. Sin esto el verificador senalaba seis componentes que funcionan
    // perfectamente — NavTop entre ellos —, y uno que grita en falso se deja
    // de usar.
    if (/(?:const|let|var)\s*\{[^}]*\bt\b[^}]*\}\s*=/.test(cuerpo)) continue;
    if (/(?:const|let|var)\s+t\s*=/.test(cuerpo)) continue;

    // Si el archivo declara `t` a nivel de modulo, el componente lo tiene por
    // cierre y no hay fallo.
    const antesDeLaFuncion = src.slice(0, m.index);
    if (/(?:^|\n)(?:const|let|var|function)\s+t\b/.test(antesDeLaFuncion)) continue;

    const lineaFirma = src.slice(0, m.index).split("\n").length;
    const dentro = cuerpo.split("\n").findIndex((l) => LLAMA_A_T.test(l));
    fallos.push({ nombre, linea: lineaFirma + Math.max(0, dentro) });
  }
  return fallos;
}

function listar(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      out.push(...listar(p));
    } else if (/\.jsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

const argumentos = process.argv.slice(2);
const archivos = argumentos.length
  ? argumentos.map((a) => path.resolve(a))
  : CARPETAS.flatMap((c) => listar(path.join(RAIZ, c)));

let total = 0;
for (const f of archivos) {
  const fallos = revisar(f);
  if (!fallos.length) continue;
  total += fallos.length;
  const rel = path.relative(path.join(__dirname, ".."), f);
  for (const { nombre, linea } of fallos) {
    console.log(`${rel}:${linea}  ${nombre}() llama a t("...") pero no recibe \`t\``);
  }
}

if (total) {
  console.log(`\n${total} componente(s) sin \`t\`.`);
  process.exit(1);
}
console.log(`${archivos.length} archivos revisados, 0 componentes sin \`t\`.`);
