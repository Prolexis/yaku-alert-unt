/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', '"Plus Jakarta Sans"', "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        canvas: "#F7F9FC",
        surface: "#FFFFFF",
        ink: "#111827",
        muted: "#64748B",
        hairline: "#E2E8F0",
        navy: {
          950: "#071524",
          900: "#0B1F33",
          800: "#122C46",
          700: "#1B3B5C",
        },
        brand: {
          600: "#2563EB",
          700: "#1D4ED8",
        },
      },
      boxShadow: {
        subtle: "0 1px 2px 0 rgba(17, 24, 39, 0.04)",
        panel: "0 1px 3px 0 rgba(11, 31, 51, 0.06), 0 1px 2px -1px rgba(11, 31, 51, 0.04)",
      },
    },
  },
  plugins: [],
};
