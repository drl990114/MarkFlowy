import { localResourcePath } from '@/helper/localResourcePath'
import { rebaseFilePath } from '@/helper/pathIdentity'
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

export const HTML_PREVIEW_SANDBOX = ''
export const HTML_PREVIEW_TRUSTED_SANDBOX = 'allow-scripts'
export const HTML_PREVIEW_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' blob: data:",
  "style-src 'unsafe-inline' blob: data:",
  'img-src blob: data:',
  'font-src blob: data:',
  'media-src blob: data:',
  "connect-src 'none'",
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
  resourceIssues: HtmlPreviewResourceIssue[]
  dispose: () => void
}

const RESOURCE_ISSUE_REASONS = [
  'not_found',
  'permission_denied',
  'outside_root',
  'too_large',
  'unsupported',
  'invalid_css',
  'resource_limit',
  'read_failed',
] as const

export type HtmlPreviewResourceIssueReason = (typeof RESOURCE_ISSUE_REASONS)[number]

export interface HtmlPreviewResourceIssue {
  reference: string
  reason: HtmlPreviewResourceIssueReason
}

export interface HtmlPreviewOptions {
  workspacePath?: string
  /** Hosts may impose a smaller expansion budget, never raise the built-in limit. */
  maxExpandedBytes?: number
}

class PreviewResourceError extends Error {
  constructor(readonly code: HtmlPreviewResourceIssueReason) {
    super(code)
  }
}

const resourceErrorReason = (error: unknown): HtmlPreviewResourceIssueReason => {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return RESOURCE_ISSUE_REASONS.find((reason) => reason === error.code) ?? 'read_failed'
  }
  return 'read_failed'
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
const MAX_RESOURCE_BYTES = 16 * 1024 * 1024
const MAX_EXPANDED_BYTES = 96 * 1024 * 1024
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
  options: HtmlPreviewOptions = {},
): Promise<PreparedHtmlPreview> {
  const resources = new Map<string, Promise<string>>()
  const resourceIssues: HtmlPreviewResourceIssue[] = []
  const issueKeys = new Set<string>()
  let blockedResources = 0
  let totalBytes = 0
  let expandedBytes = new TextEncoder().encode(source).byteLength
  let disposed = false
  const requestedLimit = options.maxExpandedBytes
  const maxExpandedBytes =
    requestedLimit !== undefined && Number.isFinite(requestedLimit)
      ? Math.max(0, Math.min(requestedLimit, MAX_EXPANDED_BYTES))
      : MAX_EXPANDED_BYTES
  const dispose = () => {
    disposed = true
    resources.clear()
    signal.removeEventListener('abort', dispose)
  }
  signal.addEventListener('abort', dispose, { once: true })
  const checkCanceled = () => {
    signal.throwIfAborted()
    if (disposed) throw new DOMException('Preview disposed', 'AbortError')
  }
  const baseUrl = documentPath ? previewFileUrl(documentPath) : new URL('https://preview.invalid/')
  const directory = localResourcePath(new URL('.', baseUrl).href)
  const workspace = options.workspacePath
  const rootPath =
    documentPath && workspace && rebaseFilePath(documentPath, workspace, workspace)
      ? workspace
      : directory
  const reserveExpansion = (bytes: number) => {
    if (expandedBytes + bytes > maxExpandedBytes) throw new PreviewResourceError('too_large')
    expandedBytes += bytes
  }
  const blockResource = (reference: string, reason: HtmlPreviewResourceIssueReason) => {
    blockedResources++
    const key = `${reason}:${reference}`
    if (!issueKeys.has(key)) {
      issueKeys.add(key)
      resourceIssues.push({ reference, reason })
    }
    return EMPTY_RESOURCE
  }
  const makeDataUrl = (bytes: Uint8Array<ArrayBuffer>, type: string) => {
    checkCanceled()
    const prefix = `data:${type};base64,`
    reserveExpansion(prefix.length + Math.ceil(bytes.byteLength / 3) * 4)
    // Multiples of three keep padding at the end; bounded chunks avoid argument limits.
    const chunks: string[] = []
    for (let offset = 0; offset < bytes.length; offset += 3 * 8192) {
      chunks.push(btoa(String.fromCharCode(...bytes.subarray(offset, offset + 3 * 8192))))
    }
    return prefix + chunks.join('')
  }

  const isLocalResource = (url: URL) => {
    const path = localResourcePath(url.href)
    return (
      !!documentPath &&
      !!rootPath &&
      !!path &&
      url.protocol === 'file:' &&
      url.host === baseUrl.host &&
      rebaseFilePath(path, rootPath, rootPath) !== undefined
    )
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
    // Keep every preview dependency local. Allowing any remote resource would let
    // an otherwise useful inline script exfiltrate document contents through it.
    if (/^https:\/\//i.test(raw) || /^\/\//.test(raw)) {
      return blockResource(raw, 'unsupported')
    }
    if (/^data:/i.test(raw) && !stylesheet) return raw
    let url: URL
    try {
      url = new URL(raw, base)
    } catch {
      return blockResource(raw, 'unsupported')
    }
    if (!isLocalResource(url)) {
      return blockResource(raw, url.protocol === 'file:' ? 'outside_root' : 'unsupported')
    }
    const fragment = url.hash
    url.hash = ''
    url.search = ''
    const key = `${stylesheet ? 'css:' : ''}${url.href}`
    if (stack.includes(key) || stack.length >= MAX_DEPTH) {
      return blockResource(raw, 'resource_limit')
    }
    let pending = resources.get(key)
    if (!pending) {
      if (resources.size >= MAX_RESOURCES) {
        return blockResource(raw, 'resource_limit')
      }
      pending = (async () => {
        try {
          const path = localResourcePath(url.href)
          if (!path) throw new PreviewResourceError('unsupported')
          const bytes = await readResource(documentPath!, path)
          checkCanceled()
          totalBytes += bytes.byteLength
          if (bytes.byteLength > MAX_RESOURCE_BYTES || totalBytes > MAX_TOTAL_BYTES) {
            throw new PreviewResourceError('too_large')
          }
          const extension = path.split('.').pop()?.toLowerCase() ?? ''
          if (stylesheet) {
            return makeDataUrl(
              new TextEncoder().encode(
                await rewriteCss(new TextDecoder().decode(bytes), url, [...stack, key]),
              ),
              'text/css;charset=utf-8',
            )
          }
          return makeDataUrl(bytes, MIME_TYPES[extension] ?? 'application/octet-stream')
        } catch (error) {
          checkCanceled()
          return blockResource(raw, resourceErrorReason(error))
        }
      })()
      resources.set(key, pending)
    }
    const resource = await pending
    checkCanceled()
    if (resource === EMPTY_RESOURCE) return resource
    try {
      // Count every insertion, including cached references and nested CSS expansion.
      reserveExpansion(resource.length + fragment.length)
      return resource + fragment
    } catch (error) {
      return blockResource(raw, resourceErrorReason(error))
    }
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
    let sheet: postcss.Root
    try {
      sheet = postcss.parse(css)
    } catch {
      throw new PreviewResourceError('invalid_css')
    }
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
    reserveExpansion(0)
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
      // detachNode mutates this array; visit a snapshot so adjacent blocked nodes are not skipped.
      for (const node of parent.childNodes.slice()) {
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
          blockResource(get(node, 'src') ?? node.tagName, 'unsupported')
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
    const rewriteSrcset = async (node: Element) => {
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
    }

    const rewriteElementStyles = async (node: Element) => {
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
      } catch (error) {
        checkCanceled()
        blockResource(node.tagName === 'style' ? '<style>' : 'style', resourceErrorReason(error))
      }
    }

    const rewriteElement = async (node: Element) => {
      if (node.tagName === 'link') {
        if (get(node, 'rel')?.toLowerCase() !== 'stylesheet') {
          tree.detachNode(node)
          return
        }
        const href = await resolveResource(get(node, 'href') ?? '', baseUrl, [], true)
        set(node, 'href', href)
        if (href.startsWith('data:')) {
          remove(node, 'integrity')
          remove(node, 'crossorigin')
        }
      }
      if (['script', 'img', 'source', 'video', 'audio', 'input'].includes(node.tagName)) {
        for (const attribute of ['src', 'poster']) {
          const value = get(node, attribute)
          if (value !== undefined) set(node, attribute, await resolveResource(value, baseUrl, []))
        }
        if (get(node, 'src')?.startsWith('data:')) {
          remove(node, 'integrity')
          remove(node, 'crossorigin')
        }
      }
      await rewriteSrcset(node)
      await rewriteElementStyles(node)
      if (['a', 'area'].includes(node.tagName) && !get(node, 'href')?.startsWith('#')) {
        remove(node, 'href')
        remove(node, 'ping')
      }
    }
    for (const node of elements) await rewriteElement(node)
    const head = elements.find((node) => node.tagName === 'head')!
    const policy = tree.createElement('meta', html.NS.HTML, [
      { name: 'http-equiv', value: 'Content-Security-Policy' },
      { name: 'content', value: HTML_PREVIEW_CSP },
    ])
    if (head.childNodes.length) tree.insertBefore(head, policy, head.childNodes[0])
    else tree.appendChild(head, policy)
    checkCanceled()
    const serialized = serialize(doc)
    if (new TextEncoder().encode(serialized).byteLength > maxExpandedBytes) {
      throw new PreviewResourceError('too_large')
    }
    resources.clear()
    return { html: serialized, blockedResources, resourceIssues, dispose }
  } catch (error) {
    dispose()
    throw error
  }
}
