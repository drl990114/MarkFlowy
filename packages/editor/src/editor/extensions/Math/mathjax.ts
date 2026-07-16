import { mathjax } from 'mathjax-full/js/mathjax'
import { TeX } from 'mathjax-full/js/input/tex'
import { SVG } from 'mathjax-full/js/output/svg'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor'
import type { LiteElement } from 'mathjax-full/js/adaptors/lite/Element'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html'
import { AllPackages } from 'mathjax-full/js/input/tex/AllPackages'
import { SafeHandler } from 'mathjax-full/js/ui/safe/SafeHandler'

const adaptor = liteAdaptor()
SafeHandler(RegisterHTMLHandler(adaptor))

const texInput = new TeX({ packages: AllPackages.filter((packageName) => packageName !== 'html') })
const svgOutput = new SVG({ fontCache: 'none' })
const mathDocument = mathjax.document('', {
  InputJax: texInput,
  OutputJax: svgOutput,
})

export interface Tex2SvgOptions {
  display?: boolean
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export function tex2svg(latex: string, options: Tex2SvgOptions = {}): string {
  const { display = false } = options

  try {
    const node = mathDocument.convert(latex || '', { display })
    const svgChild = adaptor.firstChild(node)
    return adaptor.outerHTML((svgChild || node) as LiteElement)
  } catch (err) {
    console.error('[MathJax] render error:', err)
    return `<span class="mf-math-error">${escapeHtml(String(err))}</span>`
  }
}

export function tex2svgInline(latex: string): string {
  return tex2svg(latex, { display: false })
}

export function tex2svgDisplay(latex: string): string {
  return tex2svg(latex, { display: true })
}
