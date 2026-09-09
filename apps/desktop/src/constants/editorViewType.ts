import { EditorViewType as RmeEditorViewType } from 'rme'
import { isCapricornRuntimeAvailable } from './capricornRuntime'

export const EditorViewType = {
  WYSIWYG: RmeEditorViewType.WYSIWYG,
  SOURCECODE: RmeEditorViewType.SOURCECODE,
  PREVIEW: RmeEditorViewType.PREVIEW,
} as const

export type EditorViewTypeValue = RmeEditorViewType

export function isCapricornView(
  viewType: EditorViewTypeValue | undefined,
  runtimeAvailable = isCapricornRuntimeAvailable,
): boolean {
  return (
    viewType === EditorViewType.WYSIWYG || (viewType === EditorViewType.PREVIEW && runtimeAvailable)
  )
}

export { isCapricornRuntimeAvailable }
