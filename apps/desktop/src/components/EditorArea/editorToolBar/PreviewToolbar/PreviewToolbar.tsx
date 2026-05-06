import { useEditorStore } from '@/stores'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { FC, useMemo } from 'react'
import { EditorViewType } from 'rme'
import {
  ToolbarSection,
  usePriorityHidden,
  ToolbarWrapper,
} from '@markflowy/interface'
import { MenuList } from '../components/MenuList'
import { ViewSwitcher } from '../WysiwygToolbar/components/ViewSwitcher'

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
        <MenuList />
        <ViewSwitcher />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}
