// @vitest-environment jsdom
import { act } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import type { ResumeSelection } from '@/stores/editorResumeStore'
import type { CapricornRuntimeFactory, CapricornRuntimeSession } from './capricornRuntimeAdapter'
import { createCapricornResumeApi } from './capricornResume'
import { createCapricornMarkdownSelectionApi } from './capricornMarkdownSelection'

const sessions: CapricornRuntimeSession[] = []
beforeAll(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => document.createElement('div').getBoundingClientRect(),
  })
})
afterEach(async () => {
  await act(async () => sessions.splice(0).forEach((session) => session.destroy()))
  document.body.replaceChildren()
})

async function mount(markdown: string, getMarkdown?: () => string) {
  const container = document.createElement('div')
  document.body.append(container)
  let session!: CapricornRuntimeSession
  await act(async () => {
    session = (createCapricornRuntime as CapricornRuntimeFactory)(container, { markdown, autoFocus: false })
  })
  sessions.push(session)
  return { session, api: createCapricornMarkdownSelectionApi(session, getMarkdown), resume: createCapricornResumeApi(session) }
}
async function select(resume: ReturnType<typeof createCapricornResumeApi>, selection: ResumeSelection) {
  await act(async () => expect(resume.restore(selection)).toBe(true))
}

describe.skipIf(!isCapricornRuntimeAvailable)('Markdown caret mapping with the installed runtime codec', () => {
  it.each([
    { name: 'heading', markdown: '# Heading\n\nBody\n', word: 'Heading' },
    { name: 'list', markdown: '- First item\n- Second item\n', word: 'Second' },
    { name: 'bold source marks', markdown: 'Before **bold text** after\n', word: 'bold' },
    { name: 'link text', markdown: 'Before [label](https://example.com) after\n', word: 'label' },
    { name: 'bare autolink', markdown: 'Before https://example.com/path/segment/last-path after\n', word: 'segment' },
    { name: 'angle autolink', markdown: 'Before <https://example.com/path/segment/last-path> after\n', word: 'segment' },
    { name: 'inline math', markdown: 'Before $a + longVariable + b$ after\n', word: 'Variable' },
    { name: 'fenced code', markdown: '```js\nconst value = 1\n```\n', word: 'value' },
    { name: 'repeated text', markdown: '# Repeated\n\nRepeated\n\nRepeated\n', word: 'Repeated', last: true },
    { name: 'Unicode and CRLF', markdown: '# 标题😀\r\n\r\n正文🦊结束\r\n', word: '🦊' },
    { name: 'inline code', markdown: 'Before `value` after\n', word: 'value' },
  ])('round-trips a backward selection in $name without touching content or history', async ({ markdown, word, last }) => {
    const { session, api, resume } = await mount(markdown)
    const start = last ? markdown.lastIndexOf(word) : markdown.indexOf(word)
    const expected = { anchor: start + word.length, head: start }
    const before = { markdown: session.getMarkdown(), selection: resume.capture(), undo: session.getUiState().canUndo }
    const mapped = await api.resolve(markdown, expected)
    expect(mapped).toBeDefined()
    expect(resume.capture()).toEqual(before.selection)
    expect(session.getMarkdown()).toBe(before.markdown)
    expect(session.getUiState().canUndo).toBe(before.undo)
    if (!mapped) return
    await select(resume, mapped)
    const selected = resume.capture()
    const captured = await api.capture()
    expect(captured).toEqual({ markdown: before.markdown, ...expected })
    expect(resume.capture()).toEqual(selected)
    expect(session.getMarkdown()).toBe(before.markdown)
    expect(session.getUiState().canUndo).toBe(before.undo)
    if (last && mapped.kind === 'capricorn') expect(mapped.anchor.path[0]).toBe(2)
  })

  it('keeps a collapsed caret collapsed and snaps heading syntax to its text boundary', async () => {
    const { session, api, resume } = await mount('# Heading')
    const mapped = await api.resolve('# Heading', { anchor: 1, head: 1 })
    expect(mapped).toMatchObject({ kind: 'capricorn', anchor: { path: [0, 0], offset: 0 }, focus: { path: [0, 0], offset: 0 } })
    await select(resume, mapped!)
    expect(await api.capture()).toEqual({ markdown: session.getMarkdown(), anchor: 2, head: 2 })
  })

  it.each([
    { name: 'two-space bullets', markdown: '- one\n  - nested\n', word: 'nested' },
    { name: 'three-space mixed list', markdown: '1. one\n2. two\n   - nested\n', word: 'nested' },
    { name: 'three-space ordered list', markdown: '1. one\n   1. nested\n', word: 'nested' },
    { name: 'repeated list text', markdown: '- nested\n  - nested\n  - nested\n', word: 'nested' },
    { name: 'deep nesting with Unicode and CRLF', markdown: '- 一级😀\r\n  - 二级\r\n    - 三级🦊\r\n', word: '三级🦊' },
    { name: 'paragraph before a list', markdown: 'Target\n\n- one\n  - nested\n', word: 'Target' },
    { name: 'paragraph after a list', markdown: '- one\n  - nested\n\nTarget\n', word: 'Target' },
  ])('captures a backward selection in original $name without reformatting', async ({ markdown, word }) => {
    const { session, api, resume } = await mount(markdown, () => markdown)
    const serialized = session.getMarkdown()
    const start = markdown.lastIndexOf(word)
    const expected = { anchor: start + word.length, head: start }
    const mapped = await api.resolve(markdown, expected)
    expect(mapped).toBeDefined()
    await select(resume, mapped!)
    const before = { selection: resume.capture(), undo: session.getUiState().canUndo }

    expect(await api.capture()).toEqual({ markdown, ...expected })
    expect(resume.capture()).toEqual(before.selection)
    expect(session.getMarkdown()).toBe(serialized)
    expect(session.getUiState().canUndo).toBe(before.undo)
  })

  it('captures inline atom boundaries against original list indentation', async () => {
    const markdown = '- one\n  - Before ![alt](image.png) after\n'
    const { session, api, resume } = await mount(markdown, () => markdown)
    const serialized = session.getMarkdown()
    await select(resume, {
      kind: 'capricorn', anchor: { path: [1, 1], edge: 'before' }, focus: { path: [1, 1], edge: 'after' },
    })
    expect(await api.capture()).toEqual({ markdown, anchor: markdown.indexOf('!['), head: markdown.indexOf(')') + 1 })
    expect(session.getMarkdown()).toBe(serialized)
  })

  it('rejects capture against source with different document semantics', async () => {
    const { api, resume } = await mount('- one\n  - nested', () => '- one\n- nested')
    await select(resume, {
      kind: 'capricorn', anchor: { path: [1, 0], offset: 3 }, focus: { path: [1, 0], offset: 3 },
    })
    expect(await api.capture()).toBeUndefined()
  })

  it('rejects a capture when the original source snapshot changes while mapping', async () => {
    let markdown = '- one\n  - nested'
    const { api, resume } = await mount(markdown, () => markdown)
    await select(resume, {
      kind: 'capricorn', anchor: { path: [1, 0], offset: 3 }, focus: { path: [1, 0], offset: 3 },
    })
    const pending = api.capture()
    markdown = '- one\n    - nested'
    expect(await pending).toBeUndefined()
  })

  it('resolves normalized CodeMirror offsets into a document retaining CRLF source', async () => {
    const markdown = '# Heading\r\n\r\nBody😀 text\r\n'
    const normalized = markdown.replace(/\r\n/g, '\n')
    const { api, resume } = await mount(markdown)
    const anchor = normalized.indexOf('text') + 2
    const mapped = await api.resolve(normalized, { anchor, head: anchor })
    expect(mapped).toMatchObject({ kind: 'capricorn', anchor: { path: [1, 0], offset: 9 } })
    await select(resume, mapped!)
    expect(await api.capture()).toEqual({ markdown, anchor: markdown.indexOf('text') + 2, head: markdown.indexOf('text') + 2 })
  })

  it('maps inline atom boundaries without inserting anything into the live document', async () => {
    const markdown = 'Before ![alt](image.png) after'
    const { session, api, resume } = await mount(markdown)
    await select(resume, {
      kind: 'capricorn',
      anchor: { path: [0, 1], edge: 'before' },
      focus: { path: [0, 1], edge: 'after' },
    })
    expect(await api.capture()).toEqual({ markdown, anchor: markdown.indexOf('!['), head: markdown.indexOf(')') + 1 })
    expect(session.getMarkdown()).toBe(markdown)
  })

  it('uses the current serialized model after a visual edit changes the Markdown prefix', async () => {
    const { session, api, resume } = await mount('Editable text')
    await select(resume, {
      kind: 'capricorn', anchor: { path: [0, 0], offset: 5 }, focus: { path: [0, 0], offset: 5 },
    })
    await act(async () => session.commands.setBlockType('heading-2'))
    expect(session.getMarkdown()).toBe('## Editable text')
    expect(await api.capture()).toEqual({ markdown: '## Editable text', anchor: 8, head: 8 })
  })

  it('rejects source whose parsed structure differs from the current document', async () => {
    const { api, session, resume } = await mount('# Heading')
    const before = resume.capture()
    expect(await api.resolve('Heading', { anchor: 3, head: 3 })).toBeUndefined()
    expect(await api.resolve('# Different', { anchor: 4, head: 4 })).toBeUndefined()
    expect(resume.capture()).toEqual(before)
    expect(session.getMarkdown()).toBe('# Heading')
  })

  it('does not turn a hidden link destination into a selectable text location', async () => {
    const markdown = 'Before [label](https://example.com/path/segment/last-path) after'
    const { api, session, resume } = await mount(markdown)
    const before = resume.capture()
    const offset = markdown.indexOf('segment') + 3
    expect(await api.resolve(markdown, { anchor: offset, head: offset })).toBeUndefined()
    expect(resume.capture()).toEqual(before)
    expect(session.getMarkdown()).toBe(markdown)
  })

  it('rejects a capture after the document changes during serialization', async () => {
    const { api, session, resume } = await mount('# Heading')
    await select(resume, { kind: 'capricorn', anchor: { path: [0, 0], offset: 2 }, focus: { path: [0, 0], offset: 2 } })
    const pending = api.capture()
    await act(async () => session.setMarkdown('Replacement'))
    expect(await pending).toBeUndefined()
    expect(session.getMarkdown()).toBe('Replacement')
  })

  it('rejects a pending resolution after the user moves the caret', async () => {
    const { api, resume } = await mount('# Heading')
    const pending = api.resolve('# Heading', { anchor: 4, head: 4 })
    const moved: ResumeSelection = { kind: 'capricorn', anchor: { path: [0, 0], offset: 1 }, focus: { path: [0, 0], offset: 1 } }
    await select(resume, moved)
    expect(await pending).toBeUndefined()
    expect(resume.capture()).toEqual(moved)
  })
})
