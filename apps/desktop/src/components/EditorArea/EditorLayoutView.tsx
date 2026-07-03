import { useEditorStore } from '@/stores'
import type { EditorLayoutNode } from '@/stores/useEditorStore'
import { memo, type DragEvent, useCallback, useState } from 'react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import styled from 'styled-components'
import Editor from './Editor'
import EditorAreaTabs from './EditorAreaTabs'
import EditorGroupToolbar from './EditorGroupToolbar'
import { EmptyState } from './EmptyState'
import { hasEditorTabDragData, readEditorTabDragData } from './editorDragData'
import { EditorPanel } from './styles'

interface EditorLayoutViewProps {
  node: EditorLayoutNode
}

function EditorLayoutView(props: EditorLayoutViewProps) {
  const { node } = props

  if (node.type === 'leaf') {
    return <EditorGroupPane groupId={node.id} />
  }

  return <EditorBranch node={node} />
}

interface EditorBranchProps {
  node: Extract<EditorLayoutNode, { type: 'branch' }>
}

const EditorBranch = memo((props: EditorBranchProps) => {
  const { node } = props
  const setBranchSizes = useEditorStore((state) => state.setBranchSizes)

  const handleLayoutChanged = useCallback(
    (layout: Record<string, number>) => {
      const sizes = node.children.map((child) => layout[getPanelId(child)])
      if (sizes.every((size) => typeof size === 'number')) {
        setBranchSizes(node.id, sizes)
      }
    },
    [node.children, node.id, setBranchSizes],
  )

  return (
    <SplitGroup
      id={`editor-split-${node.id}`}
      orientation={node.direction}
      defaultLayout={Object.fromEntries(
        node.children.map((child, index) => [getPanelId(child), node.sizes[index] || 100]),
      )}
      onLayoutChanged={handleLayoutChanged}
    >
      {node.children.map((child, index) => (
        <PanelWithSeparator
          child={child}
          index={index}
          key={child.id}
          node={node}
        />
      ))}
    </SplitGroup>
  )
})

interface PanelWithSeparatorProps {
  child: EditorLayoutNode
  index: number
  node: Extract<EditorLayoutNode, { type: 'branch' }>
}

function PanelWithSeparator(props: PanelWithSeparatorProps) {
  const { child, index, node } = props
  const showSeparator = index < node.children.length - 1
  const defaultSize = node.sizes[index] || 100 / node.children.length

  return (
    <>
      <Panel
        id={getPanelId(child)}
        defaultSize={`${defaultSize}%`}
        minSize='180px'
        groupResizeBehavior='preserve-relative-size'
      >
        <EditorLayoutView node={child} />
      </Panel>
      {showSeparator ? <SplitSeparator $orientation={node.direction} /> : null}
    </>
  )
}

interface EditorGroupPaneProps {
  groupId: string
}

const EditorGroupPane = memo((props: EditorGroupPaneProps) => {
  const { groupId } = props
  const [isDropTarget, setIsDropTarget] = useState(false)
  const group = useEditorStore((state) => state.getGroup(groupId))
  const activeGroupId = useEditorStore((state) => state.activeGroupId)
  const isSplitMode = useEditorStore((state) => state.editorLayout.type === 'branch')
  const setActiveGroupId = useEditorStore((state) => state.setActiveGroupId)
  const moveFileToGroup = useEditorStore((state) => state.moveFileToGroup)

  const handleActivateGroup = useCallback(() => {
    setActiveGroupId(groupId)
  }, [groupId, setActiveGroupId])

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    if (!hasEditorTabDragData(e.dataTransfer)) return

    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDragEnter = useCallback((e: DragEvent<HTMLElement>) => {
    if (!hasEditorTabDragData(e.dataTransfer)) return

    e.preventDefault()
    setIsDropTarget(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLElement>) => {
    if (!hasEditorTabDragData(e.dataTransfer)) return

    const relatedTarget = e.relatedTarget
    if (relatedTarget instanceof Node && e.currentTarget.contains(relatedTarget)) return

    setIsDropTarget(false)
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      const dragData = readEditorTabDragData(e.dataTransfer)
      setIsDropTarget(false)
      if (!dragData) return

      e.preventDefault()
      e.stopPropagation()
      moveFileToGroup(dragData.sourceGroupId, groupId, dragData.fileId)
    },
    [groupId, moveFileToGroup],
  )

  if (!group) return null

  const activeFileId = group.activeId
  const isActiveGroup = activeGroupId === groupId

  return (
    <GroupPane
      $active={isActiveGroup}
      $dropTarget={isDropTarget}
      onDragEnterCapture={handleDragEnter}
      onDragLeaveCapture={handleDragLeave}
      onDragOverCapture={handleDragOver}
      onDropCapture={handleDrop}
      onFocusCapture={handleActivateGroup}
      onMouseDownCapture={handleActivateGroup}
    >
      <EditorAreaTabs compact={isSplitMode} groupId={groupId} />
      <EditorGroupToolbar editorId={activeFileId} />
      <EditorPanel id={`editor-panel-${groupId}`}>
        {group.opened.length === 0 ? (
          <GroupEmptyState>
            <EmptyState />
          </GroupEmptyState>
        ) : (
          group.opened.map((id) => (
            <Editor
              active={isActiveGroup && id === activeFileId}
              id={id}
              key={`${groupId}-${id}`}
              visible={id === activeFileId}
            />
          ))
        )}
      </EditorPanel>
    </GroupPane>
  )
})

function getPanelId(node: EditorLayoutNode) {
  return `editor-layout-panel-${node.id}`
}

const SplitGroup = styled(Group)`
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
`

const SplitSeparator = styled(Separator)<{ $orientation: 'horizontal' | 'vertical' }>`
  flex: 0 0 auto;
  background-color: ${(props) => props.theme.borderColor};
  transition: background-color 0.16s ease;

  ${(props) =>
    props.$orientation === 'horizontal'
      ? `
        width: 1px;
        cursor: col-resize !important;
      `
      : `
        height: 1px;
        cursor: row-resize !important;
      `}

  &:focus {
    outline: 1px solid ${(props) => props.theme.accentColor};
  }

  &[data-separator='hover'],
  &[data-separator='active'] {
    background-color: ${(props) => props.theme.accentColor};
  }
`

const GroupPane = styled.div<{ $active: boolean; $dropTarget: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  outline: ${(props) => (props.$dropTarget ? `1px solid ${props.theme.accentColor}` : 'none')};
  outline-offset: -1px;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: ${(props) => (props.$dropTarget ? 1 : 0)};
    box-shadow: inset 0 0 0 2px ${(props) => props.theme.accentColor};
    transition: opacity 0.12s ease;
  }
`

const GroupEmptyState = styled.div`
  position: absolute;
  inset: 0;
`

export default memo(EditorLayoutView)
