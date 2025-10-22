/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        primary: '#667eea',
        'primary-foreground': '#ffffff',
        accent: '#f7fafc',
        'accent-foreground': '#333',
        muted: '#718096',
        'muted-foreground': '#a0aec0',
        background: '#ffffff',
        foreground: '#1a202c',
        border: '#e2e8f0',
        ring: '#667eea',
      },
    },
  },
  plugins: [],
}
