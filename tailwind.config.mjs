/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      colors: {
        // Cluely-style palette
        glass: 'rgba(12, 12, 14, 0.92)',
        surface: 'rgba(255, 255, 255, 0.04)',
        hairline: 'rgba(255, 255, 255, 0.08)',
        accent: '#a78bfa',
        positive: '#10b981'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' }
        },
        'pulse-scale': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.15)' }
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '100%': { transform: 'scale(2.2)', opacity: '0' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.2s ease-out',
        blink: 'blink 1s step-end infinite',
        'pulse-scale': 'pulse-scale 1.5s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 1.5s ease-out infinite'
      }
    }
  },
  plugins: []
}
