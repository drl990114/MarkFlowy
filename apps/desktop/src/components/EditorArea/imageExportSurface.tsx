import { EditorThemeContext } from '@/editorThemeContext'
import { SemanticThemeContext } from '@/themes/context'
import { rmeEditorTokens } from '@/themes/editorTokens'
import type { ContextType } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { CreateWysiwygDelegateOptions, EditorProps, PreviewImageHydration } from 'rme'
import { ThemeProvider, type DefaultTheme } from 'styled-components'
import { waitForPrintLayout } from './pdf-print/printDocument'
import { loadRmeRuntime, type RmeRuntime } from './rmeRuntime'
import { RmeThemeProvider } from './RmeThemeProvider'

const IMAGE_EXPORT_TIMEOUT_MS = 15_000

export interface ImageExportSurface {
  element: HTMLElement
  dispose: () => void
}

export interface CreateImageExportSurfaceOptions {
  source: HTMLElement
  markdown: string
  delegateOptions: CreateWysiwygDelegateOptions
  styleToken: EditorProps['styleToken']
  theme: DefaultTheme
  editorThemeConfig?: ContextType<typeof EditorThemeContext>
  semanticTheme?: ContextType<typeof SemanticThemeContext>
  loadRuntime?: () => Promise<RmeRuntime>
}

function abortError(): DOMException {
  return new DOMException('Image export was cancelled', 'AbortError')
}

function waitForAbortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError())
  return new Promise<T>((resolve, reject) => {
    const handleAbort = () => {
      signal.removeEventListener('abort', handleAbort)
      reject(abortError())
    }
    signal.addEventListener('abort', handleAbort, { once: true })
    promise.then(
      (value) => {
        signal.removeEventListener('abort', handleAbort)
        resolve(value)
      },
      (error) => {
        signal.removeEventListener('abort', handleAbort)
        reject(error)
      },
    )
  })
}

async function waitForImage(image: HTMLImageElement, signal: AbortSignal): Promise<void> {
  image.removeAttribute('loading')
  if (!image.getAttribute('src')) throw new Error('An image is unavailable for export.')
  if (!image.complete) {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        image.removeEventListener('load', handleLoad)
        image.removeEventListener('error', handleError)
        signal.removeEventListener('abort', handleAbort)
      }
      const handleLoad = () => {
        cleanup()
        resolve()
      }
      const handleError = () => {
        cleanup()
        reject(new Error('An image failed to load for export.'))
      }
      const handleAbort = () => {
        cleanup()
        reject(abortError())
      }
      if (signal.aborted) {
        reject(abortError())
        return
      }
      image.addEventListener('load', handleLoad, { once: true })
      image.addEventListener('error', handleError, { once: true })
      signal.addEventListener('abort', handleAbort, { once: true })
    })
  }
  if (image.naturalWidth <= 0) throw new Error('An image failed to load for export.')
  if (image.decode) {
    try {
      await waitForAbortable(image.decode(), signal)
    } catch (error) {
      // WebKit can reject decode() for an image it has already loaded.
      if (signal.aborted || image.naturalWidth <= 0) throw error
    }
  }
}

function assertRenderedPreview(element: HTMLElement, resourcesSettled = false): void {
  const error = element.querySelector<HTMLElement>(
    '.mf-preview-error, .mf-preview-block-error, .mf-math-error',
  )
  if (error) throw new Error(error.textContent?.trim() || 'Image export rendering failed.')
  if (
    !element.querySelector('.mf-preview-content') ||
    element.querySelector('.mf-preview-loading')
  ) {
    throw new Error('Image export preview is not ready.')
  }
  if (
    resourcesSettled &&
    (element.querySelector('.mf-preview-image-loading, .mf-preview-image-progress') ||
      element.querySelector('.mf-preview-content')?.parentElement?.getAttribute('aria-busy') ===
        'true')
  ) {
    throw new Error('Image export resources are not ready.')
  }
}

/** Render the read snapshot independently of editor mode, selection and virtualization. */
export async function createImageExportSurface({
  source,
  markdown,
  delegateOptions,
  styleToken,
  theme,
  editorThemeConfig = null,
  semanticTheme = null,
  loadRuntime = loadRmeRuntime,
}: CreateImageExportSurfaceOptions): Promise<ImageExportSurface> {
  const doc = source.ownerDocument
  const win = doc.defaultView
  if (!win) throw new Error('Image export document is unavailable.')
  const exportTheme = semanticTheme ? { ...theme, ...rmeEditorTokens(semanticTheme) } : theme
  const element = doc.createElement('div')
  element.dataset.mfImageExport = 'true'
  element.setAttribute('aria-hidden', 'true')
  element.inert = true
  Object.assign(element.style, {
    position: 'absolute',
    left: '-100000px',
    top: '0',
    width: `${source.getBoundingClientRect().width || source.clientWidth || 800}px`,
    height: 'auto',
    overflow: 'visible',
    visibility: 'visible',
    pointerEvents: 'none',
    backgroundColor: exportTheme.bgColor,
    color: exportTheme.primaryFontColor,
    fontFamily: exportTheme.fontFamily,
  })
  doc.body.append(element)
  const abortController = new AbortController()
  const { signal } = abortController
  let root: Root | undefined
  let disposed = false
  let currentHydration: PreviewImageHydration | undefined
  let resourceAbortController: AbortController | undefined
  let resolveHydration!: (hydration: PreviewImageHydration) => void
  let pendingHydration = new Promise<PreviewImageHydration>((resolve) => {
    resolveHydration = resolve
  })
  let rejectRendering!: (error: Error) => void
  const renderingFailure = new Promise<never>((_resolve, reject) => {
    rejectRendering = reject
  })
  const handleError = (error: unknown) => {
    if (!disposed) rejectRendering(error instanceof Error ? error : new Error(String(error)))
  }
  const handleHydration = (hydration: PreviewImageHydration | null) => {
    if (disposed) return
    if (hydration !== currentHydration) resourceAbortController?.abort()
    currentHydration = hydration ?? undefined
    if (hydration) resolveHydration(hydration)
    else {
      pendingHydration = new Promise<PreviewImageHydration>((resolve) => {
        resolveHydration = resolve
      })
    }
  }
  const dispose = () => {
    if (disposed) return
    disposed = true
    abortController.abort()
    try {
      root?.unmount()
    } finally {
      element.remove()
    }
  }
  const timeout = win.setTimeout(() => {
    handleError(new Error('Image export resources timed out.'))
  }, IMAGE_EXPORT_TIMEOUT_MS)

  try {
    await Promise.race([
      renderingFailure,
      (async () => {
        const runtime = await waitForAbortable(loadRuntime(), signal)
        if (disposed) throw abortError()
        const Preview = runtime.Preview
        root = createRoot(element, { onUncaughtError: handleError })
        root.render(
          <EditorThemeContext value={editorThemeConfig}>
            <SemanticThemeContext value={semanticTheme}>
              <RmeThemeProvider runtime={runtime}>
                <ThemeProvider theme={exportTheme}>
                  <Preview
                    doc={markdown}
                    delegateOptions={delegateOptions}
                    styleToken={styleToken}
                    handleLinkClick={() => true}
                    onError={handleError}
                    onImageHydrationChange={handleHydration}
                  />
                </ThemeProvider>
              </RmeThemeProvider>
            </SemanticThemeContext>
          </EditorThemeContext>,
        )
        while (!disposed) {
          const hydration = currentHydration ?? (await waitForAbortable(pendingHydration, signal))
          // Preview settles only after formulas/diagrams have rendered and image URLs resolve.
          await waitForAbortable(hydration.settled, signal)
          if (hydration !== currentHydration) continue
          assertRenderedPreview(element)
          const resources = new AbortController()
          resourceAbortController = resources
          const abortResources = () => resources.abort()
          signal.addEventListener('abort', abortResources, { once: true })
          try {
            await Promise.all([
              ...Array.from(element.querySelectorAll<HTMLImageElement>('img'), (image) =>
                waitForImage(image, resources.signal),
              ),
              ...('fonts' in doc ? [waitForAbortable(doc.fonts.ready, resources.signal)] : []),
            ])
            await waitForPrintLayout(element, resources.signal, win)
          } catch (error) {
            if (hydration === currentHydration) throw error
          } finally {
            signal.removeEventListener('abort', abortResources)
            resources.abort()
            if (resourceAbortController === resources) resourceAbortController = undefined
          }
          if (hydration === currentHydration) {
            assertRenderedPreview(element, true)
            return
          }
        }
        throw abortError()
      })(),
    ])
    return { element, dispose }
  } catch (error) {
    dispose()
    throw error
  } finally {
    win.clearTimeout(timeout)
  }
}
