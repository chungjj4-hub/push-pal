import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/strava': 'http://localhost:3001',
      '/whoop': 'http://localhost:3001',
      '/fit': 'http://localhost:3001',
      '/workouts': 'http://localhost:3001',
      '/journal': 'http://localhost:3001',
      '/goals': 'http://localhost:3001',
      // Only proxy the API sub-paths (/coach/briefing, /coach/chat) — leave the
      // bare /coach route to the SPA so direct nav / refresh on Coach works.
      '^/coach/': 'http://localhost:3001',
      '/health': 'http://localhost:3001',
    },
  },
})
