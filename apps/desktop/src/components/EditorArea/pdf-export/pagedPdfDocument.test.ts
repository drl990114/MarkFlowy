// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import postcss from 'postcss'
import { preparePagedPdfDocument } from './pagedPdfDocument'
import { PDF_EXPORT_CSP } from './pdfExportDocument'

const options = { paperSize: 'a4', landscape: false } as const
const html = `<!DOCTYPE html><html lang="zh-CN"><head><title>中文 PDF</title><style>@page{size:A4 portrait;margin:16mm}.mf-pdf-export{font-family:TestFont}@font-face{font-family:TestFont;src:url(data:font/ttf;base64,AAAA)}</style></head><body><main class="mf-pdf-export"><h1>中文标题</h1><p>Mixed text <span class="mf-preview-math-inline"><svg style="vertical-align:-0.2ex"><path d="M0 0L2 2"/></svg></span></p></main></body></html>`

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => { resolve = done })
  return { promise, resolve }
}

interface SurfaceOptions {
  fonts?: Promise<unknown>
  preview?: (doc: Document, context: {
    source: DocumentFragment
    layout: (rendered: HTMLElement) => void
  }) => Promise<{ total: number }>
  scriptError?: boolean
  beforeLoad?: (doc: Document) => void
}

function installSurface(configuration: SurfaceOptions = {}) {
  const observed: {
    iframe?: HTMLIFrameElement
    source?: Document
    script?: HTMLScriptElement
    config?: unknown
  } = {}
  const layoutCallbacks: ((rendered: HTMLElement) => void)[] = []
  const preview = vi.fn(async (doc: Document, source: DocumentFragment) => {
    if (configuration.preview) return configuration.preview(doc, {
      source, layout: (rendered) => layoutCallbacks.forEach((callback) => callback(rendered)),
    })
    const content = doc.querySelector('.mf-pdf-export')!
    const pages = doc.createElement('div')
    pages.className = 'pagedjs_pages'
    pages.style.setProperty('--pagedjs-page-count', '2')
    for (let index = 0; index < 2; index += 1) {
      const page = doc.createElement('div')
      page.className = 'pagedjs_page'
      const sheet = doc.createElement('div')
      sheet.className = 'pagedjs_sheet'
      if (index === 0) sheet.append(content)
      else sheet.innerHTML = '<h2>第二页</h2>'
      page.append(sheet)
      pages.append(page)
    }
    doc.body.replaceChildren(pages)
    const generated = doc.createElement('style')
    doc.head.append(generated)
    generated.sheet!.insertRule('.pagedjs_page{--generated-rule:retained}', 0)
    return { total: 2 }
  })
  const append = document.body.append.bind(document.body)
  vi.spyOn(document.body, 'append').mockImplementation((...nodes) => {
    append(...nodes)
    const iframe = nodes.find((node): node is HTMLIFrameElement =>
      typeof node !== 'string' && node.nodeName === 'IFRAME',
    )
    if (!iframe) return
    observed.iframe = iframe
    const doc = iframe.contentDocument!
    observed.source = doc
    doc.open()
    doc.write(iframe.srcdoc)
    doc.close()
    Object.defineProperty(doc, 'fonts', {
      configurable: true,
      value: { ready: configuration.fonts ?? Promise.resolve() },
    })
    configuration.beforeLoad?.(doc)
    const headAppend = doc.head.append.bind(doc.head)
    vi.spyOn(doc.head, 'append').mockImplementation((...children) => {
      headAppend(...children)
      for (const child of children) {
        if (typeof child === 'string' || child.nodeName !== 'SCRIPT') continue
        observed.script = child as HTMLScriptElement
        observed.config = (iframe.contentWindow as unknown as { PagedConfig?: unknown }).PagedConfig
        queueMicrotask(() => child.dispatchEvent(new Event(configuration.scriptError ? 'error' : 'load')))
      }
    })
    Object.defineProperty(iframe.contentWindow, 'Paged', {
      configurable: true,
      value: { Previewer: class {
        chunker = {
          source: doc.createDocumentFragment(),
          hooks: { layout: { register: (callback: (rendered: HTMLElement) => void) => layoutCallbacks.push(callback) } },
        }

        preview = () => {
          this.chunker.source.append(...Array.from(doc.body.childNodes, (node) => node.cloneNode(true)))
          return preview(doc, this.chunker.source)
        }
      } },
    })
    queueMicrotask(() => iframe.dispatchEvent(new Event('load')))
  })
  return { observed, preview }
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  document.body.replaceChildren()
})

describe('isolated Paged.js PDF document preparation', () => {
  it('returns only fixed physical pages while retaining CSSOM rules, SVG and embedded fonts', async () => {
    const initialHead = document.head.innerHTML
    const { observed } = installSurface()
    const result = await preparePagedPdfDocument(html, options)
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    expect(result.pageCount).toBe(2)
    expect(doc.querySelectorAll('.mf-pdf-pages')).toHaveLength(1)
    expect(doc.body.children).toHaveLength(1)
    expect(doc.querySelectorAll('.mf-pdf-pages > .pagedjs_page[data-mf-pdf-page]')).toHaveLength(2)
    expect(Array.from(doc.querySelectorAll('[data-mf-pdf-page]'), (page) => page.getAttribute('data-mf-pdf-page')))
      .toEqual(['1', '2'])
    expect(doc.querySelector('svg path')?.getAttribute('d')).toBe('M0 0L2 2')
    expect(doc.querySelector('svg')?.getAttribute('style')).toBe('vertical-align:-0.2ex')
    expect(doc.querySelector('.mf-preview-math-inline')?.getAttribute('style')).toBeNull()
    expect(doc.head.textContent).toContain('data:font/ttf;base64,AAAA')
    expect(doc.head.textContent).toContain('--generated-rule: retained')
    expect(doc.querySelector('style[data-mf-pdf-pages]')?.textContent).toContain('size:210mm 297mm;margin:0')
    expect(doc.querySelector('style[data-mf-pdf-pages]')?.textContent).toContain('break-after:auto!important')
    expect(doc.querySelector('meta[http-equiv]')?.getAttribute('content')).toBe(PDF_EXPORT_CSP)
    expect(doc.querySelector('script,template,iframe')).toBeNull()
    expect(observed.iframe?.isConnected).toBe(false)
    expect(document.head.innerHTML).toBe(initialHead)
    expect((window as unknown as { Paged?: unknown }).Paged).toBeUndefined()
  })

  it.each([
    ['a4', true, '297mm 210mm'],
    ['letter', false, '215.9mm 279.4mm'],
    ['letter', true, '279.4mm 215.9mm'],
  ] as const)('retains exact %s landscape=%s page geometry', async (paperSize, landscape, dimensions) => {
    installSurface()
    const result = await preparePagedPdfDocument(html, { paperSize, landscape })
    expect(result.html).toContain(`size:${dimensions};margin:0`)
  })

  it.each([
    ['a4', false, 297],
    ['a4', true, 210],
    ['letter', false, 279.4],
    ['letter', true, 215.9],
  ] as const)('reserves print-only rounding slack for %s landscape=%s without resizing the screen page or its contents', async (paperSize, landscape, height) => {
    installSurface()
    const result = await preparePagedPdfDocument(html, { paperSize, landscape })
    const doc = new DOMParser().parseFromString(result.html, 'text/html')
    const css = postcss.parse(doc.querySelector('style[data-mf-pdf-pages]')!.textContent!)
    const outer = '.mf-pdf-pages>[data-mf-pdf-page]'
    const sheet = `${outer}>.pagedjs_sheet`
    const screenSizes: string[] = []
    const sheetSizes: string[] = []
    const printedSizes: string[] = []
    css.walkRules((rule) => {
      if (![outer, sheet].includes(rule.selector)) return
      const printOnly = rule.parent?.type === 'atrule' && rule.parent.name === 'media' && rule.parent.params === 'print'
      rule.walkDecls(/^(height|min-height|max-height)$/, (declaration) => {
        expect(declaration.important).toBe(true)
        if (printOnly) {
          expect(rule.selector).toBe(outer)
          printedSizes.push(declaration.value)
        } else if (rule.selector === outer) screenSizes.push(declaration.value)
        else sheetSizes.push(declaration.value)
      })
    })
    expect(screenSizes).toEqual(Array(3).fill(`${height}mm`))
    expect(sheetSizes).toEqual(Array(3).fill(`${height}mm`))
    expect(printedSizes).toEqual(Array(3).fill(`calc(${height}mm - 1px)`))
  })

  it('sets physical page size before Paged sees uppercase named-paper CSS', async () => {
    installSurface({ beforeLoad: (doc) => {
      const sizes: string[] = []
      for (const style of doc.querySelectorAll('style')) postcss.parse(style.textContent ?? '').walkAtRules('page', (rule) => {
        rule.walkDecls('size', (declaration) => { sizes.push(declaration.value) })
        expect(rule.toString()).toContain('margin:16mm')
      })
      expect(sizes).toEqual(['279.4mm 215.9mm'])
    } })
    await preparePagedPdfDocument(html.replace('A4 portrait', 'LETTER landscape'), { paperSize: 'letter', landscape: true })
  })

  it('grants a nonce to only the bundled script and disables automatic pagination', async () => {
    const { observed, preview } = installSurface()
    const source = html.replace('</head>', '<script>alert(1)</script><meta http-equiv="refresh" content="0;url=https://example.com"></head>')
      .replace('<h1>', '<h1 onclick="alert(2)" nonce="authored" data-ref="collision" data-mf-pdf-page="fake">')
    const result = await preparePagedPdfDocument(source, options)
    expect(observed.script?.src).toContain('paged.polyfill.min.js')
    expect(observed.script?.nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(observed.iframe?.srcdoc).toContain(`script-src 'nonce-${observed.script?.nonce}'`)
    expect(observed.iframe?.srcdoc).not.toMatch(/onclick=|<script|http-equiv="refresh"|nonce="authored"|data-ref=|data-mf-pdf-page=/)
    expect(observed.config).toEqual({ auto: false })
    expect(preview).toHaveBeenCalledOnce()
    expect(result.html).not.toContain("script-src 'nonce-")
  })

  it('waits for document fonts before starting pagination', async () => {
    const fonts = deferred<void>()
    const { preview } = installSurface({ fonts: fonts.promise })
    const pending = preparePagedPdfDocument(html, options)
    await vi.waitFor(() => expect(document.querySelector('iframe')).not.toBeNull())
    await Promise.resolve()
    expect(preview).not.toHaveBeenCalled()
    fonts.resolve()
    await pending
    expect(preview).toHaveBeenCalledOnce()
  })

  it('waits for embedded images and their decoding before pagination', async () => {
    let image!: HTMLImageElement
    const decoded = vi.fn(async () => {})
    let loading: ReturnType<typeof vi.spyOn>
    const { preview } = installSurface({ beforeLoad: (doc) => {
      image = doc.querySelector('img')!
      Object.defineProperty(image, 'complete', { configurable: true, value: false })
      Object.defineProperty(image, 'decode', { configurable: true, value: decoded })
      loading = vi.spyOn(image, 'addEventListener')
    } })
    const pending = preparePagedPdfDocument(html.replace('</main>', '<img src="data:image/png;base64,AAAA"></main>'), options)
    await vi.waitFor(() => expect(loading).toHaveBeenCalledWith('load', expect.any(Function), { once: true }))
    expect(preview).not.toHaveBeenCalled()
    Object.defineProperty(image, 'complete', { configurable: true, value: true })
    Object.defineProperty(image, 'naturalWidth', { configurable: true, value: 10 })
    image.dispatchEvent(new Event('load'))
    await pending
    expect(decoded).toHaveBeenCalled()
    expect(preview).toHaveBeenCalledOnce()
  })

  it('rejects broken images rather than paginating before resources settle', async () => {
    const { observed, preview } = installSurface({ beforeLoad: (doc) => {
      const image = doc.querySelector('img')!
      Object.defineProperty(image, 'complete', { configurable: true, value: true })
    } })
    await expect(preparePagedPdfDocument(html.replace('</main>', '<img src="data:image/png;base64,AAAA"></main>'), options))
      .rejects.toThrow('image could not load')
    expect(preview).not.toHaveBeenCalled()
    expect(observed.iframe?.isConnected).toBe(false)
  })

  it('rejects an already aborted operation without creating a surface', async () => {
    const controller = new AbortController()
    controller.abort()
    const { observed } = installSurface()
    await expect(preparePagedPdfDocument(html, { ...options, signal: controller.signal }))
      .rejects.toMatchObject({ name: 'AbortError' })
    expect(observed.iframe).toBeUndefined()
  })

  it('removes the owned iframe immediately when cancelled during font loading', async () => {
    const controller = new AbortController()
    const fonts = deferred<void>()
    const { observed, preview } = installSurface({ fonts: fonts.promise })
    const pending = preparePagedPdfDocument(html, { ...options, signal: controller.signal })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.waitFor(() => expect(observed.script).toBeDefined())
    controller.abort()
    await rejected
    fonts.resolve()
    await Promise.resolve()
    expect(observed.iframe?.isConnected).toBe(false)
    expect(preview).not.toHaveBeenCalled()
  })

  it('cleans up after paginator errors and leaves the application document intact', async () => {
    document.body.innerHTML = '<main id="editor">Original editor</main>'
    const { observed } = installSurface({ preview: async () => { throw new Error('Layout failed') } })
    await expect(preparePagedPdfDocument(html, options)).rejects.toThrow('Layout failed')
    expect(observed.iframe?.isConnected).toBe(false)
    expect(document.body.innerHTML).toBe('<main id="editor">Original editor</main>')
  })

  it('cleans up when the bundled script fails to load', async () => {
    const { observed } = installSurface({ scriptError: true })
    await expect(preparePagedPdfDocument(html, options)).rejects.toThrow('bundled PDF paginator could not load')
    expect(observed.iframe?.isConnected).toBe(false)
  })

  it('fails rather than printing an unpaginated source document', async () => {
    const { observed } = installSurface({ preview: async () => ({ total: 0 }) })
    await expect(preparePagedPdfDocument(html, options)).rejects.toThrow('could not be paginated')
    expect(observed.iframe?.isConnected).toBe(false)
  })

  it('times out and cleans up when pagination never settles', async () => {
    vi.useFakeTimers()
    const { observed } = installSurface({ preview: () => new Promise(() => {}) })
    const pending = preparePagedPdfDocument(html, options)
    const rejected = expect(pending).rejects.toThrow('pagination timed out')
    await vi.advanceTimersByTimeAsync(120_000)
    await rejected
    expect(observed.iframe?.isConnected).toBe(false)
  })

  it.each([
    ['<tbody><tr><th colspan="2">Header</th></tr><tr><td>Body</td></tr></tbody>', 1],
    ['<thead><tr><th>Existing</th></tr></thead><tbody><tr><th>Body header</th></tr></tbody>', 1],
    ['<tbody><tr><th>Mixed</th><td>Cell</td></tr><tr><th>Later header</th></tr></tbody>', 0],
    ['<tbody><tr><th rowspan="2">Crossing</th></tr><tr><td>Body</td></tr></tbody>', 0],
    ['<tbody><tr><th rowspan="0">Crossing</th></tr><tr><td>Body</td></tr></tbody>', 0],
    ['<tbody><tr><th rowspan="2">Contained</th></tr><tr><th>Second</th></tr><tr><td>Body</td></tr></tbody>', 2],
  ])('promotes only safely contained leading TH rows: %s', async (table, headerRows) => {
    let actualHeaderRows = -1
    installSurface({ beforeLoad: (doc) => {
      actualHeaderRows = doc.querySelectorAll('thead > tr').length
    } })
    await preparePagedPdfDocument(html.replace('</main>', `<table>${table}</table></main>`), options)
    expect(actualHeaderRows).toBe(headerRows)
  })

  it('expands the actual RME list selector without changing its matches or type specificity', async () => {
    const selector = '.mf-pdf-export :is(ul, ol)[data-tight="true"] > li + li'
    let normalized = ''
    const body = '<ul data-tight="true"><li>First</li><li id="ul-second">Second</li></ul><ol data-tight="true"><li>First</li><li id="ol-second">Second</li></ol>'
    installSurface({ beforeLoad: (doc) => {
      doc.querySelectorAll('style').forEach((style) => postcss.parse(style.textContent ?? '').walkRules((rule) => {
        if (rule.selector.includes('[data-tight')) normalized = rule.selector
      }))
      expect(Array.from(doc.querySelectorAll(normalized), (element) => element.id))
        .toEqual(Array.from(doc.querySelectorAll(selector), (element) => element.id))
    } })
    await preparePagedPdfDocument(html.replace('</head>', `<style>${selector}{margin-top:3px}</style></head>`)
      .replace('</main>', `${body}</main>`), options)
    expect(normalized).toContain(':is(ul)')
    expect(normalized).toContain(':is( ol)')
    expect(normalized.split(',')).toHaveLength(2)
  })

  it('expands Cartesian :where() lists while retaining their zero specificity wrappers', async () => {
    let normalized = ''
    installSurface({ beforeLoad: (doc) => {
      doc.querySelectorAll('style').forEach((style) => postcss.parse(style.textContent ?? '').walkRules((rule) => {
        if (rule.selector.includes(':where')) normalized = rule.selector
      }))
    } })
    await preparePagedPdfDocument(html.replace('</head>', '<style>:where(#id,.class) :where(ul,ol)>li+li{padding:0}</style></head>'), options)
    expect(normalized.split(',')).toHaveLength(4)
    expect(normalized.match(/:where\(/g)).toHaveLength(8)
    expect(normalized).not.toContain(':where(#id,.class)')
  })

  it.each([
    [':not(.a,.b)', 'selector lists inside :not'],
    [':not(:is(ul,ol))', 'negated or positional'],
    [':is(#id,.class)', 'mixed-specificity'],
  ])('rejects unsupported %s rather than changing its matching or cascade', async (selector, message) => {
    const { observed } = installSurface()
    await expect(preparePagedPdfDocument(html.replace('</head>', `<style>${selector}{display:none}</style></head>`), options))
      .rejects.toThrow(message)
    expect(observed.iframe).toBeUndefined()
  })

  it('bounds selector Cartesian expansion before creating an iframe', async () => {
    const { observed } = installSurface()
    const selector = Array.from({ length: 8 }, () => ':where(a,b)').join(' ')
    await expect(preparePagedPdfDocument(html.replace('</head>', `<style>${selector}{padding:0}</style></head>`), options))
      .rejects.toThrow('too many selector combinations')
    expect(observed.iframe).toBeUndefined()
  })

  it('keeps embedded font bytes out of the Paged CSS parser without copying or dropping faces', async () => {
    const first = 'data:font/ttf;base64,AAAA'
    const second = 'data:font/ttf;base64,BBBB'
    installSurface({ beforeLoad: (doc) => {
      const ignored = Array.from(doc.querySelectorAll('style[data-pagedjs-ignore]'), (style) => style.textContent).join('')
      const processed = Array.from(doc.querySelectorAll('style:not([data-pagedjs-ignore])'), (style) => style.textContent).join('')
      expect(ignored).toContain(first)
      expect(ignored).toContain(second)
      expect(ignored).toContain('@supports (display:grid)')
      expect(processed).not.toContain('@font-face')
    } })
    const result = await preparePagedPdfDocument(html.replace('</head>', `<style>@supports (display:grid){@font-face{font-family:Second;src:url(${second})}}.unrelated{color:red}</style></head>`), options)
    expect(result.html.split(first)).toHaveLength(2)
    expect(result.html.split(second)).toHaveLength(2)
    expect(result.html).toContain('.unrelated')
  })

  it('repeats continuation headers and column widths before layout without duplicating existing headers', async () => {
    installSurface({ preview: async (doc, { source, layout }) => {
      source.querySelector('table')!.setAttribute('data-ref', 'table-1')
      const pages = doc.createElement('div')
      pages.className = 'pagedjs_pages'
      pages.innerHTML = '<div class="pagedjs_page"><table data-ref="table-1" data-split-from="table-1"><tbody><tr><td>Continuation</td></tr></tbody></table></div>'
      const page = pages.firstElementChild as HTMLElement
      layout(page)
      layout(page)
      expect(page.querySelectorAll('thead')).toHaveLength(1)
      expect(page.querySelector('thead th')?.textContent).toBe('Repeat me')
      expect(Array.from(page.querySelectorAll('colgroup col'), (col) => col.getAttribute('style')))
        .toEqual(['width:30%', 'width:70%'])
      expect(page.querySelector('tbody td')?.textContent).toBe('Continuation')
      expect(source.querySelectorAll('thead')).toHaveLength(1)
      doc.body.replaceChildren(pages)
      return { total: 1 }
    } })
    await preparePagedPdfDocument(html.replace('</main>', '<table><colgroup><col style="width:30%"></colgroup><colgroup><col style="width:70%"></colgroup><thead><tr><th>Repeat me</th></tr></thead><tbody><tr><td>Body</td></tr></tbody></table></main>'), options)
  })

  it('progresses when the offscreen iframe never receives a native animation frame', async () => {
    vi.useFakeTimers()
    const parentRequest = window.requestAnimationFrame
    const nativeRequest = vi.fn(() => 101)
    const nativeCancel = vi.fn()
    const callback = vi.fn()
    installSurface({
      beforeLoad: (doc) => {
        doc.defaultView!.requestAnimationFrame = nativeRequest
        doc.defaultView!.cancelAnimationFrame = nativeCancel
      },
      preview: (doc) => new Promise((resolve) => {
        doc.defaultView!.requestAnimationFrame((timestamp) => {
          callback(timestamp)
          doc.body.innerHTML = '<div class="pagedjs_pages"><div class="pagedjs_page">Content</div></div>'
          resolve({ total: 1 })
        })
      }),
    })
    const pending = preparePagedPdfDocument(html, options)
    await vi.advanceTimersByTimeAsync(16)
    expect((await pending).pageCount).toBe(1)
    expect(nativeRequest).toHaveBeenCalledOnce()
    expect(nativeCancel).toHaveBeenCalledWith(101)
    expect(callback).toHaveBeenCalledExactlyOnceWith(expect.any(Number))
    expect(window.requestAnimationFrame).toBe(parentRequest)
  })

  it('does not deliver a second callback when the native frame wins the timer race', async () => {
    vi.useFakeTimers()
    const callback = vi.fn()
    installSurface({
      beforeLoad: (doc) => {
        doc.defaultView!.requestAnimationFrame = (run) => {
          queueMicrotask(() => run(123))
          return 1
        }
        doc.defaultView!.cancelAnimationFrame = vi.fn()
      },
      preview: (doc) => new Promise((resolve) => {
        doc.defaultView!.requestAnimationFrame((timestamp) => {
          callback(timestamp)
          doc.body.innerHTML = '<div class="pagedjs_pages"><div class="pagedjs_page">Content</div></div>'
          resolve({ total: 1 })
        })
      }),
    })
    const pending = preparePagedPdfDocument(html, options)
    await vi.advanceTimersByTimeAsync(0)
    await pending
    await vi.advanceTimersByTimeAsync(100)
    expect(callback).toHaveBeenCalledExactlyOnceWith(123)
  })

  it('cancels outstanding iframe frames and fallback timers when the operation is aborted', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const callback = vi.fn()
    const nativeCancel = vi.fn()
    const nativeRequest = vi.fn(() => 2)
    installSurface({
      beforeLoad: (doc) => {
        doc.defaultView!.requestAnimationFrame = nativeRequest
        doc.defaultView!.cancelAnimationFrame = nativeCancel
      },
      preview: (doc) => {
        doc.defaultView!.requestAnimationFrame(callback)
        return new Promise(() => {})
      },
    })
    const pending = preparePagedPdfDocument(html, { ...options, signal: controller.signal })
    const rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await vi.advanceTimersByTimeAsync(0)
    expect(nativeRequest).toHaveBeenCalledOnce()
    controller.abort()
    await rejected
    await vi.advanceTimersByTimeAsync(100)
    expect(nativeCancel).toHaveBeenCalledWith(2)
    expect(callback).not.toHaveBeenCalled()
  })
})
