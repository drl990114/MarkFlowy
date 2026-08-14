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
  CommandButton,
} from '@markflowy/interface'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { MenuList } from '../components/MenuList'
import { AIButton } from './components/AIButton'

interface WysiwygToolbarProps {
  editorId?: string
}

export const WysiwygToolbar: FC<WysiwygToolbarProps> = (props) => {
  const { editorId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const { getEditorViewType } = useEditorViewTypeStore()
  const { t } = useTranslation()
  const targetEditorId = editorId ?? activeId
  const imageLabel = t('toolbar.image') || 'Image'

  const editorCtx = useEditorStore((state) => state.editorCtxMap.get(targetEditorId ?? ''))
  const viewType = targetEditorId ? getEditorViewType(targetEditorId) : EditorViewType.WYSIWYG

  const sections = useMemo(
    () => [
      { id: 'common', priority: 100 },
      { id: 'history', priority: 90 },
      { id: 'headings', priority: 60 },
      { id: 'formatting', priority: 50 },
      { id: 'insert', priority: 40 },
      { id: 'blocks', priority: 30 },
    ],
    [],
  )

  const { containerRef, hiddenIds, registerItemWidth } = usePriorityHidden({
    items: sections,
    gap: 0,
  })

  if (!editorCtx || viewType !== EditorViewType.WYSIWYG) {
    return null
  }

  const handleInsertImage = () => {
    const commands = editorCtx.commands as typeof editorCtx.commands & {
      requestImageInsert?: () => boolean
    }
    commands.requestImageInsert?.()
  }

  return (
    <ToolbarWrapper className='mf-editor-toolbar' ref={containerRef}>
      <ToolbarSection
        id='common'
        registerWidth={registerItemWidth}
        hidden={hiddenIds.has('common')}
      >
        <MenuList editorId={targetEditorId} showTypewriterScroll />
        <AIButton editorId={targetEditorId} />
      </ToolbarSection>

      <ToolbarSection
        id='history'
        registerWidth={registerItemWidth}
        hidden={hiddenIds.has('history')}
      >
        <ToolbarDivider />
        <CommandButton
          editorCtx={editorCtx}
          commandName='undo'
          icon='ri-arrow-go-back-line'
          label={t('toolbar.undo') || 'Undo'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='redo'
          icon='ri-arrow-go-forward-line'
          label={t('toolbar.redo') || 'Redo'}
        />
      </ToolbarSection>

      <ToolbarSection
        id='headings'
        registerWidth={registerItemWidth}
        hidden={hiddenIds.has('headings')}
      >
        <ToolbarDivider />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleHeading'
          attrs={{ level: 1 }}
          icon='ri-h-1'
          label={t('toolbar.h1') || 'Heading 1'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleHeading'
          attrs={{ level: 2 }}
          icon='ri-h-2'
          label={t('toolbar.h2') || 'Heading 2'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleHeading'
          attrs={{ level: 3 }}
          icon='ri-h-3'
          label={t('toolbar.h3') || 'Heading 3'}
        />
      </ToolbarSection>

      <ToolbarSection
        id='formatting'
        registerWidth={registerItemWidth}
        hidden={hiddenIds.has('formatting')}
      >
        <ToolbarDivider />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleStrong'
          icon='ri-bold'
          label={t('toolbar.bold') || 'Bold'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleEmphasis'
          icon='ri-italic'
          label={t('toolbar.italic') || 'Italic'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleCodeText'
          icon='ri-code-line'
          label={t('toolbar.code') || 'Inline Code'}
        />
      </ToolbarSection>

      <ToolbarSection
        id='insert'
        registerWidth={registerItemWidth}
        hidden={hiddenIds.has('insert')}
      >
        <ToolbarDivider />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={imageLabel}
              className='size-6 rounded-sm'
              onClick={handleInsertImage}
              size='icon-sm'
              variant='ghost'
            >
              <i className='ri-image-line' aria-hidden='true' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{imageLabel}</TooltipContent>
        </Tooltip>
      </ToolbarSection>

      <ToolbarSection
        id='blocks'
        registerWidth={registerItemWidth}
        hidden={hiddenIds.has('blocks')}
      >
        <ToolbarDivider />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleBlockquote'
          icon='ri-double-quotes-l'
          label={t('toolbar.quote') || 'Blockquote'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleList'
          attrs={{ kind: 'bullet' }}
          icon='ri-list-unordered'
          label={t('toolbar.bulletList') || 'Bullet List'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleList'
          attrs={{ kind: 'ordered' }}
          icon='ri-list-ordered'
          label={t('toolbar.orderedList') || 'Ordered List'}
        />
        <CommandButton
          editorCtx={editorCtx}
          commandName='toggleList'
          attrs={{ kind: 'task' }}
          icon='ri-checkbox-line'
          label={t('toolbar.taskList') || 'Task List'}
        />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}
