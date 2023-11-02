import { readFileSync } from 'fs'
import postcss from 'rollup-plugin-postcss'
import postcssImport from 'postcss-import'
import postcssNested from 'postcss-nested'
import { createConfig } from '../../rollup.config.mjs'

export default [
  ...createConfig({
    input: 'src/index.ts',
    pkg: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')),
  }),
  // If you dont need to import the css in your js, you can remove this
  {
    input: 'src/index.css',
    output: {
      file: 'dist/style.css',
      format: 'es',
    },
    plugins: [
      postcss({
        plugins: [postcssImport(), postcssNested()],
        extract: true,
        sourceMap: false,
        minimize: true,
      }),
    ],
  },
]
