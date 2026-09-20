import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import postcss, { type AnyNode } from 'postcss'
import type { Plugin } from 'vite'

const styleId = 'virtual:mf-pdf-preview-style'
const resolvedStyleId = '\0' + styleId
const assetPrefix = '/mf-pdf-assets/'

export function scopePdfViewerCss(css: string): string {
  const root = postcss.parse(css)
  root.walkRules((rule) => {
    // PDF.js uses nested CSS; only prefix the outermost selectors.
    let ancestor: AnyNode | undefined = rule.parent
    while (ancestor) {
      if (
        ancestor.type === 'rule' ||
        (ancestor.type === 'atrule' && /keyframes$/i.test(ancestor.name))
      )
        return
      ancestor = ancestor.parent
    }
    rule.selectors = rule.selectors.map((selector) =>
      selector.includes(':root')
        ? selector.replace(/:root/g, '.mf-pdf-preview')
        : `.mf-pdf-preview ${selector}`,
    )
  })
  root.walkDecls((decl) => {
    decl.value = decl.value.replace(/url\((['"]?)images\//g, `url($1${assetPrefix}images/`)
  })
  return root.toString()
}

/** The same versioned resources are available in Vite dev and packaged Tauri. */
export function pdfPreviewAssets(): Plugin {
  const require = createRequire(import.meta.url)
  const root = dirname(require.resolve('pdfjs-dist/package.json'))
  const files = new Map<string, string>()
  for (const directory of ['cmaps', 'standard_fonts', 'wasm', 'web/images']) {
    for (const entry of readdirSync(join(root, directory), { withFileTypes: true })) {
      if (!entry.isFile()) continue
      const name = `${directory.replace('web/', '')}/${entry.name}`
      files.set(name, join(root, directory, entry.name))
    }
  }
  return {
    name: 'markflowy-pdf-preview-assets',
    resolveId: (id) => (id === styleId ? resolvedStyleId : null),
    load(id) {
      if (id !== resolvedStyleId) return null
      return `export default ${JSON.stringify(scopePdfViewerCss(readFileSync(join(root, 'web/pdf_viewer.css'), 'utf8')))};`
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split('?')[0] ?? ''
        if (!url.startsWith(assetPrefix)) return next()
        const path = files.get(url.slice(assetPrefix.length))
        if (!path) {
          response.statusCode = 404
          response.end()
          return
        }
        const mime = path.endsWith('.wasm')
          ? 'application/wasm'
          : path.endsWith('.svg')
            ? 'image/svg+xml'
            : 'application/octet-stream'
        response.setHeader('Content-Type', mime)
        response.end(readFileSync(path))
      })
    },
    generateBundle() {
      for (const [name, path] of files)
        this.emitFile({
          type: 'asset',
          fileName: assetPrefix.slice(1) + name,
          source: readFileSync(path),
        })
    },
  }
}
