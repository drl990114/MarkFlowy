import { useEditorStore } from '@/stores'
import { EditorViewType } from '@/constants/editorViewType'
import useEditorViewTypeStore from '@/stores/useEditorViewTypeStore'
import { type FC, useMemo } from 'react'
import { ToolbarSection, usePriorityHidden, ToolbarWrapper } from '@markflowy/interface'
import { MenuList } from '../components/MenuList'
import { ViewSwitcher } from '../WysiwygToolbar/components/ViewSwitcher'

interface PreviewToolbarProps {
  editorId?: string
}

export const PreviewToolbar: FC<PreviewToolbarProps> = (props) => {
  const { editorId } = props
  const activeId = useEditorStore((state) => state.activeId)
  const { getEditorViewType } = useEditorViewTypeStore()
  const targetEditorId = editorId ?? activeId

  const viewType = targetEditorId ? getEditorViewType(targetEditorId) : EditorViewType.WYSIWYG

  const sections = useMemo(() => [{ id: 'common', priority: 100 }], [])

  const { containerRef, hiddenIds, registerItemWidth } = usePriorityHidden({
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
        hidden={hiddenIds.has('common')}
      >
        <MenuList editorId={targetEditorId} />
        <ViewSwitcher editorId={targetEditorId} />
      </ToolbarSection>
    </ToolbarWrapper>
  )
}
