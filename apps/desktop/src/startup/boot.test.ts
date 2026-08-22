import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const renderBootOverlay = () => {
  document.body.innerHTML = `
    <div id="mf-boot-overlay" role="status" aria-live="polite">
      <div class="mf-boot-progress"></div>
    </div>
  `
}

const installFrameQueue = (reducedMotion = false) => {
  const frames: FrameRequestCallback[] = []
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback)
    return frames.length
  })
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) =>
      ({
        matches: reducedMotion && query === '(prefers-reduced-motion: reduce)',
        media: query,
      }) as unknown as MediaQueryList,
  )
  return frames
}

beforeEach(() => {
  vi.resetModules()
  renderBootOverlay()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.clear()
  delete window.__MARKFLOWY_BOOTSTRAP__
  Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-mf-theme')
  document.documentElement.removeAttribute('style')
})

describe('boot overlay lifecycle', () => {
  it('waits for two animation frames before starting the compositor-only fade', async () => {
    const frames = installFrameQueue()
    const performanceMarkSpy = vi.spyOn(window.performance, 'mark')
    const { markBootShellReady } = await import('./boot')

    markBootShellReady(window, document)

    const overlay = document.getElementById('mf-boot-overlay')!
    expect(overlay.dataset.shellReady).toBe('true')
    expect(overlay.dataset.state).toBeUndefined()
    expect(frames).toHaveLength(1)

    frames.shift()?.(16)
    expect(overlay.dataset.state).toBeUndefined()
    expect(frames).toHaveLength(1)

    frames.shift()?.(32)
    expect(overlay.dataset.state).toBe('hiding')
    expect(overlay.getAttribute('aria-hidden')).toBe('true')
    expect(performanceMarkSpy).toHaveBeenCalledWith('mf:startup:shell-ready')
    expect(performanceMarkSpy).toHaveBeenCalledWith('mf:startup:boot-hide-start')

    overlay.dispatchEvent(new Event('transitionend'))
    expect(document.getElementById('mf-boot-overlay')).toBeNull()
    expect(performanceMarkSpy).toHaveBeenCalledWith('mf:startup:boot-hidden')
  })

  it('removes the overlay immediately after the double frame for reduced motion', async () => {
    const frames = installFrameQueue(true)
    const { markBootShellReady } = await import('./boot')

    markBootShellReady(window, document)
    frames.shift()?.(16)
    frames.shift()?.(32)

    expect(document.getElementById('mf-boot-overlay')).toBeNull()
  })
})

describe('static boot loader contract', () => {
  const desktopRoot = process.cwd().endsWith('apps/desktop')
    ? process.cwd()
    : resolve(process.cwd(), 'apps/desktop')
  const indexHtml = readFileSync(resolve(desktopRoot, 'index.html'), 'utf8')

  it('uses a delayed transform-only progress animation with paint containment', () => {
    const progressKeyframes = indexHtml.slice(
      indexHtml.indexOf('@keyframes mf-boot-progress'),
      indexHtml.indexOf('@keyframes mf-boot-reveal'),
    )

    expect(indexHtml).toContain('contain: layout paint')
    expect(indexHtml).toContain('animation: mf-boot-reveal 1ms linear 120ms forwards')
    expect(indexHtml).not.toContain("#mf-boot-overlay[data-shell-ready='true'] .mf-boot-progress")
    expect(indexHtml).toContain('rawAppearance.schemaVersion === 1')
    expect(indexHtml).toContain('window.sessionStorage.getItem(sessionStorageKey)')
    expect(indexHtml).toContain("[0-9a-f]{4}")
    expect(progressKeyframes).toContain('transform: translate3d')
    expect(progressKeyframes).not.toMatch(/\b(?:left|right|width):/)
  })

  it('has no HTML timeout fallback and preserves the reduced-motion path', () => {
    expect(indexHtml).not.toContain('window.setTimeout')
    expect(indexHtml).not.toContain('mf-boot-fatal')
    expect(indexHtml).toContain('@media (prefers-reduced-motion: reduce)')
    expect(indexHtml).toContain('transition: opacity 120ms')
  })

  it('applies the current webview session palette before HTML parsing on reload', () => {
    const bootstrapScript = indexHtml.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]
    const lightAppearance = {
      schemaVersion: 1 as const,
      preference: 'light' as const,
      resolvedMode: 'light' as const,
      themeId: 'MarkFlowy Light',
      palette: {
        surfaceApp: '#ffffff',
        surfacePanel: '#f9f9f9',
        surfaceToolbar: '#fefefe',
        foreground: '#000000',
        mutedForeground: '#505050',
        border: '#d2d2d2',
        accent: '#1f6ae2',
      },
    }
    const darkAppearance = {
      schemaVersion: 1 as const,
      preference: 'dark' as const,
      resolvedMode: 'dark' as const,
      themeId: 'Local Midnight',
      palette: {
        surfaceApp: '#101214',
        surfacePanel: '#17191b',
        surfaceToolbar: '#1d2023',
        foreground: '#f2f3f4',
        mutedForeground: '#9fa3a8',
        border: '#30343a',
        accent: '#3b82f6',
      },
    }
    window.__MARKFLOWY_BOOTSTRAP__ = {
      appearance: lightAppearance,
      openedUrls: [],
      sessionId: 'native-session',
    }
    window.sessionStorage.setItem(
      'markflowy:startup-appearance:session:v1',
      JSON.stringify(darkAppearance),
    )
    Object.defineProperty(window, '__TAURI_INTERNALS__', { configurable: true, value: {} })
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: false } as MediaQueryList)

    expect(bootstrapScript).toBeTruthy()
    window.eval(bootstrapScript!)

    expect(window.__MARKFLOWY_BOOTSTRAP__?.appearance).toMatchObject({
      resolvedMode: 'dark',
      themeId: 'Local Midnight',
    })
    expect(document.documentElement.dataset.mfTheme).toBe('dark')
    expect(document.documentElement.style.getPropertyValue('--mf-boot-surface-app')).toBe('#101214')
  })
})
