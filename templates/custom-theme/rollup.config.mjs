import { readFileSync } from 'fs'
import postcss from 'rollup-plugin-postcss'
import postcssImport from 'postcss-import'
import postcssNested from 'postcss-nested'
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'

/**
 * Create a base rollup config
 * @param {Record<string,any>} pkg Imported package.json
 * @param {string[]} external Imported package.json
 * @returns {import('rollup').RollupOptions}
 */
export function createConfig({ input = 'index.ts', pkg, external = [] }) {
  return [
    {
      input,
      onwarn: (warning) => {
        throw Object.assign(new Error(), warning)
      },
      strictDeprecations: true,
      output: {
        file: pkg.browser,
        format: 'es',
        sourcemap: true,
        entryFileNames: '[name].js',
      },
      plugins: [
        resolve(),
        postcss({
          plugins: [postcssImport(), postcssNested()],
          extract: false,
          sourceMap: false,
          minimize: true,
        }),
        typescript({ sourceMap: true }),
      ],
    },
  ]
}

export default createConfig({
  input: 'src/index.ts',
  pkg: JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')),
})
