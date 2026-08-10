import { describe, expect, it } from 'vitest'
import type { EditorLayoutNode } from '@/stores/useEditorStore'
import { containsEditorGroup, getTopEditorGroupId } from './editorLayoutActionGroups'

const leaf = (id: string): EditorLayoutNode => ({
  type: 'leaf',
  id,
  opened: [],
})

describe('getTopEditorGroupId', () => {
  it('uses the only group for both action edges', () => {
    expect(getTopEditorGroupId(leaf('only'), 'left')).toBe('only')
    expect(getTopEditorGroupId(leaf('only'), 'right')).toBe('only')
  })

  it('places actions in the outer groups of a horizontal split', () => {
    const layout: EditorLayoutNode = {
      type: 'branch',
      id: 'root',
      direction: 'horizontal',
      sizes: [50, 50],
      children: [leaf('left'), leaf('right')],
    }

    expect(getTopEditorGroupId(layout, 'left')).toBe('left')
    expect(getTopEditorGroupId(layout, 'right')).toBe('right')
  })

  it('keeps global actions on the top row of nested splits', () => {
    const layout: EditorLayoutNode = {
      type: 'branch',
      id: 'root',
      direction: 'vertical',
      sizes: [50, 50],
      children: [
        {
          type: 'branch',
          id: 'top',
          direction: 'horizontal',
          sizes: [50, 50],
          children: [leaf('top-left'), leaf('top-right')],
        },
        leaf('bottom'),
      ],
    }

    expect(getTopEditorGroupId(layout, 'left')).toBe('top-left')
    expect(getTopEditorGroupId(layout, 'right')).toBe('top-right')
  })
})

describe('containsEditorGroup', () => {
  const layout: EditorLayoutNode = {
    type: 'branch',
    id: 'root',
    direction: 'horizontal',
    sizes: [40, 60],
    children: [
      leaf('left'),
      {
        type: 'branch',
        id: 'right-column',
        direction: 'vertical',
        sizes: [50, 50],
        children: [leaf('top-right'), leaf('bottom-right')],
      },
    ],
  }

  it('finds an active group through nested split branches', () => {
    expect(containsEditorGroup(layout, 'bottom-right')).toBe(true)
  })

  it('rejects missing or unknown groups', () => {
    expect(containsEditorGroup(layout, 'missing')).toBe(false)
    expect(containsEditorGroup(layout)).toBe(false)
  })
})
