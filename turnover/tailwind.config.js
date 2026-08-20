/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,jsx}', './src/shell.html'],
  theme: {
    extend: {
      fontFamily: {
        /* System stacks only — the console must render identically with no
         * network, so no webfont is ever fetched. */
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto',
               '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', '"SF Mono"', 'Menlo', 'Consolas',
               '"Roboto Mono"', '"Liberation Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
