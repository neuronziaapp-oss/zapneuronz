/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          green: '#25D366',
          'light-green': '#DCF8C6',
          'dark-green': '#128C7E',
          blue: '#34B7F1',
          gray: '#F0F0F0',
          'dark-gray': '#8696A0',
          'darker-gray': '#54656F',
          'chat-bg': '#E5DDD5',
          'dark-bg': '#0B141A',
          'dark-panel': '#202C33',
          'dark-input': '#2A3942'
        }
      },
      fontFamily: {
        sans: ['Segoe UI', 'Roboto', 'Arial', 'sans-serif']
      },
      spacing: {
        18: '4.5rem',
        88: '22rem'
      },
      maxWidth: {
        xs: '20rem',
        '8xl': '88rem'
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'fade-in': 'fadeIn 0.3s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        typing: 'typing 1.5s infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        typing: {
          '0%, 60%, 100%': { transform: 'translateY(0)' },
          '30%': { transform: 'translateY(-10px)' }
        }
      }
    }
  },
  plugins: [require('@tailwindcss/forms')],
  darkMode: 'class'
}
