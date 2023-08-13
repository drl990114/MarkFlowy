/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
        ],
      },
    }),
    svgr({
      exportAsDefault: true,
    }),
  ],
  build: {
    minify: 'esbuild',
    rollupOptions: {},
  },
  resolve: {
    alias: [{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      reporter: ['json', 'html'],
      all: true,
      src: ['./src'],
      exclude: ['**/*.spec.*'],
    },
    deps: {},

    // Limit the resources we used in the CI, to avoid out-of-memory errors.
    maxConcurrency: process.env.CI ? 1 : 5,
  },
})
