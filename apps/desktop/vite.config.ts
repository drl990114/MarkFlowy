/// <reference types="vitest/config" />

import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import svgr from 'vite-plugin-svgr'

import { CAPRICORN_VERSION, resolvePrivateCapricornRuntime } from './capricornRuntimeResolver'

const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))
const capricornRuntimeId = 'virtual:markflowy-capricorn-runtime'
const resolvedCapricornRuntimeId = `\0${capricornRuntimeId}`

function optionalCapricornRuntimePlugin(runtimeEntry: string | null): Plugin {
  return {
    name: 'markflowy-optional-capricorn-runtime',
    resolveId(source) {
      return source === capricornRuntimeId ? resolvedCapricornRuntimeId : null
    },
    load(id) {
      if (id !== resolvedCapricornRuntimeId) return null

      if (!runtimeEntry) {
        return `export function createCapricornRuntime() {
          throw new Error('Capricorn runtime is not installed. Run yarn install:capricorn-runtime with a GitHub Packages read token.');
        }`
      }

      // Re-export the package root so a new async capability remains optional
      // with older private packages that expose only the synchronous factory.
      return `export * from ${JSON.stringify(runtimeEntry)};`
    },
  }
}

export default defineConfig(async ({ mode }) => {
  const capricornRuntimeEntry = resolvePrivateCapricornRuntime(
    fileURLToPath(
      new URL(
        '../../.private-runtime/node_modules/@drl990114/capricorn-runtime/package.json',
        import.meta.url,
      ),
    ),
  )
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
      include: ['react-dom/server', 'zens'],
    },
    plugins: [
      optionalCapricornRuntimePlugin(capricornRuntimeEntry),
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
    define: {
      __MARKFLOWY_CAPRICORN_RUNTIME_AVAILABLE__: JSON.stringify(capricornRuntimeEntry !== null),
      __MARKFLOWY_CAPRICORN_RUNTIME_VERSION__: JSON.stringify(
        capricornRuntimeEntry ? CAPRICORN_VERSION : null,
      ),
      __MARKFLOWY_CAPRICORN_RUNTIME_ENTRY_SHA256__: JSON.stringify(
        capricornRuntimeEntry
          ? createHash('sha256').update(readFileSync(capricornRuntimeEntry)).digest('hex')
          : null,
      ),
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
