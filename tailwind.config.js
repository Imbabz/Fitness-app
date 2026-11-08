/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Every colour resolves to a CSS custom property defined in
      // src/theme/tokens.css. Day/night is a class swap on <html>, so no
      // component ever needs to know which mode it is in.
      colors: {
        base: 'rgb(var(--c-base) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        accent: 'rgb(var(--c-accent) / <alpha-value>)',
        'accent-soft': 'rgb(var(--c-accent-soft) / <alpha-value>)',
        spine: 'rgb(var(--c-spine) / <alpha-value>)',
        warmup: 'rgb(var(--c-warmup) / <alpha-value>)',
        main: 'rgb(var(--c-main) / <alpha-value>)',
        mobility: 'rgb(var(--c-mobility) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
      },
      borderRadius: {
        card: 'var(--r-card)',
      },
      transitionDuration: {
        mode: 'var(--t-mode)',
        motion: 'var(--t-motion)',
      },
      fontFamily: {
        /*
         * The world speaks in serif, the work speaks in sans. `ui-serif` is
         * New York on iOS — a well-drawn contemporary face the system already
         * carries, so it costs no download and no network call. Georgia is
         * only the fallback; on its own it reads as a default.
         */
        serif: ['ui-serif', 'New York', 'Georgia', 'Times New Roman', 'serif'],
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
