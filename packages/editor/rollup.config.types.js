import dts from 'rollup-plugin-dts'
import postcss from 'rollup-plugin-postcss'

export default {
  input: './src/index.ts',
  output: [{ file: 'dist/index.d.ts', format: 'es' }],
  plugins: [
    postcss({
      autoModules: true,
      include: '**/*.css',
      extensions: ['.css'],
      plugins: [],
    }),
    dts({
      compilerOptions: {
        baseUrl: 'src',
      },
    }),
  ],
}