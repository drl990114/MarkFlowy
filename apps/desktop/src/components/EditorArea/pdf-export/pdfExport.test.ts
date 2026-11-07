import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { inspectPdf } from './pdfExportValidation'
import {
  exportPdfWithBrowser,
  exportPdfWithNative,
  getPdfExportFileName,
  probePdfBrowser,
} from './pdfExport'
import type { NativePdfExportRequest, PdfExportRequest } from './pdfExport'
import type * as PdfValidation from './pdfExportValidation'

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn() }))
vi.mock('./pdfExportValidation', async (original) => ({
  ...(await original<typeof PdfValidation>()),
  inspectPdf: vi.fn(),
}))

const request: PdfExportRequest = {
  jobId: 'export-job',
  html: '<h1>Title</h1>',
  outputPath: '/docs/out.pdf',
  sourcePath: '/docs/source.md',
  executablePath: '/chrome',
  paperSize: 'a4',
  landscape: false,
  includeOutline: true,
}
const valid = { pages: 2, outline: [{ title: 'Title', depth: 0, page: 1 }] }
const prepared = { jobId: request.jobId, pdfBase64: 'pdf', headingCount: 1 }

describe('browser PDF export', () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(inspectPdf).mockReset().mockResolvedValue(valid)
  })

  it('commits only after the generated PDF bookmarks pass inspection', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(prepared)
      .mockResolvedValueOnce({ outputPath: request.outputPath })
    const result = await exportPdfWithBrowser(request, new AbortController().signal)
    expect(inspectPdf).toHaveBeenCalledWith('pdf', expect.any(AbortSignal))
    expect(invoke).toHaveBeenNthCalledWith(1, 'prepare_pdf_export', { request })
    expect(invoke).toHaveBeenNthCalledWith(2, 'commit_pdf_export', { jobId: request.jobId })
    expect(result.outputPath).toBe(request.outputPath)
  })

  it('cancels the staged artifact without committing when headings are missing', async () => {
    vi.mocked(invoke).mockResolvedValue(prepared)
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 2, outline: [] })
    await expect(exportPdfWithBrowser(request, new AbortController().signal)).rejects.toThrow(
      'requested heading bookmarks',
    )
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: request.jobId })
  })

  it('rejects a reply belonging to a different job', async () => {
    vi.mocked(invoke).mockResolvedValue({ jobId: 'another-job', pdfBase64: 'pdf' })
    await expect(exportPdfWithBrowser(request, new AbortController().signal)).rejects.toThrow(
      'does not match',
    )
    expect(inspectPdf).not.toHaveBeenCalled()
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: request.jobId })
  })

  it('cancels running preparation and never commits its late result', async () => {
    const controller = new AbortController()
    let complete!: (value: { jobId: string; pdfBase64: string }) => void
    vi.mocked(invoke).mockImplementation((command) =>
      command === 'prepare_pdf_export'
        ? new Promise((resolve) => {
            complete = resolve
          })
        : Promise.resolve(undefined),
    )
    const exporting = exportPdfWithBrowser(request, controller.signal)
    controller.abort()
    complete({ jobId: request.jobId, pdfBase64: 'pdf' })
    await expect(exporting).rejects.toMatchObject({ name: 'AbortError' })
    expect(inspectPdf).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
  })

  it('permits a document without headings and verifies disabling bookmarks', async () => {
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 1, outline: [] })
    vi.mocked(invoke)
      .mockResolvedValueOnce({ ...prepared, headingCount: 0 })
      .mockResolvedValueOnce({ outputPath: request.outputPath })
    await expect(
      exportPdfWithBrowser({ ...request, includeOutline: false }, new AbortController().signal),
    ).resolves.toEqual({ outputPath: request.outputPath })
  })

  it('cleans up when committing the target fails', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(prepared)
      .mockRejectedValueOnce(new Error('Write failed'))
      .mockResolvedValueOnce(undefined)
    await expect(exportPdfWithBrowser(request, new AbortController().signal)).rejects.toThrow(
      'Write failed',
    )
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: request.jobId })
  })

  it('checks probed outline hierarchy and cross-page destinations before caching compatibility', async () => {
    vi.mocked(invoke).mockResolvedValue({
      available: true,
      version: 'Chrome 150',
      executablePath: '/probe-chrome',
      probePdfBase64: 'probe',
    })
    vi.mocked(inspectPdf).mockResolvedValue({
      pages: 2,
      outline: [
        { title: 'MarkFlowy PDF probe', depth: 0, page: 1 },
        { title: 'Nested heading', depth: 1, page: 1 },
        { title: 'Next page', depth: 0, page: 2 },
      ],
    })
    expect(await probePdfBrowser('/probe-chrome', true)).toMatchObject({ compatible: true })
    await probePdfBrowser('/probe-chrome')
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('rejects an available browser when its PDF silently omits bookmarks', async () => {
    vi.mocked(invoke).mockResolvedValue({ available: true, probePdfBase64: 'probe' })
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 2, outline: [] })
    expect(await probePdfBrowser('/old-chrome', true)).toMatchObject({
      available: true,
      compatible: false,
      error: { code: 'unsupported_browser' },
    })
  })

  it('tries the next installed browser when the first cannot generate bookmarks', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce({
        available: true,
        executablePath: '/old-auto-chrome',
        probePdfBase64: 'old',
      })
      .mockResolvedValueOnce({ available: true, executablePath: '/edge', probePdfBase64: 'new' })
    vi.mocked(inspectPdf)
      .mockResolvedValueOnce({ pages: 2, outline: [] })
      .mockResolvedValueOnce({
        pages: 2,
        outline: [
          { title: 'MarkFlowy PDF probe', depth: 0, page: 1 },
          { title: 'Nested heading', depth: 1, page: 1 },
          { title: 'Next page', depth: 0, page: 2 },
        ],
      })
    expect(await probePdfBrowser(undefined, true)).toMatchObject({
      executablePath: '/edge',
      compatible: true,
    })
    expect(invoke).toHaveBeenNthCalledWith(2, 'probe_pdf_browser', {
      executablePath: undefined,
      excludedExecutables: ['/old-auto-chrome'],
    })
  })

  it('rejects missing printable heading metadata before inspecting or committing', async () => {
    vi.mocked(invoke).mockResolvedValue({ jobId: request.jobId, pdfBase64: 'pdf' })
    await expect(exportPdfWithBrowser(request, new AbortController().signal)).rejects.toThrow(
      'printable heading count',
    )
    expect(inspectPdf).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
  })

  it.each([
    ['note.md', 'note.pdf'],
    ['中文.markdown', '中文.pdf'],
    ['', 'document.pdf'],
  ])('names %s as %s', (name, expected) => expect(getPdfExportFileName(name)).toBe(expected))
})

describe('native PDF export', () => {
  const nativeRequest: NativePdfExportRequest = {
    jobId: 'native-export-job',
    html: '<h1>Native document</h1>',
    outputPath: '/docs/native.pdf',
    sourcePath: '/docs/source.md',
    paperSize: 'letter',
    landscape: true,
    includeOutline: true,
  }
  const nativePrepared = { jobId: nativeRequest.jobId, pdfBase64: 'native-pdf', headingCount: 1 }

  beforeEach(() => {
    vi.mocked(invoke).mockReset()
    vi.mocked(inspectPdf).mockReset().mockResolvedValue(valid)
  })

  it('uses native preparation without a browser path and commits after inspection', async () => {
    vi.mocked(invoke)
      .mockResolvedValueOnce(nativePrepared)
      .mockResolvedValueOnce({ outputPath: nativeRequest.outputPath })
    await expect(exportPdfWithNative(nativeRequest, new AbortController().signal)).resolves.toEqual(
      { outputPath: nativeRequest.outputPath },
    )
    expect(invoke).toHaveBeenNthCalledWith(1, 'prepare_native_pdf_export', {
      request: nativeRequest,
    })
    expect(inspectPdf).toHaveBeenCalledWith('native-pdf', expect.any(AbortSignal))
    expect(invoke).toHaveBeenNthCalledWith(2, 'commit_pdf_export', { jobId: nativeRequest.jobId })
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('exports native PDFs without bookmarks when disabled', async () => {
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 2, outline: [] })
    vi.mocked(invoke)
      .mockResolvedValueOnce(nativePrepared)
      .mockResolvedValueOnce({ outputPath: nativeRequest.outputPath })
    const withoutOutline = { ...nativeRequest, includeOutline: false }
    await expect(
      exportPdfWithNative(withoutOutline, new AbortController().signal),
    ).resolves.toEqual({
      outputPath: nativeRequest.outputPath,
    })
    expect(invoke).toHaveBeenNthCalledWith(1, 'prepare_native_pdf_export', {
      request: withoutOutline,
    })
  })

  it('allows native documents without headings when bookmarks are requested', async () => {
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 1, outline: [] })
    vi.mocked(invoke)
      .mockResolvedValueOnce({ ...nativePrepared, headingCount: 0 })
      .mockResolvedValueOnce({ outputPath: nativeRequest.outputPath })
    await expect(exportPdfWithNative(nativeRequest, new AbortController().signal)).resolves.toEqual(
      {
        outputPath: nativeRequest.outputPath,
      },
    )
  })

  it.each([undefined, -1, NaN, 1.5])(
    'rejects invalid native heading count %s before inspecting or committing',
    async (headingCount) => {
      vi.mocked(invoke).mockResolvedValue({ ...nativePrepared, headingCount })
      await expect(
        exportPdfWithNative(nativeRequest, new AbortController().signal),
      ).rejects.toThrow('printable heading count')
      expect(inspectPdf).not.toHaveBeenCalled()
      expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
      expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: nativeRequest.jobId })
    },
  )

  it('does not commit a native PDF with missing requested bookmarks', async () => {
    vi.mocked(invoke).mockResolvedValue(nativePrepared)
    vi.mocked(inspectPdf).mockResolvedValue({ pages: 2, outline: [] })
    await expect(exportPdfWithNative(nativeRequest, new AbortController().signal)).rejects.toThrow(
      'requested heading bookmarks',
    )
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: nativeRequest.jobId })
  })

  it('does not commit a native PDF that includes bookmarks after they were disabled', async () => {
    vi.mocked(invoke).mockResolvedValue(nativePrepared)
    await expect(
      exportPdfWithNative(
        { ...nativeRequest, includeOutline: false },
        new AbortController().signal,
      ),
    ).rejects.toThrow('requested heading bookmarks')
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: nativeRequest.jobId })
  })

  it.each([0, -1, NaN, 1.5])('rejects invalid page count %s without committing', async (pages) => {
    vi.mocked(invoke).mockResolvedValue(nativePrepared)
    vi.mocked(inspectPdf).mockResolvedValue({ pages, outline: [] })
    await expect(exportPdfWithNative(nativeRequest, new AbortController().signal)).rejects.toThrow(
      'no valid pages',
    )
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: nativeRequest.jobId })
  })

  it('removes an unreadable native artifact without replacing the target', async () => {
    vi.mocked(invoke).mockResolvedValue(nativePrepared)
    vi.mocked(inspectPdf).mockRejectedValue(new Error('Invalid PDF'))
    await expect(exportPdfWithNative(nativeRequest, new AbortController().signal)).rejects.toThrow(
      'Invalid PDF',
    )
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: nativeRequest.jobId })
  })

  it('never commits a native renderer result that arrives after cancellation', async () => {
    const controller = new AbortController()
    let finish!: (value: typeof nativePrepared) => void
    vi.mocked(invoke).mockImplementation((command) =>
      command === 'prepare_native_pdf_export'
        ? new Promise((resolve) => {
            finish = resolve
          })
        : Promise.resolve(undefined),
    )
    const exporting = exportPdfWithNative(nativeRequest, controller.signal)
    controller.abort()
    finish(nativePrepared)
    await expect(exporting).rejects.toMatchObject({ name: 'AbortError' })
    expect(inspectPdf).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
    expect(invoke).toHaveBeenLastCalledWith('cancel_pdf_export', { jobId: nativeRequest.jobId })
  })

  it('rejects a native result from another job before artifact inspection', async () => {
    vi.mocked(invoke).mockResolvedValue({ ...nativePrepared, jobId: 'other-job' })
    await expect(exportPdfWithNative(nativeRequest, new AbortController().signal)).rejects.toThrow(
      'does not match',
    )
    expect(inspectPdf).not.toHaveBeenCalled()
    expect(invoke).not.toHaveBeenCalledWith('commit_pdf_export', expect.anything())
  })
})
