import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextContent,
  TextItem,
} from 'pdfjs-dist/types/src/display/api'
import { enablePdfTextStreamIteration } from './pdfTextStreamCompatibility'

const NativeReadableStream = globalThis.ReadableStream
class LegacyReadableStream<T> extends NativeReadableStream<T> {}
Object.defineProperty(LegacyReadableStream.prototype, Symbol.asyncIterator, { value: undefined })
Object.defineProperty(LegacyReadableStream.prototype, 'values', { value: undefined })

let getTextContent: PDFPageProxy['getTextContent']

function pdfFixture(): Uint8Array {
  const content = 'BT /F1 12 Tf 50 750 Td (Print930 END930) Tj ET'
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ]
  let source = '%PDF-1.4\n'
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(source.length)
    source += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xref = source.length
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  source += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(source)
}

function textItem(str: string, fontName = 'f1'): TextItem {
  return {
    str,
    fontName,
    dir: 'ltr',
    width: str.length * 6,
    height: 12,
    transform: [1, 0, 0, 1, 0, 0],
    hasEOL: false,
  }
}

const chunks: TextContent[] = [
  {
    items: [textItem('Print930')],
    styles: { f1: { fontFamily: 'Arial', ascent: 0.9, descent: -0.1, vertical: false } },
    lang: null,
  },
  {
    items: [textItem('END930'), textItem('中文', 'f2')],
    styles: { f2: { fontFamily: 'sans-serif', ascent: 0.8, descent: -0.2, vertical: false } },
    lang: 'zh-CN',
  },
]

function ownedDocument(streamTextContent: () => ReadableStream<TextContent>) {
  const page = {
    _transport: { _htmlForXfa: null },
    streamTextContent: vi.fn(streamTextContent),
    getTextContent,
  }
  const document = { getPage: vi.fn(async () => page) }
  return { page, document: document as unknown as PDFDocumentProxy }
}

function textStream(cancel = vi.fn()) {
  return new LegacyReadableStream<TextContent>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
    cancel,
  })
}

async function consume(stream: ReadableStream<TextContent>, stopEarly = false) {
  const collected: TextContent[] = []
  for await (const chunk of stream as ReadableStream<TextContent> & AsyncIterable<TextContent>) {
    collected.push(chunk)
    if (stopEarly) break
  }
  return collected
}

beforeAll(async () => {
  // Exercise PDF.js's actual for-await implementation rather than a copy of it.
  const pdf = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const task = pdf.getDocument({ data: pdfFixture() })
  const document = await task.promise
  const page = await document.getPage(1)
  getTextContent = page.getTextContent
  await task.destroy()
})

beforeEach(() => {
  vi.stubGlobal('ReadableStream', LegacyReadableStream)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('PDF text streams without native async iteration', () => {
  it('lets the real PDF.js text extractor merge chunks after the legacy stream used to reject', async () => {
    const { page, document } = ownedDocument(() => textStream())
    await expect(getTextContent.call(page as unknown as PDFPageProxy)).rejects.toBeInstanceOf(TypeError)

    const nativeIterator: unknown = Reflect.get(NativeReadableStream.prototype, Symbol.asyncIterator)
    enablePdfTextStreamIteration(document)
    const wrappedPage = await document.getPage(1)
    const result = await wrappedPage.getTextContent()

    expect(result.items).toEqual(chunks.flatMap((chunk) => chunk.items))
    expect(result.styles).toEqual({ ...chunks[0].styles, ...chunks[1].styles })
    expect(result.lang).toBe('zh-CN')
    expect(Reflect.get(NativeReadableStream.prototype, Symbol.asyncIterator)).toBe(nativeIterator)
    expect(Reflect.get(LegacyReadableStream.prototype, Symbol.asyncIterator)).toBeUndefined()
    expect(Reflect.get(LegacyReadableStream.prototype, 'values')).toBeUndefined()
  })

  it.each([false, true])('releases the reader lock and cancels only on early return: %s', async (stopEarly) => {
    const cancel = vi.fn()
    const stream = textStream(cancel)
    const { document } = ownedDocument(() => stream)
    enablePdfTextStreamIteration(document)
    const page = await document.getPage(1)
    const iterable = page.streamTextContent()

    expect(Object.hasOwn(iterable, Symbol.asyncIterator)).toBe(true)
    expect(await consume(iterable, stopEarly)).toEqual(stopEarly ? chunks.slice(0, 1) : chunks)
    expect(stream.locked).toBe(false)
    expect(cancel).toHaveBeenCalledTimes(stopEarly ? 1 : 0)
  })

  it('releases the lock while an early-return cancellation is still pending', async () => {
    let finishCancellation!: () => void
    const cancellation = new Promise<void>((resolve) => {
      finishCancellation = resolve
    })
    const cancel = vi.fn(() => cancellation)
    const stream = textStream(cancel)
    const { document } = ownedDocument(() => stream)
    enablePdfTextStreamIteration(document)
    const page = await document.getPage(1)
    let finished = false
    const consuming = consume(page.streamTextContent(), true).then((result) => {
      finished = true
      return result
    })

    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1))
    expect(stream.locked).toBe(false)
    expect(finished).toBe(false)

    finishCancellation()
    await expect(consuming).resolves.toEqual(chunks.slice(0, 1))
    expect(finished).toBe(true)
  })

  it('propagates a reader failure and releases its lock', async () => {
    const error = new Error('text extraction failed')
    const stream = new LegacyReadableStream<TextContent>({
      start(controller) {
        controller.error(error)
      },
    })
    const { document } = ownedDocument(() => stream)
    enablePdfTextStreamIteration(document)
    const page = await document.getPage(1)

    await expect(consume(page.streamTextContent())).rejects.toBe(error)
    expect(stream.locked).toBe(false)
  })

  it('leaves documents and pages unchanged when native iteration is supported', async () => {
    vi.unstubAllGlobals()
    const { page, document } = ownedDocument(() => new NativeReadableStream<TextContent>())
    const originalGetPage = document.getPage
    const originalStreamTextContent = page.streamTextContent

    enablePdfTextStreamIteration(document)
    expect(document.getPage).toBe(originalGetPage)
    await document.getPage(1)
    expect(page.streamTextContent).toBe(originalStreamTextContent)
  })

  it('wraps each cached page once and preserves the real extractor for XFA', async () => {
    const { page, document } = ownedDocument(() => textStream())
    const originalStreamTextContent = page.streamTextContent
    enablePdfTextStreamIteration(document)
    await document.getPage(1)
    const wrappedStreamTextContent = page.streamTextContent
    await document.getPage(1)
    expect(page.streamTextContent).toBe(wrappedStreamTextContent)
    expect(page.getTextContent).toBe(getTextContent)

    Object.assign(page, {
      _transport: { _htmlForXfa: {} },
      getXfa: vi.fn(async () => ({ name: '#text', value: 'XFA Print930' })),
    })
    const result = await getTextContent.call(page as unknown as PDFPageProxy)
    expect(result.items).toEqual([{ str: 'XFA Print930' }])
    expect(originalStreamTextContent).not.toHaveBeenCalled()
  })
})
