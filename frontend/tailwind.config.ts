import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ww: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          accent: '#e8a045',
          'accent-hover': '#f0b35b',
          text: '#e6edf3',
          muted: '#8b949e',
        },
        tier: {
          S: '#ff9500',
          A: '#c084fc',
          B: '#60a5fa',
          C: '#4ade80',
          D: '#94a3b8',
        },
        element: {
          Glacio: '#7dd3fc',
          Fusion: '#f97316',
          Electro: '#a855f7',
          Aero: '#34d399',
          Spectro: '#facc15',
          Havoc: '#e879f9',
        },
      },
    },
  },
  plugins: [],
}

export default config
