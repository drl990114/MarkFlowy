import * as esbuild from 'esbuild'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))
const isWatch = process.argv.includes('--watch')

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
]

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: pkg.module,
  external,
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
}

if (isWatch) {
  const ctx = await esbuild.context(buildOptions)
  await ctx.watch()
  console.log(`[${pkg.name}] watching for changes...`)
} else {
  await esbuild.build(buildOptions)
}
