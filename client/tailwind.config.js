/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        hand: ['Kalam', 'cursive'],
      },
      colors: {
        cream: '#f5f0e8',
        ink: '#1a1a1a',
      },
    },
  },
  plugins: [],
};
