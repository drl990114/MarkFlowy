import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  acquirePrintTask,
  invokeSystemPrint,
  makePrintDocumentTransferable,
  preparePrintDocument,
  replaceInteractiveMedia,
} from './printDocument'

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

const originalFontsDescriptor = Object.getOwnPropertyDescriptor(document, 'fonts')

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  if (originalFontsDescriptor) {
    Object.defineProperty(document, 'fonts', originalFontsDescriptor)
  } else {
    Reflect.deleteProperty(document, 'fonts')
  }
})

describe('preparePrintDocument', () => {
  it('waits for Preview hydration, image decoding, and fonts before completing', async () => {
    const hydration = deferred()
    const fonts = deferred<FontFaceSet>()
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: fonts.promise },
    })

    const root = document.createElement('div')
    const image = document.createElement('img')
    image.src = 'https://example.com/diagram.png'
    let imageComplete = false
    let naturalWidth = 0
    Object.defineProperties(image, {
      complete: { configurable: true, get: () => imageComplete },
      naturalWidth: { configurable: true, get: () => naturalWidth },
    })
    const decode = vi.fn().mockResolvedValue(undefined)
    image.decode = decode
    root.append(image)

    let settled = false
    const preparation = preparePrintDocument({
      root,
      hydration: { settled: hydration.promise },
      interactiveMediaLabel: 'Interactive content',
      timeoutMs: 1_000,
    }).then((result) => {
      settled = true
      return result
    })

    await Promise.resolve()
    expect(settled).toBe(false)

    hydration.resolve()
    await Promise.resolve()
    expect(settled).toBe(false)

    imageComplete = true
    naturalWidth = 640
    image.dispatchEvent(new Event('load'))
    await Promise.resolve()
    expect(decode).toHaveBeenCalledOnce()
    expect(settled).toBe(false)

    fonts.resolve({} as FontFaceSet)
    await expect(preparation).resolves.toEqual({ failedImageCount: 0 })
  })

  it('counts an unavailable image but still prepares the printable document', async () => {
    const root = document.createElement('div')
    const image = document.createElement('img')
    image.alt = 'Missing chart'
    Object.defineProperties(image, {
      complete: { configurable: true, value: true },
      naturalWidth: { configurable: true, value: 0 },
    })
    root.append(image)

    await expect(
      preparePrintDocument({
        root,
        hydration: { settled: Promise.resolve() },
        interactiveMediaLabel: 'Interactive content',
      }),
    ).resolves.toEqual({ failedImageCount: 1 })
    expect(image.alt).toBe('Missing chart')
  })

  it('rejects rendered Preview block errors instead of printing their error UI', async () => {
    const root = document.createElement('div')
    root.innerHTML = '<div class="mf-preview-block-error">Mermaid rendering failed</div>'

    await expect(
      preparePrintDocument({
        root,
        hydration: { settled: Promise.resolve() },
        interactiveMediaLabel: 'Interactive content',
      }),
    ).rejects.toThrow('Mermaid rendering failed')
  })

  it('cancels pending resource work when its owner unmounts', async () => {
    const root = document.createElement('div')
    const image = document.createElement('img')
    image.src = 'https://example.com/pending.png'
    Object.defineProperty(image, 'complete', { configurable: true, value: false })
    root.append(image)
    const abortController = new AbortController()
    const preparation = preparePrintDocument({
      root,
      hydration: { settled: Promise.resolve() },
      interactiveMediaLabel: 'Interactive content',
      signal: abortController.signal,
    })
    const rejection = expect(preparation).rejects.toMatchObject({ name: 'AbortError' })

    abortController.abort()
    await rejection
  })

  it('rejects when the overall resource deadline is exceeded', async () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    const neverSettles = new Promise<void>(() => {})
    const preparation = preparePrintDocument({
      root,
      hydration: { settled: neverSettles },
      interactiveMediaLabel: 'Interactive content',
      timeoutMs: 15_000,
    })
    const rejection = expect(preparation).rejects.toThrow('Timed out')

    await vi.advanceTimersByTimeAsync(15_000)
    await rejection
  })

  it('replaces mask-based flat-list markers with printable inline SVG icons', async () => {
    const root = document.createElement('div')
    root.innerHTML = `
      <div class="prosemirror-flat-list" data-list-kind="bullet">
        <div class="list-marker"></div>
        <div class="list-content">Bullet</div>
      </div>
      <div class="prosemirror-flat-list" data-list-kind="toggle" data-list-collapsed>
        <div class="list-marker"></div>
        <div class="list-content">Toggle</div>
      </div>
    `

    await preparePrintDocument({
      root,
      hydration: { settled: Promise.resolve() },
      interactiveMediaLabel: 'Interactive content',
      timeoutMs: 100,
    })

    const markers = root.querySelectorAll('.mf-pdf-list-marker')
    expect(markers).toHaveLength(2)
    expect(markers[0]?.querySelector('svg circle')).not.toBeNull()
    expect(markers[1]?.querySelector('svg polygon')).not.toBeNull()
    expect(root.querySelector('[data-list-kind="toggle"]')?.hasAttribute('data-list-collapsed')).toBe(
      false,
    )
  })
})

describe('makePrintDocumentTransferable', () => {
  it('converts renderer-scoped blob images before sending HTML to another WebView', async () => {
    const root = document.createElement('div')
    const image = document.createElement('img')
    image.setAttribute('src', 'blob:preview-image')
    image.setAttribute('srcset', 'blob:preview-image 1x')
    root.append(image)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        blob: async () => new Blob(['image-bytes'], { type: 'image/png' }),
        ok: true,
      })),
    )

    await makePrintDocumentTransferable(root, new AbortController().signal)

    expect(image.src).toMatch(/^data:image\/png;base64,/)
    expect(image.hasAttribute('srcset')).toBe(false)
  })
})

describe('replaceInteractiveMedia', () => {
  it('replaces interactive content with printable source links', () => {
    const root = document.createElement('div')
    root.innerHTML = [
      '<iframe src="https://example.com/embed"></iframe>',
      '<video src="https://example.com/movie.mp4"></video>',
      '<iframe src="javascript:alert(1)"></iframe>',
      '<canvas></canvas>',
    ].join('')

    replaceInteractiveMedia(root, 'Interactive content')

    expect(root.querySelector('iframe, video, canvas')).toBeNull()
    expect(root.querySelectorAll('.mf-pdf-media-placeholder')).toHaveLength(4)
    expect(Array.from(root.querySelectorAll('a')).map((link) => link.href)).toEqual([
      'https://example.com/embed',
      'https://example.com/movie.mp4',
    ])
  })
})

describe('print task lifecycle', () => {
  it('allows only one print task until it is released', () => {
    const release = acquirePrintTask()
    expect(release).not.toBeNull()
    expect(acquirePrintTask()).toBeNull()

    release?.()
    const nextRelease = acquirePrintTask()
    expect(nextRelease).not.toBeNull()
    nextRelease?.()
  })

  it('accepts Promise-returning print bridges and observes afterprint', async () => {
    const target = new EventTarget()
    const printFinished = deferred()
    const fakeWindow = {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      print: vi.fn(() => printFinished.promise),
      clearTimeout: window.clearTimeout.bind(window),
      setTimeout: window.setTimeout.bind(window),
    } as unknown as Window

    const printing = invokeSystemPrint(fakeWindow)
    expect(fakeWindow.print).toHaveBeenCalledOnce()

    printFinished.resolve()
    target.dispatchEvent(new Event('afterprint'))
    await expect(printing).resolves.toBeUndefined()
  })

  it('keeps an async native print bridge alive until the native dialog completes', async () => {
    vi.useFakeTimers()
    const target = new EventTarget()
    const nativeCompletion = deferred()
    const fakeWindow = {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      print: vi.fn(() => Promise.resolve()),
      clearTimeout: window.clearTimeout.bind(window),
      setTimeout: window.setTimeout.bind(window),
    } as unknown as Window
    let settled = false
    const printing = invokeSystemPrint(fakeWindow, {
      nativeCompletion: nativeCompletion.promise,
      nativeFallbackMs: 1_000,
      standardFallbackMs: 10,
    }).then(() => {
      settled = true
    })

    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(250)
    expect(settled).toBe(false)

    nativeCompletion.resolve()
    await printing
    expect(settled).toBe(true)
  })

  it('uses a short fallback when afterprint is not dispatched', async () => {
    vi.useFakeTimers()
    const target = new EventTarget()
    const fakeWindow = {
      addEventListener: target.addEventListener.bind(target),
      removeEventListener: target.removeEventListener.bind(target),
      print: vi.fn(),
      clearTimeout: window.clearTimeout.bind(window),
      setTimeout: window.setTimeout.bind(window),
    } as unknown as Window

    const printing = invokeSystemPrint(fakeWindow, { standardFallbackMs: 250 })
    await vi.advanceTimersByTimeAsync(250)
    await expect(printing).resolves.toBeUndefined()
  })
})
