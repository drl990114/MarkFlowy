// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import type { CapricornRuntimeFactory, CapricornRuntimeSession } from '@/components/EditorArea/capricornRuntimeAdapter'
import { createCapricornResumeApi } from '@/components/EditorArea/capricornResume'
import { canInsertCapricornBlock, createCapricornBlockInsertApi } from '@/components/EditorArea/capricornBlockInsert'

let session: CapricornRuntimeSession | undefined
beforeAll(() => {
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
})
afterEach(async () => {
  const previous = session
  session = undefined
  await act(async () => previous?.destroy())
  document.body.replaceChildren()
})

async function mount(markdown: string, anchor: number, head = anchor, path = [0, 0]) {
  const container = document.createElement('div')
  document.body.append(container)
  await act(async () => {
    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
      markdown, mode: 'edit', autoFocus: false, virtualize: { enable: false },
    })
  })
  const resume = createCapricornResumeApi(session!)
  await act(async () => {
    expect(resume.restore({ kind: 'capricorn', anchor: { path, offset: anchor },
      focus: { path, offset: head } })).toBe(true)
    session!.focus()
  })
  const bookmark = session!.selection!.capture()!
  expect(session!.selection!.restore(bookmark.id)).toBe(true)
  const currentSession = session!
  return { container, bookmark, insert: createCapricornBlockInsertApi(currentSession, container, () => session === currentSession)! }
}

describe('block insertion in the installed Capricorn runtime', () => {
  it.each(['code', 'math'] as const)('inserts an empty %s at the end and focuses its source editor', async (kind) => {
    const { container, insert } = await mount('Tail', 4)
    await act(async () => expect(await insert(kind, '', () => true)).toBe(true))
    const fence = kind === 'code' ? '```' : '$$'
    expect(session!.getMarkdown().trimEnd()).toBe(`Tail\n\n${fence}\n\n${fence}`)
    await waitFor(() => expect(document.activeElement?.classList.contains('cm-content')).toBe(true))
    expect(container.querySelectorAll('.cm-editor')).toHaveLength(1)
    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe('Tail')
  })

  it.each(['code', 'math'] as const)('splits a paragraph around an empty %s without losing the suffix', async (kind) => {
    const { insert } = await mount('Tail', 2)
    await act(async () => expect(await insert(kind, '', () => true)).toBe(true))
    const fence = kind === 'code' ? '```' : '$$'
    expect(session!.getMarkdown()).toBe(`Ta\n\n${fence}\n\n${fence}\n\nil`)
    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe('Tail')
  })

  it.each(['code', 'math'] as const)('moves selected text into the new %s and undoes in one step', async (kind) => {
    const { bookmark, insert } = await mount('Tail', 1, 3)
    expect(bookmark.text).toBe('ai')
    await act(async () => expect(await insert(kind, bookmark.text, () => true)).toBe(true))
    const fence = kind === 'code' ? '```' : '$$'
    expect(session!.getMarkdown()).toBe(`T\n\n${fence}\nai\n${fence}\n\nl`)
    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe('Tail')
  })

  it.each(['code', 'math'] as const)('creates an editable %s in an empty document', async (kind) => {
    const { insert } = await mount('', 0)
    await act(async () => expect(await insert(kind, '', () => true)).toBe(true))
    const fence = kind === 'code' ? '```' : '$$'
    expect(session!.getMarkdown().trim()).toBe(`${fence}\n\n${fence}`)
    await waitFor(() => expect(document.activeElement?.classList.contains('cm-content')).toBe(true))
  })

  it('keeps literal multiline source and embedded backticks', async () => {
    const { insert } = await mount('Tail', 4)
    await act(async () => expect(await insert('code', '```\nvalue\n```', () => true)).toBe(true))
    expect(session!.getMarkdown().trimEnd()).toBe('Tail\n\n````\n```\nvalue\n```\n````')
  })

  it.each(['- Tail', '> Tail'])('preserves %s around an insertion and undo', async (markdown) => {
    const { container, insert } = await mount(markdown, 2)
    await act(async () => expect(await insert('code', '', () => true)).toBe(true))
    expect(session!.getMarkdown()).toBe(`${markdown.slice(0, 2)}Ta\n\n\n\n\`\`\`\n\n\`\`\`\n\n\n\n${markdown.slice(0, 2)}il`)
    await waitFor(() => expect(document.activeElement?.classList.contains('cm-content')).toBe(true))
    const keys = Array.from(container.querySelectorAll('[data-cap-leaf-block]'), (node) => node.getAttribute('data-cap-key'))
    expect(new Set(keys).size).toBe(keys.length)
    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe(markdown)
  })

  it('refuses block insertion inside a table cell without changing its content', async () => {
    const markdown = '| A | B |\n| --- | --- |\n| C | D |'
    const { insert } = await mount(markdown, 0, 0, [0, 0, 0, 0])
    const before = session!.getMarkdown()
    expect(canInsertCapricornBlock(session!)).toBe(false)
    await act(async () => expect(await insert('code', '', () => true)).toBe(false))
    expect(session!.getMarkdown()).toBe(before)
  })

  it('does not reinterpret selected math delimiters as several source blocks', async () => {
    const { insert } = await mount('Tail', 4)
    await act(async () => expect(await insert('math', 'a\n$$\n$$\nb', () => true)).toBe(false))
    expect(session!.getMarkdown()).toBe('Tail')
  })

  it('does not insert into a document that changes while parsing', async () => {
    const { insert } = await mount('Tail', 4)
    await act(async () => {
      const pending = insert('code', '', () => true)
      session!.setMarkdown('New document')
      expect(await pending).toBe(false)
    })
    expect(session!.getMarkdown()).toBe('New document')
  })
})
