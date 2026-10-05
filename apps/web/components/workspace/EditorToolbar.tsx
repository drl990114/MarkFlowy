import { MfIconButton, ToolbarDivider, ToolbarWrapper } from '@markflowy/interface'
import type { ViewType } from 'hooks/useWorkspaceState'
import rem from 'utils/rem'
import styled from 'styled-components'
import { useTranslation } from 'next-i18next'
import NavButton from '../Nav/NavButton'

function MenuList({
  viewType,
  onViewTypeChange,
}: {
  viewType: ViewType
  onViewTypeChange: (type: ViewType) => void
}) {
  const { t } = useTranslation()
  return (
    <ModeGroup aria-label={t('workspace.editor')}>
      {(
        [
          ['wysiwyg', 'workspace.editor'],
          ['source', 'workspace.source'],
          ['preview', 'workspace.previewMode'],
        ] as const
      ).map(([mode, label]) => (
        <ModeButton
          key={mode}
          type='button'
          aria-pressed={viewType === mode}
          onClick={() => onViewTypeChange(mode)}
        >
          {t(label)}
        </ModeButton>
      ))}
    </ModeGroup>
  )
}

export function EditorToolbar({
  viewType,
  onViewTypeChange,
}: {
  viewType: ViewType
  onViewTypeChange: (type: ViewType) => void
}) {
  return (
    <EditorToolbarWrapper>
      <MenuList viewType={viewType} onViewTypeChange={onViewTypeChange} />
      <ToolbarDivider />
      <ToolbarSection>
        <MfIconButton
          icon='ri-arrow-go-back-line'
          onClick={() => {}}
          tooltipProps={{ title: 'Undo' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-arrow-go-forward-line'
          onClick={() => {}}
          tooltipProps={{ title: 'Redo' }}
          size='small'
          rounded='smooth'
        />
      </ToolbarSection>
      <ToolbarDivider />
      <ToolbarSection>
        <MfIconButton
          icon='ri-h-1'
          onClick={() => {}}
          tooltipProps={{ title: 'Heading 1' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-h-2'
          onClick={() => {}}
          tooltipProps={{ title: 'Heading 2' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-h-3'
          onClick={() => {}}
          tooltipProps={{ title: 'Heading 3' }}
          size='small'
          rounded='smooth'
        />
      </ToolbarSection>
      <ToolbarDivider />
      <ToolbarSection>
        <MfIconButton
          icon='ri-bold'
          onClick={() => {}}
          tooltipProps={{ title: 'Bold' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-italic'
          onClick={() => {}}
          tooltipProps={{ title: 'Italic' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-strikethrough'
          onClick={() => {}}
          tooltipProps={{ title: 'Strikethrough' }}
          size='small'
          rounded='smooth'
        />
      </ToolbarSection>
      <ToolbarDivider />
      <ToolbarSection>
        <MfIconButton
          icon='ri-list-unordered'
          onClick={() => {}}
          tooltipProps={{ title: 'Bullet List' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-list-ordered'
          onClick={() => {}}
          tooltipProps={{ title: 'Numbered List' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-checkbox-line'
          onClick={() => {}}
          tooltipProps={{ title: 'Task List' }}
          size='small'
          rounded='smooth'
        />
      </ToolbarSection>
      <ToolbarDivider />
      <ToolbarSection>
        <MfIconButton
          icon='ri-link'
          onClick={() => {}}
          tooltipProps={{ title: 'Link' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-image-line'
          onClick={() => {}}
          tooltipProps={{ title: 'Image' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-code-line'
          onClick={() => {}}
          tooltipProps={{ title: 'Code' }}
          size='small'
          rounded='smooth'
        />
        <MfIconButton
          icon='ri-double-quotes-l'
          onClick={() => {}}
          tooltipProps={{ title: 'Quote' }}
          size='small'
          rounded='smooth'
        />
      </ToolbarSection>
    </EditorToolbarWrapper>
  )
}

const ToolbarSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(2)};
`

const EditorToolbarWrapper = styled(ToolbarWrapper)`
  min-height: 48px;
  flex-shrink: 0;
  padding: 6px 16px;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  border-bottom: 1px solid var(--line-soft);
  background: var(--paper);
  > * {
    flex-shrink: 0;
  }
`

const ModeGroup = styled.div`
  display: flex;
  gap: 2px;
  padding: 3px;
  border-radius: 8px;
  background: var(--paper-warm);
`

const ModeButton = styled(NavButton)`
  && {
    height: 28px;
    padding: 0 10px;
    border-radius: 5px;
    color: var(--ink-mute);
    font-size: 12px;
    font-weight: 500;
    transition:
      color 160ms ease,
      background-color 160ms ease;
  }
  &[aria-pressed='true'] {
    color: var(--seal);
    background: var(--paper);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--shadow-color) 12%, transparent);
  }
`
