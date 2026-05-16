/// <reference types="vitest" />
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(() => ({
  resolve: {
    alias: [{ find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) }],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__test__/setup-vitest.ts'],
  },
  coverage: {
    reporter: ['text', 'json', 'html']
  },
}))
