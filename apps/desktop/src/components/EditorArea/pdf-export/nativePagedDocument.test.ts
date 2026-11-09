// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { URL as FileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Heading {
  index: number
  title: string
  level: number
  pageIndex: number
  left: number
  top: number
}
interface InternalLink {
  pageIndex: number
  left: number
  top: number
  right: number
  bottom: number
  targetPageIndex: number
  targetLeft: number
  targetTop: number
}
interface PreparedPages { pageCount: number; headings: Heading[]; links: InternalLink[] }

const script = readFileSync(
  new FileURL('../../../../src-tauri/src/pdf_export/native/paged_document.js', import.meta.url), 'utf8',
)
const measurePages = new Function('document', 'getComputedStyle', `return (${script}\n)`) as (
  document: Document, getStyle: typeof window.getComputedStyle,
) => (outline: boolean, width: number, height: number, metadataKey?: string, readyTitle?: string) => PreparedPages

function box(left: number, top: number, width: number, height: number) {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

beforeEach(() => {
  document.head.innerHTML = '<style>*{opacity:1} .hidden{display:none}</style>'
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const count = document.querySelectorAll('[data-mf-pdf-page]').length
    if (this.classList.contains('mf-pdf-pages')) return box(0, 0, 800, count * 1000)
    const page = this.closest('[data-mf-pdf-page]')
    const index = Array.from(document.querySelectorAll('[data-mf-pdf-page]')).indexOf(page!)
    if (this.hasAttribute('data-mf-pdf-page')) return box(0, index * 1000, 800, 1000)
    const values = (this.getAttribute('data-rect') ?? '80,100,300,40').split(',').map(Number)
    return box(values[0], index * 1000 + values[1], values[2], values[3])
  })
  vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
    const source = this.getAttribute('data-client-rects')
    if (source) {
      const page = this.closest('[data-mf-pdf-page]')
      const index = Array.from(document.querySelectorAll('[data-mf-pdf-page]')).indexOf(page!)
      return (JSON.parse(source) as number[][]).map((rect) => box(rect[0], index * 1000 + rect[1], rect[2], rect[3])) as unknown as DOMRectList
    }
    return [this.getBoundingClientRect()] as unknown as DOMRectList
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(globalThis, 'mf-native-readiness-test:document')
  document.body.replaceChildren()
  document.head.replaceChildren()
})

function prepare(pages: string[], outline = true) {
  document.body.innerHTML = `<main class="mf-pdf-pages">${pages.map((content, index) =>
    `<div data-mf-pdf-page="${index + 1}">${content}</div>`).join('')}</main>`
  return measurePages(document, window.getComputedStyle.bind(window))(outline, 800, 1000)
}

describe('trusted native physical-page measurements', () => {
  it('measures page-relative positions and retains duplicate titles with separate source refs', () => {
    const result = prepare([
      '<h1 data-ref="a">中文标题</h1><h3 data-ref="b" data-rect="40,250,200,50">Repeated</h3>',
      '<h3 data-ref="c">Repeated</h3><div role="heading" aria-level="6">末节 ✨</div>',
    ])
    expect(result).toEqual({ pageCount: 2, links: [], headings: [
      { index: 0, title: '中文标题', level: 1, pageIndex: 0, left: 0.1, top: 0.1 },
      { index: 1, title: 'Repeated', level: 3, pageIndex: 0, left: 0.05, top: 0.25 },
      { index: 2, title: 'Repeated', level: 3, pageIndex: 1, left: 0.1, top: 0.1 },
      { index: 3, title: '末节 ✨', level: 6, pageIndex: 1, left: 0.1, top: 0.1 },
    ] })
    expect(document.querySelector('a[data-mf-pdf-outline-marker]')).toBeNull()
  })

  it('respects accessible names, hidden descendants, roles and explicit levels', () => {
    const result = prepare([`
      <span id="label" hidden>完整章节名称</span>
      <h1 aria-labelledby="label" aria-label="Ignored">Other</h1>
      <h2>Visible <span class="hidden">Hidden</span><img alt="图示"></h2>
      <h3><svg><title>SVG title</title><text>Decoration</text></svg></h3>
      <h4 role="presentation">Not a heading</h4><h5 aria-level="7">Invalid level</h5>
      <div hidden><h2>Hidden parent</h2></div><h2 style="opacity:0">Transparent</h2>
      <h2 aria-hidden="true">Excluded</h2><h2 data-rect="80,1100,300,40">Outside page</h2>
      <h2></h2><div role="heading">Default level</div>
    `])
    expect(result.headings.map(({ title, level }) => ({ title, level }))).toEqual([
      { title: '完整章节名称', level: 1 }, { title: 'Visible 图示', level: 2 },
      { title: 'SVG title', level: 3 }, { title: 'Default level', level: 2 },
    ])
  })

  it('deduplicates repeated headers and combines only split fragments at the first destination', () => {
    const result = prepare([
      '<h1 data-ref="split" data-split-to="split">Long heading</h1><h2 data-ref="header">Repeated header</h2>',
      '<h1 data-ref="split" data-split-from="split">continuation</h1><h2 data-ref="header">Repeated header</h2>',
    ])
    expect(result.headings.map(({ title, pageIndex }) => ({ title, pageIndex }))).toEqual([
      { title: 'Long heading continuation', pageIndex: 0 }, { title: 'Repeated header', pageIndex: 0 },
    ])
  })

  it('keeps complete explicit labels once for split heading fragments', () => {
    const result = prepare([
      '<h1 data-ref="split" aria-label="Complete title">First</h1>',
      '<h1 data-ref="split" data-split-from="split" aria-label="Complete title">Second</h1>',
    ])
    expect(result.headings).toHaveLength(1)
    expect(result.headings[0].title).toBe('Complete title')
    expect(result.headings[0].pageIndex).toBe(0)
  })

  it('still verifies physical pages with outline disabled', () => {
    expect(prepare(['<h1>Ignored</h1>', '<h2>Also ignored</h2>'], false)).toEqual({ pageCount: 2, headings: [], links: [] })
    expect(() => measurePages(document, window.getComputedStyle.bind(window))(false, 900, 1000)).toThrow('dimensions')
    document.body.innerHTML = '<main class="mf-pdf-pages"></main>'
    expect(() => measurePages(document, window.getComputedStyle.bind(window))(false, 800, 1000)).toThrow('page count')
  })

  it('rejects missing/nested page containers and oversized titles', () => {
    document.body.innerHTML = '<h1>Unpaginated</h1>'
    expect(() => measurePages(document, window.getComputedStyle.bind(window))(true, 800, 1000)).toThrow('container')
    expect(() => prepare(['<div data-mf-pdf-page="nested"><h1>Nested</h1></div>'])).toThrow('Nested')
    expect(() => prepare([`<h1>${'x'.repeat(4097)}</h1>`])).toThrow('oversized')
  })

  it('signals a short title while preserving a large callback payload and long Unicode document title', () => {
    const headings = Array.from({ length: 300 }, (_, index) => `<h2 data-ref="h${index}">章节 ${index} ${'标题'.repeat(20)}</h2>`).join('')
    prepare([headings])
    const originalTitle = '中文📚'.repeat(600)
    document.title = originalTitle
    const key = 'mf-native-readiness-test:document'
    const signal = 'mf-native-readiness-test:ready'
    const result = measurePages(document, window.getComputedStyle.bind(window))(true, 800, 1000, key, signal)
    const metadata = Reflect.get(globalThis, key) as PreparedPages & { title: string }
    expect(result.headings).toHaveLength(300)
    expect(document.title).toBe(signal)
    expect(document.title.length).toBeLessThan(1000)
    expect(metadata.title).toBe(originalTitle)
    expect(metadata.headings).toHaveLength(300)
    expect(JSON.stringify(metadata).length).toBeGreaterThan(1000)
    expect(JSON.parse(JSON.stringify(metadata))).toEqual(metadata)
  })

  it('bounds stored titles by codepoints without splitting a surrogate pair', () => {
    prepare(['<h1>Unicode title boundary</h1>'])
    document.title = `${'x'.repeat(4095)}📚 extra`
    const key = 'mf-native-readiness-test:document'
    measurePages(document, window.getComputedStyle.bind(window))(false, 800, 1000, key, 'ready')
    const metadata = Reflect.get(globalThis, key) as PreparedPages & { title: string }
    expect(Array.from(metadata.title)).toHaveLength(4096)
    expect(metadata.title.endsWith('📚')).toBe(true)
    expect(metadata.headings).toEqual([])
    expect(document.title).toBe('ready')
  })

  it('collects Unicode fragment destinations independently of the outline preference', () => {
    const result = prepare([
      '<a href="#%E8%B7%A8%E9%A1%B5%E8%A1%A8%E6%A0%BC" data-rect="40,100,120,20">Go to table</a>',
      '<h2 id="跨页表格" data-ref="table" data-id="跨页表格" data-rect="80,250,300,40">Target</h2>',
    ], false)
    expect(result.headings).toEqual([])
    expect(result.links).toEqual([{
      pageIndex: 0, left: 0.05, top: 0.1, right: 0.2, bottom: 0.12,
      targetPageIndex: 1, targetLeft: 0.1, targetTop: 0.25,
    }])
  })

  it('preserves href-dependent styles and accepts only this document URL or a literal fragment', () => {
    const current = document.URL.split('#')[0]
    document.head.insertAdjacentHTML('beforeend', '<style>a[href^="#"]{color:rgb(1,2,3)}</style>')
    const result = prepare([
      `<a href="#target">Local</a><a href="${current}#target">Absolute self</a>
       <a href="other.html#target">Other document</a><a href="file:///other.html#target">Other file</a>
       <a href="https://example.com/doc#target">External</a><a href="javascript:alert(1)#target">Invalid</a>`,
      '<div id="target">Target</div>',
    ])
    expect(result.links).toHaveLength(1)
    // Identical native source rectangles are deduplicated, without changing
    // either local href or turning it into a temporary marker URI.
    expect(document.querySelector('a')?.getAttribute('href')).toBe('#target')
    expect(getComputedStyle(document.querySelector('a')!).color).toBe('rgb(1, 2, 3)')
    expect(Array.from(document.querySelectorAll('a'), (anchor) => anchor.getAttribute('href')))
      .toContain(`${current}#target`)
  })

  it('supports zero-size legacy and ID anchors, including aria-hidden aliases with only a finite bounding point', () => {
    const result = prepare([
      '<a href="#named" data-rect="10,100,50,20">Named</a><a href="#empty" data-rect="100,100,50,20">ID</a>',
      '<a name="named" aria-hidden="true" data-rect="25,350,0,0"></a><span id="empty" aria-hidden="true" data-client-rects="[]" data-rect="40,450,0,0"></span>',
    ])
    expect(result.links.map(({ targetPageIndex, targetLeft, targetTop }) => ({ targetPageIndex, targetLeft, targetTop })))
      .toEqual([
        { targetPageIndex: 1, targetLeft: 25 / 800, targetTop: 0.35 },
        { targetPageIndex: 1, targetLeft: 0.05, targetTop: 0.45 },
      ])
  })

  it('handles empty and top fragments while giving an actual top ID precedence', () => {
    const result = prepare([
      '<a href="#" data-rect="10,100,40,20">Start</a><a href="#TOP" data-rect="60,100,40,20">Fallback top</a><a href="#top" data-rect="110,100,40,20">Actual ID</a>',
      '<div id="top" data-rect="40,400,100,20">Actual top target</div>',
    ])
    expect(result.links.map(({ targetPageIndex, targetTop }) => ({ targetPageIndex, targetTop })))
      .toEqual([{ targetPageIndex: 0, targetTop: 0 }, { targetPageIndex: 0, targetTop: 0 }, { targetPageIndex: 1, targetTop: 0.4 }])
  })

  it('gives a matching legacy top name precedence over the top fallback', () => {
    const result = prepare(['<a href="#TOP">Named top</a>', '<a name="TOP" data-rect="40,400,0,0"></a>'])
    expect(result.links[0]).toMatchObject({ targetPageIndex: 1, targetTop: 0.4 })
  })

  it('decodes fragment punctuation once and prefers an ID over a legacy name', () => {
    const result = prepare([
      '<a href="#name%2520%23%22">Escaped ID</a><a href="#duplicate" data-rect="100,100,40,20">ID priority</a>',
      '<a name="duplicate" data-rect="40,200,0,0"></a><div id="duplicate" data-rect="80,300,100,20">ID</div><span id="name%20#&quot;" data-rect="60,500,0,0"></span>',
    ])
    expect(result.links.map(({ targetLeft, targetTop }) => [targetLeft, targetTop])).toEqual([[0.075, 0.5], [0.1, 0.3]])
  })

  it('chooses the first located continuation of one source ref and does not fall through to an unrelated duplicate ID', () => {
    const result = prepare([
      '<a href="#continued">Continued</a><a href="#hidden-first" data-rect="100,100,40,20">Hidden first</a><div id="continued" data-id="continued" data-ref="source" data-rect="80,1100,100,20">Outside</div><div id="hidden-first" data-ref="hidden" class="hidden">Hidden</div>',
      '<div data-id="continued" data-ref="source" data-split-from="source" data-rect="50,220,100,20">Located continuation</div><div id="continued" data-ref="other">Unrelated duplicate</div><div id="hidden-first" data-ref="unrelated">Unrelated visible duplicate</div>',
    ])
    expect(result.links).toHaveLength(1)
    expect(result.links[0]).toMatchObject({ targetPageIndex: 1, targetLeft: 50 / 800, targetTop: 0.22 })
  })

  it('does not let Paged page IDs mask an authored data-id destination', () => {
    const result = prepare([
      '<a href="#page-1">Authored anchor</a>',
      '<div data-id="page-1" data-ref="authored" data-rect="80,300,100,20">Authored target</div>',
    ])
    expect(result.links[0]).toMatchObject({ targetPageIndex: 1, targetTop: 0.3 })
    document.querySelector('[data-mf-pdf-page]')!.setAttribute('id', 'page-1')
    document.querySelector('[data-mf-pdf-page]')!.classList.add('pagedjs_page')
    const measured = measurePages(document, window.getComputedStyle.bind(window))(true, 800, 1000)
    expect(measured.links[0]).toMatchObject({ targetPageIndex: 1, targetTop: 0.3 })
  })

  it('collects every visible line rectangle, clips page edges and deduplicates repeated rectangles', () => {
    const result = prepare([
      '<a href="#target" data-client-rects="[[80,100,120,15],[80,120,200,15],[80,120,200,15],[-5,140,20,15],[790,170,50,15],[80,1100,120,15]]">Wrapped link</a>',
      '<div id="target">Target</div>',
    ])
    expect(result.links.map(({ left, top, right, bottom }) => [left, top, right, bottom]))
      .toEqual([[0.1, 0.1, 0.25, 0.115], [0.1, 0.12, 0.35, 0.135], [0, 0.14, 15 / 800, 0.155], [790 / 800, 0.17, 1, 0.185]])
  })

  it('collects visible text lines and images when a display:contents anchor has no box', () => {
    vi.spyOn(document, 'createRange').mockImplementation(() => {
      let selected: Node
      return {
        selectNodeContents(node: Node) { selected = node },
        getClientRects() {
          const element = selected.parentElement!
          const index = Array.from(document.querySelectorAll('[data-mf-pdf-page]'))
            .indexOf(element.closest('[data-mf-pdf-page]')!)
          return (JSON.parse(element.getAttribute('data-range-rects')!) as number[][])
            .map((rect) => box(rect[0], index * 1000 + rect[1], rect[2], rect[3]))
        },
      } as unknown as Range
    })
    const result = prepare([
      `<a href="#target" style="display:contents" data-client-rects="[]" data-rect="0,0,0,0">
        <div data-range-rects="[[80,100,120,15],[80,120,200,15]]">Visible wrapped text</div>
        <span class="hidden">Hidden text without a range</span>
        <span aria-hidden="true">Decorative text without a range</span>
        <img alt="Clickable image" data-rect="80,160,40,30">
        <span style="overflow:hidden" data-rect="100,220,40,15" data-range-rects="[[80,220,100,15]]">Clipped text</span>
      </a>`,
      '<span id="target" data-rect="40,500,0,0"></span>',
    ])
    expect(result.links.map(({ left, top, right, bottom }) => [left, top, right, bottom]))
      .toEqual([[0.1, 0.1, 0.25, 0.115], [0.1, 0.12, 0.35, 0.135], [0.1, 0.16, 0.15, 0.19], [0.125, 0.22, 0.175, 0.235]])
  })

  it('clips sources hidden by an overflow container and filters non-clickable links without requiring target area', () => {
    const result = prepare([
      '<div style="overflow:hidden" data-rect="60,100,140,40"><a href="#target" data-rect="40,90,200,80">Clipped</a></div><a href="#target" class="hidden">Hidden</a><div aria-hidden="true"><a href="#target">Hidden ancestor</a></div><a href="#target" style="visibility:hidden">Invisible</a><a href="#target" style="opacity:0">Transparent</a><a href="#target" inert>Inert</a><a href="#target" data-rect="80,100,0,0"></a><a href="#target" data-rect="80,1100,10,20">Outside</a><a href="#missing">Missing</a><a href="#%ZZ">Malformed</a>',
      '<span id="target" aria-hidden="true" data-rect="40,500,0,0"></span>',
    ])
    expect(result.links).toHaveLength(1)
    expect(result.links[0]).toMatchObject({ left: 60 / 800, top: 0.1, right: 0.25, bottom: 0.14, targetTop: 0.5 })
  })

  it('rejects oversized link geometry metadata instead of returning a partial link list', () => {
    prepare(['<a href="#target">Many fragments</a><div id="target">Target</div>'])
    const anchor = document.querySelector('a')!
    vi.spyOn(anchor, 'getClientRects').mockReturnValue(Array.from({ length: 20001 }, (_, index) =>
      box(index % 700, 100 + Math.floor(index / 700) * 2, 1, 1)) as unknown as DOMRectList)
    expect(() => measurePages(document, window.getComputedStyle.bind(window))(false, 800, 1000)).toThrow('Too many internal PDF link rectangles')
  })

})
