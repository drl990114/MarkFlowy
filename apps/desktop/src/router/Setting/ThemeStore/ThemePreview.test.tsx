import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveThemeTokens, type ResolvedTheme } from '@markflowy/theme/semantic'
import { PREVIEW_CHANNEL } from '@/themes/preview/protocol'
import { ThemePreview } from './ThemePreview'

const labels = {
  preview: 'Preview',
  loadError: 'Failed',
  error: 'Error',
  retry: 'Retry',
  previewNotes: 'Notes',
  previewIdeas: 'Ideas',
  previewWelcome: 'Welcome',
  previewSearch: 'Search preview',
  previewSearchPlaceholder: 'Search…',
  previewNewNote: 'New note',
}
vi.mock('./labels', () => ({ useThemeLabels: () => labels }))

class StubPort {
  onmessage: ((event: MessageEvent) => void) | null = null
  postMessage = vi.fn()
  start = vi.fn()
  close = vi.fn()

  receive(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data }))
  }
}
const channels: StubMessageChannel[] = []
class StubMessageChannel {
  port1 = new StubPort()
  port2 = new StubPort()

  constructor() {
    channels.push(this)
  }
}

function theme(background = '#ffffff'): ResolvedTheme {
  return {
    id: 'paper/light',
    name: 'Paper',
    mode: 'light',
    css: '',
    tokens: resolveThemeTokens('light', { 'editor.background': background }),
  }
}
function mount() {
  const props = { theme: theme(), snippets: [], inspect: false, onInspect: vi.fn() }
  const view = render(<ThemePreview {...props} />)
  const frame = view.container.querySelector('iframe')!
  const url = new URL(frame.src)
  const session = url.searchParams.get('session')!
  // Model a window proxy independently from its current document URL. This
  // lets the test exercise navigation without asking jsdom to load a page.
  const previewWindow = { location: { href: frame.src }, postMessage: vi.fn() }
  Object.defineProperty(frame, 'contentWindow', { value: previewWindow, configurable: true })
  const message = (type: string, extra: Record<string, unknown> = {}) => ({
    channel: PREVIEW_CHANNEL,
    session,
    type,
    ...extra,
  })
  const ready = ({
    source = previewWindow,
    origin = url.origin,
    data = message('ready'),
  }: { source?: object; origin?: string; data?: unknown } = {}) => {
    const event = new MessageEvent('message', { origin, data })
    Object.defineProperty(event, 'source', { value: source })
    window.dispatchEvent(event)
  }
  return { ...view, props, frame, url, session, previewWindow, message, ready }
}

beforeEach(() => {
  channels.length = 0
  vi.stubGlobal('MessageChannel', StubMessageChannel)
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('theme preview host bridge', () => {
  it('requires the expected window, origin, channel and session before opening a port', () => {
    const view = mount()
    view.ready({ source: window })
    view.ready({ origin: 'https://unrelated.example' })
    view.ready({ data: view.message('ready', { session: 'another-session' }) })
    view.ready({ data: view.message('ready', { channel: 'another-channel' }) })
    view.ready({ data: view.message('update') })
    expect(channels).toHaveLength(0)
    expect(view.previewWindow.postMessage).not.toHaveBeenCalled()

    view.ready()
    expect(channels).toHaveLength(1)
    expect(channels[0].port1.start).toHaveBeenCalledOnce()
    expect(channels[0].port1.postMessage).not.toHaveBeenCalled()
    expect(view.previewWindow.postMessage).toHaveBeenCalledExactlyOnceWith(
      view.message('connect'),
      view.url.origin,
      [channels[0].port2],
    )
    channels[0].port1.receive(view.message('ready', { session: 'another-session' }))
    expect(channels[0].port1.postMessage).not.toHaveBeenCalled()
    channels[0].port1.receive(view.message('ready'))
    expect(channels[0].port1.postMessage).toHaveBeenCalledWith(
      view.message('update', {
        state: { theme: view.props.theme, snippets: [], inspect: false, labels },
      }),
    )
  })

  it('does not transfer a theme port to a window that has navigated away', () => {
    const view = mount()
    view.previewWindow.location.href = new URL('other-page.html', view.url).href
    view.ready()
    expect(channels).toHaveLength(0)
    Object.defineProperty(view.previewWindow, 'location', {
      get() {
        throw new DOMException('Cross-origin window', 'SecurityError')
      },
    })
    view.ready()
    expect(channels).toHaveLength(0)
    expect(view.previewWindow.postMessage).not.toHaveBeenCalled()
  })

  it('updates the document-bound port and inspector callback without replacing the iframe', () => {
    const view = mount()
    const initialSource = view.frame.src
    view.ready()
    const port = channels[0].port1
    port.receive(view.message('ready'))
    const onInspect = vi.fn()
    const next = {
      theme: theme('#112233'),
      snippets: [{ id: 'personal', css: 'p { letter-spacing: 0.02em }' }],
      inspect: true,
      onInspect,
    }
    view.rerender(<ThemePreview {...next} />)
    expect(view.container.querySelector('iframe')).toBe(view.frame)
    expect(view.frame.src).toBe(initialSource)
    expect(channels).toHaveLength(1)
    expect(port.postMessage).toHaveBeenLastCalledWith(
      view.message('update', {
        state: { theme: next.theme, snippets: next.snippets, inspect: true, labels },
      }),
    )
    expect(view.previewWindow.postMessage).toHaveBeenCalledOnce()
    port.receive(view.message('inspect', { token: 'unknown.token' }))
    port.receive(view.message('inspect', { token: 'editor.caret', session: 'another-session' }))
    expect(onInspect).not.toHaveBeenCalled()
    port.receive(view.message('inspect', { token: 'editor.caret' }))
    expect(onInspect).toHaveBeenCalledExactlyOnceWith('editor.caret')
    expect(view.props.onInspect).not.toHaveBeenCalled()
    view.unmount()
    expect(port.close).toHaveBeenCalledOnce()
    view.ready()
    expect(channels).toHaveLength(1)
  })

  it('closes the old channel on navigation and sends no theme until another valid handshake', () => {
    const view = mount()
    view.ready()
    const oldPort = channels[0].port1
    oldPort.receive(view.message('ready'))
    const sentBeforeNavigation = oldPort.postMessage.mock.calls.length
    view.previewWindow.location.href = new URL('other-page.html', view.url).href
    fireEvent.load(view.frame)
    expect(oldPort.close).toHaveBeenCalledOnce()
    expect(view.previewWindow.postMessage).toHaveBeenLastCalledWith(
      view.message('hello'),
      view.url.origin,
    )
    view.rerender(<ThemePreview {...view.props} theme={theme('#445566')} />)
    expect(oldPort.postMessage).toHaveBeenCalledTimes(sentBeforeNavigation)
    view.ready()
    expect(channels).toHaveLength(1)

    view.previewWindow.location.href = view.frame.src
    view.ready()
    expect(channels).toHaveLength(2)
    channels[1].port1.receive(view.message('ready'))
    expect(channels[1].port1.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'update',
        state: expect.objectContaining({ theme: theme('#445566') }),
      }),
    )
  })
})
