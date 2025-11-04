/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Calibri', 'Inter', 'sans-serif'],
        inter: ['Inter', 'sans-serif'],
        calibri: ['Calibri', 'sans-serif'],
      },
      colors: {
        brand: "#3b5999",
      },
    },
  },
  plugins: [],
};

