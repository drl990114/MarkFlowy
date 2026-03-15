import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { FC, useMemo } from 'react'
import { EditorViewType } from 'rme'
import styled from 'styled-components'
import { ToolbarSection, usePriorityHidden } from '../responsive'
import { ViewSwitcher } from '../WysiwygToolbar/components/ViewSwitcher'

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
  box-sizing: border-box;
`

export const PreviewToolbar: FC = () => {
  const { activeId } = useEditorStore()
  const { getEditorViewType } = useEditorViewTypeStore()

  const viewType = activeId ? getEditorViewType(activeId) : EditorViewType.WYSIWYG

  const sections = useMemo(() => [
    { id: 'common', priority: 100 },
  ], [])

  const { containerRef, hiddenIds, registerItemWidth } = usePriorityHidden({ items: sections, gap: 0 })

  if (viewType !== EditorViewType.PREVIEW) {
    return null
  }

  return (
    <ToolbarWrapper ref={containerRef}>
      <ToolbarSection id="common" registerWidth={registerItemWidth} hidden={hiddenIds.has('common')}>
        <ViewSwitcher />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}
