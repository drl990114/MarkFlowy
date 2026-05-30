import { mathjax } from 'mathjax-full/js/mathjax'
import { TeX } from 'mathjax-full/js/input/tex'
import { SVG } from 'mathjax-full/js/output/svg'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)

const texInput = new TeX({ packages: AllPackages })
const svgOutput = new SVG({ fontCache: 'local' })
const mathDocument = mathjax.document('', {
  InputJax: texInput,
  OutputJax: svgOutput,
})

export interface Tex2SvgOptions {
  display?: boolean
}

export function tex2svg(latex: string, options: Tex2SvgOptions = {}): string {
  const { display = false } = options

  try {
    const node = mathDocument.convert(latex || '', { display })
    const svgChild = adaptor.firstChild(node)
    return svgChild ? adaptor.outerHTML(svgChild) : adaptor.outerHTML(node)
  } catch (err) {
    console.error('[MathJax] render error:', err)
    return `<span style="color:red">${String(err)}</span>`
  }
}

export function tex2svgInline(latex: string): string {
  return tex2svg(latex, { display: false })
}

export function tex2svgDisplay(latex: string): string {
  return tex2svg(latex, { display: true })
}
