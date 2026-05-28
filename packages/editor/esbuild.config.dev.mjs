// @ts-check

import { commonjs } from "@hyrious/esbuild-plugin-commonjs"
import * as esbuild from 'esbuild'
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import alias from 'esbuild-plugin-alias'
import { esbuildDecorators } from 'esbuild-plugin-ts-decorators'
import pkg from 'esbuild-plugin-markdown'
import fs from 'fs'
const { markdownPlugin } = pkg

const devCtx = await esbuild.context({
  entryPoints: ['./src/index-dev.tsx'],
  bundle: true,
  outdir: 'build',
  treeShaking: true,
  logLevel: 'info',
  loader: {
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
    '.ttf': 'dataurl',
    '.svg': 'dataurl',
    '.eot': 'dataurl',
  },
  plugins: [
    alias({
      '@/': './',
    }),
    markdownPlugin({
      filter: /\.md$/,
    }),
  ],
})

const distCtx = await esbuild.context({
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
  minify: false,
  splitting: true,
  entryPoints: { index: './src/index.ts' },
  outExtension: { '.js': '.mjs' },
  outdir: './dist/',
  bundle: true,
  format: 'esm',
  sourcemap: true,
  treeShaking: true,
  logLevel: 'info',
})

fs.existsSync('./build') || fs.mkdirSync('./build')
fs.existsSync('./dist') || fs.mkdirSync('./dist')

fs.copyFile('./public/index.html', './build/index.html', (err) => {
  if (err) throw err
})

await devCtx.watch()
await distCtx.watch()

await devCtx.serve({
  servedir: 'build',
  port: 3030,
  host: 'localhost',
})