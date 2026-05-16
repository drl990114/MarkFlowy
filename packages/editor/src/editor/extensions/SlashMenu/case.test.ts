import { describe, expect, test } from 'vitest'
import { getCase, SlashCases } from './case'
import type { SlashMenuState } from './type'

// 模拟 EditorView
const mockEditorView = {
  state: {
    selection: {
      from: 0,
      to: 0,
      $head: {
        parent: {
          type: { name: 'paragraph' },
          textContent: '',
          parentOffset: 0,
        },
        parentOffset: 0,
      },
    },
    doc: {
      content: {
        size: 1,
      },
      resolve: (pos: number) => ({
        parent: {
          type: { name: 'paragraph' },
          textContent: '',
        },
      }),
    },
  },
  domAtPos: () => ({ node: document.createElement('div') }),
} as any

describe('SlashMenu Input Method Handling', () => {
  const initialState: SlashMenuState = {
    open: false,
    filter: '',
    ignoredKeys: [],
  }

  test('should ignore slash key when input method is composing', () => {
    const event = {
      code: 'Slash',
      key: '/',
      isComposing: true,
    } as KeyboardEvent

    const result = getCase(initialState, event, mockEditorView, [])
    expect(result).toBe(SlashCases.Ignore)
  })

  test('should handle escape key when input method is composing', () => {
    const stateWithMenuOpen: SlashMenuState = {
      ...initialState,
      open: true,
    }

    const event = {
      key: 'Escape',
      isComposing: true,
    } as KeyboardEvent

    const result = getCase(stateWithMenuOpen, event, mockEditorView, [])
    expect(result).toBe(SlashCases.CloseMenu)
  })

  test('should handle backspace key when input method is composing and filter is empty', () => {
    const stateWithMenuOpen: SlashMenuState = {
      ...initialState,
      open: true,
      filter: '',
    }

    const event = {
      key: 'Backspace',
      isComposing: true,
    } as KeyboardEvent

    const result = getCase(stateWithMenuOpen, event, mockEditorView, [])
    expect(result).toBe(SlashCases.CloseMenu)
  })

  test('should ignore other keys when input method is composing', () => {
    const stateWithMenuOpen: SlashMenuState = {
      ...initialState,
      open: true,
      filter: 'test',
    }

    const event = {
      key: 'a',
      isComposing: true,
    } as KeyboardEvent

    const result = getCase(stateWithMenuOpen, event, mockEditorView, [])
    expect(result).toBe(SlashCases.Ignore)
  })

  test('should handle slash key normally when input method is not composing', () => {
    const event = {
      code: 'Slash',
      key: '/',
      isComposing: false,
    } as KeyboardEvent

    const result = getCase(initialState, event, mockEditorView, [])
    expect(result).toBe(SlashCases.OpenMenu)
  })
})
