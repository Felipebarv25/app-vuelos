// Actualiza web/data/salud-paises.json consultando fuentes oficiales:
//   - Wikipedia "Health in <country>" (REST API, plain extract)
//   - CDC Travel Health Notices (página por destino, parseo simple)
//   - WHO ITH (no tiene API pública estructurada, sirve solo como
//     fuente de referencia que citamos en cada entrada)
//
// Estrategia:
// 1) Carga el JSON actual (lo respeta como BASELINE curado).
// 2) Para cada país, consulta Wikipedia REST y CDC en paralelo.
// 3) Si la fuente externa devuelve algo más reciente o complementario,
//    lo guarda como `enriquecido_desde_fuentes` (sin sobreescribir
//    los campos curados). Esto evita que un cambio temporal en
//    Wikipedia rompa una entrada estable.
// 4) Actualiza `actualizado: YYYY-MM-DD`.
//
// Uso:
//   node scripts/actualizar-salud.mjs            # actualiza TODOS los países
//   node scripts/actualizar-salud.mjs --pais ES  # actualiza solo uno
//   node scripts/actualizar-salud.mjs --dry-run  # imprime sin escribir

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "..");
const JSON_PATH = path.join(RAIZ, "web", "data", "salud-paises.json");

// User-Agent identificable: APIs públicas (Wikipedia, etc.) rechazan
// peticiones sin UA desde IPs datacenter. Aprendido en sesión 10.
const UA = "Anduve-HealthBot/1.0 (https://anduve-app.vercel.app)";

const args = process.argv.slice(2);
const FILTRO_PAIS = (() => {
  const i = args.indexOf("--pais");
  return i >= 0 ? args[i + 1]?.toUpperCase() : null;
})();
const DRY_RUN = args.includes("--dry-run");

// Mapa ISO2 -> nombre del artículo Wikipedia "Health in <X>".
// Algunas variantes no usan el nombre del país exactamente.
const WIKI_ARTICULO = {
  AR: "Health_in_Argentina",
  AU: "Health_in_Australia",
  AT: "Health_in_Austria",
  BE: "Health_in_Belgium",
  BO: "Health_in_Bolivia",
  BR: "Health_in_Brazil",
  CA: "Health_in_Canada",
  CL: "Health_in_Chile",
  CN: "Health_in_China",
  KR: "Healthcare_in_South_Korea",
  CR: "Health_in_Costa_Rica",
  CU: "Health_in_Cuba",
  DK: "Health_in_Denmark",
  EC: "Health_in_Ecuador",
  EG: "Health_in_Egypt",
  AE: "Health_in_the_United_Arab_Emirates",
  ES: "Health_in_Spain",
  US: "Health_in_the_United_States",
  FR: "Health_in_France",
  GR: "Health_in_Greece",
  GT: "Health_in_Guatemala",
  HU: "Health_in_Hungary",
  IN: "Health_in_India",
  ID: "Health_in_Indonesia",
  IE: "Health_in_the_Republic_of_Ireland",
  IT: "Health_in_Italy",
  JP: "Health_in_Japan",
  MA: "Health_in_Morocco",
  MX: "Health_in_Mexico",
  NL: "Health_in_the_Netherlands",
  NZ: "Health_in_New_Zealand",
  PA: "Health_in_Panama",
  PY: "Health_in_Paraguay",
  PE: "Health_in_Peru",
  PL: "Health_in_Poland",
  PT: "Health_in_Portugal",
  GB: "Health_in_the_United_Kingdom",
  SG: "Health_in_Singapore",
  ZA: "Health_in_South_Africa",
  SE: "Health_in_Sweden",
  CH: "Health_in_Switzerland",
  TH: "Health_in_Thailand",
  CZ: "Health_in_the_Czech_Republic",
  TR: "Health_in_Turkey",
  UY: "Health_in_Uruguay",
  DE: "Health_in_Germany",
};

// CDC Travel Health destination slugs.
const CDC_SLUG = {
  AR: "argentina", AU: "australia", AT: "austria", BE: "belgium",
  BO: "bolivia", BR: "brazil", CA: "canada", CL: "chile", CN: "china",
  KR: "south-korea", CR: "costa-rica", CU: "cuba", DK: "denmark",
  EC: "ecuador", EG: "egypt", AE: "united-arab-emirates", ES: "spain",
  US: "united-states-america", FR: "france", GR: "greece",
  GT: "guatemala", HU: "hungary", IN: "india", ID: "indonesia",
  IE: "ireland", IT: "italy", JP: "japan", MA: "morocco", MX: "mexico",
  NL: "netherlands", NZ: "new-zealand", PA: "panama", PY: "paraguay",
  PE: "peru", PL: "poland", PT: "portugal", GB: "united-kingdom",
  SG: "singapore", ZA: "south-africa", SE: "sweden", CH: "switzerland",
  TH: "thailand", CZ: "czech-republic", TR: "turkey", UY: "uruguay",
  DE: "germany",
};

async function consultarWikipedia(iso) {
  const articulo = WIKI_ARTICULO[iso];
  if (!articulo) return null;
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${articulo}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
    if (!r.ok) return null;
    const data = await r.json();
    return {
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${articulo}`,
      extracto: (data.extract || "").slice(0, 600),
      consultado: new Date().toISOString().slice(0, 10),
    };
  } catch (e) {
    return null;
  }
}

async function consultarCDC(iso) {
  const slug = CDC_SLUG[iso];
  if (!slug) return null;
  // CDC no expone JSON, pero la página tiene un meta description útil.
  const url = `https://wwwnc.cdc.gov/travel/destinations/traveler/none/${slug}`;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA } });
    if (!r.ok) return { url, alertas: [], consultado: new Date().toISOString().slice(0, 10) };
    const html = await r.text();
    // Buscamos los travel health notices recientes en el HTML.
    // Pattern simple: <h3 class="card-title">Title</h3> dentro de .travel-health-notices.
    const alertasRe = /<h3[^>]*class="[^"]*card-title[^"]*"[^>]*>([^<]+)<\/h3>/gi;
    const alertas = [];
    let m;
    while ((m = alertasRe.exec(html)) !== null && alertas.length < 5) {
      const t = m[1].trim();
      if (t.length > 3 && t.length < 200) alertas.push(t);
    }
    return { url, alertas, consultado: new Date().toISOString().slice(0, 10) };
  } catch (e) {
    return null;
  }
}

async function main() {
  console.log(`Cargando dataset actual desde ${path.relative(RAIZ, JSON_PATH)}…`);
  const raw = await fs.readFile(JSON_PATH, "utf8");
  const data = JSON.parse(raw);

  const isos = Object.keys(data).filter((k) => k !== "_meta");
  const objetivo = FILTRO_PAIS ? [FILTRO_PAIS] : isos;
  if (FILTRO_PAIS && !data[FILTRO_PAIS]) {
    console.error(`  ✗ País ${FILTRO_PAIS} no existe en el dataset. Abortando.`);
    process.exit(1);
  }

  console.log(`Actualizando ${objetivo.length} país(es)…`);
  const hoy = new Date().toISOString().slice(0, 10);
  let actualizados = 0;
  let errores = 0;

  for (const iso of objetivo) {
    const nombre = data[iso].pais || iso;
    process.stdout.write(`  · ${iso} (${nombre})… `);
    try {
      // Llamadas en paralelo: Wikipedia + CDC.
      const [wiki, cdc] = await Promise.all([consultarWikipedia(iso), consultarCDC(iso)]);
      const enriquecido = {};
      if (wiki) enriquecido.wikipedia = wiki;
      if (cdc) enriquecido.cdc = cdc;
      if (Object.keys(enriquecido).length > 0) {
        data[iso].enriquecido_desde_fuentes = enriquecido;
        data[iso].actualizado = hoy;
        actualizados++;
        process.stdout.write(`✓ wiki=${wiki ? "OK" : "—"} cdc=${cdc ? `${cdc.alertas?.length || 0} alertas` : "—"}\n`);
      } else {
        process.stdout.write("sin datos externos\n");
      }
    } catch (e) {
      errores++;
      process.stdout.write(`✗ ${e.message}\n`);
    }
    // Throttle suave (10/s máx) para ser amables con las APIs.
    await new Promise((r) => setTimeout(r, 100));
  }

  // Actualizar metadata.
  data._meta = data._meta || {};
  data._meta.version = (data._meta.version || 0) + 1;
  data._meta.actualizado = hoy;
  data._meta.ultima_corrida = {
    fecha: new Date().toISOString(),
    paises_actualizados: actualizados,
    errores,
  };

  console.log(`\n→ ${actualizados}/${objetivo.length} actualizados, ${errores} errores.`);

  if (DRY_RUN) {
    console.log("(dry-run: no se escribe el archivo)");
    return;
  }

  await fs.writeFile(JSON_PATH, JSON.stringify(data, null, 2), "utf8");
  console.log(`✓ Escrito ${path.relative(RAIZ, JSON_PATH)}`);
}

main().catch((e) => {
  console.error("Error fatal:", e);
  process.exit(1);
});
