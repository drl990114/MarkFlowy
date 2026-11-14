// @ts-check

import { commonjs } from "@hyrious/esbuild-plugin-commonjs"
import * as esbuild from 'esbuild'
import { nodeExternalsPlugin } from 'esbuild-node-externals'
import alias from 'esbuild-plugin-alias'
import { esbuildDecorators } from 'esbuild-plugin-ts-decorators'
import { copyFile, mkdir } from 'node:fs/promises'

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

await distCtx.watch()

if (process.env.MARKFLOWY_EDITOR_WATCH_ONLY !== '1') {
  const devCtx = await esbuild.context({
    entryPoints: ['./src/index-dev.tsx'],
    bundle: true,
    outdir: 'build',
    treeShaking: true,
    logLevel: 'info',
    loader: {
      '.md': 'text',
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
    ],
  })

  await mkdir('./build', { recursive: true })
  await copyFile('./public/index.html', './build/index.html')
  await devCtx.watch()
  await devCtx.serve({
    servedir: 'build',
    port: 3030,
    host: 'localhost',
  })
}
