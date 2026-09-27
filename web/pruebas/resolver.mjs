// Resolvedor solo para las pruebas: Node ESM exige extension y el proyecto,
// que compila con webpack, importa sin ella ("./kv"). Esto la añade al vuelo
// para poder ejecutar los modulos REALES sin tocarlos.
//
// Tambien traduce el alias "@/..." que usa el proyecto (jsconfig.json lo mapea
// a la raiz de web/). Sin esto no se pueden probar los modulos que se importan
// entre si por alias —comparadorTransporte, rutaViva, presupuesto—, que son
// justo los que calculan precios y procedencias.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url))); // .../web

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith("@/")) {
      const base = join(RAIZ, especificador.slice(2));
      for (const ruta of [base, base + ".js", join(base, "index.js")]) {
        if (existsSync(ruta)) return { url: pathToFileURL(ruta).href, shortCircuit: true };
      }
    }
    try {
      return siguiente(especificador, contexto);
    } catch (e) {
      if (!especificador.startsWith(".")) throw e;
      const conJs = especificador + ".js";
      const r = siguiente(conJs, contexto);
      if (existsSync(fileURLToPath(r.url))) return r;
      throw e;
    }
  },
});
