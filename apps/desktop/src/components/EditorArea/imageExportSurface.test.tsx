// @vitest-environment jsdom
import { EditorThemeContext, type EditorThemeConfig } from '@/editorThemeContext'
import { SemanticThemeContext } from '@/themes/context'
import { getThemeTokens } from '@/themes/runtime'
import { desktopLightTheme, lightTheme } from '@markflowy/theme'
import {
  act,
  useContext,
  useLayoutEffect,
  useRef,
  type ComponentProps,
  type ReactNode,
} from 'react'
import { ThemeContext } from 'styled-components'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createImageExportSurface,
  type CreateImageExportSurfaceOptions,
  type ImageExportSurface,
} from './imageExportSurface'
import type { RmeRuntime } from './rmeRuntime'

vi.mock('@/stores/useThemeStore', () => ({
  FALLBACK_LIGHT_THEME: 'MarkFlowy Light',
  FALLBACK_DARK_THEME: 'MarkFlowy Dark',
}))

type PreviewProps = ComponentProps<RmeRuntime['Preview']>

function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function fakeRuntime({
  hydration = Promise.resolve(),
  html = '<p>Prepared snapshot</p>',
  error,
  className = 'mf-preview-content',
  onMount,
}: {
  hydration?: Promise<void>
  html?: string
  error?: Error
  className?: string
  onMount?: (element: HTMLDivElement) => void
} = {}) {
  const unmount = vi.fn()
  let props: PreviewProps | undefined
  const context: { editor?: EditorThemeConfig | null; theme?: unknown; semantic?: unknown } = {}
  const Preview = (previewProps: PreviewProps) => {
    props = previewProps
    context.editor = useContext(EditorThemeContext)
    context.semantic = useContext(SemanticThemeContext)
    context.theme = useContext(ThemeContext)
    const ref = useRef<HTMLDivElement>(null)
    const { onError, onImageHydrationChange } = previewProps
    useLayoutEffect(() => {
      if (ref.current) onMount?.(ref.current)
      if (error) onError?.(error)
      onImageHydrationChange?.({ settled: hydration })
      return () => {
        unmount()
        onImageHydrationChange?.(null)
      }
    }, [onError, onImageHydrationChange])
    return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
  }
  const runtime = {
    Preview,
    lightTheme: { codemirrorTheme: { settings: {}, styles: [] } },
    darkTheme: { codemirrorTheme: { settings: {}, styles: [] } },
    ThemeProvider: ({ children }: { children: ReactNode }) => children,
  } as unknown as RmeRuntime
  return { runtime, unmount, context, getProps: () => props! }
}

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
const surfaces: ImageExportSurface[] = []

beforeAll(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})
afterAll(() => {
  delete actEnvironment.IS_REACT_ACT_ENVIRONMENT
})
beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: { ready: Promise.resolve() },
  })
})
afterEach(async () => {
  await act(async () => {
    surfaces.splice(0).forEach((surface) => surface.dispose())
    await vi.runAllTimersAsync()
  })
  document.body.replaceChildren()
  vi.useRealTimers()
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else Reflect.deleteProperty(document, 'fonts')
})

async function start(runtime: RmeRuntime, options: Partial<CreateImageExportSurfaceOptions> = {}) {
  const source = document.createElement('div')
  source.innerHTML = '<textarea>Live source and unfinished placeholder</textarea>'
  document.body.append(source)
  vi.spyOn(source, 'getBoundingClientRect').mockReturnValue({ width: 640 } as DOMRect)
  let promise!: Promise<ImageExportSurface>
  await act(async () => {
    promise = createImageExportSurface({
      source,
      markdown: 'Snapshot with $x^2$ and Mermaid',
      delegateOptions: {},
      styleToken: { rootFontSize: '19px', rootLineHeight: '1.8' },
      theme: lightTheme.styledConstants,
      loadRuntime: async () => runtime,
      ...options,
    })
    // Observe immediately because renderer failures can reject during the first commit.
    void promise.then(
      (surface) => surfaces.push(surface),
      () => {},
    )
  })
  return { promise, source }
}

async function layout() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60)
  })
}

describe('image export preview surface', () => {
  it('waits for formula/diagram hydration, image decoding, fonts and layout', async () => {
    const hydration = deferred()
    const decoded = deferred()
    const fonts = deferred()
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { ready: fonts.promise },
    })
    let imageComplete = false
    let imageWidth = 0
    let image!: HTMLImageElement
    const decode = vi.fn(() => decoded.promise)
    const preview = fakeRuntime({
      hydration: hydration.promise,
      html: '<svg data-formula="rendered"></svg><svg data-mermaid="rendered"></svg><img src="data:image/png;base64,image" loading="lazy">',
      onMount: (element) => {
        image = element.querySelector('img')!
        Object.defineProperties(image, {
          complete: { configurable: true, get: () => imageComplete },
          naturalWidth: { configurable: true, get: () => imageWidth },
        })
        image.decode = decode
      },
    })
    const { promise, source } = await start(preview.runtime)
    const finished = vi.fn()
    void promise.then(finished)
    await layout()
    expect(finished).not.toHaveBeenCalled()
    expect(decode).not.toHaveBeenCalled()

    await act(async () => hydration.resolve())
    expect(image.hasAttribute('loading')).toBe(false)
    await act(async () => {
      imageComplete = true
      imageWidth = 120
      image.dispatchEvent(new Event('load'))
    })
    expect(decode).toHaveBeenCalledOnce()
    await act(async () => decoded.resolve())
    await layout()
    expect(finished).not.toHaveBeenCalled()
    await act(async () => fonts.resolve())
    expect(finished).not.toHaveBeenCalled()
    await layout()
    const surface = await promise
    expect(surface.element.querySelectorAll('svg')).toHaveLength(2)
    expect(surface.element.querySelector('textarea')).toBeNull()
    expect(surface.element.textContent).not.toContain('unfinished placeholder')
    expect(surface.element.style.width).toBe('640px')
    expect(surface.element.style.visibility).toBe('visible')
    expect(surface.element.inert).toBe(true)
    expect(preview.getProps().doc).toBe('Snapshot with $x^2$ and Mermaid')
    expect(preview.getProps().styleToken).toEqual({ rootFontSize: '19px', rootLineHeight: '1.8' })
    expect(source.isConnected).toBe(true)

    await act(async () => {
      surface.dispose()
      surface.dispose()
    })
    expect(preview.unmount).toHaveBeenCalledOnce()
    expect(surface.element.isConnected).toBe(false)
    expect(source.isConnected).toBe(true)
  })

  it('restores the captured editor and styled theme contexts in the independent root', async () => {
    const preview = fakeRuntime()
    const editorThemeConfig: EditorThemeConfig = {
      mode: 'light',
      name: 'export theme',
      token: desktopLightTheme,
      codemirrorTheme: undefined,
    }
    const { promise } = await start(preview.runtime, { editorThemeConfig })
    await layout()
    await promise
    expect(preview.context.editor).toBe(editorThemeConfig)
    expect(preview.context.theme).toBe(lightTheme.styledConstants)
    expect(preview.context.semantic).toBeNull()
  })

  it('rejects Preview renderer errors and removes the mounted root', async () => {
    const preview = fakeRuntime({ error: new Error('Mermaid failed') })
    const { promise, source } = await start(preview.runtime)
    await expect(promise).rejects.toThrow('Mermaid failed')
    expect(preview.unmount).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-mf-image-export]')).toBeNull()
    expect(source.isConnected).toBe(true)
  })

  it('uses editor semantic colors for strong text, code and tables in the export root', async () => {
    const preview = fakeRuntime()
    const semanticTheme = getThemeTokens(lightTheme, {
      'editor.foreground': '#eeeeee',
      'editor.background': '#161616',
      'editor.code.background': '#202020',
      'editor.code.foreground': '#dddddd',
    })
    const { promise } = await start(preview.runtime, { semanticTheme })
    await layout()
    const surface = await promise
    expect(preview.context.semantic).toBe(semanticTheme)
    expect(preview.context.theme).toMatchObject({
      bgColor: '#161616ff',
      primaryFontColor: '#eeeeeeff',
      strongFontColor: '#eeeeeeff',
      preBgColor: '#202020ff',
      kbdFontColor: '#ddddddff',
      tableTrBgColor: '#161616ff',
    })
    expect(surface.element.style.backgroundColor).toBe('rgb(22, 22, 22)')
  })

  it.each(['mf-preview-error', 'mf-preview-block-error', 'mf-math-error'])(
    'rejects the rendered %s error instead of exporting error UI',
    async (className) => {
      const preview = fakeRuntime({ html: `<div class="${className}">Formula failed</div>` })
      const { promise } = await start(preview.runtime)
      await expect(promise).rejects.toThrow('Formula failed')
      expect(document.querySelector('[data-mf-image-export]')).toBeNull()
      expect(preview.unmount).toHaveBeenCalledOnce()
    },
  )

  it.each(['mf-preview-loading', 'mf-preview-image-progress'])(
    'rejects an unresolved %s placeholder after hydration',
    async (className) => {
      const preview = fakeRuntime({ html: `<div class="${className}">Loading</div>` })
      const { promise } = await start(preview.runtime)
      await layout()
      await expect(promise).rejects.toThrow('not ready')
      expect(document.querySelector('[data-mf-image-export]')).toBeNull()
    },
  )

  it('times out a pending hydration, unmounts and ignores late renderer callbacks', async () => {
    const hydration = deferred()
    const preview = fakeRuntime({ hydration: hydration.promise })
    const { promise, source } = await start(preview.runtime)
    const rejection = expect(promise).rejects.toThrow('timed out')
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000)
    })
    await rejection
    expect(preview.unmount).toHaveBeenCalledOnce()
    await act(async () => {
      hydration.resolve()
      preview.getProps().onImageHydrationChange?.({ settled: Promise.resolve() })
      preview.getProps().onError?.(new Error('Late error'))
    })
    expect(document.querySelector('[data-mf-image-export]')).toBeNull()
    expect(source.isConnected).toBe(true)
  })

  it('waits for a new hydration after the cancelled generation settles', async () => {
    const oldHydration = deferred()
    const newHydration = deferred()
    const preview = fakeRuntime({ hydration: oldHydration.promise })
    const { promise } = await start(preview.runtime)
    const finished = vi.fn()
    const failed = vi.fn()
    void promise.then(finished, failed)
    const content = document.querySelector<HTMLElement>('[data-mf-image-export] > div')!
    await act(async () => {
      content.className = 'mf-preview-loading'
      preview.getProps().onImageHydrationChange?.(null)
      oldHydration.resolve()
    })
    await layout()
    expect(finished).not.toHaveBeenCalled()
    expect(failed).not.toHaveBeenCalled()
    await act(async () => {
      preview.getProps().onImageHydrationChange?.({ settled: newHydration.promise })
    })
    await layout()
    expect(finished).not.toHaveBeenCalled()
    await act(async () => {
      content.className = 'mf-preview-content'
      content.innerHTML = '<svg data-mermaid="new"></svg>'
      newHydration.resolve()
    })
    await layout()
    const surface = await promise
    expect(surface.element.querySelector('[data-mermaid="new"]')).not.toBeNull()
    expect(failed).not.toHaveBeenCalled()
  })

  it('cancels old image waits when a new Preview generation replaces their DOM', async () => {
    const newHydration = deferred()
    let oldImage!: HTMLImageElement
    const preview = fakeRuntime({
      html: '<img src="data:image/png;base64,old">',
      onMount: (content) => {
        oldImage = content.querySelector('img')!
        Object.defineProperty(oldImage, 'complete', { configurable: true, value: false })
      },
    })
    const { promise } = await start(preview.runtime)
    const removeListener = vi.spyOn(oldImage, 'removeEventListener')
    const content = document.querySelector<HTMLElement>('.mf-preview-content')!
    await act(async () => {
      preview.getProps().onImageHydrationChange?.(null)
      content.innerHTML = '<svg data-formula="new"></svg>'
      preview.getProps().onImageHydrationChange?.({ settled: newHydration.promise })
    })
    expect(removeListener.mock.calls.map(([event]) => event)).toContain('load')
    expect(removeListener.mock.calls.map(([event]) => event)).toContain('error')
    await act(async () => newHydration.resolve())
    await layout()
    const surface = await promise
    expect(surface.element.querySelector('[data-formula="new"]')).not.toBeNull()
  })

  it('rejects a failed image and cancels the remaining resource listeners', async () => {
    let image!: HTMLImageElement
    const preview = fakeRuntime({
      html: '<img src="data:image/png;base64,image">',
      onMount: (element) => {
        image = element.querySelector('img')!
        Object.defineProperty(image, 'complete', { configurable: true, value: false })
      },
    })
    const { promise } = await start(preview.runtime)
    const rejection = expect(promise).rejects.toThrow('failed to load')
    await act(async () => image.dispatchEvent(new Event('error')))
    await rejection
    expect(preview.unmount).toHaveBeenCalledOnce()
    expect(document.querySelector('[data-mf-image-export]')).toBeNull()
  })
})
