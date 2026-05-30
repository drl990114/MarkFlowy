import * as esbuild from 'esbuild'

const isWatch = process.argv.includes('--watch')

const buildOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/index.mjs',
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
}

if (isWatch) {
  const ctx = await esbuild.context(buildOptions)
  await ctx.watch()
  console.log('[@markflowy/github-api] watching for changes...')
} else {
  await esbuild.build(buildOptions)
}
