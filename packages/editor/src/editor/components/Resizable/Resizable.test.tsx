import type { NodeViewComponentProps } from '@rme-sdk/sdk/react'
import { editorLightTheme } from '@markflowy/theme'
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { ThemeProvider } from 'styled-components'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Resizable, ResizableRatioType, calculateResizableDimensions } from './Resizable'
import { ResizableHandleType } from './ResizableHandle'

function createPointerEvent(type: string, clientX: number, clientY: number): Event {
  const event = new MouseEvent(type, { bubbles: true, clientX, clientY })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  return event
}

describe('calculateResizableDimensions', () => {
  it('preserves the aspect ratio for corner resizing', () => {
    expect(
      calculateResizableDimensions({
        aspectRatio: ResizableRatioType.Fixed,
        deltaX: 50,
        deltaY: 20,
        handleType: ResizableHandleType.BottomRight,
        startHeight: 100,
        startWidth: 200,
      }),
    ).toEqual({ height: 125, width: 250 })
  })

  it('supports independent dimensions and clamps the editor width', () => {
    expect(
      calculateResizableDimensions({
        aspectRatio: ResizableRatioType.Flexible,
        deltaX: 30,
        deltaY: 20,
        handleType: ResizableHandleType.TopLeft,
        maxWidth: 160,
        startHeight: 100,
        startWidth: 200,
      }),
    ).toEqual({ height: 80, width: 160 })
  })
})

describe('Resizable pointer interaction', () => {
  let container: HTMLDivElement
  let root: Root
  let animationFrameCallback: FrameRequestCallback | undefined

  beforeEach(() => {
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
    animationFrameCallback = undefined
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        animationFrameCallback = callback
        return 1
      }),
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  it('renders frames directly and commits one attribute update on pointer up', () => {
    const updateAttributes = vi.fn()
    const editorDom = document.createElement('div')
    vi.spyOn(editorDom, 'getBoundingClientRect').mockReturnValue({
      bottom: 500,
      height: 500,
      left: 0,
      right: 800,
      top: 0,
      width: 800,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const nodeViewProps = {
      node: { attrs: { height: 100, width: 200 } },
      updateAttributes,
      view: { dom: editorDom },
    } as unknown as NodeViewComponentProps
    const props = {
      ...nodeViewProps,
      selected: true,
      getResizeAttributes: () => ({ 'data-rme-type': 'html' }),
    } as ComponentProps<typeof Resizable>

    act(() => {
      root.render(
        <ThemeProvider theme={editorLightTheme}>
          <Resizable {...props}>
            <img alt='' />
          </Resizable>
        </ThemeProvider>,
      )
    })

    const resizable = container.querySelector<HTMLElement>("[data-rme-resizable='true']")!
    vi.spyOn(resizable, 'getBoundingClientRect').mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })
    const handle = container.querySelectorAll<HTMLElement>('.rme-resizable-handle')[3]
    Object.defineProperties(handle, {
      hasPointerCapture: { value: vi.fn(() => true) },
      releasePointerCapture: { value: vi.fn() },
      setPointerCapture: { value: vi.fn() },
    })

    act(() => handle.dispatchEvent(createPointerEvent('pointerdown', 100, 100)))
    act(() => handle.dispatchEvent(createPointerEvent('pointermove', 150, 140)))

    expect(updateAttributes).not.toHaveBeenCalled()
    act(() => animationFrameCallback?.(0))
    expect(resizable.style.width).toBe('250px')
    expect(resizable.style.height).toBe('125px')
    expect(updateAttributes).not.toHaveBeenCalled()

    act(() => handle.dispatchEvent(createPointerEvent('pointerup', 160, 140)))
    expect(updateAttributes).toHaveBeenCalledOnce()
    expect(updateAttributes).toHaveBeenCalledWith({
      'data-rme-type': 'html',
      height: 130,
      width: 260,
    })
  })
})
