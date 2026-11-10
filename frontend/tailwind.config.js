/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      boxShadow: {
        card: '0 1px 3px rgb(15 23 42 / 0.06)',
        warm: '0 2px 10px rgba(0, 0, 0, 0.04)',
      },
      colors: {
        cream: {
          50: '#FDFCF9',
          100: '#FBF9F4',
          200: '#F4EFE6',
          300: '#EBE7DF',
        },
        navy: {
          900: '#0E131F',
          800: '#151C2D',
          700: '#1D263B',
        },
        brand: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          500: '#f97316',
          600: '#F95716', // Main Lovable brand vibrant orange
          700: '#ea580c',
          800: '#c2410c',
          900: '#9a3412',
        }
      }
    },
  },
  plugins: [],
}
