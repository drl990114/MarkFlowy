import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { type FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/i18n'
import {
  EditorViewType,
  getActiveListKind,
  type EditorContext,
  type StandardListKind,
} from 'rme'
import {
  BoldIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
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

type ToolbarCommand = (attrs?: Record<string, unknown>) => unknown
type StandardListCommandName = 'toggleBulletList' | 'toggleOrderedList' | 'toggleTaskList'

const STANDARD_LIST_COMMAND_BY_KIND = {
  bullet: 'toggleBulletList',
  ordered: 'toggleOrderedList',
  task: 'toggleTaskList',
} as const satisfies Record<StandardListKind, StandardListCommandName>

function runStandardListCommand(editorCtx: EditorContext, kind: StandardListKind): boolean {
  const command = editorCtx.commands[STANDARD_LIST_COMMAND_BY_KIND[kind]]
  if (!command.enabled()) return false

  command()
  return true
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

  const editorCtx = useEditorStore((state) => state.editorCtxMap.get(targetEditorId ?? ''))
  const viewType = targetEditorId ? getEditorViewType(targetEditorId) : EditorViewType.WYSIWYG
  const [activeListKind, setActiveListKind] = useState<StandardListKind | null>(null)

  useEffect(() => {
    if (!editorCtx) {
      setActiveListKind(null)
      return
    }

    const syncActiveListKind = () => {
      setActiveListKind(getActiveListKind(editorCtx.view.state))
    }

    syncActiveListKind()
    return editorCtx.addHandler('updated', syncActiveListKind)
  }, [editorCtx])

  const { containerRef, hiddenIds, registerItemWidth } = usePriorityHidden({
    items: TOOLBAR_SECTIONS,
    gap: 0,
  })

  const runEditorCommand = useCallback(
    (commandName: string, attrs?: Record<string, unknown>) => {
      if (!editorCtx) return
      const commands = editorCtx.commands as unknown as Record<string, ToolbarCommand | undefined>
      const command = commands[commandName]
      if (!command) return

      if (attrs === undefined) command()
      else command(attrs)
      editorCtx.view.focus()
    },
    [editorCtx],
  )

  const runListCommand = useCallback(
    (kind: StandardListKind) => {
      if (!editorCtx) return
      if (runStandardListCommand(editorCtx, kind)) {
        editorCtx.view.focus()
      }
    },
    [editorCtx],
  )

  const handleInsertImage = useCallback(() => {
    if (!editorCtx) return
    const commands = editorCtx.commands as typeof editorCtx.commands & {
      requestImageInsert?: () => boolean
    }
    commands.requestImageInsert?.()
  }, [editorCtx])

  const actions = useMemo<ToolbarAction[]>(
    () => [
      {
        id: 'undo',
        group: 'history',
        priority: 90,
        label: t('toolbar.undo') || 'Undo',
        icon: Undo2Icon,
        run: () => runEditorCommand('undo'),
      },
      {
        id: 'redo',
        group: 'history',
        priority: 90,
        label: t('toolbar.redo') || 'Redo',
        icon: Redo2Icon,
        run: () => runEditorCommand('redo'),
      },
      {
        id: 'heading-1',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h1') || 'Heading 1',
        icon: Heading1Icon,
        run: () => runEditorCommand('toggleHeading', { level: 1 }),
      },
      {
        id: 'heading-2',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h2') || 'Heading 2',
        icon: Heading2Icon,
        run: () => runEditorCommand('toggleHeading', { level: 2 }),
      },
      {
        id: 'heading-3',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h3') || 'Heading 3',
        icon: Heading3Icon,
        run: () => runEditorCommand('toggleHeading', { level: 3 }),
      },
      {
        id: 'bold',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.bold') || 'Bold',
        icon: BoldIcon,
        run: () => runEditorCommand('toggleStrong'),
      },
      {
        id: 'italic',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.italic') || 'Italic',
        icon: ItalicIcon,
        run: () => runEditorCommand('toggleEmphasis'),
      },
      {
        id: 'inline-code',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.code') || 'Inline Code',
        icon: Code2Icon,
        run: () => runEditorCommand('toggleCodeText'),
      },
      {
        id: 'image',
        group: 'insert',
        priority: 40,
        label: imageLabel,
        icon: ImageIcon,
        run: handleInsertImage,
      },
      {
        id: 'blockquote',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.quote') || 'Blockquote',
        icon: QuoteIcon,
        run: () => runEditorCommand('toggleBlockquote'),
      },
      {
        id: 'bullet-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.bulletList') || 'Bullet List',
        icon: ListIcon,
        pressed: activeListKind === 'bullet',
        run: () => runListCommand('bullet'),
      },
      {
        id: 'ordered-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.orderedList') || 'Ordered List',
        icon: ListOrderedIcon,
        pressed: activeListKind === 'ordered',
        run: () => runListCommand('ordered'),
      },
      {
        id: 'task-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.taskList') || 'Task List',
        icon: ListTodoIcon,
        pressed: activeListKind === 'task',
        run: () => runListCommand('task'),
      },
    ],
    [activeListKind, handleInsertImage, imageLabel, runEditorCommand, runListCommand, t],
  )

  const overflowMenuItems = useMemo(
    () => toOverflowMenuItems(getOverflowToolbarActions(actions, hiddenIds)),
    [actions, hiddenIds],
  )

  if (!editorCtx || viewType !== EditorViewType.WYSIWYG) {
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
