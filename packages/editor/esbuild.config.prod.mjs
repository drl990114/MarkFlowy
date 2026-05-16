// @ts-check

import { commonjs } from "@hyrious/esbuild-plugin-commonjs"
import * as esbuild from 'esbuild'
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import alias from 'esbuild-plugin-alias'
import { esbuildDecorators } from 'esbuild-plugin-ts-decorators'

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
    commonjs(),
    alias({
      '@': './src',
    }),
    esbuildDecorators({
      tsconfig: './tsconfig.json',
      cwd: process.cwd(),
    }),
    nodeExternalsPlugin(),
  ],
  minify: true,
  minifyWhitespace: true,
  minifyIdentifiers: true,
  minifySyntax: true,

  splitting: true,
  entryPoints: { index: './src/index.ts' },
  outExtension: { '.js': '.mjs' },
  outdir: './dist/',
  bundle: true,
  format: 'esm',
  sourcemap: false,
  treeShaking: true,
  logLevel: 'debug',
})
