import { beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectPdf, verifyPdfOutline, verifyPdfProbe } from './pdfExportValidation'

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
  getOutline: vi.fn(),
  getDestination: vi.fn(),
  getPageIndex: vi.fn(),
}))
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => ({
  GlobalWorkerOptions: {},
  getDocument: mocks.getDocument,
}))
const pdf = btoa('%PDF-1.7\nfixture')

describe('PDF artifact inspection', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.destroy.mockResolvedValue(undefined)
    mocks.getOutline.mockResolvedValue([
      {
        title: '中文标题',
        dest: [{ num: 3, gen: 0 }, { name: 'XYZ' }, 0, 100, 0],
        items: [{ title: '重复', dest: 'nested', items: [] }],
      },
    ])
    mocks.getDestination.mockResolvedValue([1, { name: 'XYZ' }, 0, 50, 0])
    mocks.getPageIndex.mockResolvedValue(0)
    mocks.getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getOutline: mocks.getOutline,
        getDestination: mocks.getDestination,
        getPageIndex: mocks.getPageIndex,
      }),
      destroy: mocks.destroy,
    })
  })

  it('resolves named and referenced bookmark targets with their hierarchy', async () => {
    expect(await inspectPdf(pdf)).toEqual({
      pages: 2,
      outline: [
        { title: '中文标题', depth: 0, page: 1 },
        { title: '重复', depth: 1, page: 2 },
      ],
    })
    expect(mocks.getDestination).toHaveBeenCalledWith('nested')
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })

  it('rejects a bookmark outside the actual PDF page range and releases the parser', async () => {
    mocks.getPageIndex.mockResolvedValue(9)
    await expect(inspectPdf(pdf)).rejects.toThrow('invalid page')
    expect(mocks.destroy).toHaveBeenCalledOnce()
  })

  it('rejects a bookmark with no internal destination', async () => {
    mocks.getOutline.mockResolvedValue([{ title: 'Title', dest: null, items: [] }])
    await expect(inspectPdf(pdf)).rejects.toThrow('invalid page')
  })

  it('rejects non-PDF data before loading the parser', async () => {
    await expect(inspectPdf(btoa('HTML response'))).rejects.toThrow('did not generate a PDF')
    expect(mocks.getDocument).not.toHaveBeenCalled()
  })

  it('stops an obsolete artifact inspection after cancellation', async () => {
    const abort = new AbortController()
    mocks.getOutline.mockImplementation(async () => {
      abort.abort()
      return []
    })
    await expect(inspectPdf(pdf, abort.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(mocks.destroy).toHaveBeenCalled()
  })

  it('allows empty outlines only when the requested document has no headings', () => {
    expect(() => verifyPdfOutline({ pages: 1, outline: [] }, 0, true)).not.toThrow()
    expect(() => verifyPdfOutline({ pages: 1, outline: [] }, 1, true)).toThrow()
    expect(() => verifyPdfOutline({ pages: 0, outline: [] }, 0, false)).toThrow()
  })

  it('checks cross-page probe targets as well as its outline titles', () => {
    const probe = {
      pages: 2,
      outline: [
        { title: 'MarkFlowy PDF probe', depth: 0, page: 1 },
        { title: 'Nested heading', depth: 1, page: 1 },
        { title: 'Next page', depth: 0, page: 1 },
      ],
    }
    expect(verifyPdfProbe(probe)).toBe(false)
    probe.outline[2].page = 2
    expect(verifyPdfProbe(probe)).toBe(true)
  })
})
