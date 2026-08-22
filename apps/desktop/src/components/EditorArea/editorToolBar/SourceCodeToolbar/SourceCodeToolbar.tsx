import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { type FC, useCallback, useMemo } from 'react'
import { useTranslation } from '@/i18n'
import { EditorViewType } from 'rme'
import {
  BoldIcon,
  Code2Icon,
  Heading1Icon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  ListTodoIcon,
  QuoteIcon,
  Redo2Icon,
  StrikethroughIcon,
  Undo2Icon,
} from 'lucide-react'
import {
  ToolbarSection,
  usePriorityHidden,
  ToolbarWrapper,
  ToolbarDivider,
  createCommandMap,
  type ClipboardReadFunction,
} from '@markflowy/interface'
import {
  getOverflowToolbarActions,
  MenuList,
  ToolbarActionButton,
  toOverflowMenuItems,
  type ToolbarAction,
} from '../components'
import { AIButton } from '../WysiwygToolbar/components/AIButton'
import { sourceCodeCodemirrorViewMap } from '../../TextEditor'
import { clipboardRead } from '@/helper/clipboard'
import { requestImageInsert } from '../../requestImageInsert'

interface SourceCodeToolbarProps {
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

const readClipboard: ClipboardReadFunction = () => clipboardRead()
const sourceCommandMap = createCommandMap(readClipboard)

export const SourceCodeToolbar: FC<SourceCodeToolbarProps> = (props) => {
  const { editorId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const { getEditorViewType } = useEditorViewTypeStore()
  const { t } = useTranslation()
  const targetEditorId = editorId ?? activeId
  const imageLabel = t('toolbar.image') || 'Image'

  const viewType = targetEditorId ? getEditorViewType(targetEditorId) : EditorViewType.WYSIWYG

  const { containerRef, hiddenIds, registerItemWidth } = usePriorityHidden({
    items: TOOLBAR_SECTIONS,
    gap: 0,
  })

  const getEditorView = useCallback(() => {
    if (!targetEditorId) return undefined
    return sourceCodeCodemirrorViewMap.get(targetEditorId)?.cm
  }, [targetEditorId])

  const runSourceCommand = useCallback(
    (commandName: string, attrs?: Record<string, unknown>) => {
      const view = getEditorView()
      if (!view) return
      const command = sourceCommandMap[commandName]
      if (!command) return

      command(view, attrs)
      view.focus()
    },
    [getEditorView],
  )

  const handleInsertImage = useCallback(async () => {
    const view = getEditorView()
    if (!view) return

    const attributes = await requestImageInsert(targetEditorId)
    if (!attributes) {
      view.focus()
      return
    }

    const { from, to } = view.state.selection.main
    const selectedText = view.state.sliceDoc(from, to)
    const alt = (selectedText || attributes.alt || '').replace(/([\\\]])/g, '\\$1')
    const src = /\s/.test(attributes.src)
      ? `<${attributes.src.replace(/>/g, '%3E')}>`
      : attributes.src.replace(/([()])/g, '\\$1')
    const title = attributes.title
      ? ` "${attributes.title.replace(/([\\"])/g, '\\$1')}"`
      : ''

    view.dispatch(view.state.replaceSelection(`![${alt}](${src}${title})`))
    view.focus()
  }, [getEditorView, targetEditorId])

  const actions = useMemo<ToolbarAction[]>(
    () => [
      {
        id: 'undo',
        group: 'history',
        priority: 90,
        label: t('toolbar.undo') || 'Undo',
        icon: Undo2Icon,
        run: () => runSourceCommand('undo'),
      },
      {
        id: 'redo',
        group: 'history',
        priority: 90,
        label: t('toolbar.redo') || 'Redo',
        icon: Redo2Icon,
        run: () => runSourceCommand('redo'),
      },
      {
        id: 'heading-1',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h1') || 'Heading 1',
        icon: Heading1Icon,
        run: () => runSourceCommand('toggleHeading', { level: 1 }),
      },
      {
        id: 'heading-2',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h2') || 'Heading 2',
        icon: Heading2Icon,
        run: () => runSourceCommand('toggleHeading', { level: 2 }),
      },
      {
        id: 'heading-3',
        group: 'headings',
        priority: 60,
        label: t('toolbar.h3') || 'Heading 3',
        icon: Heading3Icon,
        run: () => runSourceCommand('toggleHeading', { level: 3 }),
      },
      {
        id: 'bold',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.bold') || 'Bold',
        icon: BoldIcon,
        run: () => runSourceCommand('toggleStrong'),
      },
      {
        id: 'italic',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.italic') || 'Italic',
        icon: ItalicIcon,
        run: () => runSourceCommand('toggleEmphasis'),
      },
      {
        id: 'inline-code',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.code') || 'Inline Code',
        icon: Code2Icon,
        run: () => runSourceCommand('toggleCodeText'),
      },
      {
        id: 'strikethrough',
        group: 'formatting',
        priority: 50,
        label: t('toolbar.strike') || 'Strikethrough',
        icon: StrikethroughIcon,
        run: () => runSourceCommand('toggleDelete'),
      },
      {
        id: 'link',
        group: 'insert',
        priority: 40,
        label: t('toolbar.link') || 'Link',
        icon: LinkIcon,
        run: () => runSourceCommand('insertLink'),
      },
      {
        id: 'image',
        group: 'insert',
        priority: 40,
        label: imageLabel,
        icon: ImageIcon,
        run: () => void handleInsertImage(),
      },
      {
        id: 'blockquote',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.quote') || 'Blockquote',
        icon: QuoteIcon,
        run: () => runSourceCommand('toggleBlockquote'),
      },
      {
        id: 'bullet-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.bulletList') || 'Bullet List',
        icon: ListIcon,
        run: () => runSourceCommand('toggleBulletList'),
      },
      {
        id: 'ordered-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.orderedList') || 'Ordered List',
        icon: ListOrderedIcon,
        run: () => runSourceCommand('toggleOrderedList'),
      },
      {
        id: 'task-list',
        group: 'blocks',
        priority: 30,
        label: t('toolbar.taskList') || 'Task List',
        icon: ListTodoIcon,
        run: () => runSourceCommand('toggleTaskList'),
      },
    ],
    [handleInsertImage, imageLabel, runSourceCommand, t],
  )

  const overflowMenuItems = useMemo(
    () => toOverflowMenuItems(getOverflowToolbarActions(actions, hiddenIds)),
    [actions, hiddenIds],
  )

  if (viewType !== EditorViewType.SOURCECODE) {
    return null
  }

  return (
    <ToolbarWrapper className='mf-editor-toolbar' ref={containerRef}>
      <ToolbarSection id='common' registerWidth={registerItemWidth} hidden={false}>
        <MenuList
          editorId={targetEditorId}
          prependItems={overflowMenuItems}
        />
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
