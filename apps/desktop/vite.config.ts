/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
  },
  clearScreen: false,
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
          'babel-plugin-react-compiler'
        ],
      },
    }),
    svgr({
      svgrOptions: {
        exportType: 'default',
      },
    }),
  ],
  build: {
    minify: 'esbuild',
    sourcemap: true,
    rollupOptions: {},
  },
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      { find: '@markflowy/i18n', replacement: fileURLToPath(new URL('../../packages/i18n/dist/index.js', import.meta.url)) },
    ],
    dedupe: ['react', 'react-dom'],
  },
  test: {
    environment: 'happy-dom',
    reporters: ['verbose'],
  },
})
