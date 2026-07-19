import { beforeEach, describe, expect, test, vi } from 'vitest'
import { normalizeReference } from 'markdown-it/lib/common/utils.mjs'
import { prosemirrorNodeToHtml } from '@rme-sdk/main'
import { createWysiwygDelegate } from '../../components/WysiwygEditor/delegate'

const mermaidHarness = vi.hoisted(() => ({
  bindFunctions: vi.fn(),
  getDiagramFromText: vi.fn(),
  render: vi.fn(),
}))

vi.mock('../mermaid', () => ({
  loadMermaid: async () => ({
    mermaidAPI: { getDiagramFromText: mermaidHarness.getDiagramFromText },
    render: mermaidHarness.render,
  }),
}))

import {
  enhanceProsemirrorHtml,
  prepareProsemirrorPreview,
  rmeProsemirrorNodeToHtml,
} from '../prosemirrorNodeToHtml'

function parseHtml(html: string): HTMLDivElement {
  const container = document.createElement('div')
  container.innerHTML = html
  return container
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('enhanceProsemirrorHtml', () => {
  beforeEach(() => {
    mermaidHarness.bindFunctions.mockReset()
    mermaidHarness.getDiagramFromText.mockReset()
    mermaidHarness.render.mockReset()
    mermaidHarness.getDiagramFromText.mockImplementation(async (source: string) => {
      const normalizedSource = source.replaceAll('\\u0069', 'i')
      const hasImageShape = /@\s*\{[^}]*["']?img["']?\s*:/i.test(normalizedSource)
      return {
        db: {
          getVertices: () =>
            new Map(hasImageShape ? [['image', { img: 'https://example.com/a.png' }]] : []),
        },
      }
    })
    mermaidHarness.render.mockResolvedValue({
      bindFunctions: mermaidHarness.bindFunctions,
      svg: '<svg data-rendered="mermaid"><text>diagram</text></svg>',
    })
  })

  test('highlights known fenced code languages and preserves unknown languages', async () => {
    const html = [
      '<pre data-type="code-block" data-language="typescript"><code>const answer: number = 42</code></pre>',
      '<pre data-type="code-block" data-language="unknown-lang"><code>&lt;unsafe&gt;</code></pre>',
      '<pre data-type="code-block" data-language="foo-javascript"><code>const fuzzy = false</code></pre>',
    ].join('')

    const container = parseHtml(await enhanceProsemirrorHtml(html))
    const blocks = container.querySelectorAll('pre')

    expect(blocks[0].querySelector('.tok-keyword')?.textContent).toBe('const')
    expect(blocks[0].querySelector('.tok-typeName')?.textContent).toBe('number')
    expect(blocks[0].textContent).toBe('const answer: number = 42')
    expect(blocks[1].querySelector('[class^="tok-"]')).toBeNull()
    expect(blocks[1].textContent).toBe('<unsafe>')
    expect(blocks[1].querySelector('unsafe')).toBeNull()
    expect(blocks[2].querySelector('[class^="tok-"]')).toBeNull()
  })

  test('renders and sanitizes block and inline HTML', async () => {
    const blockSource = [
      '<details onclick="evil()">',
      '<summary style="color: red">More</summary>',
      '',
      '**safe markdown**',
      '',
      '<script>evil()</script>',
      '</details>',
      '<table background="http://127.0.0.1/leak"><tr><td>Safe table</td></tr></table>',
      '<map name="unsafe"><area href="http://127.0.0.1/leak"></map>',
    ].join('\n')
    const encodedBlockSource = document.createElement('div')
    encodedBlockSource.textContent = blockSource
    const html = [
      `<pre data-type="html-block"><code>${encodedBlockSource.innerHTML}</code></pre>`,
      '<p><span data-type="html-inline" data-html="&lt;kbd onclick=&quot;evil()&quot;&gt;"></span>Ctrl<span data-type="html-inline" data-html="&lt;/kbd&gt;"></span></p>',
      '<p><span data-type="html-inline" data-html="&lt;span class=&quot;mf-live-preview-block mf-live-preview-fullscreen&quot; id=&quot;cover&quot; data-mode=&quot;preview&quot;&gt;"></span>Cover<span data-type="html-inline" data-html="&lt;/span&gt;"></span></p>',
      '<p><span data-type="html-inline" data-html="&lt;button autofocus&gt;Run&lt;/button&gt;"></span></p>',
    ].join('')

    const container = parseHtml(await enhanceProsemirrorHtml(html))
    const details = container.querySelector('details')
    const inline = container.querySelector('kbd')

    expect(details?.querySelector('strong')?.textContent).toBe('safe markdown')
    expect(details?.hasAttribute('onclick')).toBe(false)
    expect(details?.querySelector('summary')?.hasAttribute('style')).toBe(false)
    expect(details?.querySelector('script')).toBeNull()
    expect(inline?.textContent).toBe('Ctrl')
    expect(inline?.hasAttribute('onclick')).toBe(false)
    expect(container.textContent).toContain('Cover')
    expect(container.querySelector('.mf-live-preview-fullscreen')).toBeNull()
    expect(container.querySelector('#cover')).toBeNull()
    expect(container.querySelector('[data-mode="preview"]')).toBeNull()
    expect(container.querySelector('button')).toBeNull()
    expect(container.querySelector('table')?.hasAttribute('background')).toBe(false)
    expect(container.querySelector('map')).toBeNull()
  })

  test('renders block and inline math as SVG', async () => {
    const html = [
      '<div data-type="math-block">x^2 + y^2</div>',
      '<p>Inline <span data-type="math-inline" data-tex="x^2" data-display="false"></span></p>',
    ].join('')

    const container = parseHtml(await enhanceProsemirrorHtml(html))

    expect(container.querySelector('.mf-preview-math > svg')).not.toBeNull()
    expect(container.querySelector('.mf-preview-math-inline > svg')).not.toBeNull()
    expect(container.querySelector('.mf-preview-math path')).not.toBeNull()
    expect(container.querySelector('.mf-preview-math-inline path')).not.toBeNull()
    expect(container.textContent).toContain('Inline')
  })

  test('renders Mermaid and isolates a broken diagram from other blocks', async () => {
    mermaidHarness.render.mockRejectedValueOnce(new Error('Invalid diagram'))
    const html = [
      '<pre data-type="mermaid">not a diagram</pre>',
      '<pre data-type="code-block" data-language="javascript"><code>const ok = true</code></pre>',
      '<pre data-type="mermaid">graph TD; A--&gt;B</pre>',
    ].join('')

    const container = parseHtml(await enhanceProsemirrorHtml(html))

    expect(container.querySelector('.mf-preview-block-error')?.textContent).toContain(
      'Invalid diagram',
    )
    expect(container.querySelector('.tok-keyword')?.textContent).toBe('const')
    expect(container.querySelector('svg[data-rendered="mermaid"]')).not.toBeNull()
    expect(mermaidHarness.bindFunctions).not.toHaveBeenCalled()
  })

  test('rejects Mermaid resource-bearing metadata before rendering but permits URL text', async () => {
    const unsafeSources = [
      'flowchart TD; A@{ img: "https://example.com/a.png" }',
      'flowchart TD; A@{ "img": "https://example.com/a.png" }',
      'flowchart TD; A@{ "\\u0069mg": "https://example.com/a.png" }',
      'flowchart TD; A["<img src=https://example.com/a.png>"]',
      'flowchart TD; A:::remote\nclassDef remote fill:url(https://example.com/a.png)',
    ]

    for (const source of unsafeSources) {
      const encoded = document.createElement('div')
      encoded.textContent = source
      const unsafeContainer = parseHtml(
        await enhanceProsemirrorHtml(`<pre data-type="mermaid">${encoded.innerHTML}</pre>`),
      )
      expect(unsafeContainer.querySelector('.mf-preview-block-error')).not.toBeNull()
    }
    expect(mermaidHarness.render).not.toHaveBeenCalled()

    const safeShape = parseHtml(
      await enhanceProsemirrorHtml(
        '<pre data-type="mermaid">flowchart TD; A@{ shape: rect }</pre>',
      ),
    )
    const safeUrlText = parseHtml(
      await enhanceProsemirrorHtml(
        '<pre data-type="mermaid">flowchart TD; A[&quot;Docs: https://example.com&quot;]</pre>',
      ),
    )

    expect(safeShape.querySelector('svg[data-rendered="mermaid"]')).not.toBeNull()
    expect(safeUrlText.querySelector('svg[data-rendered="mermaid"]')).not.toBeNull()
    expect(mermaidHarness.render).toHaveBeenCalledTimes(2)
  })

  test('resolves image URLs and makes task checkboxes read-only', async () => {
    const handleViewImgSrcUrl = vi.fn(async (source: string) => `asset://local/${source}`)
    const html = [
      '<img src="images/demo.png" alt="demo">',
      '<img src="file:///tmp/local.png" alt="local">',
      '<input type="checkbox" checked>',
    ].join('')

    const container = parseHtml(
      await enhanceProsemirrorHtml(html, { delegateOptions: { handleViewImgSrcUrl } }),
    )

    expect(handleViewImgSrcUrl).toHaveBeenCalledWith('images/demo.png')
    expect(handleViewImgSrcUrl).toHaveBeenCalledWith('file:///tmp/local.png')
    expect(container.querySelectorAll('img')[0].getAttribute('src')).toBe(
      'asset://local/images/demo.png',
    )
    expect(container.querySelectorAll('img')[1].getAttribute('src')).toBe(
      'asset://local/file:///tmp/local.png',
    )
    expect(container.querySelector('input')?.disabled).toBe(true)
    expect(container.querySelector('input')?.checked).toBe(true)
    expect(container.innerHTML).not.toContain('data-mf-preview-image')
  })

  test('resolves reference images without assigning the unresolved source first', async () => {
    const source = 'http://127.0.0.1/private.png'
    const handleViewImgSrcUrl = vi.fn(async () => 'asset://local/private.png')
    const setAttribute = vi.spyOn(HTMLImageElement.prototype, 'setAttribute')

    try {
      const container = parseHtml(
        await enhanceProsemirrorHtml('<img alt="private" data-refer-label="pic">', {
          delegateOptions: { handleViewImgSrcUrl },
          referenceDefinitions: new Map([
            [normalizeReference('pic'), { href: source, title: 'Private' }],
          ]),
        }),
      )

      expect(handleViewImgSrcUrl).toHaveBeenCalledWith(source)
      expect(setAttribute).not.toHaveBeenCalledWith('src', source)
      expect(container.querySelector('img')?.getAttribute('src')).toBe(
        'asset://local/private.png',
      )
      expect(container.querySelector('img')?.getAttribute('title')).toBe('Private')
      expect(container.querySelector('[data-refer-label]')).toBeNull()
    } finally {
      setAttribute.mockRestore()
    }
  })

  test('keeps Markdown image sources inert until host resolution completes', async () => {
    const source = 'http://127.0.0.1/private.png'
    const resolution = deferred<string>()
    const handleViewImgSrcUrl = vi.fn(() => resolution.promise)
    const setAttribute = vi.spyOn(HTMLImageElement.prototype, 'setAttribute')
    const doc = createWysiwygDelegate().stringToDoc(`![private](${source})`)

    try {
      const preview = rmeProsemirrorNodeToHtml(doc, { handleViewImgSrcUrl })
      await Promise.resolve()
      await Promise.resolve()

      expect(handleViewImgSrcUrl).toHaveBeenCalledWith(source)
      expect(setAttribute).not.toHaveBeenCalledWith('src', source)

      resolution.resolve('asset://local/private.png')
      const container = parseHtml(await preview)
      expect(container.querySelector('img')?.getAttribute('src')).toBe(
        'asset://local/private.png',
      )
      expect(container.innerHTML).not.toContain('data-mf-preview-image')
    } finally {
      setAttribute.mockRestore()
    }
  })

  test('prepares image hydration without waiting or exposing the source in live HTML', async () => {
    const source = 'http://127.0.0.1/private.png'
    const handleViewImgSrcUrl = vi.fn(async () => 'asset://local/private.png')
    const doc = createWysiwygDelegate().stringToDoc(`![private](${source})`)

    const preview = await prepareProsemirrorPreview(doc, { handleViewImgSrcUrl })
    const container = parseHtml(preview.html)
    const image = container.querySelector('img')
    const imageId = image?.dataset.mfPreviewImageId

    expect(handleViewImgSrcUrl).not.toHaveBeenCalled()
    expect(image?.getAttribute('src')).toMatch(/^data:image\/gif/)
    expect(imageId).toBeTruthy()
    expect(image?.hasAttribute('data-mf-preview-image-source')).toBe(false)
    expect(preview.html).not.toContain(source)
    expect(preview.html).not.toContain(encodeURIComponent(source))
    expect(preview.imageSources.get(imageId || '')).toBe(source)
  })

  test('preserves encoded remote HTML image URLs for deferred hydration', async () => {
    const source =
      'https://img.shields.io/badge/platforms-macOS%20%7C%20Linux-475569?style=flat-square'
    const handleViewImgSrcUrl = vi.fn(async () => 'blob:preview-image')
    const doc = createWysiwygDelegate().stringToDoc(
      `<div><img alt="Platforms" src="${source}"></div>`,
    )

    const preview = await prepareProsemirrorPreview(doc, { handleViewImgSrcUrl })
    const image = parseHtml(preview.html).querySelector('img')
    const imageId = image?.dataset.mfPreviewImageId

    expect(handleViewImgSrcUrl).not.toHaveBeenCalled()
    expect(imageId).toBeTruthy()
    expect(preview.imageSources.get(imageId || '')).toBe(source)
  })

  test('marks direct preview images for lazy asynchronous decoding', async () => {
    const source = 'https://example.com/image.png'
    const doc = createWysiwygDelegate().stringToDoc(`![image](${source})`)

    const preview = await prepareProsemirrorPreview(doc, {})
    const image = parseHtml(preview.html).querySelector('img')

    expect(image?.getAttribute('src')).toBe(source)
    expect(image?.getAttribute('loading')).toBe('lazy')
    expect(image?.getAttribute('decoding')).toBe('async')
    expect(image?.hasAttribute('data-mf-preview-image-id')).toBe(false)
    expect(preview.imageSources.size).toBe(0)
  })

  test('does not restore unsafe image sources without a host URL resolver', async () => {
    const container = parseHtml(
      await enhanceProsemirrorHtml(
        '<img src="file:///tmp/local.png"><img src="javascript:evil()">',
      ),
    )

    expect(Array.from(container.querySelectorAll('img')).every((image) => !image.hasAttribute('src')))
      .toBe(true)
  })

  test('removes image sources and private metadata when host resolution fails', async () => {
    const handleViewImgSrcUrl = vi.fn(async () => {
      throw new Error('Missing image')
    })
    const container = parseHtml(
      await enhanceProsemirrorHtml('<img src="images/missing.png">', {
        delegateOptions: { handleViewImgSrcUrl },
      }),
    )

    expect(container.querySelector('img')?.hasAttribute('src')).toBe(false)
    expect(container.innerHTML).not.toContain('data-mf-preview-image')
  })

  test('enhances the shared WYSIWYG Markdown parser output end to end', async () => {
    const markdown = [
      '```ts',
      'const answer: number = 42',
      '```',
      '',
      '```math',
      'x^2',
      '```',
      '',
      '<details><summary>More</summary>safe</details>',
      '',
      '<kbd>Ctrl</kbd>',
      '',
      '```mermaid',
      'graph TD; A-->B',
      '```',
      '',
      '![Logo][pic]',
      '',
      '[pic]: images/logo.png "Logo"',
    ].join('\n')
    const delegate = createWysiwygDelegate()
    const doc = delegate.stringToDoc(markdown)

    const container = parseHtml(await rmeProsemirrorNodeToHtml(doc, {}))

    expect(container.querySelector('.tok-keyword')?.textContent).toBe('const')
    expect(container.querySelector('.mf-preview-math > svg')).not.toBeNull()
    expect(container.querySelector('details')?.textContent).toContain('More')
    expect(container.querySelector('kbd')?.textContent).toBe('Ctrl')
    expect(container.querySelector('[data-type="html-inline"]')).toBeNull()
    expect(container.querySelector('svg[data-rendered="mermaid"]')).not.toBeNull()
    expect(container.querySelector('img[alt="Logo"]')?.getAttribute('src')).toBe(
      'images/logo.png',
    )
    expect(container.querySelector('.reference-def')).toBeNull()
  })

  test('keeps preview markers out of the shared HTML serializer', async () => {
    const delegate = createWysiwygDelegate()
    const doc = delegate.stringToDoc('```ts\nconst ok = true\n```\n\n<kbd>Ctrl</kbd>')
    const sharedHtml = prosemirrorNodeToHtml(doc)

    await rmeProsemirrorNodeToHtml(doc, {})

    expect(prosemirrorNodeToHtml(doc)).toBe(sharedHtml)
    expect(sharedHtml).not.toContain('data-type="code-block"')
    expect(sharedHtml).not.toContain('data-html=')
  })
})
