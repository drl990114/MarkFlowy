import { MfIconButton, ToolbarDivider, ToolbarWrapper } from '@markflowy/interface'
import type { ViewType } from 'hooks/useWorkspaceState'
import rem from 'utils/rem'
import styled from 'styled-components'

function MenuList({ viewType, onViewTypeChange }: { viewType: ViewType; onViewTypeChange: (type: ViewType) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: rem(4) }}>
      <MfIconButton
        icon='ri-eye-line'
        onClick={() => onViewTypeChange('wysiwyg')}
        tooltipProps={{ title: 'WYSIWYG' }}
        size='small'
        rounded='smooth'
        className={viewType === 'wysiwyg' ? 'active' : ''}
      />
      <MfIconButton
        icon='ri-code-line'
        onClick={() => onViewTypeChange('source')}
        tooltipProps={{ title: 'Source' }}
        size='small'
        rounded='smooth'
        className={viewType === 'source' ? 'active' : ''}
      />
      <MfIconButton
        icon='ri-file-list-line'
        onClick={() => onViewTypeChange('preview')}
        tooltipProps={{ title: 'Preview' }}
        size='small'
        rounded='smooth'
        className={viewType === 'preview' ? 'active' : ''}
      />
    </div>
  )
}

export function EditorToolbar({ viewType, onViewTypeChange }: { viewType: ViewType; onViewTypeChange: (type: ViewType) => void }) {
  return (
    <ToolbarWrapper>
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
      <ToolbarDivider />
      <ToolbarSection>
        <MenuList viewType={viewType} onViewTypeChange={onViewTypeChange} />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}

const ToolbarSection = styled.div`
  display: flex;
  align-items: center;
  gap: ${rem(2)};
`
