import { localResourcePath } from '@/helper/localResourcePath'
import { invoke } from '@tauri-apps/api/core'
import postcss from 'postcss'
import valueParser from 'postcss-value-parser'
import {
  parse,
  serialize,
  defaultTreeAdapter as tree,
  html,
  type DefaultTreeAdapterTypes,
} from 'parse5'

export const HTML_PREVIEW_SANDBOX = 'allow-scripts'
export const HTML_PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob: https:",
  "style-src 'unsafe-inline' blob: https:",
  'img-src blob: data: https:',
  'font-src blob: data: https:',
  'media-src blob: data: https:',
  'connect-src https:',
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

export interface HtmlPreviewResourceReader {
  (documentPath: string, resourcePath: string): Promise<Uint8Array<ArrayBuffer>>
}

export interface PreparedHtmlPreview {
  html: string
  blockedResources: number
  dispose: () => void
}

const MIME_TYPES: Record<string, string> = {
  css: 'text/css',
  js: 'text/javascript',
  cjs: 'text/javascript',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  avif: 'image/avif',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
  mp3: 'audio/mpeg',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogg: 'audio/ogg',
}
const EMPTY_RESOURCE = 'data:,'
const MAX_TOTAL_BYTES = 64 * 1024 * 1024
const MAX_RESOURCES = 256
const MAX_DEPTH = 8

export function previewFileUrl(path: string): URL {
  const normalized = path.replace(/\\/g, '/')
  const url = new URL('file:///')
  // Encode segments separately; #, %, and ? may be part of a filename.
  if (normalized.startsWith('//')) {
    const [host, ...segments] = normalized.slice(2).split('/')
    url.hostname = host
    url.pathname = '/' + segments.map(encodeURIComponent).join('/')
  } else {
    url.pathname = normalized.split('/').map(encodeURIComponent).join('/')
  }
  return url
}

const readNativeResource: HtmlPreviewResourceReader = async (documentPath, resourcePath) => {
  const result = await invoke<{ content: string }>('read_html_preview_resource', {
    documentPath,
    resourcePath,
  })
  return Uint8Array.from(atob(result.content), (character) => character.charCodeAt(0))
}

/** Only the disposable preview copy is parsed or rewritten. The editor owns the original bytes. */
export async function prepareHtmlPreview(
  source: string,
  documentPath: string | undefined,
  signal: AbortSignal,
  readResource: HtmlPreviewResourceReader = readNativeResource,
): Promise<PreparedHtmlPreview> {
  const objectUrls: string[] = []
  const resources = new Map<string, Promise<string>>()
  let blockedResources = 0
  let totalBytes = 0
  const dispose = () => {
    objectUrls.splice(0).forEach((url) => URL.revokeObjectURL(url))
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  const checkCanceled = () => signal.throwIfAborted()
  const baseUrl = documentPath ? previewFileUrl(documentPath) : new URL('https://preview.invalid/')
  const rootUrl = new URL('.', baseUrl)
  const makeBlob = (data: BlobPart, type: string) => {
    checkCanceled()
    const url = URL.createObjectURL(new Blob([data], { type }))
    objectUrls.push(url)
    return url
  }

  const resolveResource = async (
    value: string,
    base: URL,
    stack: string[],
    stylesheet = false,
  ): Promise<string> => {
    checkCanceled()
    const raw = value.trim()
    if (!raw || raw.startsWith('#')) return raw
    // Remote resources retain their URL semantics. HTTP, file access outside the
    // declared dependency tree, and pre-existing blob URLs are not accepted.
    if (/^https:\/\//i.test(raw)) return raw
    if (/^\/\//.test(raw)) return `https:${raw}`
    if (/^data:/i.test(raw) && !stylesheet) return raw
    let url: URL
    try {
      url = new URL(raw, base)
    } catch {
      blockedResources++
      return EMPTY_RESOURCE
    }
    if (
      url.protocol === 'https:' &&
      base.protocol === 'https:' &&
      base.hostname !== 'preview.invalid'
    )
      return url.href
    if (
      !documentPath ||
      url.protocol !== 'file:' ||
      url.host !== rootUrl.host ||
      !url.pathname.startsWith(rootUrl.pathname)
    ) {
      blockedResources++
      return EMPTY_RESOURCE
    }
    const fragment = url.hash
    url.hash = ''
    url.search = ''
    const key = `${stylesheet ? 'css:' : ''}${url.href}`
    if (stack.includes(key) || stack.length >= MAX_DEPTH) {
      blockedResources++
      return EMPTY_RESOURCE
    }
    let pending = resources.get(key)
    if (!pending) {
      if (resources.size >= MAX_RESOURCES) {
        blockedResources++
        return EMPTY_RESOURCE
      }
      pending = (async () => {
        try {
          const path = localResourcePath(url.href)
          if (!path) throw new Error('Invalid resource path')
          const bytes = await readResource(documentPath, path)
          checkCanceled()
          totalBytes += bytes.byteLength
          if (totalBytes > MAX_TOTAL_BYTES) throw new Error('Preview resources exceed 64 MiB')
          const extension = path.split('.').pop()?.toLowerCase() ?? ''
          if (stylesheet) {
            return makeBlob(
              await rewriteCss(new TextDecoder().decode(bytes), url, [...stack, key]),
              'text/css',
            )
          }
          return makeBlob(bytes, MIME_TYPES[extension] ?? 'application/octet-stream')
        } catch (error) {
          checkCanceled()
          blockedResources++
          return EMPTY_RESOURCE
        }
      })()
      resources.set(key, pending)
    }
    return (await pending) + fragment
  }

  const rewriteCssValue = async (value: string, base: URL, stack: string[], isImport = false) => {
    const parsed = valueParser(value)
    const tasks: Promise<void>[] = []
    parsed.walk((node) => {
      if (node.type === 'function' && node.value.toLowerCase() === 'url') {
        const resource =
          node.nodes.length === 1 && node.nodes[0].type === 'string'
            ? node.nodes[0].value
            : valueParser.stringify(node.nodes)
        tasks.push(
          resolveResource(resource, base, stack, isImport).then((url) => {
            node.nodes = [
              { type: 'string', quote: '"', value: url, sourceIndex: 0, sourceEndIndex: 0 },
            ]
          }),
        )
        return false
      }
    })
    const first = parsed.nodes.find((node) => node.type !== 'space' && node.type !== 'comment')
    if (isImport && first?.type === 'string') {
      tasks.push(
        resolveResource(first.value, base, stack, true).then((url) => {
          first.value = url
        }),
      )
    }
    await Promise.all(tasks)
    return parsed.toString()
  }

  const rewriteCss = async (css: string, base: URL, stack: string[]) => {
    const sheet = postcss.parse(css)
    // Resolve sequentially: an import cycle must never wait on its own cached promise.
    const nodes: { value: string; set: (value: string) => void; isImport: boolean }[] = []
    sheet.walkDecls((decl) => {
      nodes.push({
        value: decl.value,
        set: (value) => {
          decl.value = value
        },
        isImport: false,
      })
    })
    sheet.walkAtRules('import', (rule) => {
      nodes.push({
        value: rule.params,
        set: (value) => {
          rule.params = value
        },
        isImport: true,
      })
    })
    for (const node of nodes)
      node.set(await rewriteCssValue(node.value, base, stack, node.isImport))
    return sheet.toString()
  }

  try {
    checkCanceled()
    // Parse data, never a live DOM: no script execution, custom element upgrade,
    // or resource request is possible before the sandbox receives the document.
    const doc = parse(source)
    type Element = DefaultTreeAdapterTypes.Element
    const elements: Element[] = []
    const get = (node: Element, name: string) =>
      node.attrs.find((attr) => attr.name === name)?.value
    const set = (node: Element, name: string, value: string) => {
      const attr = node.attrs.find((item) => item.name === name)
      if (attr) attr.value = value
      else node.attrs.push({ name, value })
    }
    const remove = (node: Element, name: string) => {
      node.attrs = node.attrs.filter((attr) => attr.name !== name)
    }
    const visit = (parent: DefaultTreeAdapterTypes.ParentNode) => {
      for (const node of [...parent.childNodes]) {
        if (!tree.isElementNode(node)) continue
        if (
          ['base', 'iframe', 'object', 'embed'].includes(node.tagName) ||
          (node.tagName === 'meta' && get(node, 'http-equiv') !== undefined)
        ) {
          tree.detachNode(node)
          continue
        }
        if (
          node.tagName === 'script' &&
          ['module', 'importmap'].includes(get(node, 'type')?.trim().toLowerCase() ?? '')
        ) {
          tree.detachNode(node)
          blockedResources++
          continue
        }
        elements.push(node)
        visit(
          node.tagName === 'template'
            ? tree.getTemplateContent(node as DefaultTreeAdapterTypes.Template)
            : node,
        )
      }
    }
    visit(doc)
    for (const node of elements) {
      if (node.tagName === 'link') {
        if (get(node, 'rel')?.toLowerCase() !== 'stylesheet') {
          tree.detachNode(node)
          continue
        }
        const href = await resolveResource(get(node, 'href') ?? '', baseUrl, [], true)
        set(node, 'href', href)
        if (href.startsWith('blob:') || href === EMPTY_RESOURCE) {
          remove(node, 'integrity')
          remove(node, 'crossorigin')
        }
      }
      if (['script', 'img', 'source', 'video', 'audio', 'input'].includes(node.tagName)) {
        for (const attribute of ['src', 'poster']) {
          const value = get(node, attribute)
          if (value !== undefined) set(node, attribute, await resolveResource(value, baseUrl, []))
        }
        if (get(node, 'src')?.startsWith('blob:') || get(node, 'src') === EMPTY_RESOURCE) {
          remove(node, 'integrity')
          remove(node, 'crossorigin')
        }
      }
      const srcset = get(node, 'srcset')
      if (srcset !== undefined) {
        // Data URLs contain commas; the URL token ends at whitespace in that case.
        const candidates = srcset.match(/(?:data:[^\s]+|[^\s,]+)(?:\s+[^,]+)?(?:,|$)/g) ?? []
        const converted: string[] = []
        for (const candidate of candidates) {
          const [url, ...descriptor] = candidate.replace(/,$/, '').trim().split(/\s+/)
          converted.push([await resolveResource(url, baseUrl, []), ...descriptor].join(' '))
        }
        set(node, 'srcset', converted.join(', '))
      }
      try {
        if (node.tagName === 'style') {
          const css = node.childNodes
            .filter(tree.isTextNode)
            .map((child) => child.value)
            .join('')
          const rewritten = await rewriteCss(css, baseUrl, [])
          node.childNodes = []
          tree.insertText(node, rewritten)
        }
        const style = get(node, 'style')
        if (style !== undefined) set(node, 'style', await rewriteCss(style, baseUrl, []))
      } catch {
        checkCanceled()
        blockedResources++
      }
      if (['a', 'area'].includes(node.tagName) && !get(node, 'href')?.startsWith('#')) {
        remove(node, 'href')
        remove(node, 'ping')
      }
    }
    const head = elements.find((node) => node.tagName === 'head')!
    const policy = tree.createElement('meta', html.NS.HTML, [
      { name: 'http-equiv', value: 'Content-Security-Policy' },
      { name: 'content', value: HTML_PREVIEW_CSP },
    ])
    if (head.childNodes.length) tree.insertBefore(head, policy, head.childNodes[0])
    else tree.appendChild(head, policy)
    checkCanceled()
    return { html: serialize(doc), blockedResources, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
