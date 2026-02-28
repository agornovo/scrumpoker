import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/socket.io': {
        target: 'http://localhost:8080',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./setupTests.js'],
    coverage: {
      provider: 'v8',
      include: ['**/*.{jsx,js}'],
      exclude: ['**/__tests__/**', '**/*.{spec,test}.{js,jsx}', 'setupTests.js', 'main.jsx'],
    },
  },
})
