import postcss, { type ChildNode } from 'postcss'
import selectorParser, { type Pseudo, type Selector } from 'postcss-selector-parser'
import { escapeExportStyleText } from '../exportHtmlDocument'
import { PDF_EXPORT_CSP } from './pdfExportDocument'

export interface PagedPdfDocumentOptions {
  paperSize: 'a4' | 'letter'
  landscape: boolean
  signal?: AbortSignal
}

export interface PagedPdfDocument {
  html: string
  pageCount: number
}

interface PagedPreviewer {
  preview: () => Promise<{ total: number }>
  chunker: {
    source?: ParentNode
    hooks: { layout: { register: (callback: (rendered: HTMLElement) => void) => void } }
  }
}

interface PagedWindow extends Window {
  PagedConfig?: { auto: false }
  Paged?: { Previewer: new () => PagedPreviewer }
}

const paginationTimeoutMs = 120_000
const pagedPolyfillUrl = '/mf-pdf-assets/pagination/paged.polyfill.min.js'

function abortError(): DOMException {
  return new DOMException('PDF pagination was cancelled.', 'AbortError')
}

function paperDimensions({ paperSize, landscape }: PagedPdfDocumentOptions) {
  const [width, height] = paperSize === 'letter' ? [215.9, 279.4] : [210, 297]
  return landscape ? { width: height, height: width } : { width, height }
}

function promoteTableHeaders(doc: Document): void {
  for (const table of doc.querySelectorAll<HTMLTableElement>('.mf-pdf-export table')) {
    if (table.querySelector(':scope > thead')) continue
    const body = table.querySelector(':scope > tbody')
    if (!body) continue
    const rows = Array.from(body.children).filter((row) => row.tagName === 'TR')
    const cells = (row: Element) => Array.from(row.children)
      .filter((cell) => cell.tagName === 'TH' || cell.tagName === 'TD')
    const headers: Element[] = []
    for (const row of rows) {
      const rowCells = cells(row)
      if (!rowCells.length || rowCells.some((cell) => cell.tagName !== 'TH')) break
      headers.push(row)
    }
    if (!headers.length || headers.some((row, index) => cells(row).some((cell) => {
      const attribute = cell.getAttribute('rowspan')
      const span = attribute === null ? 1 : Number.parseInt(attribute, 10)
      return (span === 0 && rows.length > headers.length) || span > headers.length - index
    }))) continue
    const head = doc.createElement('thead')
    table.insertBefore(head, body)
    head.append(...headers)
  }
}

function simpleSpecificity(selector: Selector): string | undefined {
  const score = [0, 0, 0]
  for (const node of selector.nodes) {
    if (node.type === 'id') score[0] += 1
    else if (node.type === 'class' || node.type === 'attribute') score[1] += 1
    else if (node.type === 'tag') score[2] += 1
    else if (node.type === 'pseudo') {
      if (node.nodes?.length) return undefined
      if (node.value.startsWith('::') || /^:(before|after|first-line|first-letter)$/.test(node.value))
        score[2] += 1
      else score[1] += 1
    }
  }
  return score.join(',')
}

function expandPagedSelector(selector: Selector): Selector[] {
  let list: { pseudo: Pseudo; ordinal: number } | undefined
  let ordinal = 0
  selector.walkPseudos((pseudo) => {
    if (!list && pseudo.nodes?.length > 1) list = { pseudo, ordinal }
    ordinal += 1
  })
  if (!list) {
    if (selector.toString().includes(','))
      throw new Error('PDF pagination does not support a comma inside this CSS selector.')
    return [selector]
  }
  const { pseudo, ordinal: targetOrdinal } = list
  const name = pseudo.value.toLowerCase()
  if (name !== ':is' && name !== ':where')
    throw new Error(`PDF pagination does not support selector lists inside ${pseudo.value}().`)
  for (let parent = pseudo.parent?.parent; parent && parent.type !== 'root'; parent = parent.parent?.parent) {
    if (parent.type !== 'pseudo' || ![':is', ':where'].includes(parent.value.toLowerCase()))
      throw new Error('PDF pagination does not support a selector list inside a negated or positional selector.')
  }
  if (name === ':is') {
    const scores = pseudo.nodes.map(simpleSpecificity)
    if (scores.some((score) => score === undefined || score !== scores[0]))
      throw new Error('PDF pagination does not support mixed-specificity or nested :is() selector lists.')
  }
  const expanded: Selector[] = []
  for (const branch of pseudo.nodes) {
    const clone = selector.clone()
    let index = 0
    clone.walkPseudos((candidate) => {
      if (index === targetOrdinal) {
        candidate.removeAll()
        candidate.append(branch.clone())
      }
      index += 1
    })
    expanded.push(...expandPagedSelector(clone))
    if (expanded.length > 128) throw new Error('The PDF stylesheet has too many selector combinations.')
  }
  return expanded
}

function normalizePagedSelectors(doc: Document, options: PagedPdfDocumentOptions): void {
  const { width, height } = paperDimensions(options)
  let selectorCount = 0
  doc.querySelectorAll('style').forEach((style) => {
    const css = postcss.parse(style.textContent ?? '')
    css.walkAtRules('page', (rule) => {
      // Paged's named-paper lookup is case sensitive (LETTER is not letter).
      // Physical dimensions avoid that ambiguity, including landscape pages.
      rule.walkDecls('size', (declaration) => { declaration.value = `${width}mm ${height}mm` })
    })
    const fonts = postcss.root()
    css.walkAtRules(/^font-face$/i, (rule) => {
      let preserved: ChildNode = rule.clone()
      for (let parent = rule.parent; parent && parent.type !== 'root'; parent = parent.parent) {
        if (parent.type !== 'atrule')
          throw new Error('A PDF font is nested inside an unsupported CSS rule.')
        const wrapper = parent.clone({ nodes: [] })
        wrapper.append(preserved)
        preserved = wrapper
      }
      fonts.append(preserved)
      rule.remove()
    })
    if (fonts.nodes.length) {
      // Large embedded font tokens exceed css-tree's offset range in Paged.js.
      // Fonts need no pagination transforms; let the browser load exact bytes.
      const retained = doc.createElement('style')
      retained.setAttribute('data-pagedjs-ignore', '')
      retained.textContent = escapeExportStyleText(fonts.toString())
      style.before(retained)
    }
    css.walkRules((rule) => {
      if (rule.parent?.type === 'atrule' && /(?:^|-)keyframes$/i.test(rule.parent.name)) return
      if (!rule.selector.includes(',')) return
      rule.selector = selectorParser((root) => {
        const expanded = root.nodes.flatMap(expandPagedSelector)
        selectorCount += expanded.length
        if (selectorCount > 4096) throw new Error('The PDF stylesheet has too many selector combinations.')
        root.removeAll()
        for (const selector of expanded) root.append(selector)
      }).processSync(rule.selector)
    })
    style.textContent = escapeExportStyleText(css.toString())
  })
}

function prepareSource(html: string, nonce: string, options: PagedPdfDocumentOptions): string {
  // The caller supplies the sanitized buildPdfExportDocument snapshot. Strip
  // executable elements again before granting the one bundled script a nonce.
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,iframe,object,embed,base,link,meta[http-equiv]')
    .forEach((element) => element.remove())
  for (const element of doc.querySelectorAll('*')) {
    for (const attribute of Array.from(element.attributes)) {
      if (/^on/i.test(attribute.name) || ['nonce', 'data-ref', 'data-mf-pdf-page'].includes(attribute.name))
        element.removeAttribute(attribute.name)
    }
  }
  promoteTableHeaders(doc)
  normalizePagedSelectors(doc, options)
  const policy = doc.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = PDF_EXPORT_CSP.replace("script-src 'none'", `script-src 'nonce-${nonce}'`)
  doc.head.prepend(policy)
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`
}

function repeatTableHeaders(previewer: PagedPreviewer): void {
  // Paged 0.4 does not copy THEAD when rebuilding a continued table. The
  // documented layout hook runs before overflow detection, so repeated rows
  // reserve real space rather than covering body rows after pagination.
  previewer.chunker.hooks.layout.register((rendered) => {
    const sourceTables = new Map(Array.from(
      previewer.chunker.source?.querySelectorAll<HTMLTableElement>('table[data-ref]') ?? [],
      (table) => [table.getAttribute('data-ref'), table],
    ))
    for (const table of rendered.querySelectorAll<HTMLTableElement>('table[data-split-from]')) {
      if (table.querySelector(':scope > thead') || !table.querySelector(':scope > tbody > tr')) continue
      const source = sourceTables.get(table.getAttribute('data-ref'))
      const header = source?.querySelector(':scope > thead')
      if (!source || !header) continue
      if (!table.querySelector(':scope > colgroup')) {
        const body = table.querySelector(':scope > tbody')
        for (const group of source.querySelectorAll(':scope > colgroup'))
          table.insertBefore(group.cloneNode(true), body)
      }
      table.insertBefore(header.cloneNode(true), table.querySelector(':scope > tbody'))
    }
  })
}

function waitForLoad(element: HTMLElement, message: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const loaded = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); reject(new Error(message)) }
    const cleanup = () => {
      element.removeEventListener('load', loaded)
      element.removeEventListener('error', failed)
    }
    element.addEventListener('load', loaded, { once: true })
    element.addEventListener('error', failed, { once: true })
  })
}

async function waitForResources(doc: Document): Promise<void> {
  await doc.fonts?.ready
  await Promise.all(Array.from(doc.images, async (image) => {
    if (!image.complete) await waitForLoad(image, 'An image could not load for PDF pagination.')
    if (!image.naturalWidth) throw new Error('An image could not load for PDF pagination.')
    if (typeof image.decode === 'function') await image.decode()
  }))
}

function installFrameScheduler(win: Window): () => void {
  const nativeRequest = win.requestAnimationFrame
  const nativeCancel = win.cancelAnimationFrame
  const pending = new Map<number, {
    animation?: number
    timer?: ReturnType<typeof setTimeout>
  }>()
  let nextId = 1
  const cancel = (id: number) => {
    const frame = pending.get(id)
    if (!frame) return
    pending.delete(id)
    if (frame.timer !== undefined) clearTimeout(frame.timer)
    if (frame.animation !== undefined) nativeCancel?.call(win, frame.animation)
  }
  win.requestAnimationFrame = (callback) => {
    const id = nextId++
    const frame: {
      animation?: number
      timer?: ReturnType<typeof setTimeout>
    } = {}
    pending.set(id, frame)
    const dispatch = (timestamp: number) => {
      if (!pending.has(id)) return
      cancel(id)
      callback(timestamp)
    }
    if (typeof nativeRequest === 'function')
      frame.animation = nativeRequest.call(win, dispatch)
    // WebKit suspends RAF in offscreen iframes. DOM measurements force layout
    // without a paint; the owning window's timer keeps pagination progressing.
    frame.timer = setTimeout(() => dispatch(win.performance.now()), 16)
    return id
  }
  win.cancelAnimationFrame = cancel
  return () => {
    for (const id of pending.keys()) cancel(id)
    win.requestAnimationFrame = nativeRequest
    win.cancelAnimationFrame = nativeCancel
  }
}

function serializePages(doc: Document, options: PagedPdfDocumentOptions): PagedPdfDocument {
  const { width, height } = paperDimensions(options)
  const pages = doc.querySelector<HTMLElement>('.pagedjs_pages')
  const pageElements = pages && Array.from(pages.children)
    .filter((element): element is HTMLElement => element.matches('.pagedjs_page'))
  if (!pages || !pageElements?.length)
    throw new Error('The document could not be paginated for PDF export.')

  // Paged.js inserts CSSOM rules. outerHTML alone would lose those rules and
  // silently change page layout when the native WebView reloads the snapshot.
  for (const style of doc.querySelectorAll('style')) {
    if (style.sheet) style.textContent = escapeExportStyleText(
      Array.from(style.sheet.cssRules, (rule) => rule.cssText).join('\n'),
    )
  }
  const snapshot = doc.cloneNode(true) as Document
  const outputPages = snapshot.importNode(pages, true)
  outputPages.classList.add('mf-pdf-pages')
  outputPages.querySelectorAll('[data-mf-pdf-page]').forEach((element) =>
    element.removeAttribute('data-mf-pdf-page'),
  )
  Array.from(outputPages.children).forEach((page, index) => {
    page.setAttribute('data-mf-pdf-page', String(index + 1))
  })
  snapshot.body.replaceChildren(outputPages)
  snapshot.querySelectorAll('script,template,meta[http-equiv]').forEach((element) => element.remove())
  const policy = snapshot.createElement('meta')
  policy.httpEquiv = 'Content-Security-Policy'
  policy.content = PDF_EXPORT_CSP
  snapshot.head.prepend(policy)
  const finalStyle = snapshot.createElement('style')
  finalStyle.dataset.mfPdfPages = ''
  // The original 16mm margins have already become Paged.js page furniture.
  // Native printing must not paginate them a second time or add outer margins.
  finalStyle.textContent = `
@page{size:${width}mm ${height}mm;margin:0}
html,body{width:${width}mm!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;overflow:visible!important}
.mf-pdf-pages.pagedjs_pages{display:block!important;width:${width}mm!important;height:auto!important;min-height:0!important;max-height:none!important;margin:0!important;padding:0!important;gap:0!important;transform:none!important}
.mf-pdf-pages>[data-mf-pdf-page]{box-sizing:border-box!important;position:relative!important;display:block!important;width:${width}mm!important;min-width:${width}mm!important;max-width:${width}mm!important;height:${height}mm!important;min-height:${height}mm!important;max-height:${height}mm!important;margin:0!important;padding:0!important;border:0!important;overflow:hidden!important;transform:none!important;break-inside:avoid!important;page-break-inside:avoid!important;break-after:page!important;page-break-after:always!important}
.mf-pdf-pages>[data-mf-pdf-page]:last-child{break-after:auto!important;page-break-after:auto!important}
.mf-pdf-pages>[data-mf-pdf-page]>.pagedjs_sheet{height:${height}mm!important;min-height:${height}mm!important;max-height:${height}mm!important}
/* WebKit truncates printable height to whole CSS pixels. Leave the rounding
   slack in the blank bottom margin, keeping page furniture and content intact. */
@media print{.mf-pdf-pages>[data-mf-pdf-page]{height:calc(${height}mm - 1px)!important;min-height:calc(${height}mm - 1px)!important;max-height:calc(${height}mm - 1px)!important}}
`
  snapshot.head.append(finalStyle)
  return { html: `<!DOCTYPE html>\n${snapshot.documentElement.outerHTML}`, pageCount: pageElements.length }
}

/** Paginate a sanitized, self-contained PDF snapshot without touching the editor. */
export async function preparePagedPdfDocument(
  html: string,
  options: PagedPdfDocumentOptions,
): Promise<PagedPdfDocument> {
  if (options.signal?.aborted) throw abortError()
  const nonceBytes = crypto.getRandomValues(new Uint8Array(16))
  const nonce = Array.from(nonceBytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  const iframe = document.createElement('iframe')
  const { width, height } = paperDimensions(options)
  iframe.dataset.mfPdfPagination = ''
  iframe.title = 'PDF pagination'
  iframe.setAttribute('aria-hidden', 'true')
  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin')
  iframe.tabIndex = -1
  iframe.style.cssText = `position:fixed!important;left:-100000px!important;top:0!important;width:${width}mm!important;height:${height}mm!important;border:0!important;opacity:0!important;pointer-events:none!important;`
  iframe.srcdoc = prepareSource(html, nonce, options)
  let active = true
  const ensureActive = () => {
    if (!active || options.signal?.aborted) throw abortError()
  }
  let timeout: ReturnType<typeof setTimeout> | undefined
  let handleAbort: (() => void) | undefined
  let restoreFrameScheduler: (() => void) | undefined
  const interrupted = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error('PDF pagination timed out.')), paginationTimeoutMs)
    handleAbort = () => reject(abortError())
    options.signal?.addEventListener('abort', handleAbort, { once: true })
  })
  try {
    const loaded = waitForLoad(iframe, 'The PDF pagination surface could not load.')
    document.body.append(iframe)
    const paginate = async () => {
      await loaded
      ensureActive()
      const doc = iframe.contentDocument
      const win = iframe.contentWindow as PagedWindow | null
      if (!doc || !win) throw new Error('The PDF pagination surface is unavailable.')
      // Queue captures RAF while evaluating the library, before preview().
      restoreFrameScheduler = installFrameScheduler(win)
      win.PagedConfig = { auto: false }
      const script = doc.createElement('script')
      script.nonce = nonce
      script.src = pagedPolyfillUrl
      const scriptLoaded = waitForLoad(script, 'The bundled PDF paginator could not load.')
      doc.head.append(script)
      await scriptLoaded
      ensureActive()
      if (!win.Paged?.Previewer) throw new Error('The bundled PDF paginator is unavailable.')
      await waitForResources(doc)
      ensureActive()
      const previewer = new win.Paged.Previewer()
      repeatTableHeaders(previewer)
      await previewer.preview()
      ensureActive()
      await waitForResources(doc)
      ensureActive()
      return serializePages(doc, options)
    }
    return await Promise.race([paginate(), interrupted])
  } finally {
    active = false
    if (timeout !== undefined) clearTimeout(timeout)
    if (handleAbort) options.signal?.removeEventListener('abort', handleAbort)
    restoreFrameScheduler?.()
    iframe.remove()
  }
}
