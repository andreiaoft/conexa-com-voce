/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        conexa: {
          "blue-dark":     "#0D47A1",
          "blue-medium":   "#1565C0",
          "blue-light":    "#E3F2FD",
          "green":         "#43A047",
          "green-light":   "#E8F5E9",
          "text-primary":  "#212121",
          "text-secondary":"#757575",
          "danger":        "#D32F2F",
          "danger-light":  "#FFEBEE",
          "warning":       "#F57C00",
          "warning-light": "#FFF3E0",
          "yellow":        "#B45309",
          "yellow-light":  "#FEF3C7",
        },
      },
    },
  },
  plugins: [],
};
