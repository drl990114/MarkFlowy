import { act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import type {
  CapricornRuntimeFactory,
  CapricornRuntimeOptions,
  CapricornRuntimeSession,
} from './capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from './capricornRuntimeDom'

// Exercise the constructible browser DataTransfer path used by the runtime's
// paste event bridge. A plain event payload takes a different fallback path.
class BrowserTransfer {
  private data = new Map<string, string>()
  files: File[] = []

  get types() {
    return [...this.data.keys()]
  }

  get items() {
    return this.types.map((type) => ({ kind: 'string', type }))
  }

  setData(type: string, text: string) {
    this.data.set(type, String(text))
  }

  getData(type: string) {
    return this.data.get(type) ?? ''
  }

  clearData(type?: string) {
    if (type) this.data.delete(type)
    else this.data.clear()
  }
}

const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
let session: CapricornRuntimeSession | undefined
let container: HTMLDivElement

beforeEach(() => {
  vi.stubGlobal('DataTransfer', BrowserTransfer)
  container = document.createElement('div')
  document.body.append(container)
})

afterEach(async () => {
  await act(async () => session?.destroy())
  session = undefined
  document.body.replaceChildren()
  vi.unstubAllGlobals()
})

async function mount(options: CapricornRuntimeOptions) {
  await act(async () => {
    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, options)
  })
  await act(async () => {
    session!.focus()
    await frame()
  })
  expect(getCapricornRuntimeInput(container)).not.toBeNull()
}

async function selectAll() {
  const isMac = /Mac OS X/i.test(navigator.userAgent)
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    key: 'a',
    code: 'KeyA',
    ctrlKey: !isMac,
    metaKey: isMac,
  })
  await act(async () => {
    getCapricornRuntimeInput(container)!.dispatchEvent(event)
    await frame()
  })
  expect(event.defaultPrevented).toBe(true)
}

async function dispatchClipboard(type: 'copy' | 'cut' | 'paste', data: BrowserTransfer) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'clipboardData', { value: data })
  await act(async () => {
    getCapricornRuntimeInput(container)!.dispatchEvent(event)
    // Native clipboard payloads need to be captured during event dispatch.
    if (type === 'paste') data.clearData()
    await frame()
  })
  expect(event.defaultPrevented).toBe(true)
}

describe.skipIf(!isCapricornRuntimeAvailable)('published Capricorn clipboard in Desktop', () => {
  it.each([false, true])('pastes a bare Base64 image address (HTML wrapper: %s)', async (withHtml) => {
    const source =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAAAwCAIAAABhdOiYAAAAfElEQVR42u3bMQ3AIBCGUbR0qQHGSkBEZVVFDSGgMiCBvSEkt70v/3zD2y8d+i0hWAL6yhWxNjrfO2jzfn5qxAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgAABAgQIECBAgHaB5Ntnsw7ItYlpWF7YMwAAAABJRU5ErkJggg=='
    const original = 'Replace this selection'
    const markdown = `![](${source})`
    await mount({ markdown: original })
    await selectAll()
    const clipboard = new BrowserTransfer()
    clipboard.setData('text/plain', `\r\n${source}\r\n`)
    if (withHtml) clipboard.setData('text/html', `<span>${source}</span>`)
    await dispatchClipboard('paste', clipboard)
    expect(session!.getMarkdown()).toBe(markdown)
    expect(container.querySelector('img')?.getAttribute('src')).toBe(source)
    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe(original)
    await act(async () => session!.commands.redo())
    expect(session!.getMarkdown()).toBe(markdown)
    await act(async () => {
      session!.setMarkdown('')
      session!.setMarkdown(markdown)
      await frame()
    })
    expect(container.querySelector('img')?.getAttribute('src')).toBe(source)
  })

  it('copies rich Markdown and pastes it through the real input event bridge', async () => {
    const markdown = '**Copy me** and keep this'
    await mount({ markdown })
    await selectAll()
    const copied = new BrowserTransfer()
    await dispatchClipboard('copy', copied)
    expect(copied.getData('text/plain')).toBe(markdown)
    expect(copied.getData('text/html')).toContain('<strong>Copy me</strong>')
    expect(copied.getData('application/x-capricorn-fragment')).not.toBe('')

    await act(async () => {
      session!.setMarkdown('')
      session!.focus()
      await frame()
    })
    await dispatchClipboard('paste', copied)
    expect(session!.getMarkdown()).toBe(markdown)
  })

  it('copies a large selection through exactly one host writer without editing the document', async () => {
    const markdown = Array(256)
      .fill('clipboard ' + 'x'.repeat(1100))
      .join('\n\n')
    const writeText = vi.fn(async () => {})
    const onClipboardResult = vi.fn()
    expect(new TextEncoder().encode(markdown).byteLength).toBeGreaterThanOrEqual(256 * 1024)
    await mount({ markdown, clipboard: { writeText }, onClipboardResult })
    await selectAll()
    const copied = new BrowserTransfer()
    const nativeWrite = vi.spyOn(copied, 'setData')
    await dispatchClipboard('copy', copied)
    expect(writeText).toHaveBeenCalledExactlyOnceWith(markdown)
    expect(nativeWrite).not.toHaveBeenCalled()
    expect(onClipboardResult).toHaveBeenCalledExactlyOnceWith({
      action: 'copy',
      status: 'markdown',
    })
    expect(session!.getMarkdown()).toBe(markdown)
  })

  it('retains the complete large selection when the host clipboard rejects a cut', async () => {
    const markdown = Array(256)
      .fill('retain ' + 'x'.repeat(1100))
      .join('\n\n')
    const writeText = vi.fn(async () => {
      throw new Error('Native clipboard unavailable')
    })
    const onClipboardResult = vi.fn()
    await mount({ markdown, clipboard: { writeText }, onClipboardResult })
    await selectAll()
    await dispatchClipboard('cut', new BrowserTransfer())
    expect(writeText).toHaveBeenCalledExactlyOnceWith(markdown)
    expect(onClipboardResult).toHaveBeenCalledExactlyOnceWith({ action: 'cut', status: 'failed' })
    expect(session!.getMarkdown()).toBe(markdown)
  })
})
