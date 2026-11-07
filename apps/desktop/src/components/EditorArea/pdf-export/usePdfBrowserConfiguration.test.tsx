import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { PdfBrowserInfo } from './pdfExport'
import { usePdfBrowserConfiguration } from './usePdfBrowserConfiguration'

const mocks = vi.hoisted(() => ({ probe: vi.fn(), open: vi.fn(), write: vi.fn() }))
vi.mock('./pdfExport', () => ({
  PDF_BROWSER_EXECUTABLE_PATH_SETTING: 'pdf_browser_executable_path',
  probePdfBrowser: mocks.probe,
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }))
vi.mock('@/services/app-setting', () => ({ default: { writeSettingData: mocks.write } }))

const initialSettings = useAppSettingStore.getState()
const ready: PdfBrowserInfo = {
  available: true,
  compatible: true,
  executablePath: '/automatic/browser',
  version: '150',
}

function setPath(path: string) {
  const store = useAppSettingStore.getState()
  store.setSettingData({ ...store.settingData, pdf_browser_executable_path: path })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

beforeEach(() => {
  vi.resetAllMocks()
  useAppSettingStore.setState({ settingData: { pandoc_executable_path: '/pandoc' } })
  mocks.probe.mockImplementation(async (path?: string) => ({
    ...ready,
    executablePath: path || ready.executablePath,
  }))
  mocks.open.mockResolvedValue(null)
  mocks.write.mockImplementation(async (_item: { key: string }, path: string) => setPath(path))
})

afterEach(() => {
  cleanup()
  useAppSettingStore.setState(initialSettings, true)
})

describe('shared PDF browser configuration', () => {
  it('synchronizes the persisted browser choice across mounted consumers and resets to automatic', async () => {
    const first = renderHook(() => usePdfBrowserConfiguration())
    const second = renderHook(() => usePdfBrowserConfiguration())
    await waitFor(() => expect(first.result.current.info).toEqual(ready))
    mocks.open.mockResolvedValue('/custom/browser')
    await act(() => first.result.current.selectExecutable())
    expect(mocks.open).toHaveBeenCalledWith({
      directory: false,
      multiple: false,
      fileAccessMode: 'scoped',
    })
    expect(mocks.write).toHaveBeenCalledWith(
      { key: 'pdf_browser_executable_path' },
      '/custom/browser',
    )
    await waitFor(() => {
      expect(first.result.current.info?.executablePath).toBe('/custom/browser')
      expect(second.result.current.info?.executablePath).toBe('/custom/browser')
    })
    await act(() => second.result.current.resetToAutomatic())
    await waitFor(() => expect(first.result.current.info).toEqual(ready))
    expect(second.result.current.configuredPath).toBe('')
    expect(useAppSettingStore.getState().settingData.pandoc_executable_path).toBe('/pandoc')
  })

  it('does not probe or configure while disabled and checks when opened', async () => {
    const { result, rerender } = renderHook(({ enabled }) => usePdfBrowserConfiguration(enabled), {
      initialProps: { enabled: false },
    })
    expect(result.current.checking).toBe(false)
    await act(async () => {
      await result.current.checkBrowser(true)
      await result.current.selectExecutable()
      await result.current.resetToAutomatic()
    })
    expect(mocks.probe).not.toHaveBeenCalled()
    expect(mocks.open).not.toHaveBeenCalled()
    expect(mocks.write).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await waitFor(() => expect(result.current.info).toEqual(ready))
    expect(mocks.probe).toHaveBeenCalledWith(undefined, false)
  })

  it('leaves the choice and detection intact when a picker is cancelled', async () => {
    const { result } = renderHook(() => usePdfBrowserConfiguration())
    await waitFor(() => expect(result.current.info).toEqual(ready))
    await act(() => result.current.selectExecutable())
    expect(mocks.write).not.toHaveBeenCalled()
    expect(mocks.probe).toHaveBeenCalledOnce()
    expect(result.current.info).toEqual(ready)
    expect(result.current.configuring).toBe(false)
  })

  it('keeps configuration busy through persistence and prevents duplicate pickers', async () => {
    const picker = deferred<string | null>()
    const saved = deferred<void>()
    mocks.open.mockReturnValue(picker.promise)
    mocks.write.mockImplementation(async (_item: { key: string }, path: string) => {
      setPath(path)
      await saved.promise
    })
    const { result } = renderHook(() => usePdfBrowserConfiguration())
    await waitFor(() => expect(result.current.info).toEqual(ready))
    let selecting!: Promise<void>
    act(() => {
      selecting = result.current.selectExecutable()
    })
    expect(result.current.configuring).toBe(true)
    await act(() => result.current.selectExecutable())
    expect(mocks.open).toHaveBeenCalledOnce()
    await act(async () => picker.resolve('/custom/browser'))
    expect(result.current.configuring).toBe(true)
    expect(result.current.info?.executablePath).toBe('/custom/browser')
    await act(async () => {
      saved.resolve()
      await selecting
    })
    expect(result.current.configuring).toBe(false)
  })

  it('refreshes a browser selected again at the same path', async () => {
    setPath('/custom/browser')
    const { result } = renderHook(() => usePdfBrowserConfiguration())
    await waitFor(() => expect(result.current.checking).toBe(false))
    mocks.open.mockResolvedValue('/custom/browser')
    await act(() => result.current.selectExecutable())
    expect(mocks.probe.mock.calls).toEqual([
      ['/custom/browser', false],
      ['/custom/browser', true],
    ])
    expect(result.current.configuring).toBe(false)
  })

  it('never exposes a previous ready browser during a changed-path render', async () => {
    const pending = deferred<PdfBrowserInfo>()
    const renders: { path: string; executable?: string }[] = []
    const { result } = renderHook(() => {
      const configuration = usePdfBrowserConfiguration()
      renders.push({
        path: configuration.configuredPath,
        executable: configuration.info?.executablePath,
      })
      return configuration
    })
    await waitFor(() => expect(result.current.info).toEqual(ready))
    mocks.probe.mockReturnValue(pending.promise)
    act(() => setPath('/new/browser'))
    expect(result.current.checking).toBe(true)
    expect(result.current.info).toBeUndefined()
    expect(
      renders
        .filter((rendered) => rendered.path === '/new/browser')
        .every((rendered) => !rendered.executable),
    ).toBe(true)
    await act(async () => pending.resolve({ ...ready, executablePath: '/new/browser' }))
    expect(result.current.info?.executablePath).toBe('/new/browser')
  })

  it('discards old probes and old failures after a new path has been checked', async () => {
    const first = deferred<PdfBrowserInfo>()
    const second = deferred<PdfBrowserInfo>()
    mocks.probe.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result } = renderHook(() => usePdfBrowserConfiguration())
    act(() => setPath('/new/browser'))
    await act(async () => second.resolve({ ...ready, executablePath: '/new/browser' }))
    await act(async () => first.reject(new Error('Old browser failed')))
    expect(result.current.info?.executablePath).toBe('/new/browser')
    expect(result.current.checkError).toBeUndefined()
    expect(result.current.checking).toBe(false)
  })

  it('keeps native diagnostics and clears them after a successful retry', async () => {
    const error = {
      code: 'access_denied',
      message: 'Window rejected',
      detail: 'Permission check failed',
    }
    mocks.probe.mockRejectedValueOnce(error)
    const { result } = renderHook(() => usePdfBrowserConfiguration())
    await waitFor(() => expect(result.current.checking).toBe(false))
    expect(result.current.info?.error).toEqual(error)
    expect(result.current.checkError).toBe('Window rejected')
    await act(() => result.current.checkBrowser(true))
    expect(result.current.checkError).toBeUndefined()
    expect(result.current.info).toEqual(ready)
  })

  it('reports failed writes after the settings service rolls back the optimistic choice', async () => {
    setPath('/old/browser')
    const saved = deferred<void>()
    mocks.open.mockResolvedValue('/new/browser')
    mocks.write.mockImplementation(async () => {
      setPath('/new/browser')
      try {
        await saved.promise
      } catch (error) {
        setPath('/old/browser')
        throw error
      }
    })
    const { result } = renderHook(() => usePdfBrowserConfiguration())
    await waitFor(() => expect(result.current.checking).toBe(false))
    let selecting!: Promise<void>
    act(() => {
      selecting = result.current.selectExecutable()
    })
    await waitFor(() => expect(result.current.info?.executablePath).toBe('/new/browser'))
    expect(result.current.configuring).toBe(true)
    await act(async () => {
      saved.reject(new Error('Write failed'))
      await selecting
    })
    await waitFor(() => expect(result.current.info?.executablePath).toBe('/old/browser'))
    expect(result.current.saveError).toBe(true)
    expect(result.current.configuring).toBe(false)
  })

  it('does not persist a picker result after unmount', async () => {
    const picker = deferred<string | null>()
    mocks.open.mockReturnValue(picker.promise)
    const { result, unmount } = renderHook(() => usePdfBrowserConfiguration())
    let selecting!: Promise<void>
    act(() => {
      selecting = result.current.selectExecutable()
    })
    unmount()
    await act(async () => {
      picker.resolve('/late/browser')
      await selecting
    })
    expect(mocks.write).not.toHaveBeenCalled()
  })

  it('isolates picker operations across closing and reopening the export dialog', async () => {
    const first = deferred<string | null>()
    const second = deferred<string | null>()
    mocks.open.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const { result, rerender } = renderHook(({ enabled }) => usePdfBrowserConfiguration(enabled), {
      initialProps: { enabled: true },
    })
    let firstSelection!: Promise<void>
    act(() => {
      firstSelection = result.current.selectExecutable()
    })
    rerender({ enabled: false })
    rerender({ enabled: true })
    let secondSelection!: Promise<void>
    act(() => {
      secondSelection = result.current.selectExecutable()
    })
    await act(async () => {
      first.resolve('/late/browser')
      await firstSelection
    })
    expect(mocks.write).not.toHaveBeenCalled()
    expect(result.current.configuring).toBe(true)
    await act(async () => {
      second.resolve('/current/browser')
      await secondSelection
    })
    expect(mocks.write).toHaveBeenCalledOnce()
    expect(result.current.info?.executablePath).toBe('/current/browser')
    expect(result.current.configuring).toBe(false)
  })
})
