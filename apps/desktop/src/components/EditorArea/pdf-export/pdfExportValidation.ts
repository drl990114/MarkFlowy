import type { PDFDocumentLoadingTask } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

export interface PdfOutlineEntry {
  title: string
  depth: number
  page: number
}

export interface PdfInspection {
  pages: number
  outline: PdfOutlineEntry[]
}

interface OutlineNode {
  title: string
  dest: string | unknown[] | null
  items: OutlineNode[]
}

function isPageReference(value: unknown): value is { num: number; gen: number } {
  return Boolean(
    value &&
      typeof value === 'object' &&
      'num' in value &&
      Number.isInteger(value.num) &&
      'gen' in value &&
      Number.isInteger(value.gen),
  )
}

/** Read the generated artifact, including the destinations a reader will use. */
export async function inspectPdf(base64: string, signal?: AbortSignal): Promise<PdfInspection> {
  signal?.throwIfAborted()
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') {
    throw new Error('The browser did not generate a PDF document.')
  }
  const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
  signal?.throwIfAborted()
  pdf.GlobalWorkerOptions.workerSrc = workerUrl
  let task: PDFDocumentLoadingTask | undefined
  const abort = () => {
    void task?.destroy().catch(() => {})
  }
  signal?.addEventListener('abort', abort, { once: true })
  try {
    task = pdf.getDocument({ data: bytes, disableFontFace: true })
    const document = await task.promise
    signal?.throwIfAborted()
    const outline: PdfOutlineEntry[] = []
    const readNodes = async (nodes: OutlineNode[], depth: number): Promise<void> => {
      for (const node of nodes) {
        signal?.throwIfAborted()
        const destination: unknown[] | null =
          typeof node.dest === 'string' ? await document.getDestination(node.dest) : node.dest
        const reference = destination?.[0]
        const pageIndex =
          typeof reference === 'number' && Number.isInteger(reference)
            ? reference
            : isPageReference(reference)
              ? await document.getPageIndex(reference)
              : -1
        if (pageIndex < 0 || pageIndex >= document.numPages) {
          throw new Error('A PDF bookmark points to an invalid page.')
        }
        outline.push({ title: node.title, depth, page: pageIndex + 1 })
        await readNodes(node.items, depth + 1)
      }
    }
    const nodes = (await document.getOutline()) as OutlineNode[] | null
    await readNodes(nodes ?? [], 0)
    signal?.throwIfAborted()
    return { pages: document.numPages, outline }
  } catch (error) {
    signal?.throwIfAborted()
    throw error
  } finally {
    signal?.removeEventListener('abort', abort)
    await task?.destroy().catch(() => {})
  }
}

export function verifyPdfOutline(
  inspection: PdfInspection,
  headingCount: number,
  includeOutline: boolean,
): void {
  if (inspection.pages < 1) throw new Error('The generated PDF has no pages.')
  const expected = includeOutline ? headingCount : 0
  if (inspection.outline.length !== expected) {
    throw new Error('The generated PDF does not contain the requested heading bookmarks.')
  }
}

export function verifyPdfProbe(inspection: PdfInspection): boolean {
  const [parent, child, nextPage] = inspection.outline
  return (
    inspection.pages >= 2 &&
    inspection.outline.length === 3 &&
    parent?.title === 'MarkFlowy PDF probe' &&
    parent.depth === 0 &&
    parent.page === 1 &&
    child?.title === 'Nested heading' &&
    child.depth === 1 &&
    child.page === 1 &&
    nextPage?.title === 'Next page' &&
    nextPage.depth === 0 &&
    nextPage.page === 2
  )
}
