import type { Node as ProsemirrorNode } from '@rme-sdk/sdk/pm/model'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { eventBus } from '../../utils/eventbus'
import { Preview, type PreviewImageHydration } from './preview'

const harness = vi.hoisted(() => ({
  renderPreview: vi.fn(),
}))

vi.mock('@markflowy/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('../../theme', () => ({
  WysiwygThemeWrapper: ({ children }: { children?: React.ReactNode }) => (
    <div data-theme-wrapper='true'>{children}</div>
  ),
}))

vi.mock('../../utils/prosemirrorNodeToHtml', () => ({
  prepareProsemirrorPreview: async (...args: unknown[]) => {
    const result = await harness.renderPreview(...args)
    return typeof result === 'string'
      ? { html: result, imageSources: new Map<string, string>() }
      : result
  },
}))

vi.mock('../Editor', () => ({
  defaultStyleToken: {},
}))

vi.mock('../WysiwygEditor', () => ({
  createWysiwygDelegate: vi.fn(),
}))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })

  return { promise, reject, resolve }
}

function createDoc(...nodeNames: string[]): ProsemirrorNode {
  return {
    descendants: (callback: (node: { type: { name: string } }) => boolean | undefined | void) => {
      nodeNames.forEach((name) => callback({ type: { name } }))
    },
  } as unknown as ProsemirrorNode
}

async function flushScheduledRender() {
  await act(async () => {
    vi.runOnlyPendingTimers()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
  await act(async () => {
    await Promise.resolve()
  })
}

describe('Preview', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
    vi.useFakeTimers()
    harness.renderPreview.mockReset()
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  test('does not let an older document render overwrite the latest document', async () => {
    const firstRender = deferred<string>()
    const secondRender = deferred<string>()
    const firstDoc = createDoc()
    const secondDoc = createDoc()
    harness.renderPreview
      .mockReturnValueOnce(firstRender.promise)
      .mockReturnValueOnce(secondRender.promise)

    act(() => root.render(<Preview doc={firstDoc} />))
    await flushScheduledRender()
    act(() => root.render(<Preview doc={secondDoc} />))
    await flushScheduledRender()

    await act(async () => secondRender.resolve('<p>latest</p>'))
    expect(container.textContent).toBe('latest')

    await act(async () => firstRender.resolve('<p>stale</p>'))
    expect(container.textContent).toBe('latest')
  })

  test('rerenders Mermaid content after the editor theme changes', async () => {
    const firstRender = deferred<string>()
    const themedRender = deferred<string>()
    harness.renderPreview
      .mockReturnValueOnce(firstRender.promise)
      .mockReturnValueOnce(themedRender.promise)

    act(() => root.render(<Preview doc={createDoc('mermaid_node')} />))
    await flushScheduledRender()

    act(() => {
      eventBus.emit('change-theme')
    })
    await flushScheduledRender()
    expect(harness.renderPreview).toHaveBeenCalledTimes(2)

    await act(async () => themedRender.resolve('<p>dark diagram</p>'))
    await act(async () => firstRender.resolve('<p>light diagram</p>'))
    expect(container.textContent).toBe('dark diagram')
  })

  test('does not reprocess documents without Mermaid on theme changes', async () => {
    harness.renderPreview.mockResolvedValue('<p>plain</p>')

    act(() => root.render(<Preview doc={createDoc('paragraph')} />))
    await flushScheduledRender()
    act(() => {
      eventBus.emit('change-theme')
    })
    await flushScheduledRender()

    expect(harness.renderPreview).toHaveBeenCalledOnce()
  })

  test('reuses resolved images when a Mermaid theme rerender is required', async () => {
    const resolveImage = vi.fn(async (source: string) => `asset://local/${source}`)
    harness.renderPreview.mockImplementation(async () => ({
      html: [
        '<p>diagram</p>',
        '<p><img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="',
        ' data-mf-preview-image-id="image-1"></p>',
      ].join(''),
      imageSources: new Map([['image-1', 'image.png']]),
    }))

    act(() =>
      root.render(
        <Preview
          doc={createDoc('mermaid_node')}
          delegateOptions={{ handleViewImgSrcUrl: resolveImage }}
        />,
      ),
    )
    await flushScheduledRender()
    act(() => {
      eventBus.emit('change-theme')
    })
    await flushScheduledRender()

    expect(harness.renderPreview).toHaveBeenCalledTimes(2)
    expect(resolveImage).toHaveBeenCalledOnce()
  })

  test('does not let the inert placeholder settle the real image request', async () => {
    const imageResolution = deferred<string>()
    const hydrationStarted = deferred<void>()
    let imageHydration: PreviewImageHydration | null = null
    const resolveImage = vi.fn(() => {
      hydrationStarted.resolve()
      return imageResolution.promise
    })
    harness.renderPreview.mockResolvedValue({
      html: [
        '<img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="',
        ' data-mf-preview-image-id="image-1">',
      ].join(''),
      imageSources: new Map([['image-1', 'image.png']]),
    })

    act(() =>
      root.render(
        <Preview
          doc={createDoc()}
          delegateOptions={{ handleViewImgSrcUrl: resolveImage }}
          onImageHydrationChange={(hydration) => {
            imageHydration = hydration
          }}
        />,
      ),
    )
    await flushScheduledRender()
    await act(async () => hydrationStarted.promise)

    const activeHydration = imageHydration as PreviewImageHydration | null
    expect(activeHydration).not.toBeNull()
    let hydrationSettled = false
    void activeHydration?.settled.then(() => {
      hydrationSettled = true
    })
    await act(async () => Promise.resolve())
    expect(hydrationSettled).toBe(false)

    const image = container.querySelector('img')
    expect(image).not.toBeNull()
    expect(image?.hasAttribute('loading')).toBe(false)
    expect(image?.getAttribute('decoding')).toBe('async')
    expect(image?.referrerPolicy).toBe('no-referrer')
    expect(image?.getAttribute('aria-busy')).toBe('true')
    const imageProgress = container.querySelector('.mf-preview-image-progress')
    expect(imageProgress?.getAttribute('aria-label')).toBe('common.loading')
    expect(imageProgress?.textContent).toBe('')
    expect(imageProgress?.querySelector('.mf-preview-image-progress-track')).not.toBeNull()
    act(() => image?.dispatchEvent(new Event('load')))
    expect(image?.classList.contains('mf-preview-image-loading')).toBe(true)
    const removeAttribute = vi.spyOn(image as HTMLImageElement, 'removeAttribute')

    await act(async () => {
      imageResolution.resolve('asset://localhost/image.png')
      await activeHydration?.settled
    })
    const hydratedImage = container.querySelector('img')
    expect(hydratedImage).toBe(image)
    expect(hydratedImage?.getAttribute('src')).toBe('asset://localhost/image.png')
    expect(hydrationSettled).toBe(true)
    expect(removeAttribute).not.toHaveBeenCalledWith('src')

    act(() => hydratedImage?.dispatchEvent(new Event('error')))
    expect(hydratedImage?.hasAttribute('src')).toBe(false)
    expect(hydratedImage?.classList.contains('mf-preview-image-loading')).toBe(false)
  })

  test('keeps native lazy loading for direct images that do not replace placeholders', async () => {
    harness.renderPreview.mockResolvedValue({
      html: '<img src="https://example.com/direct.png">',
      imageSources: new Map(),
    })

    act(() => root.render(<Preview doc={createDoc()} />))
    await flushScheduledRender()

    const image = container.querySelector('img')
    expect(image?.getAttribute('src')).toBe('https://example.com/direct.png')
    expect(image?.getAttribute('loading')).toBe('lazy')
    expect(image?.getAttribute('decoding')).toBe('async')
    expect(image?.referrerPolicy).toBe('no-referrer')
  })

  test('falls back to the encoded remote source when its resolved Blob cannot render', async () => {
    const source =
      'https://img.shields.io/github/commit-activity/m/drl990114/MarkFlowy?color=%23ff9900'
    const resolveImage = vi.fn(async () => 'blob:preview-badge')
    harness.renderPreview.mockResolvedValue({
      html: [
        '<img alt="Commit Activity"',
        ' src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs="',
        ' data-mf-preview-image-id="image-1">',
      ].join(''),
      imageSources: new Map([['image-1', source]]),
    })

    act(() =>
      root.render(
        <Preview
          doc={createDoc()}
          delegateOptions={{ handleViewImgSrcUrl: resolveImage }}
        />,
      ),
    )
    await flushScheduledRender()

    const image = container.querySelector('img')
    expect(image?.getAttribute('src')).toBe('blob:preview-badge')

    act(() => image?.dispatchEvent(new Event('error')))
    expect(image?.getAttribute('src')).toBe(source)
    expect(image?.classList.contains('mf-preview-image-loading')).toBe(true)

    act(() => image?.dispatchEvent(new Event('load')))
    expect(image?.getAttribute('src')).toBe(source)
    expect(image?.classList.contains('mf-preview-image-loading')).toBe(false)
  })

  test('finishes loading when the rendered document is empty', async () => {
    harness.renderPreview.mockResolvedValue('')

    act(() => root.render(<Preview doc={createDoc()} />))
    await flushScheduledRender()

    expect(container.querySelector('.mf-preview-loading')).toBeNull()
    expect(container.querySelector('.mf-preview-content')).not.toBeNull()
  })
})
