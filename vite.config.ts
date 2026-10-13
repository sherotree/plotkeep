import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const isolationHeaders = {
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Opener-Policy': 'same-origin',
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 4867,
    strictPort: true,
    headers: isolationHeaders,
    proxy: {
      '/ollama': {
        target: 'http://127.0.0.1:11434',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ollama/, ''),
      },
    },
  },
  preview: {
    host: true,
    port: 4867,
    headers: isolationHeaders,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
