import type { Node as ProsemirrorNode } from '@rme-sdk/pm/model'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { eventBus } from '../../utils/eventbus'
import { Preview } from './preview'

const harness = vi.hoisted(() => ({
  renderPreview: vi.fn(),
}))

vi.mock('zens', () => ({
  Loading: () => <span data-loading='true' />,
}))

vi.mock('../../theme', () => ({
  WysiwygThemeWrapper: ({ children }: { children?: React.ReactNode }) => (
    <div data-theme-wrapper='true'>{children}</div>
  ),
}))

vi.mock('../../utils/prosemirrorNodeToHtml', () => ({
  rmeProsemirrorNodeToHtml: harness.renderPreview,
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
    descendants: (
      callback: (node: { type: { name: string } }) => boolean | undefined | void,
    ) => {
      nodeNames.forEach((name) => callback({ type: { name } }))
    },
  } as unknown as ProsemirrorNode
}

async function flushScheduledRender() {
  await act(async () => {
    vi.runOnlyPendingTimers()
    await Promise.resolve()
  })
}

describe('Preview', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.useFakeTimers()
    harness.renderPreview.mockReset()
    container = document.createElement('div')
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    vi.useRealTimers()
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
    harness.renderPreview.mockImplementation(
      async (
        _doc: ProsemirrorNode,
        options?: { handleViewImgSrcUrl?: (source: string) => Promise<string> },
      ) => {
        await options?.handleViewImgSrcUrl?.('image.png')
        return '<p>diagram</p>'
      },
    )

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

  test('finishes loading when the rendered document is empty', async () => {
    harness.renderPreview.mockResolvedValue('')

    act(() => root.render(<Preview doc={createDoc()} />))
    await flushScheduledRender()

    expect(container.querySelector('[data-loading="true"]')).toBeNull()
    expect(container.querySelector('.mf-preview-content')).not.toBeNull()
  })
})
