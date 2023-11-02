import { builtinModules } from 'module'
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
      external: Object.keys(pkg.dependencies || {})
        .concat(Object.keys(pkg.peerDependencies || {}))
        .concat(builtinModules)
        .concat(external),
      onwarn: (warning) => {
        throw Object.assign(new Error(), warning)
      },
      strictDeprecations: true,
      output: {
        file: pkg.module,
        format: 'es',
        sourcemap: true,
      },
      plugins: [resolve(), typescript({ sourceMap: true })],
    },
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
      plugins: [resolve(), typescript({ sourceMap: true })],
    },
  ]
}
