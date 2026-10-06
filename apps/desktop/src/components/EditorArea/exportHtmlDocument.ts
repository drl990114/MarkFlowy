import { getExportableImageSrc } from '@/helper/image'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import GithubSlugger from './html-export/github-slugger/index.js'

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )

function localFragment(source: string, doc: Document): string | null {
  if (source.startsWith('#')) return source
  try {
    const resource = new URL(source, doc.baseURI)
    if (!resource.hash) return null
    const fragment = resource.hash
    const current = new URL(doc.URL)
    resource.hash = ''
    current.hash = ''
    return resource.href === current.href ? fragment : null
  } catch {
    return null
  }
}

function serializeBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('An image could not be embedded in HTML.'))
    reader.onerror = () => reject(reader.error || new Error('An image could not be read.'))
    reader.readAsDataURL(blob)
  })
}

function assertStandaloneSvg(source: string): void {
  if (!/^data:image\/svg\+xml[;,]/i.test(source)) return
  const comma = source.indexOf(',')
  const encoded = source.slice(comma + 1)
  const text = /;base64/i.test(source.slice(0, comma))
    ? new TextDecoder().decode(
        Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0)),
      )
    : decodeURIComponent(encoded)
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (svg.querySelector('parsererror'))
    throw new Error('An SVG image could not be read for HTML export.')
  const isEmbedded = (value: string) => value.startsWith('#') || value.startsWith('data:')
  for (const element of Array.from(svg.querySelectorAll('image, use, feImage'))) {
    const href =
      element.getAttribute('href') || element.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
    if (href && !isEmbedded(href)) {
      throw new Error('An SVG image contains an external resource that cannot be embedded in HTML.')
    }
  }
  // Data-image SVGs cannot load external styles, images or font files. Refuse
  // those dependencies instead of exporting an apparently successful blank image.
  const css = [
    ...Array.from(svg.querySelectorAll('[style]'), (element) => element.getAttribute('style')),
    ...Array.from(svg.querySelectorAll('style'), (element) => element.textContent),
  ].join('\n')
  if (/@import\b/i.test(css) || /<\?xml-stylesheet\b/i.test(text)) {
    throw new Error('An SVG image depends on an external stylesheet.')
  }
  valueParser(css).walk((node) => {
    if (node.type === 'function' && node.value.toLowerCase() === 'url') {
      const url = valueParser
        .stringify(node.nodes)
        .trim()
        .replace(/^(['"])(.*)\1$/, '$2')
      if (!isEmbedded(url)) throw new Error('An SVG image contains an external CSS resource.')
      return false
    }
  })
}

function createImageEmbedder(fileFolderPath?: string) {
  const pending = new Map<string, Promise<string>>()
  return (source: string, renderedSource?: string): Promise<string> => {
    const key = JSON.stringify([source, renderedSource])
    const cached = pending.get(key)
    if (cached) return cached
    const result = (async () => {
      let embedded = await getExportableImageSrc(source, fileFolderPath, renderedSource)
      if (embedded.startsWith('blob:')) {
        const response = await fetch(embedded)
        if (!response.ok) throw new Error('An image could not be read for HTML export.')
        embedded = await serializeBlob(await response.blob())
      }
      if (!/^data:image\//i.test(embedded)) {
        throw new Error('An image could not be embedded in the exported HTML.')
      }
      assertStandaloneSvg(embedded)
      return embedded
    })()
    pending.set(key, result)
    return result
  }
}

type EmbedImage = ReturnType<typeof createImageEmbedder>

export interface ExportDocumentResourceOptions {
  /** PDF exports freeze the fonts used by the prepared document as data URLs. */
  embedFont?: (source: string) => Promise<string>
  /** Include the retained renderer wrappers when selecting scoped CSS rules. */
  styleRoot?: HTMLElement
}

export interface PreparedExportDocumentContent {
  content: HTMLElement
  css: string
}

async function embedCssImages(css: string, doc: Document, embed: EmbedImage): Promise<string> {
  const parsed = valueParser(css)
  const pending: Promise<void>[] = []
  parsed.walk((node) => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return
    const source = valueParser
      .stringify(node.nodes)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
    pending.push(
      (async () => {
        const embedded = localFragment(source, doc) ?? (await embed(source))
        node.nodes = [
          { type: 'string', quote: '"', value: embedded, sourceIndex: 0, sourceEndIndex: 0 },
        ]
      })(),
    )
    return false
  })
  await Promise.all(pending)
  return parsed.toString()
}

function splitSelectors(value: string): string[] {
  const selectors: string[] = []
  let start = 0
  let depth = 0
  let quote = ''
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === '\\') index += 1
    else if (quote) {
      if (character === quote) quote = ''
    } else if (character === '"' || character === "'") quote = character
    else if (character === '(' || character === '[') depth += 1
    else if (character === ')' || character === ']') depth -= 1
    else if (character === ',' && depth === 0) {
      selectors.push(value.slice(start, index).trim())
      start = index + 1
    }
  }
  return [...selectors, value.slice(start).trim()]
}

const normalizeFontFamily = (value: string) =>
  value
    .trim()
    .replace(/^(['"])(.*)\1$/, '$2')
    .toLowerCase()

async function embedFontSource(
  source: string,
  baseUrl: string,
  embed: NonNullable<ExportDocumentResourceOptions['embedFont']>,
): Promise<string> {
  // Chromium supports the first packaged URL (normally WOFF2). Keeping a
  // single embedded source avoids fetching the WOFF/TTF fallbacks as well.
  for (const candidate of splitSelectors(source)) {
    const parsed = valueParser(candidate)
    let url: valueParser.FunctionNode | undefined
    parsed.walk((node) => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        url = node
        return false
      }
    })
    if (!url) continue
    const raw = valueParser
      .stringify(url.nodes)
      .trim()
      .replace(/^(['"])(.*)\1$/, '$2')
    const embedded = await embed(new URL(raw, baseUrl).href)
    url.nodes = [{ type: 'string', quote: '"', value: embedded, sourceIndex: 0, sourceEndIndex: 0 }]
    return parsed.toString()
  }
  throw new Error('A document font has no portable source for PDF export.')
}

async function embedContentStyles(
  css: string,
  doc: Document,
  embed: EmbedImage,
  options: ExportDocumentResourceOptions,
): Promise<string> {
  if (!options.embedFont) return embedCssImages(css, doc, embed)
  const parsed = postcss.parse(css)
  parsed.walkAtRules('import', (rule) => {
    rule.remove()
  })
  const pending: Promise<void>[] = []
  parsed.walkDecls((declaration) => {
    pending.push(
      (async () => {
        const fontSource =
          declaration.prop.toLowerCase() === 'src' &&
          declaration.parent?.type === 'atrule' &&
          declaration.parent.name.toLowerCase() === 'font-face'
        declaration.value = fontSource
          ? await embedFontSource(declaration.value, doc.baseURI, options.embedFont!)
          : await embedCssImages(declaration.value, doc, embed)
      })(),
    )
  })
  await Promise.all(pending)
  return parsed.toString()
}

function matchesExport(selector: string, root: HTMLElement): boolean {
  const target = selector.replace(/::[\w-]+(?:\([^)]*\))?/g, '')
  try {
    return root.matches(target) || root.querySelector(target) !== null
  } catch {
    return false
  }
}

function addFontFallback(style: CSSStyleDeclaration, code = false): void {
  const fontFamily = style.getPropertyValue('font-family')
  if (
    fontFamily &&
    !/(?:^|,)\s*(?:system-ui|sans-serif|serif|monospace|ui-monospace)\s*(?:,|$)/i.test(fontFamily)
  ) {
    style.setProperty(
      'font-family',
      `${fontFamily}, ${code ? 'monospace' : 'system-ui, sans-serif'}`,
    )
  }
}

async function collectExportStyles(
  root: HTMLElement,
  embed: EmbedImage,
  options: ExportDocumentResourceOptions,
): Promise<string> {
  const doc = root.ownerDocument
  const usedFonts = new Set<string>()
  const fontFaces: { style: CSSStyleDeclaration; baseUrl: string }[] = []
  const collectFonts = (style: CSSStyleDeclaration) => {
    for (const family of splitSelectors(style.getPropertyValue('font-family')))
      if (family) usedFonts.add(normalizeFontFamily(family))
  }
  if (options.embedFont) {
    for (const element of [root, ...Array.from(root.querySelectorAll('*'))]) {
      const computed = doc.defaultView?.getComputedStyle(element)
      if (computed) collectFonts(computed)
    }
  }
  const readRules = async (rules: CSSRuleList, baseUrl: string): Promise<string> => {
    const selected: string[] = []
    for (const rule of Array.from(rules)) {
      if ('selectorText' in rule && 'style' in rule) {
        const styleRule = rule as CSSStyleRule
        const selectors = splitSelectors(styleRule.selectorText).filter((selector) =>
          matchesExport(selector, root),
        )
        if (!selectors.length) continue
        const style = doc.createElement('span').style
        style.cssText = styleRule.style.cssText
        if (options.embedFont) collectFonts(style)
        addFontFallback(style, /(?:pre|code|\.cm-|\.tok-)/.test(selectors.join(',')))
        selected.push(`${selectors.join(',')}{${await embedCssImages(style.cssText, doc, embed)}}`)
      } else if (options.embedFont && rule.type === 5 && 'style' in rule) {
        fontFaces.push({ style: (rule as CSSFontFaceRule).style, baseUrl })
      } else if (rule.cssText.startsWith('@layer ') && !('cssRules' in rule)) {
        selected.push(rule.cssText)
      } else if (
        'cssRules' in rule &&
        (rule.type === 4 || rule.type === 12 || rule.cssText.startsWith('@layer '))
      ) {
        const group = rule as CSSGroupingRule
        const content = await readRules(group.cssRules, baseUrl)
        if (content)
          selected.push(`${rule.cssText.slice(0, rule.cssText.indexOf('{'))}{${content}}`)
      }
      // HTML keeps stable local font fallbacks. PDF additionally freezes used
      // font faces below; neither profile imports unrelated application rules.
    }
    return selected.join('\n')
  }
  const styles: string[] = []
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      // Cross-origin host styles cannot be inspected. The preview's own styled
      // rules are same-origin CSSOM sheets and remain available here.
      if (options.embedFont)
        throw new Error('A document stylesheet could not be read for PDF export.')
      continue
    }
    styles.push(await readRules(rules, sheet.href || doc.baseURI))
  }
  for (const face of fontFaces) {
    if (!usedFonts.has(normalizeFontFamily(face.style.getPropertyValue('font-family')))) continue
    const fontCss = postcss.parse(`@font-face{${face.style.cssText}}`)
    const source = await embedFontSource(
      face.style.getPropertyValue('src'),
      face.baseUrl,
      options.embedFont!,
    )
    fontCss.walkDecls('src', (declaration) => {
      declaration.value = source
    })
    styles.push(fontCss.toString())
  }
  return styles.filter(Boolean).join('\n')
}

function copyUsedVariables(source: HTMLElement, target: HTMLElement, css: string): void {
  const computed = source.ownerDocument.defaultView?.getComputedStyle(source)
  if (!computed) return
  const names = new Set<string>()
  const collect = (value: string) => {
    for (const match of value.matchAll(/var\(\s*(--[\w-]+)/g)) names.add(match[1])
  }
  collect(css)
  for (const name of names) {
    const value = computed.getPropertyValue(name)
    if (value) {
      target.style.setProperty(name, value)
      collect(value)
    }
  }
}

function addHeadingAnchors(root: HTMLElement): void {
  const slugger = new GithubSlugger()
  const used = new Set(Array.from(root.querySelectorAll('[id]'), (element) => element.id))
  for (const heading of Array.from(root.querySelectorAll('h1,h2,h3,h4,h5,h6'))) {
    const anchor = slugger.slug(heading.textContent || '')
    if (heading.id === anchor) continue
    // Static RME headings have no IDs. Preserve an explicit ID from other
    // renderers, adding the same text anchor Capricorn publishes as an alias.
    let unique = anchor || 'heading'
    let suffix = 0
    while (used.has(unique)) unique = `${anchor || 'heading'}-${++suffix}`
    if (heading.id) {
      const alias = root.ownerDocument.createElement('span')
      alias.id = unique
      heading.prepend(alias)
    } else heading.id = unique
    used.add(unique)
  }
}

export const escapeExportStyleText = (css: string) => css.replace(/<\/style/gi, '<\\/style')

/** Prepare the already-sanitized static preview, never raw Markdown/user HTML. */
export async function prepareExportDocumentContent(
  html: string,
  root: HTMLElement | null,
  fileFolderPath?: string,
  options: ExportDocumentResourceOptions = {},
): Promise<PreparedExportDocumentContent> {
  const doc = root?.ownerDocument ?? document
  const content = (root?.cloneNode(false) as HTMLElement | undefined) ?? doc.createElement('div')
  content.innerHTML = html
  const source = root ?? content
  const embed = createImageEmbedder(fileFolderPath)
  const css = await collectExportStyles(options.styleRoot || source, embed, options)
  copyUsedVariables(source, content, css + content.outerHTML)

  for (const image of Array.from(content.querySelectorAll('img'))) {
    const rendered = image.getAttribute('src') || ''
    const original = image.getAttribute('data-rme-original-src') || rendered
    image.src = await embed(/^(?:data:|blob:)/i.test(rendered) ? rendered : original, rendered)
    image.removeAttribute('srcset')
    image.removeAttribute('loading')
    image.removeAttribute('data-rme-original-src')
  }
  for (const image of Array.from(content.querySelectorAll('svg image, svg use, svg feImage'))) {
    const href =
      image.getAttribute('href') || image.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
    if (!href) continue
    const fragment = localFragment(href, doc)
    if (!fragment && image.tagName.toLowerCase() === 'use') {
      throw new Error('An external SVG symbol could not be embedded in HTML.')
    }
    const embedded = fragment ?? (await embed(href))
    image.setAttribute('href', embedded)
    if (image.hasAttributeNS('http://www.w3.org/1999/xlink', 'href')) {
      image.removeAttribute('xlink:href')
      image.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', embedded)
    }
  }
  for (const element of [
    content,
    ...Array.from(content.querySelectorAll<HTMLElement | SVGElement>('[style]')),
  ]) {
    if (!element.style) continue
    addFontFallback(element.style, /^(?:PRE|CODE)$/.test(element.tagName))
    element.style.cssText = await embedCssImages(element.style.cssText, doc, embed)
  }
  for (const style of Array.from(content.querySelectorAll('style'))) {
    style.textContent = escapeExportStyleText(
      await embedContentStyles(style.textContent || '', doc, embed, options),
    )
  }
  content
    .querySelectorAll('.cm-copy-btn, .mf-live-preview-toolbar')
    .forEach((element) => element.remove())
  for (const element of [content, ...Array.from(content.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        attribute.name.startsWith('data-mf-preview-') ||
        attribute.name === 'data-rme-original-src'
      ) {
        element.removeAttribute(attribute.name)
      }
    }
  }
  addHeadingAnchors(content)
  for (const attribute of ['inert', 'aria-hidden', 'data-mf-image-export'])
    content.removeAttribute(attribute)
  for (const property of [
    'position',
    'left',
    'top',
    'width',
    'height',
    'overflow',
    'visibility',
    'pointer-events',
  ]) {
    content.style.removeProperty(property)
  }
  return { content, css }
}

/** Serialize the already-sanitized static preview, never raw Markdown/user HTML. */
export async function exportHtmlDocument(
  html: string,
  root: HTMLElement | null,
  title: string,
  fileFolderPath?: string,
): Promise<string> {
  const doc = root?.ownerDocument ?? document
  const { content, css } = await prepareExportDocumentContent(html, root, fileFolderPath)
  content.classList.add('mf-html-export')
  const layout =
    'html,body{margin:0;min-height:100%}.mf-html-export{box-sizing:border-box;max-width:100%;padding:clamp(16px,4vw,40px)}.mf-html-export img{max-width:100%;height:auto}'
  const styles = escapeExportStyleText(`${css}\n${layout}`)
  const bodyStyle = doc.createElement('body').style
  for (const property of ['background-color', 'color', 'font-family']) {
    bodyStyle.setProperty(property, content.style.getPropertyValue(property))
  }
  return `<!DOCTYPE html>
<html lang="${escapeHtml(doc.documentElement.lang || 'en')}">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title><style>${styles}</style></head>
<body style="${escapeHtml(bodyStyle.cssText)}">${content.outerHTML}</body></html>`
}
