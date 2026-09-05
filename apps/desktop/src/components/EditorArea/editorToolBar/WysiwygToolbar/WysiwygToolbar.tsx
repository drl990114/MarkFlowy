import { useEditorStore } from '@/stores'
import { EditorViewType } from '@/constants/editorViewType'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { type FC, useCallback, useMemo, useSyncExternalStore } from 'react'
import { useTranslation } from '@/i18n'
import { getCapricornEditor, subscribeCapricornEditors } from '../../capricornEditorRegistry'
import type { CapricornBlockType, CapricornMarkType } from '../../capricornRuntimeAdapter'
import {
  BoldIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  LinkIcon,
  ItalicIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  QuoteIcon,
  Redo2Icon,
  Undo2Icon,
} from 'lucide-react'
import {
  ToolbarSection,
  usePriorityHidden,
  ToolbarWrapper,
  ToolbarDivider,
} from '@markflowy/interface'
import {
  getOverflowToolbarActions,
  MenuList,
  ToolbarActionButton,
  toOverflowMenuItems,
  type ToolbarAction,
} from '../components'
import { AIButton } from './components/AIButton'

interface WysiwygToolbarProps {
  editorId?: string
}

const TOOLBAR_GROUPS = [
  { id: 'history', priority: 90 },
  { id: 'headings', priority: 60 },
  { id: 'formatting', priority: 50 },
  { id: 'insert', priority: 40 },
  { id: 'blocks', priority: 30 },
]

const TOOLBAR_SECTIONS = [{ id: 'common', priority: 100 }, ...TOOLBAR_GROUPS]

export const WysiwygToolbar: FC<WysiwygToolbarProps> = (props) => {
  const { editorId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const { getEditorViewType } = useEditorViewTypeStore()
  const { t } = useTranslation()
  const targetEditorId = editorId ?? activeId
  const imageLabel = t('toolbar.image') || 'Image'

  const viewType = targetEditorId ? getEditorViewType(targetEditorId) : EditorViewType.WYSIWYG
  const getEditorSnapshot = useCallback(
    () => (targetEditorId ? getCapricornEditor(targetEditorId) : undefined),
    [targetEditorId],
  )
  const editor = useSyncExternalStore(
    subscribeCapricornEditors,
    getEditorSnapshot,
    getEditorSnapshot,
  )
  const getUiStateSnapshot = useCallback(() => editor?.getUiState() ?? null, [editor])
  const subscribeUiState = useCallback(
    (listener: () => void) => editor?.subscribeUiState(listener) ?? (() => undefined),
    [editor],
  )
  const uiState = useSyncExternalStore(subscribeUiState, getUiStateSnapshot, getUiStateSnapshot)

  const { containerRef, hiddenIds, registerItemWidth } = usePriorityHidden({
    items: TOOLBAR_SECTIONS,
    gap: 0,
  })

  const runEditorCommand = useCallback(
    (command: () => void) => {
      command()
      editor?.focus()
    },
    [editor],
  )

  const runListCommand = useCallback(
    (kind: 'bullet' | 'ordered' | 'task') => {
      if (!editor) return
      runEditorCommand(() => editor.commands.toggleList(kind))
    },
    [editor, runEditorCommand],
  )

  const setBlockType = useCallback(
    (blockType: CapricornBlockType) => {
      if (!editor) return
      runEditorCommand(() => editor.commands.setBlockType(blockType))
    },
    [editor, runEditorCommand],
  )

  const toggleMark = useCallback(
    (mark: CapricornMarkType) => {
      if (!editor) return
      runEditorCommand(() => editor.commands.toggleMark(mark))
    },
    [editor, runEditorCommand],
  )

  const handleInsertImage = useCallback(() => {
    if (editor?.selection) {
      editor.requestInlineEdit?.('image')
      return
    }
    void editor?.requestImageInsert().finally(() => editor.focus())
  }, [editor])

  const actions = useMemo<ToolbarAction[]>(
    () => [
      {
        id: 'undo',
        group: 'history',
        priority: 90,
        label: t('toolbar.undo') || 'Undo',
        icon: Undo2Icon,
        disabled: !uiState?.canUndo,
        run: () => editor && runEditorCommand(editor.commands.undo),
      },
      {
        id: 'redo',
        group: 'history',
        priority: 90,
        label: t('toolbar.redo') || 'Redo',
        icon: Redo2Icon,
        disabled: !uiState?.canRedo,
        run: () => editor && runEditorCommand(editor.commands.redo),
      },
      {
        id: 'heading-1',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h1') || 'Heading 1',
        icon: Heading1Icon,
        pressed: uiState?.currentBlockType === 'heading-1',
        run: () => setBlockType('heading-1'),
      },
      {
        id: 'heading-2',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h2') || 'Heading 2',
        icon: Heading2Icon,
        pressed: uiState?.currentBlockType === 'heading-2',
        run: () => setBlockType('heading-2'),
      },
      {
        id: 'heading-3',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h3') || 'Heading 3',
        icon: Heading3Icon,
        pressed: uiState?.currentBlockType === 'heading-3',
        run: () => setBlockType('heading-3'),
      },
      {
        id: 'bold',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.bold') || 'Bold',
        icon: BoldIcon,
        pressed: uiState?.markStates.bold === 'active',
        run: () => toggleMark('bold'),
      },
      {
        id: 'italic',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.italic') || 'Italic',
        icon: ItalicIcon,
        pressed: uiState?.markStates.italic === 'active',
        run: () => toggleMark('italic'),
      },
      {
        id: 'inline-code',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.code') || 'Inline Code',
        icon: Code2Icon,
        pressed: uiState?.markStates.code === 'active',
        run: () => toggleMark('code'),
      },
      {
        id: 'link',
        group: 'insert',
        priority: 40,
        label: t('inline_insert.insert_link'),
        icon: LinkIcon,
        pressed: Boolean(uiState?.link),
        disabled: !editor?.selection || !editor.commands.insertLink || uiState?.readOnly,
        run: () => {
          editor?.requestInlineEdit?.('link')
        },
      },
      {
        id: 'image',
        group: 'insert',
        priority: 40,
        label: imageLabel,
        icon: ImageIcon,
        disabled: !editor || uiState?.readOnly,
        run: handleInsertImage,
      },
      {
        id: 'blockquote',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.quote') || 'Blockquote',
        icon: QuoteIcon,
        pressed: uiState?.currentBlockType === 'blockquote',
        run: () => editor && runEditorCommand(editor.commands.toggleBlockquote),
      },
      {
        id: 'bullet-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.bulletList') || 'Bullet List',
        icon: ListIcon,
        pressed: uiState?.listType === 'bullet',
        run: () => runListCommand('bullet'),
      },
      {
        id: 'ordered-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.orderedList') || 'Ordered List',
        icon: ListOrderedIcon,
        pressed: uiState?.listType === 'ordered',
        run: () => runListCommand('ordered'),
      },
      {
        id: 'task-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.taskList') || 'Task List',
        icon: ListTodoIcon,
        pressed: uiState?.listType === 'task',
        run: () => runListCommand('task'),
      },
    ],
    [
      editor,
      handleInsertImage,
      imageLabel,
      runEditorCommand,
      runListCommand,
      setBlockType,
      t,
      toggleMark,
      uiState,
    ],
  )

  const overflowMenuItems = useMemo(
    () => toOverflowMenuItems(getOverflowToolbarActions(actions, hiddenIds)),
    [actions, hiddenIds],
  )

  if (!editor || viewType !== EditorViewType.WYSIWYG) {
    return null
  }

  return (
    <ToolbarWrapper className='mf-editor-toolbar' ref={containerRef}>
      <ToolbarSection id='common' registerWidth={registerItemWidth} hidden={false}>
        <MenuList editorId={targetEditorId} prependItems={overflowMenuItems} showTypewriterScroll />
        <AIButton editorId={targetEditorId} />
      </ToolbarSection>

      {TOOLBAR_GROUPS.map((group) => (
        <ToolbarSection
          hidden={hiddenIds.has(group.id)}
          id={group.id}
          key={group.id}
          registerWidth={registerItemWidth}
        >
          <ToolbarDivider />
          {actions
            .filter((action) => action.group === group.id)
            .map((action) => (
              <ToolbarActionButton action={action} key={action.id} />
            ))}
        </ToolbarSection>
      ))}
    </ToolbarWrapper>
  )
}
