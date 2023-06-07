import { defineConfig } from 'windicss/helpers'
import customColors from './src/colors'

export default defineConfig({
  preflight: false,
  darkMode: 'class',
  extract: {
    include: ['**/*.{tsx,jsx,css}'],
    exclude: ['node_modules', '.git'],
  },
  plugins: [
    require('windicss/plugin/scroll-snap'),
  ],
  shortcuts: {
    // element
    'split': 'h-1px w-full bg-neutral-300',

    // layout
    'fjic': 'flex justify-center items-center',
  },
  theme: {
    extend: {
      colors: customColors,
    },
  },
})
