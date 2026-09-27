// Resolvedor solo para las pruebas: Node ESM exige extension y el proyecto,
// que compila con webpack, importa sin ella ("./kv"). Esto la añade al vuelo
// para poder ejecutar los modulos REALES sin tocarlos.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

registerHooks({
  resolve(especificador, contexto, siguiente) {
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
