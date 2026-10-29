import { useEditorStore } from '@/stores'
import { EditorViewType } from '@/constants/editorViewType'
import useEditorViewTypeStore, { selectEditorViewType } from '@/stores/useEditorViewTypeStore'
import { type FC, useMemo } from 'react'
import { ToolbarSection, usePriorityHidden, ToolbarWrapper } from '@markflowy/interface'
import { MenuList } from '../components/MenuList'
import { ViewSwitcher } from '../WysiwygToolbar/components/ViewSwitcher'

interface PreviewToolbarProps {
  editorId?: string
  groupId?: string
}

export const PreviewToolbar: FC<PreviewToolbarProps> = (props) => {
  const { editorId, groupId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const targetEditorId = editorId ?? activeId

  const viewType = useEditorViewTypeStore((state) =>
    selectEditorViewType(state, targetEditorId ?? '', groupId) ?? EditorViewType.WYSIWYG,
  )

  const sections = useMemo(() => [{ id: 'common', priority: 100 }], [])

  const { containerRef, registerItemWidth } = usePriorityHidden({
    items: sections,
    gap: 0,
  })

  if (viewType !== EditorViewType.PREVIEW) {
    return null
  }

  return (
    <ToolbarWrapper className='mf-editor-toolbar' ref={containerRef}>
      <ToolbarSection
        id='common'
        registerWidth={registerItemWidth}
        hidden={false}
      >
        <ViewSwitcher editorId={targetEditorId} groupId={groupId} />
        <MenuList editorId={targetEditorId} groupId={groupId} />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}
