// @vitest-environment jsdom
import { act } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import type { CapricornRuntimeFactory, CapricornRuntimeSession } from './capricornRuntimeAdapter'
import { createCapricornResumeApi } from './capricornResume'
import { createCapricornMarkdownSelectionApi } from './capricornMarkdownSelection'

// Keep this real-codec fixture in a fresh environment: the installed runtime can
// hang on query after restoring a large-document selection in a later session.
let session: CapricornRuntimeSession | undefined
beforeAll(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', { configurable: true, value: () => [] })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => document.createElement('div').getBoundingClientRect(),
  })
})
afterEach(async () => {
  await act(async () => session?.destroy())
  session = undefined
  document.body.replaceChildren()
})

describe.skipIf(!isCapricornRuntimeAvailable)('Markdown caret mapping in large documents', () => {
  it('captures a middle nested-list caret beyond the precise global diff budget', async () => {
    const markdown = Array.from({ length: 1200 }, (_, index) => `- item${index}\n  - nested${index}\n`).join('')
    const container = document.createElement('div')
    document.body.append(container)
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, { markdown, autoFocus: false })
    })
    const runtime = session!
    const api = createCapricornMarkdownSelectionApi(runtime, () => markdown)
    const resume = createCapricornResumeApi(runtime)
    const serialized = runtime.getMarkdown()
    const offset = markdown.indexOf('nested600') + 3
    const mapped = await api.resolve(markdown, { anchor: offset, head: offset })
    expect(mapped).toBeDefined()
    await act(async () => expect(resume.restore(mapped!)).toBe(true))
    const before = { selection: resume.capture(), undo: runtime.getUiState().canUndo }

    expect(await api.capture()).toEqual({ markdown, anchor: offset, head: offset })
    expect(resume.capture()).toEqual(before.selection)
    expect(runtime.getMarkdown()).toBe(serialized)
    expect(runtime.getUiState().canUndo).toBe(before.undo)
  })
})
