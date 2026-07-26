/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig(async ({ mode }) => {
  const analyzePlugin =
    mode === 'analyze'
      ? (await import('rollup-plugin-visualizer')).visualizer({
          brotliSize: true,
          emitFile: true,
          filename: 'stats.html',
          gzipSize: true,
        })
      : null

  return {
    server: {
      port: 3000,
      strictPort: true,
      fs: {
        allow: [workspaceRoot],
      },
    },
    clearScreen: false,
    optimizeDeps: {
      exclude: ['rme'],
      include: ['zens'],
    },
    plugins: [
      // Tailwind is only activated by the AI extension's lazy-loaded stylesheet.
      // That stylesheet imports theme + utilities explicitly and intentionally
      // omits Tailwind's global preflight layer.
      tailwindcss(),
      react({
        babel: {
          plugins: [
            ['@babel/plugin-proposal-decorators', { legacy: true }],
            ['@babel/plugin-proposal-class-properties', { loose: true }],
            'babel-plugin-react-compiler',
          ],
        },
      }),
      svgr({
        svgrOptions: {
          exportType: 'default',
        },
      }),
      analyzePlugin,
    ],
    build: {
      minify: 'esbuild',
      sourcemap: false,
      rolldownOptions: {
        output: {
          // Preserve dynamic-import subgraphs instead of pulling every dependency
          // into a single eagerly preloaded vendor chunk.
          codeSplitting: true,
        },
      },
    },
    resolve: {
      alias: [
        { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
        {
          find: '@markflowy/i18n',
          replacement: fileURLToPath(new URL('../../packages/i18n/src/index.ts', import.meta.url)),
        },
      ],
      dedupe: ['react', 'react-dom'],
    },
    test: {
      environment: 'happy-dom',
      reporters: ['verbose'],
    },
  }
})
