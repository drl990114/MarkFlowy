import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import TitleBar from '.'

const nativeWindow = vi.hoisted(() => ({
  isFullscreen: vi.fn<() => Promise<boolean>>(),
  onResized: vi.fn<(handler: () => void) => Promise<() => void>>(),
  unlisten: vi.fn(),
  resize: () => {},
  osType: 'macos',
}))

vi.mock('@/services/windows', () => ({ currentWindow: nativeWindow }))
vi.mock('@/hooks', () => ({ useGlobalOSInfo: () => ({ osType: nativeWindow.osType }) }))
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/stores', () => ({
  useEditorStore: (selector: (state: unknown) => unknown) =>
    selector({ folderData: [], editorLayout: { type: 'leaf', id: 'group', opened: [] } }),
}))
vi.mock('../WorkspaceActions', () => ({ WorkspaceActions: () => <button>Workspace</button> }))
vi.mock('./AppMenuButton', () => ({ AppMenuButton: () => null }))
vi.mock('./DocumentTitle', () => ({ DocumentTitle: () => null }))
vi.mock('./WindowControls', () => ({ WindowControls: () => null }))

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

async function renderTitleBar() {
  const view = render(<TitleBar />)
  await act(async () => {})
  const leading = view.getByRole('button', { name: 'Workspace' }).parentElement!
  return { ...view, leading }
}

beforeEach(() => {
  nativeWindow.osType = 'macos'
  nativeWindow.isFullscreen.mockReset().mockResolvedValue(false)
  nativeWindow.unlisten.mockReset()
  nativeWindow.resize = () => {}
  nativeWindow.onResized.mockReset().mockImplementation(async (handler) => {
    nativeWindow.resize = handler
    return nativeWindow.unlisten
  })
})

afterEach(cleanup)

describe('TitleBar native fullscreen spacing', () => {
  it('removes the traffic-light inset on entry and restores it on exit', async () => {
    const { leading, unmount } = await renderTitleBar()
    expect(leading.classList.contains('pl-[76px]')).toBe(true)

    nativeWindow.isFullscreen.mockResolvedValue(true)
    await act(async () => nativeWindow.resize())
    expect(leading.classList.contains('pl-2')).toBe(true)
    expect(leading.classList.contains('pl-[76px]')).toBe(false)

    nativeWindow.isFullscreen.mockResolvedValue(false)
    await act(async () => nativeWindow.resize())
    expect(leading.classList.contains('pl-[76px]')).toBe(true)
    expect(leading.classList.contains('pl-2')).toBe(false)

    unmount()
    expect(nativeWindow.unlisten).toHaveBeenCalledOnce()
  })

  it('starts at the left edge when the native window is already fullscreen', async () => {
    nativeWindow.isFullscreen.mockResolvedValue(true)
    const { leading } = await renderTitleBar()
    expect(leading.classList.contains('pl-2')).toBe(true)
    expect(leading.classList.contains('pl-[76px]')).toBe(false)
  })

  it('ignores an older query that completes after a newer fullscreen transition', async () => {
    const initialState = deferred<boolean>()
    nativeWindow.isFullscreen.mockReturnValueOnce(initialState.promise)
    const { leading } = await renderTitleBar()

    nativeWindow.isFullscreen.mockResolvedValue(true)
    await act(async () => nativeWindow.resize())
    expect(leading.classList.contains('pl-2')).toBe(true)

    await act(async () => initialState.resolve(false))
    expect(leading.classList.contains('pl-2')).toBe(true)
  })

  it('reads the initial state after the native listener is ready', async () => {
    const subscription = deferred<() => void>()
    nativeWindow.onResized.mockReturnValueOnce(subscription.promise)
    const { leading } = await renderTitleBar()
    expect(nativeWindow.isFullscreen).not.toHaveBeenCalled()

    nativeWindow.isFullscreen.mockResolvedValue(true)
    await act(async () => subscription.resolve(nativeWindow.unlisten))
    expect(leading.classList.contains('pl-2')).toBe(true)
  })

  it('cleans up a subscription that resolves after unmount', async () => {
    const subscription = deferred<() => void>()
    nativeWindow.onResized.mockReturnValueOnce(subscription.promise)
    const { unmount } = await renderTitleBar()
    unmount()

    await act(async () => subscription.resolve(nativeWindow.unlisten))
    expect(nativeWindow.unlisten).toHaveBeenCalledOnce()
    expect(nativeWindow.isFullscreen).not.toHaveBeenCalled()
  })

  it('retains safe windowed spacing when native APIs are unavailable', async () => {
    nativeWindow.onResized.mockRejectedValueOnce(new Error('Native events unavailable'))
    nativeWindow.isFullscreen.mockRejectedValueOnce(new Error('Native window unavailable'))
    const { leading } = await renderTitleBar()
    expect(leading.classList.contains('pl-[76px]')).toBe(true)
  })

  it('keeps the last known state if a later query fails', async () => {
    nativeWindow.isFullscreen.mockResolvedValue(true)
    const { leading } = await renderTitleBar()

    nativeWindow.isFullscreen.mockRejectedValueOnce(new Error('Native query failed'))
    await act(async () => nativeWindow.resize())
    expect(leading.classList.contains('pl-2')).toBe(true)
  })

  it.each(['windows', 'linux'])('does not subscribe on %s', async (osType) => {
    nativeWindow.osType = osType
    render(<TitleBar />)
    await act(async () => {})
    expect(nativeWindow.onResized).not.toHaveBeenCalled()
    expect(nativeWindow.isFullscreen).not.toHaveBeenCalled()
  })
})
