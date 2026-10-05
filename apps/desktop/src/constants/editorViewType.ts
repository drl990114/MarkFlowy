import type { EditorViewType as RmeEditorViewType } from 'rme'
import { isCapricornRuntimeAvailable } from './capricornRuntime'

// Persisted mode identifiers must remain available without evaluating the RME bundle.
export const EditorViewType = {
  WYSIWYG: 'wysiwyg' as RmeEditorViewType.WYSIWYG,
  SOURCECODE: 'sourceCode' as RmeEditorViewType.SOURCECODE,
  PREVIEW: 'preview' as RmeEditorViewType.PREVIEW,
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
