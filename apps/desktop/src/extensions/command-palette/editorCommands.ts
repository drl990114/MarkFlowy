import { isCurrentCommandTarget, type EditorCommandTarget } from './editorCommandTarget'
import { getCapricornEditor } from '@/components/EditorArea/capricornEditorRegistry'
import { sourceCodeCodemirrorViewMap } from '@/components/EditorArea/sourceCodeEditorRegistry'
import { insertSourceImage, insertSourceLink } from '@/components/EditorArea/sourceInsertCommands'
import { EditorViewType } from '@/constants/editorViewType'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import { redoDepth, undoDepth } from '@codemirror/commands'
import { Transaction } from '@codemirror/state'
import { createCommandMap } from '@markflowy/interface'

export {
  captureEditorCommandTarget,
  releaseEditorCommandTarget,
  isCurrentCommandTarget,
  type EditorCommandTarget,
} from './editorCommandTarget'

export type CommandUnavailableReason =
  | 'no_document'
  | 'unavailable'
  | 'preview'
  | 'read_only'
  | 'stale_target'
  | 'selection_unavailable'
  | 'no_undo'
  | 'no_redo'
  | 'markdown_only'
  | 'zen_mode'

export const EDITOR_COMMANDS = [
  ['editor_undo', 'undo'],
  ['editor_redo', 'redo'],
  ['editor_toggleStrong', 'bold'],
  ['editor_toggleEmphasis', 'italic'],
  ['editor_toggleCodeText', 'code'],
  ['editor_toggleH1', 'h1'],
  ['editor_toggleH2', 'h2'],
  ['editor_toggleH3', 'h3'],
  ['editor_toggleBlockquote', 'quote'],
  ['editor_toggleBulletList', 'bulletList'],
  ['editor_toggleOrderedList', 'orderedList'],
  ['editor_toggleTaskList', 'taskList'],
  ['editor_insertLink', 'link'],
  ['editor_insertImage', 'image'],
  ['editor_toggleDelete', 'strike'],
] as const
export type EditorPaletteCommand = (typeof EDITOR_COMMANDS)[number][0]

const sourceCommands = createCommandMap()

export function editorCommandUnavailable(
  target: EditorCommandTarget | null,
  command: EditorPaletteCommand,
): CommandUnavailableReason | undefined {
  if (!target) return 'no_document'
  if (!isCurrentCommandTarget(target)) return 'stale_target'
  if (target.mode === EditorViewType.PREVIEW) return 'preview'
  const { rich, source, sourceState, bookmark, fileId } = target
  if (rich) {
    if (getCapricornEditor(fileId) !== rich) return 'stale_target'
    const state = rich.getUiState()
    if (state.readOnly) return 'read_only'
    if (!bookmark || !rich.selection?.isValid(bookmark.id)) return 'selection_unavailable'
    if (command === 'editor_toggleDelete') return 'unavailable'
    if (command === 'editor_undo' && !state.canUndo) return 'no_undo'
    if (command === 'editor_redo' && !state.canRedo) return 'no_redo'
    if (
      (command === 'editor_insertLink' || command === 'editor_insertImage') &&
      (!bookmark.canInsertInline || !rich.requestInlineEdit)
    )
      return 'unavailable'
  } else if (source && sourceState) {
    if (
      sourceCodeCodemirrorViewMap.get(fileId)?.cm !== source ||
      source.state.doc !== sourceState.doc
    )
      return 'stale_target'
    if (source.state.readOnly) return 'read_only'
    if (command === 'editor_undo' && !undoDepth(source.state)) return 'no_undo'
    if (command === 'editor_redo' && !redoDepth(source.state)) return 'no_redo'
  } else return 'unavailable'
  if (
    !['editor_undo', 'editor_redo'].includes(command) &&
    useFileTypeConfigStore.getState().getFileTypeConfigById(fileId)?.type !== 'markdown'
  )
    return 'markdown_only'
  return undefined
}

export function restoreEditorCommandTarget(target: EditorCommandTarget): boolean {
  if (!isCurrentCommandTarget(target)) return false
  const { rich, bookmark, source, sourceState, fileId } = target
  if (rich && bookmark) {
    if (getCapricornEditor(fileId) !== rich) return false
    rich.focus()
    return rich.selection?.restore(bookmark.id) ?? false
  }
  if (
    source &&
    sourceState &&
    sourceCodeCodemirrorViewMap.get(fileId)?.cm === source &&
    source.state.doc === sourceState.doc &&
    !source.state.readOnly
  ) {
    source.focus()
    source.dispatch({
      selection: sourceState.selection,
      annotations: Transaction.addToHistory.of(false),
    })
    return true
  }
  return false
}

export async function executeEditorPaletteCommand(
  target: EditorCommandTarget | null,
  command: EditorPaletteCommand,
) {
  if (!target || editorCommandUnavailable(target, command) || !restoreEditorCommandTarget(target))
    return false
  const { rich, source, fileId } = target
  if (rich) {
    switch (command) {
      case 'editor_undo':
        rich.commands.undo()
        break
      case 'editor_redo':
        rich.commands.redo()
        break
      case 'editor_toggleStrong':
        rich.commands.toggleMark('bold')
        break
      case 'editor_toggleEmphasis':
        rich.commands.toggleMark('italic')
        break
      case 'editor_toggleCodeText':
        rich.commands.toggleMark('code')
        break
      case 'editor_toggleH1':
        rich.commands.setBlockType('heading-1')
        break
      case 'editor_toggleH2':
        rich.commands.setBlockType('heading-2')
        break
      case 'editor_toggleH3':
        rich.commands.setBlockType('heading-3')
        break
      case 'editor_toggleBlockquote':
        rich.commands.toggleBlockquote()
        break
      case 'editor_toggleBulletList':
        rich.commands.toggleList('bullet')
        break
      case 'editor_toggleOrderedList':
        rich.commands.toggleList('ordered')
        break
      case 'editor_toggleTaskList':
        rich.commands.toggleList('task')
        break
      case 'editor_insertLink':
        return rich.requestInlineEdit?.('link') ?? false
      case 'editor_insertImage':
        return rich.requestInlineEdit?.('image') ?? false
      default:
        return false
    }
    return true
  }
  if (!source) return false
  const isCurrent = () => !editorCommandUnavailable(target, command)
  if (command === 'editor_insertLink') return insertSourceLink(source, fileId, isCurrent)
  if (command === 'editor_insertImage') return insertSourceImage(source, fileId, isCurrent)
  if (/^editor_toggleH[123]$/.test(command))
    return sourceCommands.toggleHeading(source, { level: Number(command.at(-1)) })
  return sourceCommands[command.replace('editor_', '')]?.(source) ?? false
}
