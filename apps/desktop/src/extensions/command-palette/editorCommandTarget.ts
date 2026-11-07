import { getCapricornEditor } from '@/components/EditorArea/capricornEditorRegistry'
import type { CapricornRuntimeAdapter, CapricornSelectionBookmark } from '@/components/EditorArea/capricornRuntimeAdapter'
import { getSourceCodeEditor } from '@/components/EditorArea/sourceCodeEditorInstances'
import { EditorViewType, type EditorViewTypeValue } from '@/constants/editorViewType'
import useEditorStore from '@/stores/useEditorStore'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import type { EditorState } from '@codemirror/state'
import type { EditorView } from '@codemirror/view'

export interface EditorCommandTarget {
  fileId: string
  groupId?: string
  /** Explicit toolbar pane; undefined retains the active editor compatibility registry. */
  resourceGroupId?: string
  mode: EditorViewTypeValue
  rich?: CapricornRuntimeAdapter
  bookmark?: CapricornSelectionBookmark | null
  source?: EditorView
  sourceState?: EditorState
}

export function captureEditorCommandTarget(pane?: { fileId: string; groupId?: string }): EditorCommandTarget | null {
  const { activeId, activeGroupId } = useEditorStore.getState()
  const fileId = pane?.fileId ?? activeId
  const groupId = pane?.groupId ?? activeGroupId
  if (!fileId) return null
  const mode = useEditorViewTypeStore.getState().getEditorViewType(fileId, groupId)
  const resourceGroupId = pane?.groupId
  const rich = mode === EditorViewType.WYSIWYG ? getCapricornEditor(fileId, resourceGroupId) : undefined
  const source =
    mode === EditorViewType.SOURCECODE ? getSourceCodeEditor(fileId, resourceGroupId)?.cm : undefined
  return {
    fileId,
    groupId,
    resourceGroupId,
    mode,
    rich,
    source,
    sourceState: source?.state,
    bookmark: rich?.selection?.capture(),
  }
}

export function releaseEditorCommandTarget(target: EditorCommandTarget | null) {
  if (target?.bookmark) target.rich?.selection?.release(target.bookmark.id)
}

export function isCurrentCommandTarget(target: EditorCommandTarget): boolean {
  const { activeId, activeGroupId } = useEditorStore.getState()
  return (
    activeId === target.fileId &&
    activeGroupId === target.groupId &&
    useEditorViewTypeStore.getState().getEditorViewType(target.fileId, target.groupId) === target.mode
  )
}

