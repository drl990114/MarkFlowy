import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { type FC, useMemo } from 'react'
import { useTranslation } from '@/i18n'
import { EditorViewType } from 'rme'
import {
  ToolbarSection,
  usePriorityHidden,
  ToolbarWrapper,
  ToolbarDivider,
  CodeCommandButton,
  type ClipboardReadFunction,
} from '@markflowy/interface'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MenuList } from '../components/MenuList'
import { AIButton } from '../WysiwygToolbar/components/AIButton'
import { sourceCodeCodemirrorViewMap } from '../../TextEditor'
import { clipboardRead } from '@/helper/clipboard'
import { requestImageInsert } from '../../requestImageInsert'

interface SourceCodeToolbarProps {
  editorId?: string
}

export const SourceCodeToolbar: FC<SourceCodeToolbarProps> = (props) => {
  const { editorId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const { getEditorViewType } = useEditorViewTypeStore()
  const { t } = useTranslation()
  const targetEditorId = editorId ?? activeId
  const imageLabel = t('toolbar.image') || 'Image'

  const viewType = targetEditorId ? getEditorViewType(targetEditorId) : EditorViewType.WYSIWYG

  const sections = useMemo(() => [
    { id: 'common', priority: 100 },
    { id: 'history', priority: 90 },
    { id: 'headings', priority: 60 },
    { id: 'formatting', priority: 50 },
    { id: 'insert', priority: 40 },
    { id: 'blocks', priority: 30 },
  ], [])

  const { containerRef, hiddenIds, registerItemWidth } = usePriorityHidden({ items: sections, gap: 0 })

  const getEditorView = () => {
    if (!targetEditorId) return undefined
    return sourceCodeCodemirrorViewMap.get(targetEditorId)?.cm
  }

  const clipboardReadFn: ClipboardReadFunction = async () => {
    return clipboardRead()
  }

  const handleInsertImage = async () => {
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
  }

  if (viewType !== EditorViewType.SOURCECODE) {
    return null
  }

  return (
    <ToolbarWrapper className='mf-editor-toolbar' ref={containerRef}>
      <ToolbarSection id="common" registerWidth={registerItemWidth} hidden={hiddenIds.has('common')}>
        <MenuList editorId={targetEditorId} size='small' />
        <AIButton editorId={targetEditorId} />
      </ToolbarSection>

      <ToolbarSection id="history" registerWidth={registerItemWidth} hidden={hiddenIds.has('history')}>
        <ToolbarDivider />
        <CodeCommandButton
          commandName='undo'
          icon='ri-arrow-go-back-line'
          label={t('toolbar.undo') || 'Undo'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='redo'
          icon='ri-arrow-go-forward-line'
          label={t('toolbar.redo') || 'Redo'}
          getEditorView={getEditorView}
        />
      </ToolbarSection>

      <ToolbarSection id="headings" registerWidth={registerItemWidth} hidden={hiddenIds.has('headings')}>
        <ToolbarDivider />
        <CodeCommandButton
          commandName='toggleHeading'
          attrs={{ level: 1 }}
          icon='ri-h-1'
          label={t('toolbar.h1') || 'Heading 1'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleHeading'
          attrs={{ level: 2 }}
          icon='ri-h-2'
          label={t('toolbar.h2') || 'Heading 2'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleHeading'
          attrs={{ level: 3 }}
          icon='ri-h-3'
          label={t('toolbar.h3') || 'Heading 3'}
          getEditorView={getEditorView}
        />
      </ToolbarSection>

      <ToolbarSection id="formatting" registerWidth={registerItemWidth} hidden={hiddenIds.has('formatting')}>
        <ToolbarDivider />
        <CodeCommandButton
          commandName='toggleStrong'
          icon='ri-bold'
          label={t('toolbar.bold') || 'Bold'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleEmphasis'
          icon='ri-italic'
          label={t('toolbar.italic') || 'Italic'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleCodeText'
          icon='ri-code-line'
          label={t('toolbar.code') || 'Inline Code'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleDelete'
          icon='ri-strikethrough'
          label={t('toolbar.strike') || 'Strikethrough'}
          getEditorView={getEditorView}
        />
      </ToolbarSection>

      <ToolbarSection id="insert" registerWidth={registerItemWidth} hidden={hiddenIds.has('insert')}>
        <ToolbarDivider />
        <CodeCommandButton
          commandName='insertLink'
          icon='ri-link'
          label={t('toolbar.link') || 'Link'}
          getEditorView={getEditorView}
          clipboardRead={clipboardReadFn}
        />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={imageLabel}
              className='size-6 rounded-sm'
              onClick={() => void handleInsertImage()}
              size='icon-sm'
              variant='ghost'
            >
              <i className='ri-image-line' aria-hidden='true' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{imageLabel}</TooltipContent>
        </Tooltip>
      </ToolbarSection>

      <ToolbarSection id="blocks" registerWidth={registerItemWidth} hidden={hiddenIds.has('blocks')}>
        <ToolbarDivider />
        <CodeCommandButton
          commandName='toggleBlockquote'
          icon='ri-double-quotes-l'
          label={t('toolbar.quote') || 'Blockquote'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleBulletList'
          icon='ri-list-unordered'
          label={t('toolbar.bulletList') || 'Bullet List'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleOrderedList'
          icon='ri-list-ordered'
          label={t('toolbar.orderedList') || 'Ordered List'}
          getEditorView={getEditorView}
        />
        <CodeCommandButton
          commandName='toggleTaskList'
          icon='ri-checkbox-line'
          label={t('toolbar.taskList') || 'Task List'}
          getEditorView={getEditorView}
        />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}
