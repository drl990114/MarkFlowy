/// <reference types="vitest" />
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(() => ({
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      {
        find: '@markflowy/theme',
        replacement: fileURLToPath(new URL('../theme/src/index.ts', import.meta.url)),
      },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/editor/test/setup-vitest.ts'],
    server: { deps: { inline: ['@drl990114/codemirror-themes'] } },
    alias: [
      {
        find: '@drl990114/codemirror-themes',
        replacement: fileURLToPath(
          new URL('../../node_modules/@drl990114/codemirror-themes/esm/index.js', import.meta.url),
        ),
      },
      {
        find: 'zens',
        replacement: fileURLToPath(new URL('./src/editor/test/__mocks__/zens.ts', import.meta.url)),
      },
    ],
  },
  coverage: {
    reporter: ['text', 'json', 'html'],
  },
}))
