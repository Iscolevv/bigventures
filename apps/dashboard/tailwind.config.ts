import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        muted: 'var(--muted)',
        fg: 'var(--fg)',
        brand: 'var(--brand)',
        ok: 'var(--ok)',
        warn: 'var(--warn)',
        crit: 'var(--crit)',
      },
    },
  },
  plugins: [],
} satisfies Config;
