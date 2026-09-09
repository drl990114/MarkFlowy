// @vitest-environment jsdom
import { act, fireEvent, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import { isCapricornRuntimeAvailable } from '@/constants/capricornRuntime'
import type { CapricornRuntimeFactory, CapricornRuntimeSession } from './capricornRuntimeAdapter'

let session: CapricornRuntimeSession | undefined
const rangeDescriptors = new Map(
  ['getBoundingClientRect', 'getClientRects'].map((key) => [
    key,
    Object.getOwnPropertyDescriptor(Range.prototype, key),
  ]),
)

beforeEach(() => {
  // Match Capricorn's CodeMirror DOM harness: jsdom has no Range geometry.
  // This suite checks package interaction and history, not visual layout.
  Object.defineProperties(Range.prototype, {
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
    getClientRects: { configurable: true, value: () => [] },
  })
})

afterEach(async () => {
  await act(async () => session?.destroy())
  session = undefined
  document.body.replaceChildren()
  for (const [key, descriptor] of rangeDescriptors) {
    if (descriptor) Object.defineProperty(Range.prototype, key, descriptor)
    else Reflect.deleteProperty(Range.prototype, key)
  }
})

describe.skipIf(!isCapricornRuntimeAvailable)('published Capricorn code blocks in Desktop', () => {
  it('shows readable languages and edits one fence with keyboard focus and undo intact', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const original = '```ts\nconst value = 1;\nreturn value;\n```\n\n```json\n{"value":2}\n```'
    await act(async () => {
      session = (createCapricornRuntime as CapricornRuntimeFactory)(container, {
        markdown: original,
        mode: 'edit',
        virtualize: { enable: false },
      })
    })

    const actions = within(container).getAllByRole('toolbar', { name: 'Code block actions' })
    expect(actions).toHaveLength(2)
    const language = within(actions[0]).getByRole('button', {
      name: 'Code block language: TypeScript',
    })
    expect(language.textContent).toBe('TypeScript')
    expect(
      within(actions[1]).getByRole('button', { name: 'Code block language: JSON' }),
    ).toBeTruthy()

    await act(async () => fireEvent.keyDown(language, { key: 'ArrowDown' }))
    const search = within(actions[0]).getByRole('combobox', { name: 'Code block language' })
    expect(document.activeElement).toBe(search)
    await act(async () => fireEvent.change(search, { target: { value: 'python' } }))
    await act(async () => fireEvent.keyDown(search, { key: 'Enter' }))
    expect(session!.getMarkdown()).toBe(original.replace('```ts', '```python'))
    expect(document.activeElement).toBe(
      within(actions[0]).getByRole('button', { name: 'Code block language: Python' }),
    )

    await act(async () => session!.commands.undo())
    expect(session!.getMarkdown()).toBe(original)
    await act(async () => session!.setMode('preview'))
    const previewActions = within(container).getAllByRole('toolbar', { name: 'Code block actions' })
    expect(within(previewActions[0]).getByText('TypeScript')).toBeTruthy()
    expect(
      within(previewActions[0]).queryByRole('button', { name: /Code block language/ }),
    ).toBeNull()
    expect(within(previewActions[0]).getByRole('button', { name: 'Copy code' })).toBeTruthy()
    expect(session!.getMarkdown()).toBe(original)
  })
})
