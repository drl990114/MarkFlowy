import * as esbuild from 'esbuild'
import alias from 'esbuild-plugin-alias'
import pkg from 'esbuild-plugin-markdown'
import fs from 'fs'
const { markdownPlugin } = pkg

const ctx = await esbuild.context({
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

fs.existsSync('./build') || fs.mkdirSync('./build')

fs.copyFile('./public/index.html', './build/index.html', (err) => {
  if (err) throw err
})

await ctx.watch()
await ctx.serve({
  servedir: 'build',
  port: 3030,
  host: 'localhost',
})
