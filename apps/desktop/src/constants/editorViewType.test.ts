import { describe, expect, it } from 'vitest'
import { EditorViewType as RmeEditorViewType } from 'rme'
import { EditorViewType } from './editorViewType'

describe('persisted editor mode identifiers', () => {
  it('keeps the lightweight host identifiers compatible with the installed editor', () => {
    expect(EditorViewType).toEqual(RmeEditorViewType)
  })
})
