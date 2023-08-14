/// <reference types="vitest" />
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(() => ({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./__test__/setup-vitest.ts'],
    reporters: ['json', 'html'],
  },
}))
