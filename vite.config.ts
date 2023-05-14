import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import WindiCSS from 'vite-plugin-windicss'
import svgr from 'vite-plugin-svgr'

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
    alias: [
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@components', replacement: resolve(__dirname, 'src/components') },
      { find: '@services', replacement: resolve(__dirname, 'src/services') },
      { find: '@stores', replacement: resolve(__dirname, 'src/stores') },
      { find: '@utils', replacement: resolve(__dirname, 'src/utils') },
      { find: '@types', replacement: resolve(__dirname, 'src/types') },
      { find: '@constants', replacement: resolve(__dirname, 'src/constants') },
      { find: '@icons', replacement: resolve(__dirname, 'src/icons') },
      { find: '@hooks', replacement: resolve(__dirname, 'src/hooks') },
      { find: '@editor', replacement: resolve(__dirname, 'src/editor') },
      { find: '@i18n', replacement: resolve(__dirname, 'src/i18n') },
      { find: '@router', replacement: resolve(__dirname, 'src/router') },
      { find: '@colors', replacement: resolve(__dirname, 'src/colors') },
    ],
  },
})
