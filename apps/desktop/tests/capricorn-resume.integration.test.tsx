import { act } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { createCapricornRuntime } from 'virtual:markflowy-capricorn-runtime'
import {
  createCapricornRuntimeAdapter,
  type CapricornRuntimeAdapter,
  type CapricornRuntimeFactory,
} from '@/components/EditorArea/capricornRuntimeAdapter'

const editors: CapricornRuntimeAdapter[] = []
async function create(markdown: string, virtualize = false) {
  const container = document.createElement('div')
  document.body.append(container)
  let editor!: CapricornRuntimeAdapter
  await act(async () => {
    editor = createCapricornRuntimeAdapter({
      container,
      createRuntime: createCapricornRuntime as CapricornRuntimeFactory,
      options: {
        markdown,
        autoFocus: false,
        virtualize: { enable: virtualize, firstPaintBlockSize: 10 },
        getScrollableContainer: () => container,
      },
      onChange: () => {},
    })
  })
  editors.push(editor)
  return editor
}
afterEach(async () => {
  await act(async () => editors.splice(0).forEach((editor) => editor.destroy()))
  document.body.replaceChildren()
})

describe('persistent Capricorn selection against the installed runtime', () => {
  it('restores a selection into a fresh document without changing Markdown or undo', async () => {
    const markdown = '# Heading\n\nHello world!'
    const first = await create(markdown)
    const saved = {
      kind: 'capricorn' as const,
      anchor: { path: [1, 0], offset: 2 },
      focus: { path: [1, 0], offset: 7 },
    }
    await act(async () => {
      expect(first.resume!.restore(saved)).toBe(true)
    })
    expect(first.resume!.capture()).toEqual(saved)
    const second = await create(markdown)
    await act(async () => {
      expect(second.resume!.restore(JSON.parse(JSON.stringify(saved)))).toBe(true)
    })
    expect(second.resume!.capture()).toEqual(saved)
    expect(second.getMarkdown()).toBe(first.getMarkdown())
    expect(second.getUiState().canUndo).toBe(false)
  })

  it('clamps edited text and ignores removed model paths', async () => {
    const editor = await create('Hi')
    await act(async () => {
      expect(
        editor.resume!.restore({
          kind: 'capricorn',
          anchor: { path: [0, 0], offset: 99 },
          focus: { path: [0, 0], offset: 99 },
        }),
      ).toBe(true)
    })
    expect(editor.resume!.capture()).toMatchObject({ anchor: { offset: 2 }, focus: { offset: 2 } })
    const before = editor.resume!.capture()
    expect(
      editor.resume!.restore({
        kind: 'capricorn',
        anchor: { path: [999, 0], offset: 0 },
        focus: { path: [999, 0], offset: 0 },
      }),
    ).toBe(false)
    expect(editor.resume!.capture()).toEqual(before)
  })

  it('restores an offscreen selection through the model and reports selection-only changes', async () => {
    const editor = await create(
      Array.from({ length: 120 }, (_, index) => `Paragraph ${index}`).join('\n\n'),
      true,
    )
    let changes = 0
    const unsubscribe = editor.resume!.subscribe(() => {
      changes += 1
    })
    await act(async () => {
      expect(
        editor.resume!.restore({
          kind: 'capricorn',
          anchor: { path: [90, 0], offset: 3 },
          focus: { path: [90, 0], offset: 3 },
        }),
      ).toBe(true)
    })
    expect(editor.resume!.capture()).toMatchObject({ anchor: { path: [90, 0], offset: 3 } })
    expect(changes).toBeGreaterThan(0)
    unsubscribe()
  })
})
