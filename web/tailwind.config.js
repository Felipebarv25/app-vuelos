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
        // Primario: teal/petróleo "océano" (confianza de viaje, distintivo).
        marca: {
          50: "#f0faf9",
          100: "#d7f0ee",
          200: "#aee1dd",
          300: "#79cbc5",
          400: "#43b0aa",
          500: "#1d9690",
          600: "#0f766e",
          700: "#115e59",
          800: "#134e4a",
          900: "#0f3d3a",
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
        marca: "0 8px 22px rgba(15,118,110,.32)",
      },
      borderRadius: {
        xl2: "18px",
      },
    },
  },
  plugins: [],
};
