import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
      },
      colors: {
        kaf: {
          bg: 'var(--c-bg)',
          surface: 'var(--c-surface)',
          'surface-hover': 'var(--c-surface-hover)',
          'surface-active': 'var(--c-surface-active)',
          border: 'var(--c-border)',
          'border-light': 'var(--c-border-light)',
          text: 'var(--c-text)',
          'text-secondary': 'var(--c-text-secondary)',
          'text-tertiary': 'var(--c-text-tertiary)',
          accent: 'var(--c-accent)',
          'accent-hover': 'var(--c-accent-hover)',
          'accent-bg': 'var(--c-accent-bg)',
          success: 'var(--c-success)',
          'success-bg': 'var(--c-success-bg)',
          warning: 'var(--c-warning)',
          'warning-bg': 'var(--c-warning-bg)',
          danger: 'var(--c-danger)',
          'danger-bg': 'var(--c-danger-bg)',
          info: 'var(--c-info)',
          'info-bg': 'var(--c-info-bg)',
        },
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'kaf': '0 1px 3px var(--c-shadow)',
        'kaf-lg': '0 4px 12px var(--c-shadow)',
        'kaf-xl': '0 8px 24px var(--c-shadow)',
      },
    },
  },
  plugins: [],
};

export default config;
