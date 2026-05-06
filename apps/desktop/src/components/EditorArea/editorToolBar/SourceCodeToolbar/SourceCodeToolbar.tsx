import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorViewType } from 'rme'
import {
  ToolbarSection,
  usePriorityHidden,
  ToolbarWrapper,
  ToolbarDivider,
  CodeCommandButton,
  ClipboardReadFunction,
} from '@markflowy/interface'
import { MenuList } from '../components/MenuList'
import { AIButton } from '../WysiwygToolbar/components/AIButton'
import { sourceCodeCodemirrorViewMap } from '../../TextEditor'
import { clipboardRead } from '@/helper/clipboard'

export const SourceCodeToolbar: FC = () => {
  const { activeId } = useEditorStore()
  const { getEditorViewType } = useEditorViewTypeStore()
  const { t } = useTranslation()

  const viewType = activeId ? getEditorViewType(activeId) : EditorViewType.WYSIWYG

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
    if (!activeId) return undefined
    return sourceCodeCodemirrorViewMap.get(activeId)?.cm
  }

  const clipboardReadFn: ClipboardReadFunction = async () => {
    return clipboardRead()
  }

  if (viewType !== EditorViewType.SOURCECODE) {
    return null
  }

  return (
    <ToolbarWrapper ref={containerRef}>
      <ToolbarSection id="common" registerWidth={registerItemWidth} hidden={hiddenIds.has('common')}>
        <MenuList size='small' />
        <AIButton />
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
        <CodeCommandButton
          commandName='insertImage'
          icon='ri-image-line'
          label={t('toolbar.image') || 'Image'}
          getEditorView={getEditorView}
          clipboardRead={clipboardReadFn}
        />
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
