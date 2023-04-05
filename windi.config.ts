import { defineConfig } from 'windicss/helpers'

export default defineConfig({
  darkMode: 'class',
  extract: {
    include: ['**/*.{tsx,jsx,css}'],
    exclude: ['node_modules', '.git', '.next/**/*'],
  },
  attributify: true,
  shortcuts: {
    'btn': 'rounded-lg text-sky-700 bg-primary px-4 py-2 w-auto hover:shadow',
    'detail': 'text-sky-700 bg-hoverDefault',
    'label-hover': 'hover:detail',
  },
  theme: {
    extend: {
      colors: {
        primary: '#e6f7ff',
        hoverDefault: '#f6f7f9',
        borderDefault: '#dadde6',
      },
    },
  },
})
