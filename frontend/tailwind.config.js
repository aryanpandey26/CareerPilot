/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4F46E5',
          foreground: '#FFFFFF',
        },
        secondary: {
          DEFAULT: '#0F172A',
          foreground: '#FFFFFF',
        },
        accent: {
          DEFAULT: '#10B981',
          foreground: '#FFFFFF',
        },
        destructive: {
          DEFAULT: '#E11D48',
          foreground: '#FFFFFF',
        },
        background: {
          DEFAULT: '#FFFFFF',
          dark: '#020617',
          subtle: '#F8FAFC',
        },
        border: '#E2E8F0',
        input: '#E2E8F0',
        ring: '#4F46E5',
      },
      fontFamily: {
        heading: ['Poppins', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        lg: '0.75rem',
        md: '0.5rem',
        sm: '0.25rem',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}