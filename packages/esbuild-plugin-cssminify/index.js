import { readFile } from 'node:fs/promises'
import { transform } from 'esbuild'

export const CSSMinifyPlugin = {
  name: 'CSSMinifyPlugin',
  setup(build) {
    build.onLoad({ filter: /\.css?.inline$/ }, async (args) => {
      const f = await readFile(args.path)
      const css = await transform(f, { loader: 'css', minify: true })
      return { loader: 'text', contents: css.code }
    })
  },
}
