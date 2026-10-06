// @vitest-environment node
import { readFile } from 'node:fs/promises'
import { describe, expect, it, vi } from 'vitest'
import { inspectPdf, verifyPdfOutline, verifyPdfProbe } from './pdfExportValidation'

// In Node the PDF worker uses an absolute module URL, whereas the application
// uses Vite's bundled URL. This still runs the same PDF.js parser and worker.
vi.mock('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url', async () => {
  const { createRequire } = await import('node:module')
  const { pathToFileURL } = await import('node:url')
  return {
    default: pathToFileURL(
      createRequire(import.meta.url).resolve('pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
    ).href,
  }
})

describe('actual browser PDF artifacts', () => {
  it.skipIf(!process.env.MARKFLOWY_PDF_TEST_NAMED_OUTPUT)(
    'matches an accessible heading containing a named image instead of ordinary text',
    async () => {
      const path = process.env.MARKFLOWY_PDF_TEST_NAMED_OUTPUT!
      const bytes = await readFile(path)
      const metadata = JSON.parse(await readFile(path.replace(/\.pdf$/, '.json'), 'utf8')) as {
        headingCount: number
      }
      const inspection = await inspectPdf(bytes.toString('base64'))
      verifyPdfOutline(inspection, metadata.headingCount, true)
      expect(inspection.outline.map((entry) => entry.title)).toEqual(['Named SVG'])
    },
  )
  it.skipIf(!process.env.MARKFLOWY_PDF_TEST_HIDDEN_OUTPUT)(
    'matches the final printable heading count for folded and inaccessible content',
    async () => {
      const path = process.env.MARKFLOWY_PDF_TEST_HIDDEN_OUTPUT!
      const bytes = await readFile(path)
      const metadata = JSON.parse(await readFile(path.replace(/\.pdf$/, '.json'), 'utf8')) as {
        headingCount: number
      }
      const inspection = await inspectPdf(bytes.toString('base64'))
      verifyPdfOutline(inspection, metadata.headingCount, true)
      expect(metadata.headingCount).toBe(2)
      expect(inspection.outline.map((entry) => entry.title)).toEqual(['Visible', 'Visible summary'])
    },
  )
  it.skipIf(!process.env.MARKFLOWY_PDF_TEST_OUTPUT)(
    'reads the real browser probe and resolves its nested and cross-page bookmarks',
    async () => {
      const bytes = await readFile(process.env.MARKFLOWY_PDF_TEST_OUTPUT!)
      const inspection = await inspectPdf(bytes.toString('base64'))
      expect(verifyPdfProbe(inspection)).toBe(true)
      expect(inspection.outline).toEqual([
        { title: 'MarkFlowy PDF probe', depth: 0, page: 1 },
        { title: 'Nested heading', depth: 1, page: 1 },
        { title: 'Next page', depth: 0, page: 2 },
      ])
    },
  )

  it.skipIf(!process.env.MARKFLOWY_PDF_TEST_RICH_OUTPUT)(
    'preserves selectable rich-document text and CJK, duplicate and skipped-level bookmarks',
    async () => {
      const bytes = await readFile(process.env.MARKFLOWY_PDF_TEST_RICH_OUTPUT!)
      const inspection = await inspectPdf(bytes.toString('base64'))
      const includeOutline = process.env.MARKFLOWY_PDF_TEST_OUTLINE !== 'false'
      verifyPdfOutline(inspection, 4, includeOutline)
      if (includeOutline) {
        expect(inspection.outline.map(({ title, depth }) => ({ title, depth }))).toEqual([
          { title: '表格 Table', depth: 0 },
          { title: '重复标题', depth: 1 },
          { title: '重复标题', depth: 1 },
          { title: '深层标题', depth: 2 },
        ])
      }
      const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
      const task = pdf.getDocument({ data: Uint8Array.from(bytes), disableFontFace: true })
      try {
        const document = await task.promise
        const texts: string[] = []
        for (let page = 1; page <= document.numPages; page += 1) {
          const content = await (await document.getPage(page)).getTextContent()
          texts.push(content.items.map((item) => ('str' in item ? item.str : '')).join(''))
        }
        // Some CJK fonts map glyphs to Unicode compatibility characters.
        const text = texts.join('\n').normalize('NFKC')
        expect(text).toContain('表格内容')
        expect(text).toContain('可选文本')
        expect(text).toContain('exportCode')
        expect(text).toContain('kept')
        expect(text).toContain('Final paragraph')
        expect(text).toContain('跳级标题后的可选文字。')
        if (process.env.MARKFLOWY_PDF_TEST_PAPER === 'letter') {
          const page = await document.getPage(1)
          const width = page.view[2] - page.view[0]
          const height = page.view[3] - page.view[1]
          expect(width).toBeCloseTo(792, 0)
          expect(height).toBeCloseTo(612, 0)
        }
      } finally {
        await task.destroy()
      }
    },
  )
})
