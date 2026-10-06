import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import useAppSettingStore from '@/stores/useAppSettingStore'
import type { PdfBrowserInfo } from '@/components/EditorArea/pdf-export/pdfExport'
import { ExportSetting } from './index'

const mocks = vi.hoisted(() => ({
  probeBrowser: vi.fn(),
  probePandoc: vi.fn(),
  open: vi.fn(),
  write: vi.fn(),
}))

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: { version?: string }) =>
      values?.version ? `${key} ${values.version}` : key,
  }),
}))
vi.mock('@/components/EditorArea/pdf-export/pdfExport', () => ({
  PDF_BROWSER_EXECUTABLE_PATH_SETTING: 'pdf_browser_executable_path',
  probePdfBrowser: mocks.probeBrowser,
}))
vi.mock('@/components/EditorArea/pandoc-export/pandocExport', () => ({
  PANDOC_EXECUTABLE_PATH_SETTING: 'pandoc_executable_path',
  PANDOC_INSTALL_URL: 'https://pandoc.org/installing.html',
  probePandoc: mocks.probePandoc,
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: mocks.open }))
vi.mock('@tauri-apps/plugin-opener', () => ({ openUrl: vi.fn() }))
vi.mock('@/services/app-setting', () => ({ default: { writeSettingData: mocks.write } }))

const initialSettings = useAppSettingStore.getState()
const ready: PdfBrowserInfo = {
  available: true,
  compatible: true,
  version: '130',
  executablePath: '/browser',
}

beforeEach(() => {
  vi.clearAllMocks()
  useAppSettingStore.setState({ settingData: {} })
  mocks.probePandoc.mockResolvedValue({ available: false, compatible: false, supportedFormats: [] })
  mocks.probeBrowser.mockResolvedValue(ready)
  mocks.write.mockImplementation(async ({ key }: { key: string }, value: string) => {
    const store = useAppSettingStore.getState()
    store.setSettingData({ ...store.settingData, [key]: value })
  })
})

afterEach(() => {
  cleanup()
  useAppSettingStore.setState(initialSettings, true)
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

describe('PDF browser export settings', () => {
  it('detects automatically, selects a configured executable and resets it', async () => {
    render(<ExportSetting />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('ready 130'))
    expect(mocks.probeBrowser).toHaveBeenCalledWith(undefined, false)
    mocks.open.mockResolvedValue('/custom/browser')
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.select' }))
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'pdf_browser_executable_path' }),
        '/custom/browser',
      ),
    )
    await waitFor(() => expect(mocks.probeBrowser).toHaveBeenCalledWith('/custom/browser', false))
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.automatic' }))
    await waitFor(() =>
      expect(mocks.write).toHaveBeenCalledWith(
        expect.objectContaining({ key: 'pdf_browser_executable_path' }),
        '',
      ),
    )
    await waitFor(() => expect(mocks.probeBrowser.mock.calls.at(-1)).toEqual([undefined, false]))
    expect(useAppSettingStore.getState().settingData.pandoc_executable_path).toBeUndefined()
  })

  it('keeps detection unchanged when the executable picker is cancelled', async () => {
    render(<ExportSetting />)
    await screen.findByText('settings.export.pdf.status.ready 130')
    mocks.open.mockResolvedValue(null)
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.select' }))
    await waitFor(() => expect(mocks.open).toHaveBeenCalledOnce())
    expect(mocks.write).not.toHaveBeenCalled()
  })

  it('discards an earlier probe after the configured executable changes', async () => {
    const first = deferred<PdfBrowserInfo>()
    const second = deferred<PdfBrowserInfo>()
    mocks.probeBrowser.mockReset()
    mocks.probeBrowser.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    render(<ExportSetting />)
    expect(screen.getByRole('status').textContent).toContain('checking')
    act(() =>
      useAppSettingStore.setState({ settingData: { pdf_browser_executable_path: '/new/browser' } }),
    )
    await waitFor(() => expect(mocks.probeBrowser).toHaveBeenLastCalledWith('/new/browser', false))
    await act(async () =>
      second.resolve({ ...ready, version: '150', executablePath: '/new/browser' }),
    )
    expect(screen.getByRole('status').textContent).toContain('ready 150')
    await act(async () =>
      first.resolve({ ...ready, version: 'old', executablePath: '/old/browser' }),
    )
    expect(screen.getByRole('status').textContent).toContain('ready 150')
    expect(screen.queryByText('/old/browser')).toBeNull()
  })

  it('shows invalid paths and allows another check', async () => {
    useAppSettingStore.setState({
      settingData: { pdf_browser_executable_path: '/invalid/browser' },
    })
    mocks.probeBrowser.mockResolvedValue({
      available: false,
      compatible: false,
      error: { code: 'invalid_executable', message: 'Not a browser' },
    })
    render(<ExportSetting />)
    await screen.findByText('settings.export.pdf.status.invalid_executable')
    mocks.probeBrowser.mockResolvedValue(ready)
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.check_again' }))
    await screen.findByText('settings.export.pdf.status.ready 130')
    expect(mocks.probeBrowser).toHaveBeenCalledTimes(2)
    expect(mocks.probeBrowser).toHaveBeenLastCalledWith('/invalid/browser', true)
  })

  it('retains configured detection and reports failed setting writes', async () => {
    render(<ExportSetting />)
    await screen.findByText('settings.export.pdf.status.ready 130')
    mocks.open.mockResolvedValue('/new/browser')
    mocks.write.mockRejectedValue(new Error('Write failed'))
    fireEvent.click(screen.getByRole('button', { name: 'settings.export.pdf.select' }))
    expect((await screen.findByRole('alert')).textContent).toContain('save_failed')
    expect(mocks.probeBrowser).toHaveBeenCalledOnce()
  })
})
