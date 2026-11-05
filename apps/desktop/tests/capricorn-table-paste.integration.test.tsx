import { act, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'
import { getCapricornRuntimeInput } from '@/components/EditorArea/capricornRuntimeDom'

// Exercise the input bridge without reading or changing the system clipboard.
class BrowserTransfer {
  private data = new Map<string, string>()
  files: File[] = []

  get types() { return [...this.data.keys()] }
  get items() { return this.types.map((type) => ({ kind: 'string' as const, type })) }
  getData(type: string) { return this.data.get(type) ?? '' }
  setData(type: string, text: string) { this.data.set(type, text) }
  clearData(type?: string) {
    if (type) this.data.delete(type)
    else this.data.clear()
  }
}

let adapter: CapricornRuntimeAdapter | undefined

beforeEach(() => {
  vi.stubGlobal('DataTransfer', BrowserTransfer)
})
afterEach(async () => {
  await act(async () => adapter?.destroy())
  adapter = undefined
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const source = [
  'Before', '',
  '| A | B | C |',
  '| :--- | :---: | ---: |',
  '| D | left target right | F |',
  '', 'After',
].join('\n')

describe('Capricorn table clipboard regression #1280', () => {
  it.each([
    {
      name: 'selected ChatGPT code-block text',
      text: 'ordinary 中文',
      html: '<pre><code class="language-plaintext">ordinary 中文</code></pre>',
      replacement: 'ordinary 中文',
    },
    {
      name: 'literal Markdown and line breaks from a preformatted selection',
      text: '**literal**\nsecond line',
      html: '<pre><code>**literal**\nsecond line</code></pre>',
      replacement: '\\*\\*literal\\*\\*<br>second line',
    },
    {
      name: 'HTML paragraph formatting',
      text: 'Rich Link',
      html: '<p><strong>Rich</strong> <a href="https://example.com/">Link</a></p>',
      replacement: '**Rich** [Link](https://example.com/)',
    },
  ])('pastes $name without deleting a cell or changing table alignment', async ({ text, html, replacement }) => {
    const container = document.createElement('div')
    document.body.append(container)
    vi.spyOn(container, 'getBoundingClientRect').mockReturnValue(new DOMRect(40, 40, 800, 600))
    const onError = vi.fn()
    await act(async () => {
      adapter = createCapricornRuntimeAdapter({
        container,
        createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
        onChange: () => {},
        options: { markdown: source, autoFocus: false, virtualize: { enable: false }, onError },
      })
      adapter.find.search({ query: 'target' })
      await adapter.find.navigateTo?.(0)
      adapter.find.close()
      adapter.focus()
    })
    const runtime = adapter!
    const input = getCapricornRuntimeInput(container)!
    expect(input).not.toBeNull()
    const clipboard = new BrowserTransfer()
    clipboard.setData('text/plain', text)
    clipboard.setData('text/html', html)
    const event = new Event('paste', { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'clipboardData', { value: clipboard })
    await act(async () => {
      input.dispatchEvent(event)
      // Browser clipboard data is only available during the native event.
      clipboard.clearData()
    })
    const expected = source.replace('target', replacement)
    await waitFor(() => expect(runtime.getMarkdown()).toBe(expected))
    expect(event.defaultPrevented).toBe(true)
    expect(container.querySelectorAll('[role="cell"], [role="columnheader"]')).toHaveLength(6)
    await act(async () => runtime.commands.undo())
    expect(runtime.getMarkdown()).toBe(source)
    await act(async () => runtime.commands.redo())
    expect(runtime.getMarkdown()).toBe(expected)
    await act(async () => runtime.setMarkdown(expected))
    expect(runtime.getMarkdown()).toBe(expected)
    expect(onError).not.toHaveBeenCalled()
  })
})
