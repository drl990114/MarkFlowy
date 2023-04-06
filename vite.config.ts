import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import WindiCSS from 'vite-plugin-windicss'
import svgr from 'vite-plugin-svgr'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), WindiCSS(), svgr({
    exportAsDefault: true,
  })],
  resolve: {
    alias: [
      { find: '@components', replacement: path.resolve(__dirname, 'src/components') },
      { find: '@services', replacement: path.resolve(__dirname, 'src/services') },
      { find: '@stores', replacement: path.resolve(__dirname, 'src/stores') },
      { find: '@utils', replacement: path.resolve(__dirname, 'src/utils') },
      { find: '@types', replacement: path.resolve(__dirname, 'src/types') },
      { find: '@constants', replacement: path.resolve(__dirname, 'src/constants') },
      { find: '@icons', replacement: path.resolve(__dirname, 'src/icons') },
    ],
  },
})
