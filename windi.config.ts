import { defineConfig } from 'windicss/helpers'
import colors from 'windicss/colors'

export default defineConfig({
  preflight: false,
  darkMode: 'class',
  extract: {
    include: ['./src/*.{tsx,jsx,css}'],
    exclude: ['node_modules', '.git'],
  },
  plugins: [
    require('windicss/plugin/scroll-snap'),
  ],
  shortcuts: {
    // element
    'btn': 'rounded-lg text-accentColor px-4 py-2 w-auto hover:shadow',
    'split': 'h-1px w-full bg-neutral-300',
    'detail': 'text-accentColor bg-tipsBgColor',
    'label-hover': 'hover:detail',
    'icon-hover': 'hover:border-1',

    // layout
    'fjic': 'flex justify-center items-center',
  },
  theme: {
    extend: {
      colors: {
        primarFontColor: 'black',
        labelFontColor: colors.gray[400],
        accentColor: colors.sky[700],
        borderColor: colors.zinc[200],
        bgColor: colors.neutral[100],
        tipsBgColor: '#f6f7f9',
      },
    },
  },
})
