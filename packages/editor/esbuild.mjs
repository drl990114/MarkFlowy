// @ts-check

import * as esbuild from 'esbuild'
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import alias from 'esbuild-plugin-alias'
import { CSSMinifyPlugin } from './plugins/css-minify.js'

/**
 * @param {import('esbuild').BuildOptions} options
 */
async function main(options) {
  const context = await esbuild.context(options)
  const watch = process.argv.slice(2).includes('--watch')

  if (watch) {
    context.watch()
  } else {
    await context.rebuild()
    await context.dispose()
  }
}

main({
  plugins: [
    alias({
      '@': './src',
    }),
    CSSMinifyPlugin,
    nodeExternalsPlugin(),
  ],
  splitting: true,
  entryPoints: { '': './src/index.ts' },
  outExtension: { '.js': '.mjs' },
  outdir: './dist/',
  bundle: true,
  format: 'esm',
  sourcemap: true,
  treeShaking: true,
  logLevel: 'debug',
  external: ['@emotion/*'],
})
