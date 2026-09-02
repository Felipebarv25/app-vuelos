#!/usr/bin/env node
// Busca componentes JSX usados en un archivo que NO están definidos ni
// importados en él. Es el error que dos veces ya llegó a producción:
//
//   2026-08  reemplacé un bloque por posición de comentario y borré
//            nombrePais(); /ofertas reventó con "nombrePais is not defined".
//   2026-09  un script de inserción se saltó el import de NavTop en
//            /en/destino y metió el <NavTop /> igual; el build de Vercel
//            falló en el prerender y producción se quedó 40 min atrás.
//
// Ninguno de los dos lo pilla el compilador de SWC: son errores de
// RESOLUCIÓN, no de sintaxis, y solo aparecen al ejecutar o al prerenderizar.
//
//   node scripts/comprobar-referencias.js            # todo web/app y web/components
//   node scripts/comprobar-referencias.js archivo.js # uno suelto
//
// Sale con código 1 si encuentra algo, para poder encadenarlo antes de un push.

const fs = require("fs");
const path = require("path");

const RAIZ = path.join(__dirname, "..", "web");
const CARPETAS = ["app", "components", "lib"];

// Nombres que existen sin declararse en el archivo: globales del navegador y
// de React que se escriben en mayúscula y aparecen en JSX.
const GLOBALES = new Set([
  "Fragment", "Suspense", "StrictMode", "Image", "Link", "Script", "Head",
  "Math", "Object", "Array", "String", "Number", "Boolean", "Date", "JSON",
  "Promise", "Map", "Set", "WeakMap", "WeakSet", "Error", "RegExp", "Intl",
]);

// Quita comentarios conservando el numero de linea, para que el informe siga
// apuntando al sitio correcto. Sin esto el verificador senala cosas como
// "usar <AnduveIcon> directo" (una nota del autor) o "alertas:iata:<IATA>"
// (un modelo de datos en la cabecera de un fichero) y deja de ser creible.
function sinComentarios(src) {
  // Los bloques /* */ se sustituyen por espacios, no se borran: así los
  // saltos de línea se conservan y el número de línea del informe sigue
  // siendo el del archivo real.
  const bloques = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
  return bloques
    .split("\n")
    .map((l) => {
      const i = l.indexOf("//");
      if (i < 0) return l;
      // No cortar en "https://": ahí las barras son parte del protocolo.
      if (i > 0 && l[i - 1] === ":") return l;
      return l.slice(0, i);
    })
    .join("\n");
}

/** Nombres que el archivo tiene a mano: importados o declarados. */
function nombresConocidos(src) {
  const set = new Set(GLOBALES);
  const add = (s) => { if (s) set.add(s.trim()); };

  // import X, {A as B, C} from "..."   ·   import * as NS from "..."
  for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+["'][^"']+["']/g)) {
    const cláusula = m[1];
    // parte por defecto y namespace
    for (const d of cláusula.split("{")[0].split(",")) {
      const limpio = d.replace(/\*\s*as\s*/, "").trim();
      if (/^[A-Za-z_$][\w$]*$/.test(limpio)) add(limpio);
    }
    // parte con llaves
    const llaves = cláusula.match(/\{([^}]*)\}/);
    if (llaves) {
      for (const d of llaves[1].split(",")) {
        const alias = d.includes(" as ") ? d.split(" as ")[1] : d;
        add(alias.replace(/[^\w$]/g, ""));
      }
    }
  }

  // Declaraciones. Se ignora el ámbito a propósito: sobreestimar lo que
  // existe solo puede producir falsos NEGATIVOS, nunca falsos positivos, y
  // un verificador que grita en falso deja de usarse.
  for (const re of [
    /(?:^|\s)(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g,
    /class\s+([A-Za-z_$][\w$]*)/g,
    /(?:const|let|var)\s*\{([^}]*)\}\s*=/g,   // destructuring de objeto
    /(?:const|let|var)\s*\[([^\]]*)\]\s*=/g,  // destructuring de array
  ]) {
    for (const m of src.matchAll(re)) {
      for (const parte of m[1].split(",")) {
        const alias = parte.includes(":") ? parte.split(":").pop() : parte;
        add(alias.replace(/[^\w$]/g, ""));
      }
    }
  }
  return set;
}

/** Componentes JSX usados: <Algo ...>. Solo los que empiezan en mayúscula. */
function usadosEnJsx(src) {
  const usos = new Map(); // nombre -> primera línea
  const líneas = src.split("\n");
  for (let i = 0; i < líneas.length; i++) {
    for (const m of líneas[i].matchAll(/<([A-Z][\w$]*)(?:\.[\w$]+)*[\s/>]/g)) {
      if (!usos.has(m[1])) usos.set(m[1], i + 1);
    }
  }
  return usos;
}

function revisar(archivo) {
  const src = sinComentarios(fs.readFileSync(archivo, "utf8"));
  const conocidos = nombresConocidos(src);
  const fallos = [];
  for (const [nombre, línea] of usadosEnJsx(src)) {
    if (!conocidos.has(nombre)) fallos.push({ nombre, línea });
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
  for (const { nombre, línea } of fallos) {
    console.log(`${rel}:${línea}  <${nombre}> usado pero no importado ni definido`);
  }
}

if (total) {
  console.log(`\n${total} referencia(s) sin resolver.`);
  process.exit(1);
}
console.log(`${archivos.length} archivos revisados, 0 referencias sin resolver.`);
