import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as DiagnosticsModule from './editorPerformanceDiagnostics'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

let diagnostics: typeof DiagnosticsModule
let clock = 0
let nextFrame = 0
const frames = new Map<number, FrameRequestCallback>()
const advanceFrame = () => {
  clock += 16
  const callbacks = [...frames.values()]
  frames.clear()
  callbacks.forEach((callback) => callback(clock))
}

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  clock = 0
  frames.clear()
  window.localStorage.setItem('mf:editor-performance', '1')
  delete window.__MF_EDITOR_PERFORMANCE__
  vi.spyOn(window.performance, 'now').mockImplementation(() => clock)
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
    frames.delete(id)
  })
  diagnostics = await import('./editorPerformanceDiagnostics')
})

afterEach(() => {
  window.localStorage.clear()
  document.body.replaceChildren()
  vi.clearAllTimers()
  vi.unstubAllGlobals()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function surface() {
  const panel = document.createElement('div')
  panel.dataset.editorId = 'file'
  const container = document.createElement('div')
  container.innerHTML =
    '<div data-cap-content><div data-cap-editable data-cap-key="document"><span data-cap-leaf>Actual text</span></div></div>'
  const input = document.createElement('textarea')
  input.setAttribute('data-cap-input', '')
  input.setAttribute('data-cap-dockey', 'document')
  const content = container.firstElementChild as HTMLElement
  vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({ width: 600, height: 400 } as DOMRect)
  panel.append(container)
  document.body.append(panel, input)
  return { panel, container }
}

describe('editor open diagnostics', () => {
  it('is opt-in, measures exact UTF-8 bytes after ready, and does not expose content or paths', async () => {
    window.localStorage.clear()
    expect(diagnostics.beginEditorOpenMeasurement('file')).toBeUndefined()
    expect(window.__MF_EDITOR_PERFORMANCE__).toBeUndefined()
    window.localStorage.setItem('mf:editor-performance', '1')
    const id = diagnostics.beginEditorOpenMeasurement('file')
    const encode = vi.spyOn(TextEncoder.prototype, 'encode')
    diagnostics.recordEditorOpenContent(id, '中文😀')
    expect(window.__MF_EDITOR_PERFORMANCE__?.opens?.[0].byteLength).toBeUndefined()
    expect(encode).not.toHaveBeenCalled()
    expect(JSON.stringify(window.__MF_EDITOR_PERFORMANCE__)).not.toContain('中文')
    diagnostics.finishEditorOpenMeasurement(id, 'ready')
    expect(window.__MF_EDITOR_PERFORMANCE__?.opens?.[0].duration).toBe(0)
    expect(encode).not.toHaveBeenCalled()
    await vi.runOnlyPendingTimersAsync()
    expect(encode).toHaveBeenCalledExactlyOnceWith('中文😀')
    expect(window.__MF_EDITOR_PERFORMANCE__?.opens?.[0].byteLength).toBe(10)
    expect(window.__MF_EDITOR_PERFORMANCE__?.opens?.[0].stages.at(-1)).toMatchObject({
      stage: 'content-measured',
      durationMs: 0,
    })
    expect(JSON.stringify(window.__MF_EDITOR_PERFORMANCE__)).not.toContain('中文')
  })

  it('drops canceled content without paying the deferred encoding cost', async () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const encode = vi.spyOn(TextEncoder.prototype, 'encode')
    diagnostics.recordEditorOpenContent(requestId, 'x'.repeat(2 * 1024 * 1024))
    diagnostics.finishEditorOpenMeasurement(requestId, 'canceled')
    await vi.runOnlyPendingTimersAsync()

    expect(encode).not.toHaveBeenCalled()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].byteLength).toBeUndefined()
  })

  it('correlates commands, cancels superseded views, and records each stage once', () => {
    const first = diagnostics.beginEditorOpenMeasurement('a', { viewId: 'left' })
    clock = 20
    const current = diagnostics.beginEditorOpenMeasurement('file', {
      viewId: 'left',
      kind: 'switch',
    })
    diagnostics.recordEditorOpenStage(first, 'obsolete')
    diagnostics.recordEditorOpenStage(current, 'parse', { runtimeElapsedMs: 10 })
    clock = 50
    diagnostics.recordEditorOpenStage(current, 'parse', {
      runtimeElapsedMs: 20,
      durationMs: 9,
      blockCount: 42,
    })
    expect(diagnostics.getEditorOpenMeasurement('a', 'left')).toBeUndefined()
    expect(diagnostics.getEditorOpenMeasurement('file', 'left')).toBe(current)
    const samples = window.__MF_EDITOR_PERFORMANCE__!.opens!
    expect(samples[0]).toMatchObject({ status: 'canceled', duration: 20 })
    expect(samples[1].stages.map((entry) => entry.stage)).toEqual(['requested', 'parse'])
    expect(samples[1].stages[1]).toMatchObject({
      elapsedMs: 0,
      latestElapsedMs: 30,
      runtimeElapsedMs: 20,
      durationMs: 9,
    })
    expect(samples[1].blockCount).toBe(42)
    diagnostics.finishEditorOpenMeasurement(current, 'ready')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('retains the host content revision that owns each recorded runtime stage', () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file', { viewId: 'right' })
    diagnostics.recordEditorOpenStage(requestId, 'host-content-ready', { contentRevision: 7 })
    diagnostics.recordEditorOpenStage(requestId, 'runtime-ready', {
      blockCount: 42,
      contentRevision: 7,
      mode: 'wysiwyg',
      moduleState: 'warm',
      runtimeEntrySha256: 'a'.repeat(64),
      runtimeVersion: '0.1.11',
    })

    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0]).toMatchObject({
      blockCount: 42,
      contentRevision: 7,
      fileId: 'file',
      mode: 'wysiwyg',
      moduleState: 'warm',
      openRequestId: requestId,
      runtimeEntrySha256: 'a'.repeat(64),
      runtimeVersion: '0.1.11',
      viewId: 'right',
    })
  })

  it('does not call a hidden or missing input surface ready', () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const { panel, container } = surface()
    panel.style.display = 'none'
    const cancel = diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('opening')
    panel.style.display = ''
    const input = getCapricornRuntimeInput(container)!
    input.disabled = true
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('opening')
    input.disabled = false
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('ready')
    cancel()
  })

  it('cancels stale document observations rather than reporting a new document ready', () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const { container } = surface()
    diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => false,
    })
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('canceled')
  })

  it('requires the visible panel to belong to the measured file identity', () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const { panel, container } = surface()
    panel.dataset.editorId = 'other-file'
    diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('opening')

    panel.dataset.editorId = 'file'
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('ready')
  })

  it('waits for visible source editors but ignores pending blocks outside the host viewport', () => {
    const { container } = surface()
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue({
      width: 600,
      height: 400,
      top: 100,
      bottom: 500,
      left: 0,
      right: 600,
    } as DOMRect)
    const pending = document.createElement('div')
    pending.setAttribute('data-cap-source-editor-pending', 'true')
    container.append(pending)
    const bounds = vi.spyOn(pending, 'getBoundingClientRect').mockReturnValue({
      width: 600,
      height: 200,
      top: 200,
      bottom: 400,
      left: 0,
      right: 600,
    } as DOMRect)
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('opening')
    bounds.mockReturnValue({
      width: 600,
      height: 200,
      top: 600,
      bottom: 800,
      left: 0,
      right: 600,
    } as DOMRect)
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].status).toBe('ready')
    const readyRequest = diagnostics.beginEditorOpenMeasurement('file')
    bounds.mockReturnValue({
      width: 600,
      height: 200,
      top: 200,
      bottom: 400,
      left: 0,
      right: 600,
    } as DOMRect)
    pending.removeAttribute('data-cap-source-editor-pending')
    diagnostics.observeEditorFirstPaint({
      requestId: readyRequest,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![1].status).toBe('ready')
  })

  it.each(['', ' \n\t'])(
    'confirms blank Markdown %j on initial open and warm switch',
    (markdown) => {
      const { container } = surface()
      container.querySelector('[data-cap-leaf]')!.textContent = '\ufeff'
      for (const kind of ['open', 'switch'] as const) {
        const requestId = diagnostics.beginEditorOpenMeasurement('file', { kind })
        diagnostics.recordEditorOpenContent(requestId, markdown, { onlyIfMissing: true })
        diagnostics.observeEditorFirstPaint({
          requestId,
          fileId: 'file',
          container,
          isCurrent: () => true,
        })
        advanceFrame()
        advanceFrame()
        expect(window.__MF_EDITOR_PERFORMANCE__!.opens!.at(-1)!.status).toBe('ready')
      }
    },
  )

  it('does not accept an empty placeholder for real content', () => {
    const { container } = surface()
    container.querySelector('[data-cap-leaf]')!.textContent = '\ufeff'
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    diagnostics.recordEditorOpenContent(requestId, 'expected text')
    diagnostics.recordEditorOpenContent(requestId, '', { onlyIfMissing: true })
    diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens!.at(-1)!).toMatchObject({ status: 'opening' })
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens!.at(-1)!.byteLength).toBeUndefined()
    diagnostics.finishEditorOpenMeasurement(requestId, 'canceled')
  })

  it('attributes immediate input to the correct split pane during paint confirmation', () => {
    const left = diagnostics.beginEditorOpenMeasurement('file', { viewId: 'left' })
    const right = diagnostics.beginEditorOpenMeasurement('file', { viewId: 'right' })
    const { container } = surface()
    diagnostics.observeEditorFirstPaint({
      requestId: right,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    diagnostics.recordEditorInteractionMeasurement('file', 0, 'right')
    advanceFrame()
    const samples = window.__MF_EDITOR_PERFORMANCE__!.opens!
    expect(samples[0].firstInputDuration).toBeUndefined()
    expect(samples[1]).toMatchObject({ status: 'opening', firstInputDuration: 16 })
    advanceFrame()
    diagnostics.finishEditorOpenMeasurement(left, 'canceled')
  })

  it('marks unverified surfaces explicitly and retains first-input latency separately', () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const { container } = surface()
    diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    const startedAt = diagnostics.startEditorInteractionMeasurement()
    diagnostics.recordEditorInteractionMeasurement('file', startedAt)
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].firstInputDuration).toBe(16)
    const missingId = diagnostics.beginEditorOpenMeasurement('file')
    getCapricornRuntimeInput(container)!.remove()
    diagnostics.observeEditorFirstPaint({
      requestId: missingId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    clock += 5_001
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![1].status).toBe('unverified')
  })

  it('records frame gaps without claiming native Long Tasks support', () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    clock = 100
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.responsiveness).toContainEqual({
      fileId: 'file',
      viewId: 'file',
      openRequestId: requestId,
      source: 'frame-gap',
      duration: 116,
      recordedAt: 116,
    })
    diagnostics.finishEditorOpenMeasurement(requestId, 'ready')
  })

  it('attributes WebKit fallback samples to every opening active during the gap', () => {
    const left = diagnostics.beginEditorOpenMeasurement('left-file', { viewId: 'left' })
    const right = diagnostics.beginEditorOpenMeasurement('right-file', { viewId: 'right' })
    clock = 100
    advanceFrame()

    expect(window.__MF_EDITOR_PERFORMANCE__!.responsiveness).toEqual([
      {
        fileId: 'left-file',
        viewId: 'left',
        openRequestId: left,
        source: 'frame-gap',
        duration: 116,
        recordedAt: 116,
      },
      {
        fileId: 'right-file',
        viewId: 'right',
        openRequestId: right,
        source: 'frame-gap',
        duration: 116,
        recordedAt: 116,
      },
    ])
    diagnostics.finishEditorOpenMeasurement(left, 'canceled')
    diagnostics.finishEditorOpenMeasurement(right, 'canceled')
  })

  it('attributes a delayed native Long Task delivery to the opening interval it crossed', () => {
    let deliver: PerformanceObserverCallback | undefined
    class FakePerformanceObserver {
      constructor(callback: PerformanceObserverCallback) {
        deliver = callback
      }

      observe() {}

      disconnect() {}
    }
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver)

    const requestId = diagnostics.beginEditorOpenMeasurement('file', { viewId: 'right' })
    clock = 40
    diagnostics.finishEditorOpenMeasurement(requestId, 'ready')
    deliver?.(
      {
        getEntries: () => [{ duration: 50, startTime: 10 } as PerformanceEntry],
      } as PerformanceObserverEntryList,
      {} as PerformanceObserver,
    )

    expect(window.__MF_EDITOR_PERFORMANCE__!.longTasks).toEqual([
      {
        fileId: 'file',
        viewId: 'right',
        openRequestId: requestId,
        duration: 50,
        startTime: 10,
      },
    ])
  })

  it('times real portal input after readiness and releases its listener on cleanup', () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const { container } = surface()
    let interactionStart: number | undefined
    const beforeInput = vi.fn(() => {
      interactionStart = diagnostics.startEditorInteractionMeasurement()
    })
    const cancel = diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
      onBeforeInput: beforeInput,
    })
    advanceFrame()
    advanceFrame()
    const input = getCapricornRuntimeInput(container)!
    expect(container.contains(input)).toBe(false)
    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    diagnostics.recordEditorInteractionMeasurement('file', interactionStart)
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].firstInputDuration).toBe(16)
    expect(beforeInput).toHaveBeenCalledOnce()
    cancel()
    input.dispatchEvent(new InputEvent('beforeinput', { bubbles: true }))
    expect(beforeInput).toHaveBeenCalledOnce()
  })

  it('separates painted input feedback from the intentionally debounced model commit', async () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file', { viewId: 'right' })
    const { container } = surface()
    let interactionStart: number | undefined
    const cancel = diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
      onBeforeInput: () => {
        interactionStart = diagnostics.startEditorInteractionMeasurement()
      },
    })
    advanceFrame()
    advanceFrame()

    getCapricornRuntimeInput(container)!.dispatchEvent(
      new InputEvent('beforeinput', { bubbles: true }),
    )
    clock += 8
    const mutationDelivered = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect()
        resolve()
      })
      observer.observe(container.querySelector('[data-cap-leaf]')!, { childList: true })
    })
    container.querySelector('[data-cap-leaf]')!.textContent = 'Actual textx'
    await mutationDelivered
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.interactions).toContainEqual({
      fileId: 'file',
      viewId: 'right',
      openRequestId: requestId,
      duration: 24,
      recordedAt: 56,
    })
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].firstInputDuration).toBe(24)
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].firstInputCommitDuration).toBeUndefined()

    clock = 532
    diagnostics.recordEditorInteractionMeasurement('file', interactionStart, 'right', 'commit')
    expect(window.__MF_EDITOR_PERFORMANCE__!.interactionCommits).toContainEqual({
      fileId: 'file',
      viewId: 'right',
      duration: 500,
      recordedAt: 532,
    })
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].firstInputCommitDuration).toBe(500)
    expect(window.__MF_EDITOR_PERFORMANCE__!.interactions).toHaveLength(1)
    cancel()
  })

  it('does not mistake an attribute-only editor update for painted text feedback', async () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const { container } = surface()
    const cancel = diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    getCapricornRuntimeInput(container)!.dispatchEvent(
      new InputEvent('beforeinput', { bubbles: true }),
    )
    container.querySelector('[data-cap-leaf]')!.setAttribute('data-selection-state', 'active')
    await Promise.resolve()
    advanceFrame()
    expect(window.__MF_EDITOR_PERFORMANCE__!.interactions).toEqual([])
    cancel()
  })

  it('records an Enter-style top-level child insertion as painted feedback', async () => {
    const requestId = diagnostics.beginEditorOpenMeasurement('file')
    const { container } = surface()
    const cancel = diagnostics.observeEditorFirstPaint({
      requestId,
      fileId: 'file',
      container,
      isCurrent: () => true,
    })
    advanceFrame()
    advanceFrame()
    getCapricornRuntimeInput(container)!.dispatchEvent(
      new InputEvent('beforeinput', { bubbles: true }),
    )
    clock += 7
    const editable = container.querySelector<HTMLElement>('[data-cap-editable]')!
    const mutationDelivered = new Promise<void>((resolve) => {
      const observer = new MutationObserver(() => {
        observer.disconnect()
        resolve()
      })
      observer.observe(editable, { childList: true })
    })
    const paragraph = document.createElement('div')
    paragraph.dataset.capKey = 'paragraph-2'
    paragraph.innerHTML = '<span data-cap-leaf><br></span>'
    editable.append(paragraph)
    await mutationDelivered
    advanceFrame()

    expect(window.__MF_EDITOR_PERFORMANCE__!.interactions).toContainEqual({
      fileId: 'file',
      viewId: 'file',
      openRequestId: requestId,
      duration: 23,
      recordedAt: 55,
    })
    cancel()
  })

  it('does not attach a late commit to a superseding open of the same file and pane', () => {
    const obsoleteRequestId = diagnostics.beginEditorOpenMeasurement('file')
    diagnostics.finishEditorOpenMeasurement(obsoleteRequestId, 'canceled')
    const currentRequestId = diagnostics.beginEditorOpenMeasurement('file')
    diagnostics.recordEditorOpenStage(currentRequestId, 'surface-committed')
    diagnostics.recordEditorInteractionMeasurement('file', 0, 'file', 'commit', obsoleteRequestId)
    expect(window.__MF_EDITOR_PERFORMANCE__!.interactionCommits).toHaveLength(1)
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![0].firstInputCommitDuration).toBeUndefined()
    expect(window.__MF_EDITOR_PERFORMANCE__!.opens![1].firstInputCommitDuration).toBeUndefined()
    expect(window.__MF_EDITOR_PERFORMANCE__!.interactionCommits![0].openRequestId).toBe(
      obsoleteRequestId,
    )
  })
})
