import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/index.js',
  external: ['i18next', 'react-i18next'],
  platform: 'neutral',
  target: 'es2020',
})