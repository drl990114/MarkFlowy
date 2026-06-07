import type { EditorViewType as RmeEditorViewType } from 'rme'

export const EditorViewType = {
  WYSIWYG: 'wysiwyg' as RmeEditorViewType,
  SOURCECODE: 'sourceCode' as RmeEditorViewType,
  PREVIEW: 'preview' as RmeEditorViewType,
} as const

export type EditorViewType = RmeEditorViewType
