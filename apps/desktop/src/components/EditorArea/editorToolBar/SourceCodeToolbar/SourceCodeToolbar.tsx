import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { FC, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { EditorViewType } from 'rme'
import styled from 'styled-components'
import { ToolbarSection, usePriorityHidden } from '../responsive'
import { AIButton } from '../WysiwygToolbar/components/AIButton'
import { FileInfo } from '../WysiwygToolbar/components/FileInfo'
import { GitStatus } from '../WysiwygToolbar/components/GitStatus'
import { MoreActions } from '../WysiwygToolbar/components/MoreActions'
import { ViewSwitcher } from '../WysiwygToolbar/components/ViewSwitcher'
import { CodeCommandButton } from './CodeCommandButton'

const ToolbarWrapper = styled.div`
  background-color: ${({ theme }) => theme.bgColor};
  width: 100%;
  padding: 4px 8px;
  border-bottom: 1px solid ${({ theme }) => theme.borderColor};
  display: flex;
  align-items: center;
  gap: 0;
  z-index: 10;
  flex-wrap: nowrap;
  overflow: hidden;
`

const Divider = styled.div`
  width: 1px;
  height: 20px;
  background-color: ${({ theme }) => theme.borderColor};
  margin: 0 4px;
  flex-shrink: 0;
`

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

  if (viewType !== EditorViewType.SOURCECODE) {
    return null
  }

  return (
    <ToolbarWrapper ref={containerRef}>
      <ToolbarSection id="common" registerWidth={registerItemWidth} hidden={hiddenIds.has('common')}>
        <AIButton />
        <ViewSwitcher />
        <FileInfo />
        <GitStatus />
        <MoreActions />
      </ToolbarSection>

      <ToolbarSection id="history" registerWidth={registerItemWidth} hidden={hiddenIds.has('history')}>
        <Divider />
        <CodeCommandButton
          commandName='undo'
          icon='ri-arrow-go-back-line'
          label={t('toolbar.undo') || 'Undo'}
        />
        <CodeCommandButton
          commandName='redo'
          icon='ri-arrow-go-forward-line'
          label={t('toolbar.redo') || 'Redo'}
        />
      </ToolbarSection>

      <ToolbarSection id="headings" registerWidth={registerItemWidth} hidden={hiddenIds.has('headings')}>
        <Divider />
        <CodeCommandButton
          commandName='toggleHeading'
          attrs={{ level: 1 }}
          icon='ri-h-1'
          label={t('toolbar.h1') || 'Heading 1'}
        />
        <CodeCommandButton
          commandName='toggleHeading'
          attrs={{ level: 2 }}
          icon='ri-h-2'
          label={t('toolbar.h2') || 'Heading 2'}
        />
        <CodeCommandButton
          commandName='toggleHeading'
          attrs={{ level: 3 }}
          icon='ri-h-3'
          label={t('toolbar.h3') || 'Heading 3'}
        />
      </ToolbarSection>

      <ToolbarSection id="formatting" registerWidth={registerItemWidth} hidden={hiddenIds.has('formatting')}>
        <Divider />
        <CodeCommandButton
          commandName='toggleStrong'
          icon='ri-bold'
          label={t('toolbar.bold') || 'Bold'}
        />
        <CodeCommandButton
          commandName='toggleEmphasis'
          icon='ri-italic'
          label={t('toolbar.italic') || 'Italic'}
        />
        <CodeCommandButton
          commandName='toggleCodeText'
          icon='ri-code-line'
          label={t('toolbar.code') || 'Inline Code'}
        />
        <CodeCommandButton
          commandName='toggleDelete'
          icon='ri-strikethrough'
          label={t('toolbar.strike') || 'Strikethrough'}
        />
      </ToolbarSection>
      
      <ToolbarSection id="insert" registerWidth={registerItemWidth} hidden={hiddenIds.has('insert')}>
        <Divider />
        <CodeCommandButton
          commandName='insertLink'
          icon='ri-link'
          label={t('toolbar.link') || 'Link'}
        />
        <CodeCommandButton
          commandName='insertImage'
          icon='ri-image-line'
          label={t('toolbar.image') || 'Image'}
        />
      </ToolbarSection>

      <ToolbarSection id="blocks" registerWidth={registerItemWidth} hidden={hiddenIds.has('blocks')}>
        <Divider />
        <CodeCommandButton
          commandName='toggleBlockquote'
          icon='ri-double-quotes-l'
          label={t('toolbar.quote') || 'Blockquote'}
        />
        <CodeCommandButton
          commandName='toggleBulletList'
          icon='ri-list-unordered'
          label={t('toolbar.bulletList') || 'Bullet List'}
        />
        <CodeCommandButton
          commandName='toggleOrderedList'
          icon='ri-list-ordered'
          label={t('toolbar.orderedList') || 'Ordered List'}
        />
        <CodeCommandButton
          commandName='toggleTaskList'
          icon='ri-checkbox-line'
          label={t('toolbar.taskList') || 'Task List'}
        />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}
