/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        marca: {
          50: "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        suave: "0 1px 2px rgba(15,23,42,.04), 0 2px 8px rgba(15,23,42,.05)",
        media: "0 4px 16px rgba(15,23,42,.1)",
        marca: "0 8px 22px rgba(79,70,229,.35)",
      },
      borderRadius: {
        xl2: "18px",
      },
    },
  },
  plugins: [],
};
