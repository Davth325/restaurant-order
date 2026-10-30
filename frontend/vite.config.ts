import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Only the port is used here; database credentials never go into the client bundle.
  const env = loadEnv(mode, '..', '')
  return {
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: `http://127.0.0.1:${env.BACKEND_PORT || '8080'}` },
    },
  },
  }
})
