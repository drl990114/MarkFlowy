import { builtinModules } from 'module'
import typescript from '@rollup/plugin-typescript'
import resolve from '@rollup/plugin-node-resolve'
import postcss from 'rollup-plugin-postcss'
import postcssImport from 'postcss-import'
import postcssNested from 'postcss-nested'
import url from '@rollup/plugin-url'

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
      plugins: [
        resolve(),
        url({
          // by default, rollup-plugin-url will not handle font files
          include: ['**/*.woff', '**/*.woff2', '**/*.ttf'],
          // setting infinite limit will ensure that the files
          // are always bundled with the code, not copied to /dist
          limit: Infinity,
        }),
        postcss({
          plugins: [postcssImport(), postcssNested()],
          extract: false,
          sourceMap: false,
          minimize: true,
        }),
        typescript({ sourceMap: true }),
      ],
    },
    {
      input,
      onwarn: (warning) => {
        throw Object.assign(new Error(), warning)
      },
      strictDeprecations: true,
      output: {
        file: pkg.browser,
        format: 'cjs',
        sourcemap: true,
        entryFileNames: '[name].js',
      },
      external: ['styled-components', 'color'],
      plugins: [
        resolve(),
        url({
          // by default, rollup-plugin-url will not handle font files
          include: ['**/*.woff', '**/*.woff2', '**/*.ttf'],
          // setting infinite limit will ensure that the files
          // are always bundled with the code, not copied to /dist
          limit: Infinity,
        }),
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
