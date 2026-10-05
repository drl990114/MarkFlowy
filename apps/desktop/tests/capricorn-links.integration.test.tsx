import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import { act, fireEvent, waitFor } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'

let adapter: CapricornRuntimeAdapter | undefined
afterEach(async () => {
  await act(async () => adapter?.destroy())
  adapter = undefined
  document.body.replaceChildren()
})

test.skipIf(!isCapricornRuntimeAvailable)(
  'host adapter preserves paths, opens with a modifier and hot-switches editing mode',
  async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const markdown = '  [doc](./my notes/中文.md)  tail  '
    const open = vi.fn()
    await act(async () => {
      adapter = createCapricornRuntimeAdapter({
        container,
        createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
        onChange: vi.fn(),
        options: {
          markdown,
          handleLinkClick: open,
          autoFocus: false,
          virtualize: { enable: false },
        },
      })
    })
    expect(adapter!.getMarkdown()).toBe(markdown)
    const link = container.querySelector('a')!
    await act(async () => fireEvent.click(link, { ctrlKey: true }))
    expect(open).toHaveBeenCalledExactlyOnceWith('./my notes/中文.md')
    await act(async () => adapter!.updateSettings({ linkEditMode: 'markdown' }))
    await act(async () => fireEvent.click(link))
    await waitFor(() =>
      expect(container.querySelector('[data-cap-inline-source] .cm-content')).not.toBeNull(),
    )
    expect(adapter!.getMarkdown()).toBe(markdown)
    await act(async () => adapter!.updateSettings({ linkEditMode: 'popover' }))
    expect(container.querySelector('[data-cap-inline-source]')).toBeNull()
    expect(adapter!.getMarkdown()).toBe(markdown)
  },
)

test.skipIf(!isCapricornRuntimeAvailable).each([
  {
    name: 'bare URL in the release announcement',
    markdown:
      '- 🌟🌟🌟🌟🌟🌟 Web 端正式上线，支持在线编辑 github repo 以及纯浏览器本地编辑，期待大家的使用与反馈！https://www.markflowy.cc/zh',
    query: '反馈',
    replacement: '宝贵建议',
    href: 'https://www.markflowy.cc/zh',
  },
  {
    name: 'ordinary punctuation around an explicit Markdown link',
    markdown:
      'I wrote an article on how to use Copilot and Ollama in MarkFlowy. If you encounter some problems, you may find solutions here, [Use Copilot with Ollama](https://www.markflowy.cc/en/docs/Extension/UseCopilotWithOllama)。',
    query: 'some problems',
    replacement: 'any issues',
    href: 'https://www.markflowy.cc/en/docs/Extension/UseCopilotWithOllama',
  },
  {
    name: 'encoded bare URL',
    markdown:
      'Download notes: https://example.com/my%20notes/%E4%B8%AD%E6%96%87.md?next=a%2Fb&label=c%20d',
    query: 'Download notes',
    replacement: 'Read the document',
    // Autolinks render their visible text; Markdown must retain the original encoding.
    href: 'https://example.com/my notes/中文.md?next=a%2Fb&label=c d',
  },
])(
  'preserves $name after editing, undo, redo and reload',
  async ({ markdown, query, replacement, href }) => {
    const container = document.createElement('div')
    document.body.append(container)
    const onChange = vi.fn()
    await act(async () => {
      adapter = createCapricornRuntimeAdapter({
        container,
        createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
        onChange,
        options: { markdown, autoFocus: false, virtualize: { enable: false } },
      })
    })
    const runtime = adapter!
    const edited = markdown.replace(query, replacement)
    expect(container.querySelector('a')?.getAttribute('href')).toBe(href)
    onChange.mockClear()

    // A document edit invalidates the adapter's initial Markdown snapshot.
    await act(async () => {
      await runtime.find.searchAsync!({ query })
      expect(runtime.find.replaceAll(replacement)).toBe(1)
    })
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ documentChanged: true }))
    expect(runtime.getMarkdown()).toBe(edited)
    await act(async () => runtime.commands.undo())
    expect(runtime.getMarkdown()).toBe(markdown)
    await act(async () => runtime.commands.redo())
    expect(runtime.getMarkdown()).toBe(edited)

    await act(async () => runtime.setMarkdown('Reloading document'))
    await act(async () => runtime.setMarkdown(edited))
    expect(container.querySelector('a')?.getAttribute('href')).toBe(href)
    expect(runtime.getMarkdown()).toBe(edited)
    // Edit again after reload to exercise parsing and serialization together.
    await act(async () => {
      await runtime.find.searchAsync!({ query: replacement })
      expect(runtime.find.replaceAll(query)).toBe(1)
    })
    expect(runtime.getMarkdown()).toBe(markdown)
  },
)
