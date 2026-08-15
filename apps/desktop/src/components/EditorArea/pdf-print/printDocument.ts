const DEFAULT_PRINT_RESOURCE_TIMEOUT_MS = 15_000
const AFTER_PRINT_FALLBACK_MS = 250
const NATIVE_PRINT_FALLBACK_MS = 30 * 60_000

export interface PrintImagePreparationResult {
  failedImageCount: number
}

export interface PrintHydration {
  settled: Promise<void>
}

export interface PreparePrintDocumentOptions {
  root: HTMLElement
  hydration: PrintHydration
  interactiveMediaLabel: string
  timeoutMs?: number
  document?: Document
  signal?: AbortSignal
  window?: Window
}

export interface InvokeSystemPrintOptions {
  nativeCompletion?: Promise<void>
  nativeFallbackMs?: number
  standardFallbackMs?: number
}

let printTaskActive = false

export function acquirePrintTask(): (() => void) | null {
  if (printTaskActive) return null

  printTaskActive = true
  let released = false

  return () => {
    if (released) return
    released = true
    printTaskActive = false
  }
}

function createAbortError(): DOMException {
  return new DOMException('Print task was cancelled', 'AbortError')
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw createAbortError()
}

function waitForAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal)

  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      cleanup()
      reject(createAbortError())
    }
    const cleanup = () => signal.removeEventListener('abort', handleAbort)

    signal.addEventListener('abort', handleAbort, { once: true })
    promise.then(
      (value) => {
        cleanup()
        resolve(value)
      },
      (error) => {
        cleanup()
        reject(error)
      },
    )
  })
}

function readBlobAsDataUrl(blob: Blob, signal: AbortSignal): Promise<string> {
  return waitForAbortable(
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.addEventListener('load', () => {
        if (typeof reader.result === 'string') resolve(reader.result)
        else reject(new Error('Failed to serialize an image for the PDF print window'))
      })
      reader.addEventListener('error', () => {
        reject(reader.error || new Error('Failed to serialize an image for the PDF print window'))
      })
      reader.readAsDataURL(blob)
    }),
    signal,
  )
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  win: Window,
  handleTimeout: () => void,
): Promise<T> {
  let timeoutHandle: number | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutHandle = win.setTimeout(() => {
      reject(new Error('Timed out while preparing the document for printing'))
      handleTimeout()
    }, timeoutMs)
  })

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutHandle !== undefined) win.clearTimeout(timeoutHandle)
  })
}

function getMediaSource(element: Element): string | null {
  if (element instanceof HTMLMediaElement) {
    return (
      element.currentSrc ||
      element.getAttribute('src') ||
      element.querySelector('source[src]')?.getAttribute('src') ||
      null
    )
  }

  return element.getAttribute('src')
}

function getSafeWebUrl(source: string, doc: Document): string | null {
  try {
    const url = new URL(source, doc.baseURI)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

function createListMarkerIcon(kind: 'bullet' | 'toggle', doc: Document): SVGSVGElement {
  const svgNamespace = 'http://www.w3.org/2000/svg'
  const svg = doc.createElementNS(svgNamespace, 'svg')
  svg.classList.add('mf-pdf-list-marker-icon')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('focusable', 'false')

  if (kind === 'bullet') {
    const circle = doc.createElementNS(svgNamespace, 'circle')
    circle.setAttribute('cx', '12')
    circle.setAttribute('cy', '12')
    circle.setAttribute('r', '2.5')
    circle.setAttribute('fill', 'currentColor')
    svg.append(circle)
  } else {
    const polygon = doc.createElementNS(svgNamespace, 'polygon')
    polygon.setAttribute('points', '8,10 12,14 16,10')
    polygon.setAttribute('fill', 'currentColor')
    svg.append(polygon)
  }

  return svg
}

function replaceUnsupportedListMarkers(root: HTMLElement, doc: Document): void {
  root
    .querySelectorAll<HTMLElement>(
      ".prosemirror-flat-list[data-list-kind='bullet'] > .list-marker, " +
        ".prosemirror-flat-list[data-list-kind='toggle'] > .list-marker",
    )
    .forEach((marker) => {
      const list = marker.parentElement
      if (!list) return
      const kind = list.dataset.listKind
      if (kind !== 'bullet' && kind !== 'toggle') return

      if (kind === 'toggle') list.removeAttribute('data-list-collapsed')
      marker.classList.add('mf-pdf-list-marker')
      marker.replaceChildren(createListMarkerIcon(kind, doc))
    })
}

export function replaceInteractiveMedia(
  root: HTMLElement,
  label: string,
  doc: Document = document,
): void {
  root.querySelectorAll('iframe, video, audio, canvas').forEach((element) => {
    const placeholder = doc.createElement('aside')
    placeholder.className = 'mf-pdf-media-placeholder'
    placeholder.setAttribute('role', 'note')

    const labelElement = doc.createElement('span')
    labelElement.textContent = label
    placeholder.append(labelElement)

    const source = getMediaSource(element)
    const safeUrl = source ? getSafeWebUrl(source, doc) : null
    if (safeUrl) {
      const link = doc.createElement('a')
      link.href = safeUrl
      link.textContent = source!
      placeholder.append(link)
    }

    element.replaceWith(placeholder)
  })
}

async function waitForImage(image: HTMLImageElement, signal: AbortSignal): Promise<boolean> {
  throwIfAborted(signal)
  image.removeAttribute('loading')

  const decodeLoadedImage = async () => {
    if (image.naturalWidth <= 0) return false
    if (!image.decode) return true

    try {
      await waitForAbortable(image.decode(), signal)
    } catch {
      // Some WebViews reject decode() for images that are already visibly loaded.
      // naturalWidth remains the reliable fallback in that case.
    }
    return image.naturalWidth > 0
  }

  if (!image.getAttribute('src')) return false
  if (image.complete) return decodeLoadedImage()

  const loaded = await new Promise<boolean>((resolve, reject) => {
    const handleLoad = () => {
      cleanup()
      resolve(true)
    }
    const handleError = () => {
      cleanup()
      resolve(false)
    }
    const cleanup = () => {
      image.removeEventListener('load', handleLoad)
      image.removeEventListener('error', handleError)
      signal.removeEventListener('abort', handleAbort)
    }
    const handleAbort = () => {
      cleanup()
      reject(createAbortError())
    }

    image.addEventListener('load', handleLoad, { once: true })
    image.addEventListener('error', handleError, { once: true })
    signal.addEventListener('abort', handleAbort, { once: true })
  })

  return loaded ? decodeLoadedImage() : false
}

async function waitForImages(root: HTMLElement, signal: AbortSignal): Promise<number> {
  const results = await Promise.all(
    Array.from(root.querySelectorAll<HTMLImageElement>('img')).map((image) =>
      waitForImage(image, signal),
    ),
  )
  return results.filter((loaded) => !loaded).length
}

async function waitForFonts(doc: Document, signal: AbortSignal): Promise<void> {
  if ('fonts' in doc) {
    await waitForAbortable(doc.fonts.ready, signal)
  }
}

async function waitForLayout(
  root: HTMLElement,
  win: Window,
  signal: AbortSignal,
): Promise<void> {
  throwIfAborted(signal)
  void root.offsetHeight

  await new Promise<void>((resolve, reject) => {
    let settled = false
    let firstFrame = 0
    let secondFrame = 0
    const cleanup = () => {
      win.clearTimeout(fallback)
      if (firstFrame) win.cancelAnimationFrame(firstFrame)
      if (secondFrame) win.cancelAnimationFrame(secondFrame)
      signal.removeEventListener('abort', handleAbort)
    }
    const settle = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }
    const fallback = win.setTimeout(settle, 50)
    const handleAbort = () => {
      if (settled) return
      settled = true
      cleanup()
      reject(createAbortError())
    }
    signal.addEventListener('abort', handleAbort, { once: true })

    firstFrame = win.requestAnimationFrame(() => {
      secondFrame = win.requestAnimationFrame(settle)
    })
  })
}

export function waitForPrintLayout(
  root: HTMLElement,
  signal: AbortSignal,
  win: Window = window,
): Promise<void> {
  return waitForLayout(root, win, signal)
}

export async function makePrintDocumentTransferable(
  root: HTMLElement,
  signal: AbortSignal,
): Promise<void> {
  const blobImages = Array.from(
    root.querySelectorAll<HTMLImageElement>('img[src^="blob:"]'),
  )

  await Promise.all(
    blobImages.map(async (image) => {
      const source = image.getAttribute('src')
      if (!source) return

      const response = await waitForAbortable(fetch(source), signal)
      if (!response.ok) throw new Error('Failed to serialize an image for the PDF print window')
      const dataUrl = await readBlobAsDataUrl(await response.blob(), signal)
      image.removeAttribute('srcset')
      image.setAttribute('src', dataUrl)
    }),
  )
}

export async function preparePrintDocument({
  root,
  hydration,
  interactiveMediaLabel,
  timeoutMs = DEFAULT_PRINT_RESOURCE_TIMEOUT_MS,
  document: doc = document,
  signal,
  window: win = window,
}: PreparePrintDocumentOptions): Promise<PrintImagePreparationResult> {
  const taskAbortController = new AbortController()
  const handleExternalAbort = () => taskAbortController.abort()
  signal?.addEventListener('abort', handleExternalAbort, { once: true })

  try {
    return await withTimeout(
      (async () => {
        await waitForAbortable(hydration.settled, taskAbortController.signal)
        const renderError = root.querySelector<HTMLElement>(
          '.mf-preview-error, .mf-preview-block-error',
        )
        if (renderError) {
          throw new Error(renderError.textContent?.trim() || 'Preview rendering failed')
        }
        replaceInteractiveMedia(root, interactiveMediaLabel, doc)
        replaceUnsupportedListMarkers(root, doc)

        const [failedImageCount] = await Promise.all([
          waitForImages(root, taskAbortController.signal),
          waitForFonts(doc, taskAbortController.signal),
        ])
        await waitForLayout(root, win, taskAbortController.signal)

        return { failedImageCount }
      })(),
      timeoutMs,
      win,
      () => taskAbortController.abort(),
    )
  } finally {
    signal?.removeEventListener('abort', handleExternalAbort)
    taskAbortController.abort()
  }
}

export async function invokeSystemPrint(
  win: Window = window,
  {
    nativeCompletion,
    nativeFallbackMs = NATIVE_PRINT_FALLBACK_MS,
    standardFallbackMs = AFTER_PRINT_FALLBACK_MS,
  }: InvokeSystemPrintOptions = {},
): Promise<void> {
  let afterPrintFired = false
  let resolveAfterPrint!: () => void
  const afterPrint = new Promise<void>((resolve) => {
    resolveAfterPrint = resolve
  })
  const handleAfterPrint = () => {
    afterPrintFired = true
    resolveAfterPrint()
  }

  win.addEventListener('afterprint', handleAfterPrint, { once: true })

  try {
    const printResult = (win.print as () => unknown)()
    const usesAsyncNativeBridge =
      typeof printResult === 'object' &&
      printResult !== null &&
      'then' in printResult &&
      typeof printResult.then === 'function'

    await Promise.resolve(printResult)
    if (!afterPrintFired) {
      let fallbackHandle: number | undefined
      try {
        const completions = [afterPrint]
        if (usesAsyncNativeBridge && nativeCompletion) completions.push(nativeCompletion)
        completions.push(
          new Promise<void>((resolve) => {
            fallbackHandle = win.setTimeout(
              resolve,
              usesAsyncNativeBridge ? nativeFallbackMs : standardFallbackMs,
            )
          }),
        )
        await Promise.race(completions)
      } finally {
        if (fallbackHandle !== undefined) win.clearTimeout(fallbackHandle)
      }
    }
  } finally {
    win.removeEventListener('afterprint', handleAfterPrint)
  }
}
