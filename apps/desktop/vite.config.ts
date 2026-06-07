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
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (/[\\/]node_modules[\\/](react|react-dom|react-router|hox|zustand|immer)[\\/]/.test(id)) {
            return 'vendor-react'
          }

          if (/[\\/]node_modules[\\/](@tauri-apps)[\\/]/.test(id)) {
            return 'vendor-tauri'
          }

          if (/[\\/]node_modules[\\/](@ai-sdk|ai|ollama-ai-provider-v2)[\\/]/.test(id)) {
            return 'vendor-ai'
          }

          if (/[\\/]node_modules[\\/](antd|@ant-design|@rc-component|rc-)[\\/]/.test(id)) {
            return 'vendor-antd'
          }

          if (/[\\/]node_modules[\\/](prosemirror-|@codemirror|codemirror|rme)[\\/]/.test(id)) {
            return 'vendor-editor'
          }

          if (/[\\/]node_modules[\\/](mermaid|katex|cytoscape|dagre|d3-)[\\/]/.test(id)) {
            return 'vendor-preview'
          }

          return 'vendor'
        },
      },
    },
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
