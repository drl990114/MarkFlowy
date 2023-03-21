import { defineConfig } from 'windicss/helpers'

export default defineConfig({
  extract: {
    include: ['**/*.{tsx,jsx,css}'],
    exclude: ['node_modules', '.git', '.next/**/*'],
  },
  attributify: true,
  shortcuts: {
    btn: 'rounded-lg text-gray-100 bg-primary px-4 py-2 m-2 w-auto hover:shadow',
  },
  theme: {
    extend: {
      colors: {
        primary: '#617172',
      },
    },
  },
})
