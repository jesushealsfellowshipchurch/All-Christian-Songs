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
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#4f46e5',
          600: '#4338ca',
          700: '#3730a3',
          900: '#1e1b4b',
        },
        gold: {
          300: '#f3e1a0',
          400: '#e5c56c',
          500: '#cbb682',
          600: '#bfae7a',
          700: '#a08c5b',
          800: '#785f37',
        },
        cream: {
          50: '#fdfcf8',
          100: '#f7f3e6',
          200: '#e9e0c9',
          300: '#e0dbbd',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        telugu: ['"Noto Sans Telugu"', 'system-ui', 'sans-serif'],
        'telugu-serif': ['"Noto Serif Telugu"', 'Georgia', 'serif'],
        'telugu-sans': ['"Noto Sans Telugu"', 'sans-serif'],
        akaya: ['"Akaya Telivigala"', '"Noto Sans Telugu"', 'cursive'],
        peddana: ['"Peddana"', '"Noto Serif Telugu"', 'serif'],
        timmana: ['"Timmana"', '"Noto Sans Telugu"', 'sans-serif'],
        dhurjati: ['"DhurjatiCustom"', '"Dhurjati"', '"Noto Sans Telugu"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
        script: ['"Great Vibes"', '"Alex Brush"', 'cursive'],
        cinzel: ['"Cinzel"', 'Georgia', 'serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      }
    },
  },
  plugins: [],
}
