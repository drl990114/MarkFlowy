import bus from '@/helper/eventBus'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PandocExportController } from './PandocExportController'
import { PANDOC_EXPORT_EVENT } from './pandocExportMenuItem'

const pandocMocks = vi.hoisted(() => ({
  exportMarkdownWithPandoc: vi.fn(),
  probePandoc: vi.fn(),
}))

const dialogMocks = vi.hoisted(() => ({
  confirm: vi.fn(),
  open: vi.fn(),
  save: vi.fn(),
}))

const serviceMocks = vi.hoisted(() => ({
  getWorkspace: vi.fn(),
  openUrl: vi.fn(),
  revealItemInDir: vi.fn(),
  writeSettingData: vi.fn(),
}))

const toastMocks = vi.hoisted(() => ({
  dismiss: vi.fn(),
  error: vi.fn(),
  loading: vi.fn(() => 'pandoc-loading'),
  success: vi.fn(),
  warning: vi.fn(),
}))

const loggerMocks = vi.hoisted(() => ({
  error: vi.fn(),
  warn: vi.fn(),
}))

const settingsState = vi.hoisted(() => ({
  pandocExecutablePath: undefined as string | undefined,
}))

vi.mock('./pandocExport', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    exportMarkdownWithPandoc: pandocMocks.exportMarkdownWithPandoc,
    probePandoc: pandocMocks.probePandoc,
  }
})

vi.mock('@/i18n', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key,
  }),
}))

vi.mock('@/helper/logger', () => ({ logger: loggerMocks }))
vi.mock('@/services/dialog', () => ({ dialog: { confirm: dialogMocks.confirm } }))
vi.mock('@/services/workspace', () => ({ getWorkspace: serviceMocks.getWorkspace }))
vi.mock('@/services/app-setting', () => ({
  default: { writeSettingData: serviceMocks.writeSettingData },
}))
vi.mock('@/stores/useAppSettingStore', () => ({
  default: {
    getState: () => ({
      settingData: {
        pandoc_executable_path: settingsState.pandocExecutablePath,
      },
    }),
  },
}))
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: dialogMocks.open,
  save: dialogMocks.save,
}))
vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: serviceMocks.openUrl,
  revealItemInDir: serviceMocks.revealItemInDir,
}))
vi.mock('zens', () => ({ toast: toastMocks }))

const readyPandoc = {
  available: true,
  compatible: true,
  version: '3.10.1',
  executablePath: '/opt/pandoc',
  supportedFormats: ['docx', 'odt', 'epub'],
}

const unavailablePandoc = {
  available: false,
  compatible: false,
  supportedFormats: [],
  error: { code: 'not_found', message: 'Pandoc not found' },
}

const reactActEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }

beforeAll(() => {
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true
})

afterAll(() => {
  delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT
})

describe('PandocExportController', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    Object.values(pandocMocks).forEach((mock) => mock.mockReset())
    Object.values(dialogMocks).forEach((mock) => mock.mockReset())
    Object.values(serviceMocks).forEach((mock) => mock.mockReset())
    Object.values(toastMocks).forEach((mock) => mock.mockClear())
    Object.values(loggerMocks).forEach((mock) => mock.mockClear())
    settingsState.pandocExecutablePath = undefined
    pandocMocks.probePandoc.mockResolvedValue(readyPandoc)
    pandocMocks.exportMarkdownWithPandoc.mockResolvedValue({
      outputPath: '/exports/report.v2.docx',
      warnings: [],
    })
    dialogMocks.save.mockResolvedValue('/exports/report.v2.docx')
    serviceMocks.getWorkspace.mockResolvedValue({ rootPath: '/workspace' })
    serviceMocks.revealItemInDir.mockResolvedValue(undefined)
    container = document.createElement('div')
    document.body.append(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  async function renderController(
    props: Partial<React.ComponentProps<typeof PandocExportController>> = {},
  ) {
    await act(async () => {
      root.render(
        <PandocExportController
          active
          enabled
          fileName='report.v2.md'
          filePath='/workspace/docs/report.v2.md'
          getContent={() => '# Current unsaved Markdown'}
          {...props}
        />,
      )
    })
  }

  async function requestExport(format: 'docx' | 'odt' | 'epub' = 'docx') {
    act(() => bus.emit(PANDOC_EXPORT_EVENT, undefined, format))
    await act(async () => {
      await vi.waitFor(() => expect(pandocMocks.probePandoc).toHaveBeenCalled())
    })
  }

  it('exports the current unsaved Markdown with file and workspace resource paths', async () => {
    const getContent = vi.fn(() => '# Edited but not saved')
    await renderController({ getContent })
    await requestExport()
    await vi.waitFor(() => expect(pandocMocks.exportMarkdownWithPandoc).toHaveBeenCalledOnce())

    expect(dialogMocks.save).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: 'report.v2.docx',
        filters: [{ name: 'DOCX', extensions: ['docx'] }],
      }),
    )
    expect(pandocMocks.exportMarkdownWithPandoc).toHaveBeenCalledWith({
      source: '# Edited but not saved',
      format: 'docx',
      outputPath: '/exports/report.v2.docx',
      executablePath: '/opt/pandoc',
      resourcePaths: ['/workspace/docs', '/workspace'],
    })
    expect(getContent).toHaveBeenCalledOnce()
    expect(toastMocks.success).toHaveBeenCalled()
    expect(toastMocks.dismiss).toHaveBeenCalledWith('pandoc-loading')
  })

  it('does not read or convert content when the save dialog is cancelled', async () => {
    const getContent = vi.fn(() => '# Current')
    dialogMocks.save.mockResolvedValue(null)
    await renderController({ getContent })
    await requestExport('odt')
    await act(async () => Promise.resolve())

    expect(getContent).not.toHaveBeenCalled()
    expect(pandocMocks.exportMarkdownWithPandoc).not.toHaveBeenCalled()
  })

  it('includes the verified output path in warnings and can reveal the file', async () => {
    pandocMocks.exportMarkdownWithPandoc.mockResolvedValue({
      outputPath: '/exports/report.v2.docx',
      warnings: ['[WARNING] missing image'],
    })
    await renderController()
    await requestExport()
    await vi.waitFor(() => expect(toastMocks.warning).toHaveBeenCalledOnce())

    expect(toastMocks.warning).toHaveBeenCalledWith(
      expect.stringContaining('/exports/report.v2.docx'),
      expect.objectContaining({
        action: expect.objectContaining({
          label: 'contextmenu.explorer.show_in_folder',
        }),
        duration: 10_000,
      }),
    )

    const options = toastMocks.warning.mock.calls[0]?.[1]
    options.action.onClick()
    await vi.waitFor(() =>
      expect(serviceMocks.revealItemInDir).toHaveBeenCalledWith('/exports/report.v2.docx'),
    )
  })

  it('guides an unavailable installation and retries a manually selected executable', async () => {
    pandocMocks.probePandoc
      .mockResolvedValueOnce(unavailablePandoc)
      .mockResolvedValueOnce(readyPandoc)
    dialogMocks.confirm.mockResolvedValue('select')
    dialogMocks.open.mockResolvedValue('/custom/bin/pandoc')
    await renderController()
    await requestExport('epub')
    await vi.waitFor(() => expect(pandocMocks.exportMarkdownWithPandoc).toHaveBeenCalledOnce())

    expect(dialogMocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({ id: 'install' }),
          expect.objectContaining({ id: 'select' }),
        ]),
      }),
    )
    expect(serviceMocks.writeSettingData).toHaveBeenCalledWith(
      { key: 'pandoc_executable_path' },
      '/custom/bin/pandoc',
    )
    expect(pandocMocks.probePandoc).toHaveBeenNthCalledWith(2, '/custom/bin/pandoc')
  })

  it('reports an invalid configured executable without silently falling back', async () => {
    settingsState.pandocExecutablePath = '/invalid/pandoc'
    pandocMocks.probePandoc.mockResolvedValue({
      ...unavailablePandoc,
      error: { code: 'invalid_executable', message: 'Invalid executable' },
    })
    dialogMocks.confirm.mockResolvedValue('cancel')
    await renderController()
    await requestExport()

    expect(pandocMocks.probePandoc).toHaveBeenCalledOnce()
    expect(pandocMocks.probePandoc).toHaveBeenCalledWith('/invalid/pandoc')
    expect(dialogMocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          props: expect.objectContaining({
            details: expect.stringContaining('Invalid executable'),
          }),
        }),
      }),
    )
  })

  it('shows the complete localized error when conversion times out', async () => {
    pandocMocks.exportMarkdownWithPandoc.mockRejectedValue({
      code: 'timed_out',
      message: 'timeout',
      detail: 'process terminated after a very long stderr response',
      exitCode: 124,
    })
    await renderController()
    await requestExport()
    await vi.waitFor(() => expect(dialogMocks.confirm).toHaveBeenCalled())

    expect(dialogMocks.confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'contextmenu.editor_tab.export_pandoc_failed_title',
        size: 'lg',
        actions: [{ id: 'close', label: 'common.close', primary: true }],
        content: expect.objectContaining({
          props: expect.objectContaining({
            details: expect.stringMatching(
              /export_pandoc_error_timed_out[\s\S]*timed_out[\s\S]*124[\s\S]*timeout[\s\S]*process terminated/,
            ),
          }),
        }),
      }),
    )
    expect(toastMocks.dismiss).toHaveBeenCalledWith('pandoc-loading')
  })

  it('ignores export requests for non-Markdown files', async () => {
    const getContent = vi.fn(() => 'plain text')
    await renderController({ enabled: false, getContent })
    act(() => bus.emit(PANDOC_EXPORT_EVENT, undefined, 'docx'))
    await act(async () => Promise.resolve())

    expect(pandocMocks.probePandoc).not.toHaveBeenCalled()
    expect(getContent).not.toHaveBeenCalled()
  })
})
