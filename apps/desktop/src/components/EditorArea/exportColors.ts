// html2canvas 1.4 only parses rgb()/hsl(). WebKit also returns CSS Color 4
// values for native disabled controls, even when the app uses hex theme tokens.
const COLOR_FUNCTION = /\b(?:color(?:-mix)?|oklab|oklch|lab|lch|hwb|light-dark)\(/i
const CSS_TOKEN = /url\(|["']|\b(?:color(?:-mix)?|oklab|oklch|lab|lch|hwb|light-dark)\(/gi
const COLOR_PROPERTIES = [
  'color',
  'background-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'text-decoration-color',
  '-webkit-text-stroke-color',
  'background-image',
  'list-style-image',
  'box-shadow',
  'text-shadow',
] as const

/** Replace whole color expressions, including nested color-mix(), but never URL/string data. */
export function normalizeExportCssValue(value: string, toRgb: (color: string) => string): string {
  if (!COLOR_FUNCTION.test(value)) return value
  const tokens = new RegExp(CSS_TOKEN)
  let result = ''
  let copiedUntil = 0
  let match: RegExpExecArray | null
  while ((match = tokens.exec(value))) {
    const token = match[0]
    const quoted = token === '"' || token === "'"
    let quote = quoted ? token : ''
    let depth = quoted ? 0 : 1
    let end = tokens.lastIndex
    for (; end < value.length; end += 1) {
      const character = value[end]
      if (character === '\\') {
        end += 1
        continue
      }
      if (quote) {
        if (character === quote) {
          quote = ''
          if (quoted) break
        }
      } else if (character === '"' || character === "'") {
        quote = character
      } else if (character === '(') {
        depth += 1
      } else if (character === ')' && --depth === 0) {
        break
      }
    }
    if (end >= value.length) break
    if (!quoted && token.toLowerCase() !== 'url(') {
      result += value.slice(copiedUntil, match.index) + toRgb(value.slice(match.index, end + 1))
      copiedUntil = end + 1
    }
    tokens.lastIndex = end + 1
  }
  return result + value.slice(copiedUntil)
}

/** Run only in html2canvas's cloned document; the live editor stays untouched. */
export function normalizeClonedExportColors(clonedDocument: Document, root: HTMLElement): void {
  const view = clonedDocument.defaultView
  if (!view) return
  const colors = new Map<string, string>()
  let context: CanvasRenderingContext2D | null = null
  const toRgb = (color: string) => {
    const cached = colors.get(color)
    if (cached) return cached
    if (!context) {
      const canvas = clonedDocument.createElement('canvas')
      canvas.width = canvas.height = 1
      context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Cannot convert export colors without a canvas context.')
    }
    // A default canvas rasterizes into sRGB, using the browser's own color
    // conversion for wide-gamut and perceptual spaces. Read alpha as well.
    context.clearRect(0, 0, 1, 1)
    context.fillStyle = color
    context.fillRect(0, 0, 1, 1)
    const [red, green, blue, alpha] = context.getImageData(0, 0, 1, 1).data
    const rgb = `rgba(${red}, ${green}, ${blue}, ${alpha / 255})`
    colors.set(color, rgb)
    return rgb
  }

  // html2canvas separately parses html/body backgrounds. Pseudo-elements have
  // already been materialized as children by DocumentCloner before onclone.
  const elements = new Set<Element>([clonedDocument.documentElement, clonedDocument.body, root])
  for (let ancestor = root.parentElement; ancestor; ancestor = ancestor.parentElement) {
    elements.add(ancestor)
  }
  root.querySelectorAll('*').forEach((element) => elements.add(element))
  for (const element of elements) {
    const inlineStyle = (element as HTMLElement).style
    if (!inlineStyle) continue
    const computed = view.getComputedStyle(element)
    const changes = COLOR_PROPERTIES.flatMap((property) => {
      const original = computed.getPropertyValue(property)
      const normalized = normalizeExportCssValue(original, toRgb)
      return original === normalized ? [] : [{ property, normalized }]
    })
    changes.forEach(({ property, normalized }) =>
      inlineStyle.setProperty(property, normalized, 'important'),
    )
  }
}
