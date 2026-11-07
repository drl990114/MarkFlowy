import { readFileSync } from 'node:fs'
import { URL as FileURL } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

interface OutlineHeading {
  index: number
  title: string
  level: number
}

const source = readFileSync(
  new FileURL('../../../../src-tauri/src/pdf_export/native/outline_document.js', import.meta.url),
  'utf8',
)
// Exercise the same trusted script that Rust injects into the export WebView.
const createOutline = new Function('document', 'getComputedStyle', `return (${source}\n)`) as (
  exportDocument: Document,
  computedStyle: typeof window.getComputedStyle,
) => (token: string) => OutlineHeading[]

const token = 'native-outline-test'
const prefix = `https://markflowy.invalid/pdf-outline/${token}/`
const markerAttribute = 'data-mf-pdf-outline-marker'
const markerSelector = `a[${markerAttribute}]`
let initialHeadNodes: Set<ChildNode>

beforeEach(() => {
  initialHeadNodes = new Set(document.head.childNodes)
  document.body.innerHTML = ''
  // happy-dom omits these initial computed values; real WebViews return 1/static.
  // Explicit author styles still win, and visibility is left to normal inheritance.
  const defaults = document.createElement('style')
  defaults.textContent = '* { opacity: 1; position: static; } body { visibility: visible; }'
  document.head.append(defaults)
})

afterEach(() => {
  document.body.innerHTML = ''
  for (const node of Array.from(document.head.childNodes)) {
    if (!initialHeadNodes.has(node)) node.remove()
  }
})

function prepare(html: string) {
  document.body.innerHTML = html
  return createOutline(document, window.getComputedStyle.bind(window))(token)
}

function markers() {
  return Array.from(document.querySelectorAll<HTMLAnchorElement>(markerSelector))
}

describe('native PDF outline document', () => {
  it('keeps Chinese and English titles, duplicate names and skipped levels in document order', () => {
    const headings = prepare(`
      <h1> 中文 <strong>标题</strong> </h1>
      <h3>Repeated <em>title</em></h3>
      <h3>Repeated title</h3>
      <h6>末节 ✨</h6>
      <h2>  Line\n   breaks &amp; spaces  </h2>
    `)

    expect(headings).toEqual([
      { index: 0, title: '中文 标题', level: 1 },
      { index: 1, title: 'Repeated title', level: 3 },
      { index: 2, title: 'Repeated title', level: 3 },
      { index: 3, title: '末节 ✨', level: 6 },
      { index: 4, title: 'Line breaks & spaces', level: 2 },
    ])
    expect(
      Array.from(document.querySelectorAll('h1,h2,h3,h6')).map(
        (heading) => heading.querySelector<HTMLAnchorElement>(markerSelector)?.href,
      ),
    ).toEqual(headings.map(({ index }) => `${prefix}${index}`))
  })

  it('prefers labelledby references over aria-label and uses labels when references are missing', () => {
    expect(prepare(`
      <span id="chapter" hidden>章节名称</span>
      <span id="detail"> Detail <strong>name</strong> </span>
      <h1 aria-labelledby="chapter missing detail" aria-label="Wrong label">Wrong text</h1>
      <h2 aria-label=" Accessible   title ">Wrong text</h2>
      <h3 aria-labelledby="missing" aria-label="Fallback label">Wrong text</h3>
    `)).toEqual([
      { index: 0, title: '章节名称 Detail name', level: 1 },
      { index: 1, title: 'Accessible title', level: 2 },
      { index: 2, title: 'Fallback label', level: 3 },
    ])
  })

  it('uses image alternatives and SVG titles without copying decorative graphics', () => {
    expect(prepare(`
      <h1><img alt="图片标题"></h1>
      <h2><svg><title>Diagram title</title><desc>Not the title</desc><text>Not the title</text></svg></h2>
      <h3><svg aria-label="Accessible diagram"><title>Fallback title</title></svg></h3>
      <h4>Mixed <img alt="image"> title <svg aria-hidden="true"><title>Decoration</title></svg></h4>
    `)).toEqual([
      { index: 0, title: '图片标题', level: 1 },
      { index: 1, title: 'Diagram title', level: 2 },
      { index: 2, title: 'Accessible diagram', level: 3 },
      { index: 3, title: 'Mixed image title', level: 4 },
    ])
  })

  it('includes a self-referenced heading name once without following reference chains', () => {
    expect(prepare(`
      <span id="suffix">suffix</span>
      <h1 id="self" aria-labelledby="self suffix self">Own <em>text</em></h1>
      <h2 id="named" aria-labelledby="named suffix" aria-label="Own label">Other text</h2>
      <span id="reference" aria-labelledby="suffix">Direct text</span>
      <h3 aria-labelledby="reference">Other heading</h3>
    `)).toEqual([
      { index: 0, title: 'Own text suffix', level: 1 },
      { index: 1, title: 'Own label suffix', level: 2 },
      { index: 2, title: 'Direct text', level: 3 },
    ])
  })

  it('keeps word boundaries at explicit line breaks without adding whitespace inside inline words', () => {
    expect(prepare('<h1>First<br>Second <strong>con</strong>tent<br>末行</h1>')).toEqual([
      { index: 0, title: 'First Second content 末行', level: 1 },
    ])
  })

  it('omits hidden descendants and executable/template text from a visible title', () => {
    // happy-dom incorrectly lets an inherited !important value beat an explicit
    // normal child value. Match priority to exercise hiding with its CSS engine.
    expect(prepare(`
      <h1>Visible
        <span hidden>Hidden attribute</span>
        <span inert>Inert control</span>
        <span aria-hidden=" TrUe ">Decorative control</span>
        <span style="display:none">Display hidden</span>
        <span style="visibility:hidden!important">Visibility hidden</span>
        <span style="visibility:collapse!important">Collapsed</span>
        <span style="opacity:0">Transparent</span>
        <script>Script text</script><style>.unused { color: red; }</style>
        <template>Template text</template><noscript>Fallback text</noscript>
        <span>title</span>
      </h1>
    `)).toEqual([{ index: 0, title: 'Visible title', level: 1 }])
  })

  it.each(['hidden', 'inert', 'aria-hidden="true"', 'aria-hidden=" TrUe "'])(
    'excludes headings and ancestor subtrees carrying %s',
    (attribute) => {
      expect(prepare(`
        <h1 ${attribute}>Excluded heading</h1>
        <section ${attribute}><div><h2>Excluded descendant</h2></div></section>
        <h3 aria-hidden="false">Included</h3>
      `)).toEqual([{ index: 0, title: 'Included', level: 3 }])
      expect(markers().map((marker) => marker.href)).toEqual([`${prefix}probe`, `${prefix}0`])
    },
  )

  it.each(['presentation', 'none', 'button', ' PRESENTATION '])(
    'excludes a native heading with the explicit role %s',
    (role) => {
      expect(prepare(`<h1 role="${role}">Decorative</h1><h2 role=" HEADING ">Title</h2>`))
        .toEqual([{ index: 0, title: 'Title', level: 2 }])
    },
  )

  it('honors a valid explicit heading level without flattening skipped levels', () => {
    expect(prepare('<h1 aria-level=" 4 ">Fourth level</h1><h2>Second level</h2>')).toEqual([
      { index: 0, title: 'Fourth level', level: 4 },
      { index: 1, title: 'Second level', level: 2 },
    ])
  })

  it.each(['', '0', '7', '-1', '2.5', 'unknown'])(
    'excludes a heading with the invalid explicit level %j',
    (level) => {
      expect(prepare(`<h1 aria-level="${level}">Invalid</h1><h2>Valid</h2>`)).toEqual([
        { index: 0, title: 'Valid', level: 2 },
      ])
    },
  )

  it('marks screen-hidden print candidates and lets the native print engine determine inclusion', () => {
    expect(prepare(`
      <style>
        .print-only { display:none; }
        @media print { .print-only { display:block; } }
      </style>
      <h1 class="print-only">Print <strong>title</strong></h1>
      <section class="print-only"><h2>Print section</h2></section>
      <h3 style="opacity:0">Transparent screen title</h3>
    `)).toEqual([
      { index: 0, title: 'Print title', level: 1 },
      { index: 1, title: 'Print section', level: 2 },
      { index: 2, title: 'Transparent screen title', level: 3 },
    ])
    expect(markers()).toHaveLength(4)
    expect(getComputedStyle(document.querySelector('h1')!).display).toBe('none')
  })

  it('retains nested print-only title text when visibility is inherited from the heading', () => {
    expect(prepare(`
      <style>
        .print-only { visibility:hidden; }
        @media print { .print-only { visibility:visible; } }
      </style>
      <h1 class="print-only">Print <strong>title</strong><span style="visibility:hidden!important">Hidden control</span></h1>
      <section class="print-only">
        <h2 style="visibility:inherit!important"><span>Nested title</span></h2>
      </section>
    `)).toEqual([
      { index: 0, title: 'Print title', level: 1 },
      { index: 1, title: 'Nested title', level: 2 },
    ])
    const first = document.querySelector('h1')!
    const second = document.querySelector('h2')!
    expect(first.style.getPropertyValue('visibility')).toBe('')
    expect(second.style.getPropertyValue('visibility')).toBe('inherit')
    expect(second.style.getPropertyPriority('visibility')).toBe('important')
    expect(getComputedStyle(first).visibility).toBe('hidden')
    expect(getComputedStyle(second).visibility).toBe('hidden')
  })

  it('inherits heading visibility so hidden candidates cannot create visible print markers', () => {
    expect(prepare('<h1 style="visibility:hidden">Hidden title</h1><h2>Visible title</h2>'))
      .toEqual([
        { index: 0, title: 'Hidden title', level: 1 },
        { index: 1, title: 'Visible title', level: 2 },
      ])
    const hiddenMarker = document.querySelector<HTMLAnchorElement>('h1 > a')!
    const visibleMarker = document.querySelector<HTMLAnchorElement>('h2 > a')!
    expect(getComputedStyle(hiddenMarker).visibility).toBe('hidden')
    expect(getComputedStyle(visibleMarker).visibility).toBe('visible')
  })

  it('skips empty or wholly decorative titles without leaving gaps in marker indices', () => {
    expect(prepare(`
      <h1> \n </h1><h2><img alt=""></h2><h3><svg><path/></svg></h3>
      <h4><span hidden>Hidden text</span></h4><h5 aria-label=" "></h5>
      <h6>Nonempty</h6>
    `)).toEqual([{ index: 0, title: 'Nonempty', level: 6 }])
    expect(markers().map((marker) => marker.href)).toEqual([`${prefix}probe`, `${prefix}0`])
  })

  it('avoids recursion when accessible label references form a cycle', () => {
    expect(prepare(`
      <span id="first" aria-labelledby="second"></span>
      <span id="second" aria-labelledby="first"></span>
      <h1 aria-labelledby="first">Unresolvable</h1><h2>Valid title</h2>
    `)).toEqual([{ index: 0, title: 'Valid title', level: 2 }])
  })

  it('adds a text-free capability probe even when no headings are present', () => {
    expect(prepare('<p>Document without headings.</p>')).toEqual([])
    expect(markers()).toHaveLength(1)
    expect(markers()[0].href).toBe(`${prefix}probe`)
    expect(document.body.textContent).toBe('Document without headings.')
  })

  it('creates visible, out-of-flow marker boxes without adding text or changing existing positioning', () => {
    const html = '<h1 style="left:60px;top:30px">Title</h1><h2 style="position:relative;left:4px">Subtitle</h2><p>Body</p>'
    const before = new DOMParser().parseFromString(html, 'text/html')
    prepare(html)

    expect(document.body.textContent).toBe(before.body.textContent)
    expect(document.querySelector('h1')?.style.cssText).toBe(before.querySelector('h1')?.style.cssText)
    expect(document.querySelector('h2')?.style.cssText).toBe(before.querySelector('h2')?.style.cssText)
    expect(getComputedStyle(document.querySelector('h1')!).position).toBe('static')
    for (const marker of markers()) {
      expect(marker.childNodes).toHaveLength(0)
      expect(marker.tabIndex).toBe(-1)
      expect(marker.getAttribute('aria-hidden')).toBe('true')
      const style = getComputedStyle(marker)
      expect(style.position).toBe('absolute')
      expect(style.left).toBe('auto')
      expect(style.top).toBe('auto')
      expect(style.display).toBe('block')
      expect(style.visibility).toBe('visible')
      expect(Number(style.opacity)).toBe(1)
      expect(Number.parseFloat(style.width)).toBeGreaterThan(0)
      expect(Number.parseFloat(style.height)).toBeGreaterThan(0)
    }
  })

  it('removes author marker attributes while preserving authored content and ordinary links', () => {
    expect(prepare(`
      <h1 ${markerAttribute}>Authored title</h1>
      <a id="authored-link" ${markerAttribute} href="https://example.invalid/note">Regular link</a>
      <span id="authored-span" ${markerAttribute}>Regular text</span>
    `)).toEqual([{ index: 0, title: 'Authored title', level: 1 }])

    expect(document.querySelector('h1')?.hasAttribute(markerAttribute)).toBe(false)
    expect(document.querySelector('#authored-link')?.hasAttribute(markerAttribute)).toBe(false)
    expect(document.querySelector('#authored-span')?.hasAttribute(markerAttribute)).toBe(false)
    expect(document.querySelector('#authored-link')?.getAttribute('href')).toBe(
      'https://example.invalid/note',
    )
    expect(document.querySelector('#authored-span')?.textContent).toBe('Regular text')
    expect(markers().map((marker) => marker.href)).toEqual([`${prefix}probe`, `${prefix}0`])
  })

  it('rejects oversized titles rather than returning incomplete metadata', () => {
    expect(() => prepare(`<h1>${'字'.repeat(4097)}</h1>`)).toThrow(/oversized PDF headings/)
  })
})
