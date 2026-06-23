// Genera los datos de REQUISITOS DE ENTRADA por país a partir de fuentes
// abiertas y verídicas, como archivos estáticos (sin depender de APIs en vivo):
//
//  1) Visas: dataset Passport Index (ilyankou/passport-index-dataset, abierto).
//     -> web/public/requisitos/visas.json  =  { PASAPORTE: { DESTINO: requisito } }
//  2) Países (nombre en español + bandera): REST Countries.
//     -> web/lib/paisesISO.js  =  { ISO2: { nombre, bandera } }
//
// Uso:  node scripts/generar-requisitos.mjs
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, "..");
const UA = "Anduve/1.0 (https://app-vuelos-mfos.vercel.app)";

const PI_URL =
  "https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy-iso2.csv";

// Bandera emoji a partir del código ISO2 (indicadores regionales).
function bandera(cc) {
  if (!cc || cc.length !== 2) return "🌍";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + (cc.charCodeAt(0) - 65), A + (cc.charCodeAt(1) - 65));
}

async function bajar(url, json = false) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error("HTTP " + r.status + " en " + url);
  return json ? r.json() : r.text();
}

async function main() {
  const dir = join(RAIZ, "public", "requisitos");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  // --- 1) VISAS (Passport Index) ---
  console.log("Bajando dataset de visas…");
  const csv = await bajar(PI_URL);
  const lineas = csv.split(/\r?\n/);
  const visas = {};
  for (let i = 1; i < lineas.length; i++) {
    const fila = lineas[i];
    if (!fila) continue;
    const [pasaporte, destino, requisito] = fila.split(",");
    if (!pasaporte || !destino) continue;
    (visas[pasaporte] ||= {})[destino] = requisito;
  }
  writeFileSync(join(dir, "visas.json"), JSON.stringify(visas));
  console.log(`Visas: ${Object.keys(visas).length} pasaportes -> visas.json`);

  // --- 2) PAÍSES (datos útiles depositados en la web, sin enlaces externos) ---
  console.log("Bajando países (REST Countries)…");
  let paises = {};
  try {
    const data = await bajar(
      "https://restcountries.com/v3.1/all?fields=cca2,translations,name,capital,currencies,languages,timezones,car,idd,latlng",
      true
    );
    for (const c of data) {
      const cc = c.cca2;
      if (!cc) continue;
      const nombre = c.translations?.spa?.common || c.name?.common || cc;
      // Moneda principal
      let moneda = null;
      const mk = Object.keys(c.currencies || {})[0];
      if (mk) {
        const m = c.currencies[mk];
        moneda = { cod: mk, nombre: m?.name || "", sim: m?.symbol || "" };
      }
      // Código telefónico (+57…)
      const tel = (c.idd?.root || "") + (c.idd?.suffixes?.length === 1 ? c.idd.suffixes[0] : "");
      paises[cc] = {
        nombre,
        bandera: bandera(cc),
        capital: c.capital?.[0] || "",
        moneda,
        idiomas: Object.values(c.languages || {}).slice(0, 3),
        husos: c.timezones || [],
        conduccion: c.car?.side || "",
        tel,
        lat: Array.isArray(c.latlng) ? c.latlng[0] : null, // hemisferio/estaciones
      };
    }
  } catch (e) {
    console.log("! REST Countries falló (" + e.message + "); usando solo ISO del dataset.");
  }
  // Asegurar que todo pasaporte/destino del dataset tenga entrada de país.
  const todos = new Set(Object.keys(visas));
  for (const dest of Object.values(visas)) for (const d of Object.keys(dest)) todos.add(d);
  for (const cc of todos) if (!paises[cc]) paises[cc] = { nombre: cc, bandera: bandera(cc) };

  const ordenado = {};
  for (const cc of Object.keys(paises).sort((a, b) => paises[a].nombre.localeCompare(paises[b].nombre)))
    ordenado[cc] = paises[cc];

  const js =
    "// GENERADO por scripts/generar-requisitos.mjs — no editar a mano.\n" +
    "// País por código ISO-2: { nombre (es), bandera }.\n" +
    "export const PAISES_ISO = " + JSON.stringify(ordenado) + ";\n";
  writeFileSync(join(RAIZ, "lib", "paisesISO.js"), js);
  console.log(`Países: ${Object.keys(ordenado).length} -> lib/paisesISO.js`);
}

main();
