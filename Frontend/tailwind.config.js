/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ink: '#17202A',
        coral: '#F2634E',
        cream: '#FFF9F2',
        sand: '#F5E7D6',
      },
      boxShadow: {
        soft: '0 18px 45px rgba(28, 34, 41, .10)',
      },
    },
  },
  plugins: [],
}
