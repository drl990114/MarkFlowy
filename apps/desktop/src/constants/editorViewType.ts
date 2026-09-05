import { EditorViewType as RmeEditorViewType } from 'rme'

export const EditorViewType = {
  WYSIWYG: RmeEditorViewType.WYSIWYG,
  SOURCECODE: RmeEditorViewType.SOURCECODE,
  PREVIEW: RmeEditorViewType.PREVIEW,
} as const

export type EditorViewTypeValue = RmeEditorViewType

export { isCapricornRuntimeAvailable } from './capricornRuntime'
