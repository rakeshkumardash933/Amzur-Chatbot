export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      animation: {
        'bounce-slow': 'bounce 1.5s infinite',
      },
      transitionDelay: {
        '100': '100ms',
        '200': '200ms',
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}
