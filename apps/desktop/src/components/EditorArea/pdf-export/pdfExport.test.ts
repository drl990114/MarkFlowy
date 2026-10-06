import { beforeEach, describe, expect, it, vi } from 'vitest'
import { invoke } from '@tauri-apps/api/core'
import { inspectPdf } from './pdfExportValidation'
import { exportPdfWithBrowser, getPdfExportFileName, probePdfBrowser } from './pdfExport'
import type { PdfExportRequest } from './pdfExport'
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
