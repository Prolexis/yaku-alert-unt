/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', "Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        navy: {
          950: "#071524",
          900: "#0B1F33",
          800: "#122C46",
          700: "#1B3B5C",
        },
        tech: {
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
        },
        tealbrand: {
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
        },
      },
      boxShadow: {
        soft: "0 1px 3px 0 rgba(15, 23, 42, 0.06), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        card: "0 4px 20px -2px rgba(11, 31, 51, 0.06)",
      },
    },
  },
  plugins: [],
};
