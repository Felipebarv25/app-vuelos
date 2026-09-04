/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primario: teal Anduve (rebrand 2026-06-21, base #0c5f58).
        marca: {
          50: "#eff9f8",
          100: "#d4f1ef",
          200: "#a9e3df",
          300: "#74cdc5",
          400: "#3fb1a8",
          500: "#1c948e",
          600: "#0c5f58",
          700: "#0a4d48",
          800: "#073a36",
          900: "#052b28",
          // 950 anadido 2026-09: page.js ya usaba from-marca-950 y bg-marca-950
          // sin que el tono existiera en la rampa, asi que Tailwind no generaba la
          // clase y el velo de las tarjetas se quedaba SIN base oscura justo donde
          // va el titulo. El sintoma era "el texto no se lee sobre la foto".
          950: "#02100f",
        },
        // Acento: coral cálido (calidez latina, para CTAs puntuales).
        // Rampa rederivada 2026-06-25 alrededor de #f4734d para alinear con
        // los SVG del logo (AnduveIcon/AnduveLogo), la var --acento de
        // globals.css y los CTAs de los emails. Antes 500=#f4633f generaba
        // un sutil mismatch entre clase Tailwind y SVG/CSS-var.
        acento: {
          50: "#fff5f1",
          100: "#ffe7de",
          200: "#ffcfbb",
          300: "#ffaa8a",
          400: "#f88860",
          500: "#f4734d",
          600: "#de5a31",
          700: "#b54521",
          800: "#8c3520",
          900: "#6c2a1d",
        },
      },
      fontFamily: {
        // Una sola familia para todo el sistema (Plus Jakarta Sans).
        // `display` se mantiene como alias por compatibilidad con
        // className "font-display" que aun esta en algunos archivos.
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-jakarta)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        // Sombras del sistema (los nombres antiguos siguen vigentes
        // por compatibilidad con código existente).
        suave: "0 1px 2px rgba(15,23,42,.04), 0 2px 8px rgba(15,23,42,.05)",
        media: "0 4px 16px rgba(15,23,42,.1)",
        marca: "0 8px 22px rgba(12,95,88,.32)",
        // Aliases semánticos nuevos — usar estos en código nuevo:
        card:  "0 1px 2px rgba(15,23,42,.04), 0 2px 8px rgba(15,23,42,.05)",
        modal: "0 24px 60px rgba(15,23,42,.18), 0 8px 24px rgba(15,23,42,.10)",
        cta:   "0 8px 22px rgba(12,95,88,.32)",
      },
      borderRadius: {
        xl2: "18px",
      },
    },
  },
  plugins: [],
};
