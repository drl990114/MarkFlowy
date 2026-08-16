import { act, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImagePreview } from './ImagePreview'

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}))

vi.mock('use-resize-observer', () => ({
  default: () => ({ height: 800, ref: vi.fn(), width: 1000 }),
}))

vi.mock('@/components/ui/tooltip', () => {
  const Passthrough = ({ children }: { children: ReactNode }) => <>{children}</>

  return {
    Tooltip: Passthrough,
    TooltipContent: Passthrough,
    TooltipTrigger: Passthrough,
  }
})

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'image_preview.actual_size': 'Actual size',
        'image_preview.fit_to_window': 'Fit to window',
        'image_preview.toolbar': 'Image preview controls',
        'image_preview.zoom_in': 'Zoom in',
        'image_preview.zoom_out': 'Zoom out',
      })[key] ?? key,
  }),
}))

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('ImagePreview', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
    vi.unstubAllGlobals()
  })

  function loadImage(width: number, height: number) {
    const image = container.querySelector('img')!
    Object.defineProperties(image, {
      naturalHeight: { configurable: true, value: height },
      naturalWidth: { configurable: true, value: width },
    })

    act(() => image.dispatchEvent(new Event('load', { bubbles: true })))
    return image
  }

  it('fits a large image to the viewport and exposes accessible controls', () => {
    act(() => root.render(<ImagePreview filePath='/images/landscape.png' />))

    const image = loadImage(2000, 1000)
    expect(image.getAttribute('src')).toBe('asset:///images/landscape.png')
    expect(image.getAttribute('alt')).toBe('landscape.png')
    expect(image.style.width).toBe('952px')
    expect(image.style.height).toBe('476px')
    expect(container.querySelector('[role="toolbar"]')?.getAttribute('aria-label')).toBe(
      'Image preview controls',
    )
    const viewport = container.querySelector('[data-slot="image-preview-viewport"]')!
    const toolbar = container.querySelector('[data-slot="image-preview-toolbar"]')!
    expect(viewport.contains(toolbar)).toBe(false)
    expect(toolbar.parentElement?.getAttribute('data-slot')).toBe('image-preview-footer')
    expect(container.querySelector('button[aria-label="Actual size"]')?.textContent).toBe('48%')
    expect(
      container.querySelector('button[aria-label="Fit to window"]')?.getAttribute('aria-pressed'),
    ).toBe('true')
  })

  it('zooms through preset levels and restores fit or actual size', () => {
    act(() => root.render(<ImagePreview filePath='/images/landscape.png' />))
    const image = loadImage(2000, 1000)
    const zoomIn = container.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!
    const actualSize = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Actual size"]',
    )!
    const fitToWindow = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Fit to window"]',
    )!

    act(() => zoomIn.click())
    expect(image.style.width).toBe('1000px')
    expect(actualSize.textContent).toBe('50%')

    act(() => actualSize.click())
    expect(image.style.width).toBe('2000px')
    expect(actualSize.textContent).toBe('100%')
    expect(actualSize.getAttribute('aria-pressed')).toBe('true')

    act(() => fitToWindow.click())
    expect(image.style.width).toBe('952px')
    expect(actualSize.textContent).toBe('48%')
    expect(fitToWindow.getAttribute('aria-pressed')).toBe('true')
  })

  it('allows fit-to-window below the minimum manual zoom level for very large images', () => {
    act(() => root.render(<ImagePreview filePath='/images/map.png' />))
    const image = loadImage(20000, 10000)
    const zoomIn = container.querySelector<HTMLButtonElement>('button[aria-label="Zoom in"]')!
    const zoomOut = container.querySelector<HTMLButtonElement>('button[aria-label="Zoom out"]')!
    const actualSize = container.querySelector<HTMLButtonElement>(
      'button[aria-label="Actual size"]',
    )!

    expect(image.style.width).toBe('952px')
    expect(actualSize.textContent).toBe('5%')

    act(() => zoomIn.click())
    expect(actualSize.textContent).toBe('10%')

    act(() => zoomOut.click())
    expect(image.style.width).toBe('952px')
    expect(actualSize.textContent).toBe('5%')
  })

  it('fits a tall image by viewport height without growing the preview frame', () => {
    act(() => root.render(<ImagePreview filePath='/images/portrait.png' />))
    const image = loadImage(1000, 4000)
    const frame = container.querySelector('[data-slot="image-preview-frame"]')!
    const preview = container.querySelector('[data-slot="image-preview"]')!
    const stage = container.querySelector<HTMLElement>('[data-slot="image-preview-stage"]')!

    expect(image.style.height).toBe('752px')
    expect(stage.style.height).toBe('800px')
    expect(frame.contains(preview)).toBe(true)
    expect(frame.classList.contains('absolute')).toBe(true)
    expect(preview.classList.contains('h-full')).toBe(true)
  })
})
