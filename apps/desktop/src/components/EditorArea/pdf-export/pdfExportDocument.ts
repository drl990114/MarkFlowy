import { decodeLocalResource, localResourcePath } from '@/helper/localResourcePath'
import { FileResultCode, type FileSysResult } from '@markflowy/interface'
import { invoke } from '@tauri-apps/api/core'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import {
  parseFragment,
  serialize,
  defaultTreeAdapter as tree,
  type DefaultTreeAdapterTypes,
} from 'parse5'
import { escapeExportStyleText, prepareExportDocumentContent } from '../exportHtmlDocument'

export interface BuildPdfExportDocumentOptions {
  /** The prepared, hydrated static Preview, or its offscreen print container. */
  root: HTMLElement
  html: string
  title: string
  paperSize: 'a4' | 'letter'
  landscape: boolean
  fileFolderPath?: string
}

export interface PdfExportDocument {
  html: string
  /** Preliminary count; Chromium evaluates the final print document authoritatively. */
  headingCount: number
}

export const PDF_EXPORT_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  'img-src data:',
  'font-src data:',
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

const FONT_TYPES: Record<string, string> = {
  wOF2: 'font/woff2',
  wOFF: 'font/woff',
  OTTO: 'font/otf',
  ttcf: 'font/collection',
  '\u0000\u0001\u0000\u0000': 'font/ttf',
}
const MAX_FONT_BYTES = 16 * 1024 * 1024
const MAX_TOTAL_FONT_BYTES = 64 * 1024 * 1024

function assertFontBytes(bytes: Uint8Array): string {
  const signature = String.fromCharCode(...bytes.subarray(0, 4))
  if (!FONT_TYPES[signature]) throw new Error('A document font could not be read for PDF export.')
  if (bytes.byteLength > MAX_FONT_BYTES)
    throw new Error('A document font is too large for PDF export.')
  return FONT_TYPES[signature]
}

function assetFontPath(url: URL): string | undefined {
  if (
    url.protocol !== 'asset:' &&
    !(/^https?:$/.test(url.protocol) && url.hostname === 'asset.localhost')
  )
    return undefined
  const decoded = decodeLocalResource(url.pathname.slice(1))
  return /^(?:\/|[a-z]:[\\/])/i.test(decoded) ? decoded : `/${decoded}`
}

function createFontEmbedder(doc: Document) {
  const pending = new Map<string, Promise<string>>()
  const base = new URL(doc.baseURI)
  let totalBytes = 0
  return (source: string): Promise<string> => {
    const cached = pending.get(source)
    if (cached) return cached
    const result = (async () => {
      const url = new URL(source, base)
      let bytes: Uint8Array
      if (url.protocol === 'data:') {
        const comma = source.indexOf(',')
        if (
          comma < 0 ||
          !/^data:(?:font\/|application\/(?:font-|x-font-|octet-stream))/i.test(source)
        )
          throw new Error('A document font has an unsupported source for PDF export.')
        const encoded = source.slice(comma + 1)
        bytes = /;base64/i.test(source.slice(0, comma))
          ? Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0))
          : new TextEncoder().encode(decodeURIComponent(encoded))
      } else {
        const path =
          assetFontPath(url) || (url.protocol === 'file:' ? localResourcePath(url.href) : undefined)
        if (path) {
          const native = await invoke<FileSysResult>('read_u8_array_from_file', { filePath: path })
          if (native.code !== FileResultCode.Success)
            throw new Error('A document font could not be read for PDF export.')
          bytes = Uint8Array.from(atob(native.content), (character) => character.charCodeAt(0))
        } else {
          // Reuse packaged WebView assets and retained blobs. This step must
          // never request a new remote font from an arbitrary document URL.
          if (
            url.protocol !== 'blob:' &&
            (url.protocol !== base.protocol || url.host !== base.host)
          )
            throw new Error('An external document font cannot be embedded in PDF export.')
          const response = await fetch(url.href)
          if (!response.ok) throw new Error('A document font could not be read for PDF export.')
          bytes = new Uint8Array(await response.arrayBuffer())
        }
      }
      const mime = assertFontBytes(bytes)
      totalBytes += bytes.byteLength
      if (totalBytes > MAX_TOTAL_FONT_BYTES)
        throw new Error('Document fonts are too large for PDF export.')
      const chunks: string[] = []
      for (let offset = 0; offset < bytes.length; offset += 3 * 8192)
        chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 3 * 8192))))
      return `data:${mime};base64,${chunks.join('')}`
    })()
    pending.set(source, result)
    return result
  }
}

function sanitizePreparedHtml(html: string, doc: Document): string {
  // Parse data without creating a browser document, so blocked iframe/image
  // URLs cannot trigger requests before the sanitized snapshot is produced.
  const parsed = parseFragment(html)
  const blockedTags = new Set([
    'script',
    'iframe',
    'object',
    'embed',
    'base',
    'link',
    'meta',
    'template',
    'video',
    'audio',
    'canvas',
    'source',
    'animate',
    'animateMotion',
    'animateTransform',
    'set',
  ])
  const visit = (parent: DefaultTreeAdapterTypes.ParentNode) => {
    for (const element of parent.childNodes.slice()) {
      if (!tree.isElementNode(element)) continue
      if (blockedTags.has(element.tagName)) {
        tree.detachNode(element)
        continue
      }
      element.attrs = element.attrs.filter((attribute) => {
        if (
          /^on/i.test(attribute.name) ||
          ['srcdoc', 'ping', 'action', 'formaction', 'autofocus'].includes(attribute.name)
        )
          return false
        return !(
          ['href'].includes(attribute.name) &&
          /^\s*(?:javascript|vbscript|data:text\/html):/i.test(attribute.value)
        )
      })
      if (element.tagName === 'style') {
        const css = postcss.parse(
          element.childNodes
            .filter(tree.isTextNode)
            .map((node) => node.value)
            .join(''),
        )
        css.walkAtRules('import', (rule) => {
          rule.remove()
        })
        css.walkAtRules('page', (rule) => {
          rule.remove()
        })
        element.childNodes = []
        tree.insertText(element, escapeExportStyleText(css.toString()))
      }
      for (const name of ['fill', 'stroke', 'filter', 'clip-path', 'mask']) {
        const attribute = element.attrs.find((item) => item.name === name)
        const value = attribute?.value
        if (!value) continue
        const parsedValue = valueParser(value)
        parsedValue.walk((node) => {
          if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return
          const reference = valueParser
            .stringify(node.nodes)
            .trim()
            .replace(/^(['"])(.*)\1$/, '$2')
          if (!reference.startsWith('#') && !reference.startsWith(`${doc.URL.split('#')[0]}#`))
            throw new Error('An SVG resource cannot be embedded in PDF export.')
          if (reference.includes('#'))
            node.nodes = [
              {
                type: 'string',
                quote: '"',
                value: reference.slice(reference.indexOf('#')),
                sourceIndex: 0,
                sourceEndIndex: 0,
              },
            ]
          return false
        })
        attribute!.value = parsedValue.toString()
      }
      visit(element)
    }
  }
  visit(parsed)
  return serialize(parsed)
}

function normalizePrintStyles(css: string): string {
  const parsed = postcss.parse(css)
  parsed.walkAtRules('page', (rule) => {
    rule.remove()
  })
  parsed.walkRules((rule) => {
    // The preparation surface is hidden in the app. Only its descendant
    // document rules belong in the visible standalone export.
    const selectors = rule.selectors
      .filter((selector) => selector.trim() !== '.mf-pdf-print-root')
      .map((selector) => selector.replace(/\.mf-pdf-print-root\b/g, '.mf-pdf-export'))
    if (!selectors.length) rule.remove()
    else rule.selectors = selectors
  })
  return parsed.toString()
}

function printLayout(paperSize: 'a4' | 'letter', landscape: boolean): string {
  return `@page{size:${paperSize.toUpperCase()} ${landscape ? 'landscape' : 'portrait'};margin:16mm}
html,body{margin:0!important;padding:0!important;height:auto!important;min-height:0!important;overflow:visible!important}
.mf-pdf-export,.mf-pdf-export-wrapper,.mf-pdf-export .mf-preview-content{position:static!important;inset:auto!important;z-index:auto!important;display:block!important;width:auto!important;height:auto!important;min-height:0!important;max-height:none!important;max-width:100%!important;margin:0!important;padding:0!important;overflow:visible!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;content-visibility:visible!important;transform:none!important;clip:auto!important;clip-path:none!important;print-color-adjust:exact;-webkit-print-color-adjust:exact;overflow-wrap:anywhere}
.mf-pdf-export h1,.mf-pdf-export h2,.mf-pdf-export h3,.mf-pdf-export h4,.mf-pdf-export h5,.mf-pdf-export h6{break-after:avoid-page;page-break-after:avoid}
.mf-pdf-export img,.mf-pdf-export svg,.mf-pdf-export figure,.mf-pdf-export tr,.mf-pdf-export .mf-pdf-media-placeholder{break-inside:avoid;page-break-inside:avoid}
.mf-pdf-export img,.mf-pdf-export svg{max-width:100%!important;max-height:100vh!important;height:auto!important}
.mf-pdf-export pre,.mf-pdf-export code{white-space:pre-wrap!important;overflow-wrap:anywhere;word-break:break-word}
.mf-pdf-export pre{max-height:none!important;overflow:visible!important;break-inside:auto}
.mf-pdf-export table{display:table!important;width:100%!important;max-width:100%!important;table-layout:auto;overflow:visible!important}
.mf-pdf-export thead{display:table-header-group}.mf-pdf-export tfoot{display:table-footer-group}
.mf-pdf-export th,.mf-pdf-export td{overflow-wrap:anywhere;word-break:break-word}
.mf-pdf-export a{overflow-wrap:anywhere;text-decoration:underline}
.mf-pdf-export input[type=checkbox]{print-color-adjust:exact;-webkit-print-color-adjust:exact}
.mf-pdf-export .mf-preview-loading,.mf-pdf-export .mf-preview-image-progress,.mf-pdf-export [role=toolbar],.mf-pdf-export [data-radix-popper-content-wrapper]{display:none!important}`
}

function estimateHeadingCount(root: HTMLElement): number {
  return Array.from(root.querySelectorAll<HTMLElement>('h1,h2,h3,h4,h5,h6')).filter((heading) => {
    if (!heading.textContent?.trim()) return false
    const role = heading.getAttribute('role')?.trim().toLowerCase()
    if (role && role !== 'heading') return false
    const level = heading.getAttribute('aria-level')
    if (level && (!Number.isInteger(Number(level)) || Number(level) < 1 || Number(level) > 6))
      return false
    for (let ancestor: HTMLElement | null = heading; ancestor; ancestor = ancestor.parentElement) {
      if (
        ancestor.hasAttribute('hidden') ||
        ancestor.hasAttribute('inert') ||
        ancestor.getAttribute('aria-hidden')?.trim().toLowerCase() === 'true'
      )
        return false
      if (ancestor.tagName === 'DETAILS' && !ancestor.hasAttribute('open')) {
        const summary = Array.from(ancestor.children).find((child) => child.tagName === 'SUMMARY')
        if (!summary?.contains(heading)) return false
      }
      if (ancestor === root) break
    }
    return true
  }).length
}

/** Build an inert, self-contained snapshot for an external Chromium process. */
export async function buildPdfExportDocument({
  root,
  html,
  title,
  paperSize,
  landscape,
  fileFolderPath,
}: BuildPdfExportDocumentOptions): Promise<PdfExportDocument> {
  const doc = root.ownerDocument
  const preview = root.querySelector<HTMLElement>('.mf-preview-content') || root
  const safeHtml = sanitizePreparedHtml(html, doc)
  const { content, css } = await prepareExportDocumentContent(safeHtml, preview, fileFolderPath, {
    embedFont: createFontEmbedder(doc),
    styleRoot: root,
  })
  for (const element of [content, ...Array.from(content.querySelectorAll('*'))]) {
    for (const attribute of Array.from(element.attributes))
      if (/^on/i.test(attribute.name)) element.removeAttribute(attribute.name)
  }
  for (const attribute of ['hidden', 'data-mf-pdf-print-root', 'data-mf-image-export'])
    content.removeAttribute(attribute)
  content.classList.remove('mf-pdf-print-root', 'mf-html-export')
  content.classList.add('mf-preview-content')
  for (const property of [
    'display',
    'inset',
    'inset-block-start',
    'inset-inline-start',
    'z-index',
    'opacity',
    'transform',
    'clip',
    'clip-path',
    'content-visibility',
  ])
    content.style.removeProperty(property)
  const computed = doc.defaultView?.getComputedStyle(preview)
  for (const property of [
    'font-family',
    'font-size',
    'line-height',
    'color',
    'direction',
    'text-align',
  ]) {
    const value = computed?.getPropertyValue(property)
    if (value) content.style.setProperty(property, value)
  }
  const snapshot = doc.implementation.createHTMLDocument(title)
  snapshot.title = title
  snapshot.documentElement.lang = doc.documentElement.lang || 'en'
  const charset = snapshot.createElement('meta')
  charset.setAttribute('charset', 'UTF-8')
  const policy = snapshot.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = PDF_EXPORT_CSP
  const styles = snapshot.createElement('style')
  styles.textContent = escapeExportStyleText(
    `${normalizePrintStyles(css)}\n${printLayout(paperSize, landscape)}`,
  )
  snapshot.head.prepend(charset, policy)
  snapshot.head.append(styles)
  const article = snapshot.createElement('main')
  article.className = 'mf-pdf-export'
  // Styled RME rules are scoped to dynamic ancestor classes. Retain only the
  // preparation container's document wrapper chain, never its hidden shell.
  let documentRoot = content
  for (
    let source = preview.parentElement;
    source && source !== root && root.contains(source);
    source = source.parentElement
  ) {
    const wrapper = doc.createElement(source.tagName.toLowerCase())
    wrapper.className = source.className
    wrapper.classList.add('mf-pdf-export-wrapper')
    for (const attribute of ['dir', 'lang']) {
      const value = source.getAttribute(attribute)
      if (value) wrapper.setAttribute(attribute, value)
    }
    wrapper.append(documentRoot)
    documentRoot = wrapper
  }
  article.append(snapshot.adoptNode(documentRoot))
  snapshot.body.append(article)
  return {
    html: `<!DOCTYPE html>\n${snapshot.documentElement.outerHTML}`,
    headingCount: estimateHeadingCount(content),
  }
}
