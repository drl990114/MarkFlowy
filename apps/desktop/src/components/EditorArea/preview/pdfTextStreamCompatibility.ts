import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextContent,
} from 'pdfjs-dist/types/src/display/api'

type IterableTextStream = ReadableStream<TextContent> & Partial<AsyncIterable<TextContent>>

/** Keep PDF.js text extraction working in WebViews without stream async iteration. */
export function enablePdfTextStreamIteration(document: PDFDocumentProxy): void {
  if (typeof (ReadableStream.prototype as IterableTextStream)[Symbol.asyncIterator] === 'function')
    return

  const getPage = document.getPage.bind(document)
  const pages = new WeakSet<PDFPageProxy>()
  document.getPage = async (pageNumber) => {
    const page = await getPage(pageNumber)
    if (!pages.has(page)) {
      pages.add(page)
      const streamTextContent = page.streamTextContent.bind(page)
      page.streamTextContent = (params) => {
        const stream = streamTextContent(params) as IterableTextStream
        if (typeof stream[Symbol.asyncIterator] !== 'function') {
          // PDF.js 6 getTextContent uses for-await, while its text layer already
          // uses getReader. Adapt only streams owned by this PDF document.
          Object.defineProperty(stream, Symbol.asyncIterator, {
            value: async function* () {
              const reader = stream.getReader()
              let finished = false
              try {
                while (true) {
                  const { done, value } = await reader.read()
                  if (done) {
                    finished = true
                    return
                  }
                  yield value
                }
              } catch (error) {
                finished = true
                throw error
              } finally {
                let cancellation: Promise<void> | undefined
                try {
                  if (!finished) cancellation = reader.cancel()
                } finally {
                  reader.releaseLock()
                }
                await cancellation
              }
            },
          })
        }
        return stream
      }
    }
    return page
  }
}
