// Genera los PNGs del PWA + apple-touch-icon a partir de los SVGs del logo
// v5 (web/public/anduve-icon.svg / -white.svg).
//
// Uso (una sola vez tras cambios al logo):
//   1) Instala el render de SVG → PNG (no se persiste como dep del proyecto):
//      npm install --no-save sharp
//   2) Corre el script:
//      node scripts/generar-iconos.mjs
//   3) Verifica los archivos en web/public/ y commitea.
//
// Genera:
//   icono-192.png        192×192   (PWA estándar Android)
//   icono-512.png        512×512   (PWA estándar Android)
//   icono-maskable.png   512×512   con ~10% safe-zone (PWA Android Q+)
//   apple-touch-icon.png 180×180   (iOS)
//
// Si querés un tinte diferente al teal corporativo en el fondo de los
// íconos, edita BG_TEAL más abajo.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

let sharp;
try {
  sharp = (await import("sharp")).default;
} catch (e) {
  console.error("\n❌ Falta el paquete 'sharp'.\n");
  console.error("   Instálalo (no se guarda en package.json):");
  console.error("     npm install --no-save sharp\n");
  console.error("   Luego corre de nuevo:");
  console.error("     node scripts/generar-iconos.mjs\n");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(__dirname, "..");
const PUBLIC = path.join(RAIZ, "web", "public");

// El SVG teal del logo (versión para fondos claros). Lo renderizamos sobre
// un fondo teal para el ícono de la app — así no se ve transparente en
// fondos blancos del launcher.
// SVG redondo del rebrand Anduve (mismo que sirve como favicon).
const SVG_REDONDO = path.join(PUBLIC, "icono.svg");
const SVG_TEAL = SVG_REDONDO;
const SVG_WHITE = SVG_REDONDO;

// Fondo de los íconos PWA — coincide con --azul / marca-600 del sistema (rebrand Anduve).
const BG_TEAL = "#0c5f58";

async function renderear(svgPath, tamano, salida, opts = {}) {
  const { padding = 0, fondo = "transparent" } = opts;
  const svg = await fs.readFile(svgPath);
  const interior = tamano - padding * 2;

  // sharp renderiza el SVG al tamaño interior, luego lo coloca en un canvas
  // del tamaño total con fondo (centrado).
  const iconoSinFondo = await sharp(svg)
    .resize(interior, interior, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: tamano,
      height: tamano,
      channels: 4,
      background: fondo,
    },
  })
    .composite([{ input: iconoSinFondo, gravity: "center" }])
    .png({ compressionLevel: 9 })
    .toFile(salida);

  console.log(`  ✓ ${path.relative(RAIZ, salida)} (${tamano}×${tamano}${padding ? ` · padding ${padding}` : ""})`);
}

async function main() {
  console.log("Generando íconos PWA desde el logo Anduve (icono.svg redondo)…");

  // La SVG fuente YA es redonda y tiene su propio fondo teal + borde
  // coral, así que renderizamos a tamaño completo sin padding extra.

  // PNG estándar 192 — Android home-screen.
  await renderear(SVG_REDONDO, 192, path.join(PUBLIC, "icono-192.png"), {
    padding: 0,
    fondo: BG_TEAL,
  });

  // PNG estándar 512 — PWA installer / splash.
  await renderear(SVG_REDONDO, 512, path.join(PUBLIC, "icono-512.png"), {
    padding: 0,
    fondo: BG_TEAL,
  });

  // Maskable — Android Q+ aplica máscara circular/squircle. El safe-zone
  // central (80%) debe contener todo el contenido importante. Como el
  // logo YA es circular, lo escalamos al 80% (~10% padding por lado)
  // sobre el fondo teal para que la máscara no recorte la silueta.
  await renderear(SVG_REDONDO, 512, path.join(PUBLIC, "icono-maskable.png"), {
    padding: 52,
    fondo: BG_TEAL,
  });

  // Apple touch icon — iOS recorta a squircle automáticamente.
  await renderear(SVG_REDONDO, 180, path.join(PUBLIC, "apple-touch-icon.png"), {
    padding: 0,
    fondo: BG_TEAL,
  });

  console.log("\n✓ Listo. Verifica los archivos en web/public/ y commitea.");
}

main().catch((e) => {
  console.error("Error generando íconos:", e);
  process.exit(1);
});
