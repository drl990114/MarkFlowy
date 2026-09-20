import { openLocalHistory } from '@/components/LocalHistory/historyDialogStore'
import { commandRegistry } from '@/commands'
import { focusActiveEditor } from '@/components/EditorArea/focusActiveEditor'
import { openDocumentSearch } from '@/components/EditorArea/editorSearchStore'
import { EditorViewType } from '@/constants/editorViewType'
import useEditorStore from '@/stores/useEditorStore'
import useFileTypeConfigStore from '@/stores/useFileTypeConfigStore'
import useLayoutStore from '@/stores/useLayoutStore'
import {
  EDITOR_COMMANDS,
  editorCommandUnavailable,
  executeEditorPaletteCommand,
  isCurrentCommandTarget,
  type CommandUnavailableReason,
  type EditorCommandTarget,
} from './editorCommands'

export const COMMAND_CATEGORIES = ['file', 'editor', 'view', 'app'] as const
export type CommandCategory = (typeof COMMAND_CATEGORIES)[number]
export interface CommandPaletteContext {
  target: EditorCommandTarget | null
  platform: 'mac' | 'windows' | 'linux'
}
export interface PaletteCommand {
  id: string
  category: CommandCategory
  labelKey: string
  keywords: readonly string[]
  getUnavailableReason: (context: CommandPaletteContext) => CommandUnavailableReason | undefined
  execute: (context: CommandPaletteContext) => Promise<boolean> | boolean
}

const APPLICATION_COMMANDS = [
  ['app_quickOpen', 'file', 'search files open'],
  ['app_openFolder', 'file', 'workspace directory'],
  ['app_save', 'file', 'write document'],
  ['app_closeCurrentEditorTab', 'file', 'close tab'],
  ['app_findReplaceEditor', 'editor', 'search find replace'],
  ['app_toggleLeftsidebarVisible', 'view', 'sidebar explorer'],
  ['app_toggleRightsidebarVisible', 'view', 'sidebar outline'],
  ['app_toggleZenMode', 'view', 'zen focus distraction free'],
  ['app_toggleEditorType', 'view', 'markdown source wysiwyg'],
  ['app_splitEditorRight', 'view', 'split right horizontal'],
  ['app_splitEditorDown', 'view', 'split down vertical'],
  ['app_openSetting', 'app', 'settings preferences configure'],
  ['app_hide', 'app', 'hide window'],
] as const

const DOCUMENT_COMMANDS = new Set([
  'app_save',
  'app_closeCurrentEditorTab',
  'app_findReplaceEditor',
  'app_toggleEditorType',
  'app_splitEditorRight',
  'app_splitEditorDown',
])

const EDITOR_ALIASES: Readonly<Record<string, readonly string[]>> = {
  editor_toggleStrong: ['strong', '加粗'],
  editor_toggleCodeText: ['inline code', '代码'],
  editor_toggleBulletList: ['unordered list', '无序列表'],
  editor_toggleOrderedList: ['numbered list'],
  editor_toggleTaskList: ['checklist', 'todo', '待办'],
  editor_toggleDelete: ['strikethrough', 'strike'],
}

function applicationUnavailable(
  id: string,
  { target, platform }: CommandPaletteContext,
): CommandUnavailableReason | undefined {
  const layout = useLayoutStore.getState()
  if (id === 'app_hide' && platform !== 'mac') return 'unavailable'
  if (DOCUMENT_COMMANDS.has(id) || (id === 'app_toggleZenMode' && !layout.zenModeActive)) {
    if (!target) return 'no_document'
    if (!isCurrentCommandTarget(target)) return 'stale_target'
  }
  if (id === 'app_splitEditorRight' || id === 'app_splitEditorDown') {
    if (!useEditorStore.getState().activeGroupId) return 'unavailable'
    if (target && !isCurrentCommandTarget(target)) return 'stale_target'
  }
  if (target && id === 'app_findReplaceEditor') {
    if (
      target.mode === EditorViewType.PREVIEW &&
      useFileTypeConfigStore.getState().getFileTypeConfigById(target.fileId)?.type !== 'pdf'
    )
      return 'preview'
    return undefined
  }
  if (target && id === 'app_toggleEditorType') {
    const config = useFileTypeConfigStore.getState().getFileTypeConfigById(target.fileId)
    const modes = config?.supportedModes
    if (
      !modes?.includes(EditorViewType.SOURCECODE) ||
      (!modes.includes(EditorViewType.WYSIWYG) && config?.type !== 'html')
    )
      return 'unavailable'
  }
  if (
    layout.zenModeActive &&
    (id === 'app_toggleLeftsidebarVisible' || id === 'app_toggleRightsidebarVisible')
  )
    return 'zen_mode'
  return commandRegistry.hasCommand(id) ? undefined : 'unavailable'
}

export const paletteCommands: readonly PaletteCommand[] = [
  {
    id: 'app_localHistory',
    category: 'file',
    labelKey: 'history.title',
    keywords: ['history', 'versions', '历史', '版本'],
    getUnavailableReason: () => undefined,
    execute: ({ target }) => openLocalHistory(target?.fileId),
  },
  ...APPLICATION_COMMANDS.map(
    ([id, category, aliases]): PaletteCommand => ({
      id,
      category,
      labelKey: `command.id_descriptions.${id}`,
      keywords: aliases.split(' '),
      getUnavailableReason: (context) => applicationUnavailable(id, context),
      execute: async (context) => {
        if (applicationUnavailable(id, context)) return false
        if (DOCUMENT_COMMANDS.has(id)) focusActiveEditor()
        if (id === 'app_findReplaceEditor') return openDocumentSearch()
        await commandRegistry.execute(id)
        return true
      },
    }),
  ),
  ...EDITOR_COMMANDS.map(
    ([id, toolbarLabel]): PaletteCommand => ({
      id,
      category: 'editor',
      labelKey: `toolbar.${toolbarLabel}`,
      keywords: [toolbarLabel, id.replace('editor_', ''), ...(EDITOR_ALIASES[id] ?? [])],
      getUnavailableReason: ({ target }) => editorCommandUnavailable(target, id),
      execute: ({ target }) => executeEditorPaletteCommand(target, id),
    }),
  ),
]
