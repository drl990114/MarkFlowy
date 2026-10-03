import * as esbuild from 'esbuild'

const isWatch = process.argv.includes('--watch')

const buildOptions = {
  entryPoints: ['src/index.ts', 'src/desktop.ts'],
  bundle: true,
  format: 'esm',
  outdir: 'dist',
  splitting: true,
  external: ['i18next', 'react-i18next'],
  platform: 'neutral',
  target: 'es2020',
  sourcemap: true,
}

if (isWatch) {
  const ctx = await esbuild.context(buildOptions)
  await ctx.watch()
  console.log('[i18n] watching for changes...')
} else {
  await esbuild.build(buildOptions)
}
