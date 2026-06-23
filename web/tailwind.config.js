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
        },
        // Acento: coral cálido (calidez latina, para CTAs puntuales).
        acento: {
          50: "#fff4f1",
          100: "#ffe5de",
          200: "#ffc9bb",
          300: "#ffa68f",
          400: "#fb8166",
          500: "#f4633f",
          600: "#df4a26",
          700: "#b9381c",
          800: "#93301a",
          900: "#78291a",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "system-ui", "sans-serif"],
        display: ["var(--font-fraunces)", "Georgia", "serif"],
      },
      boxShadow: {
        suave: "0 1px 2px rgba(15,23,42,.04), 0 2px 8px rgba(15,23,42,.05)",
        media: "0 4px 16px rgba(15,23,42,.1)",
        marca: "0 8px 22px rgba(12,95,88,.32)",
      },
      borderRadius: {
        xl2: "18px",
      },
    },
  },
  plugins: [],
};
