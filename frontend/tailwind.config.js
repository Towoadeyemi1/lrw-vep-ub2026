/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        midnight: '#06101E',
        navy: '#0D2545',
        cobalt: '#1B3F6B',
        teal: '#0A6E82',
        gold: '#D4A820',
        amber: '#B8960C',
        'gold-light': '#F0D980',
        ivory: '#FAFAF7',
        cream: '#FBF8F2',
        slate: '#3D4F6B',
        steel: '#5C6E82',
        silver: '#8899AA',
        cloud: '#E8EDF4',
        success: '#1A5C38',
        'success-bg': '#D4EDDA',
        warning: '#7A5E00',
        'warning-bg': '#FFF3CD',
        danger: '#8B1A1A',
        'danger-bg': '#FDECEA',
        info: '#0C4F7A',
        'info-bg': '#D0E8F7',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(212, 168, 32, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(212, 168, 32, 0.8)' },
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
