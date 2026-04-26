import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ww: {
          bg: '#0a0e1a',
          'bg-deep': '#070912',
          surface: '#161b22',
          'surface-2': '#1c2230',
          border: '#2a3142',
          'border-glow': '#3a4256',
          accent: '#e8a045',
          'accent-hover': '#f0b35b',
          cyan: '#67e8f9',
          'cyan-glow': '#22d3ee',
          purple: '#a78bfa',
          text: '#e6e8ee',
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
      fontFamily: {
        display: ['Rajdhani', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      backgroundImage: {
        'hero-gradient':
          'radial-gradient(ellipse at top, rgba(103,232,249,0.15) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(167,139,250,0.12) 0%, transparent 60%), linear-gradient(180deg, #070912 0%, #0a0e1a 100%)',
        'panel-gradient':
          'linear-gradient(135deg, rgba(28,34,48,0.7) 0%, rgba(22,27,34,0.55) 100%)',
      },
      boxShadow: {
        'glow-cyan': '0 0 24px rgba(103,232,249,0.35), inset 0 0 0 1px rgba(103,232,249,0.25)',
        'glow-gold': '0 0 24px rgba(232,160,69,0.35), inset 0 0 0 1px rgba(232,160,69,0.3)',
        panel: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      },
      animation: {
        'spin-slow': 'spin 12s linear infinite',
        'pulse-glow': 'pulse-glow 2.5s ease-in-out infinite',
        'count-in': 'count-in 0.6s ease-out',
        'fade-up': 'fade-up 0.4s ease-out',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '0.85', filter: 'brightness(1)' },
          '50%': { opacity: '1', filter: 'brightness(1.15)' },
        },
        'count-in': {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
}

export default config
