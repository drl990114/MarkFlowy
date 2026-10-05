import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStatusBarReveal } from './useStatusBarReveal'

const HOVER_ATTRIBUTE = 'data-mf-status-bar-hover'
const animationFrames = new Map<number, FrameRequestCallback>()
let nextAnimationFrame = 0

function Harness({ enabled = true }: { enabled?: boolean }) {
  const statusBarRef = useStatusBarReveal(enabled)

  return (
    <div data-testid='root'>
      <div data-testid='editor'>
        <span data-testid='content'>Document content</span>
      </div>
      <div className='app-status-bar' data-testid='status-bar' ref={statusBarRef}>
        <button type='button'>Status action</button>
      </div>
    </div>
  )
}

function setRect(element: HTMLElement, x: number, y: number, width: number, height: number) {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(x, y, width, height))
}

function renderHarness(enabled = true) {
  const view = render(<Harness enabled={enabled} />)
  const root = view.getByTestId('root')
  const editor = view.getByTestId('editor')
  const content = view.getByTestId('content')
  const statusBar = view.getByTestId('status-bar')
  setRect(root, 0, 0, 800, 600)
  setRect(editor, 0, 0, 800, 600)
  setRect(statusBar, 0, 568, 800, 32)
  return { ...view, root, editor, content, statusBar }
}

function movePointer(target: HTMLElement, options: Partial<PointerEventInit> = {}) {
  fireEvent.pointerMove(target, {
    pointerType: 'mouse',
    buttons: 0,
    clientX: 400,
    clientY: 580,
    ...options,
  })
}

function flushAnimationFrame() {
  act(() => {
    const pending = [...animationFrames.values()]
    animationFrames.clear()
    pending.forEach((callback) => callback(0))
  })
}

function addOverlayScrollbar(root: HTMLElement, className = 'os-scrollbar-visible') {
  const scrollbar = document.createElement('div')
  scrollbar.className = `os-scrollbar os-scrollbar-horizontal ${className}`
  root.append(scrollbar)
  setRect(scrollbar, 0, 592, 800, 8)
  return scrollbar
}

beforeEach(() => {
  nextAnimationFrame = 0
  animationFrames.clear()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    const id = ++nextAnimationFrame
    animationFrames.set(id, callback)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    animationFrames.delete(id)
  })
})

afterEach(() => {
  cleanup()
  animationFrames.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('useStatusBarReveal', () => {
  it('reveals from editor pointer events across the toolbar footprint without intercepting them', () => {
    const { content, statusBar } = renderHarness()
    const pointerMove = vi.fn((event: Event) => event.stopPropagation())
    content.addEventListener('pointermove', pointerMove)

    movePointer(content, { clientY: 568 })
    flushAnimationFrame()

    expect(pointerMove).toHaveBeenCalledOnce()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)

    movePointer(content, { clientY: 567 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)

    movePointer(content, { clientY: 599 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)

    movePointer(content, { clientX: 801 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
  })

  it('uses the latest pointer position when several moves arrive before a frame', () => {
    const { content, statusBar } = renderHarness()

    movePointer(content)
    movePointer(content, { clientY: 540 })
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
    expect(animationFrames.size).toBe(1)

    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)

    movePointer(content, { clientY: 540 })
    movePointer(content)
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)
  })

  it.each([
    { pointerType: 'touch', buttons: 0 },
    { pointerType: 'pen', buttons: 0 },
    { pointerType: 'mouse', buttons: 1 },
  ])('does not reveal during $pointerType input with buttons=$buttons', (options) => {
    const { content, statusBar } = renderHarness()

    movePointer(content, options)
    flushAnimationFrame()

    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
  })

  it.each(['pointerleave', 'pointercancel', 'blur'])(
    'clears visible and pending hover on %s',
    (eventType) => {
      const { root, content, statusBar } = renderHarness()
      const dispatchExit = () => {
        if (eventType === 'blur') fireEvent.blur(window)
        else fireEvent(root, new PointerEvent(eventType, { pointerType: 'mouse' }))
      }

      movePointer(content)
      flushAnimationFrame()
      expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)
      dispatchExit()
      flushAnimationFrame()
      expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)

      movePointer(content)
      dispatchExit()
      flushAnimationFrame()
      expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
    },
  )

  it('clears on editor pointerdown while preserving interaction inside the toolbar', () => {
    const { content, statusBar, getByRole } = renderHarness()

    movePointer(content)
    flushAnimationFrame()
    fireEvent.pointerDown(getByRole('button'), { pointerType: 'mouse', buttons: 1 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)

    fireEvent.pointerDown(content, { pointerType: 'mouse', buttons: 1 })
    movePointer(content, { buttons: 1 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
  })

  it('keeps visible overlay scrollbars usable even when the toolbar is already revealed', () => {
    const { root, content, statusBar } = renderHarness()
    addOverlayScrollbar(root)

    movePointer(content)
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)

    // The visible toolbar can become the event target before the pointer reaches
    // the scrollbar. Exclusion must use the underlying scrollbar's geometry.
    movePointer(statusBar, { clientY: 596 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
  })

  it.each(['unusable', 'hidden', 'not-visible'])(
    'does not reserve an inactive %s overlay scrollbar footprint',
    (state) => {
      const { root, content, statusBar } = renderHarness()
      const scrollbar = addOverlayScrollbar(
        root,
        state === 'not-visible'
          ? ''
          : `os-scrollbar-visible${state === 'unusable' ? ' os-scrollbar-unusable' : ''}`,
      )
      if (state === 'hidden') scrollbar.style.visibility = 'hidden'

      movePointer(content, { clientY: 596 })
      flushAnimationFrame()

      expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)
    },
  )

  it('excludes native horizontal and vertical scrollbar tracks on the pointer event path', () => {
    const { editor, content, statusBar } = renderHarness()
    editor.style.overflow = 'auto'
    for (const [property, value] of Object.entries({
      offsetWidth: 800,
      offsetHeight: 600,
      clientWidth: 788,
      clientHeight: 588,
      scrollWidth: 1600,
      scrollHeight: 1200,
    })) {
      Object.defineProperty(editor, property, { configurable: true, value })
    }

    movePointer(content, { clientY: 594 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)

    movePointer(content, { clientX: 794, clientY: 580 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)

    movePointer(content, { clientX: 400, clientY: 580 })
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)
  })

  it('finds a native scrollbar under the toolbar after the toolbar becomes the pointer target', () => {
    const { editor, content, statusBar } = renderHarness()
    editor.style.overflowY = 'auto'
    for (const [property, value] of Object.entries({
      offsetWidth: 800,
      offsetHeight: 600,
      clientWidth: 788,
      clientHeight: 600,
      scrollWidth: 788,
      scrollHeight: 1200,
    })) {
      Object.defineProperty(editor, property, { configurable: true, value })
    }

    movePointer(content)
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)

    const original = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint')
    const elementsFromPoint = vi.fn().mockReturnValue([statusBar, editor])
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: elementsFromPoint,
    })
    try {
      movePointer(statusBar, { clientX: 794, clientY: 580 })
      flushAnimationFrame()

      expect(elementsFromPoint).toHaveBeenCalledWith(794, 580)
      expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
    } finally {
      if (original) Object.defineProperty(document, 'elementsFromPoint', original)
      else Reflect.deleteProperty(document, 'elementsFromPoint')
    }
  })

  it('removes hover and ignores future pointer events when disabled', () => {
    const { content, statusBar, rerender } = renderHarness()

    movePointer(content)
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)

    movePointer(content)
    rerender(<Harness enabled={false} />)
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)

    movePointer(content)
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)

    rerender(<Harness enabled />)
    movePointer(content)
    flushAnimationFrame()
    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(true)
  })

  it('cancels pending hover when unmounted', () => {
    const { content, statusBar, unmount } = renderHarness()

    movePointer(content)
    unmount()
    flushAnimationFrame()

    expect(statusBar.hasAttribute(HOVER_ATTRIBUTE)).toBe(false)
    expect(animationFrames.size).toBe(0)
  })
})
