import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url'
import { defineConfig } from 'vite'
import svgr from 'vite-plugin-svgr'
import WindiCSS from 'vite-plugin-windicss'

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [
    react(),
    WindiCSS(),
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
})
