import { EVENT } from '@/constants'
import useFileCacheStore from '@/helper/files'
import { checkUnsavedFiles, saveUnsavedFiles } from '@/services/checkUnsavedFiles'
import { useEditorStateStore, useEditorStore } from '@/stores'
import { memo, type DragEvent, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { showContextMenu } from '../ui-v2/ContextMenu'
import { EditorAreaHeader } from './EditorAreaHeader'
import { EditorAreaActionButton, EditorAreaActionSeparator } from './EditorAreaAction'
import {
  hasEditorTabDragData,
  readEditorTabDragData,
  writeEditorTabDragData,
} from './editorDragData'
import { Dot, TabItem } from './styles'
import { SidebarToggleButton } from './SidebarToggleButton'

const Container = styled.div<{ $compact: boolean }>`
  display: flex;
  flex: 0 0 auto;
  height: 33px;
  min-width: 0;
  background-color: ${(props) => props.theme.editorTabBgColor};

  .tab-items {
    display: flex;
    flex: 0 1 auto;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;

    &::-webkit-scrollbar {
      -webkit-appearance: none;
      display: none;
    }

    &__icon {
      margin: 0 2px;
    }

    &__right {
      margin-left: ${(props) => props.theme.spaceXs};
    }
  }

  .tab-control {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 ${(props) => props.theme.spaceXs};
    box-sizing: border-box;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-right: 1px solid ${(props) => props.theme.borderColor};
  }

  .tab-navigation {
    display: flex;
    align-items: center;
  }

  .tab-filling {
    flex: 1 1 auto;
    height: 100%;
    min-width: ${(props) => (props.$compact ? '0' : '24px')};
    box-sizing: border-box;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-left: 1px solid ${(props) => props.theme.borderColor};
  }
`
interface EditorAreaTabsProps {
  compact?: boolean
  groupId: string
  showLeftSidebarToggle?: boolean
  showRightSidebarToggle?: boolean
}

interface EditorAreaTabProps {
  active: boolean
  close: (ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined, id: string) => void
  compact: boolean
  groupId: string
  handleDragOver: (e: DragEvent<HTMLElement>) => void
  handleDrop: (e: DragEvent<HTMLElement>) => void
  id: string
  onSelect: (id: string) => void
}

function getTabLabel(fileName: string, compact: boolean) {
  if (!compact) return fileName

  const extensionIndex = fileName.lastIndexOf('.')
  if (extensionIndex <= 0) return fileName

  return fileName.slice(0, extensionIndex)
}

const EditorAreaTab = memo((props: EditorAreaTabProps) => {
  const {
    active,
    close,
    compact,
    groupId,
    handleDragOver,
    handleDrop,
    id,
    onSelect,
  } = props
  const hasUnsavedChanges = useEditorStateStore(
    (state) => state.idStateMap.get(id)?.hasUnsavedChanges ?? false,
  )
  const { t } = useTranslation()
  const fileName = useFileCacheStore((state) => state.entries[id]?.name)
  if (!fileName) return null

  const tabLabel = getTabLabel(fileName, compact)

  const handleMiddleClick = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    // 鼠标中键点击关闭标签页
    if (e.button !== 1) return
    e.stopPropagation()
    e.preventDefault()
    if (
      checkUnsavedFiles({
        fileIds: [id],
        onSaveAndClose: async () => {
          if (await saveUnsavedFiles([id])) {
            close(e, id)
          }
        },
        onUnsavedAndClose: () => {
          close(e, id)
        },
      }) > 0
    ) {
      return
    }
    close(e, id)
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
    e.stopPropagation()
    e.preventDefault()
    showContextMenu({
      x: e.clientX,
      y: e.clientY,
      items: [
        {
          label: t('contextmenu.editor_tab.close'),
          value: 'close',
          commandId: EVENT.app_closeCurrentEditorTab,
          handler: () => {
            if (
              checkUnsavedFiles({
                fileIds: [id],
                onSaveAndClose: async () => {
                  if (await saveUnsavedFiles([id])) {
                    close(e, id)
                  }
                },
                onUnsavedAndClose: () => {
                  close(e, id)
                },
              }) > 0
            ) {
              return
            }
            close(e, id)
          },
        },
        {
          label: t('contextmenu.editor_tab.close_others'),
          value: 'close_others',
          handler: () => {
            const { closeOtherFilesInGroup, getGroup } = useEditorStore.getState()
            const otherIds = (getGroup(groupId)?.opened || []).filter(
              (openedId) => openedId !== id,
            )
            if (
              checkUnsavedFiles({
                fileIds: otherIds,
                onSaveAndClose: async (hasUnsavedFileIds) => {
                  if (await saveUnsavedFiles(hasUnsavedFileIds)) {
                    closeOtherFilesInGroup(groupId, id)
                  }
                },
                onUnsavedAndClose: () => {
                  closeOtherFilesInGroup(groupId, id)
                },
              }) > 0
            ) {
              return
            }
            closeOtherFilesInGroup(groupId, id)
          },
        },
        {
          label: t('contextmenu.editor_tab.close_all'),
          value: 'close_all',
          handler: () => {
            const { closeAllFilesInGroup, getGroup } = useEditorStore.getState()
            const openedIds = getGroup(groupId)?.opened || []
            if (
              checkUnsavedFiles({
                fileIds: openedIds,
                onSaveAndClose: async (hasUnsavedFileIds) => {
                  if (await saveUnsavedFiles(hasUnsavedFileIds)) {
                    closeAllFilesInGroup(groupId)
                  }
                },
                onUnsavedAndClose: () => {
                  closeAllFilesInGroup(groupId)
                },
              }) > 0
            ) {
              return
            }
            closeAllFilesInGroup(groupId)
          },
        },
      ],
    })
  }

  const handleDragStart = (e: DragEvent<HTMLElement>) => {
    writeEditorTabDragData(e.dataTransfer, {
      sourceGroupId: groupId,
      fileId: id,
    })
    e.dataTransfer.setData('text/plain', fileName)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return

    e.preventDefault()
    onSelect(id)
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <TabItem
          active={active}
          aria-selected={active}
          draggable
          onClick={() => onSelect(id)}
          onContextMenu={handleContextMenu}
          onDragOver={handleDragOver}
          onDragStart={handleDragStart}
          onDrop={handleDrop}
          onKeyDown={handleKeyDown}
          onMouseDown={handleMiddleClick}
          role='tab'
          tabIndex={active ? 0 : -1}
        >
          <span
            style={{
              maxWidth: compact ? '112px' : '160px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {tabLabel}
          </span>

          <div className='tab-items__right'>
            {hasUnsavedChanges ? (
              <Dot />
            ) : (
              <Button
                aria-label={t('contextmenu.editor_tab.close')}
                className='close'
                onClick={(ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined) =>
                  close(ev, id)
                }
                size='icon-sm'
                variant='ghost'
              >
                <i aria-hidden='true' className='ri-close-line' />
              </Button>
            )}
          </div>
        </TabItem>
      </TooltipTrigger>
      <TooltipContent>{fileName}</TooltipContent>
    </Tooltip>
  )
})

const EditorAreaTabs = memo((props: EditorAreaTabsProps) => {
  const {
    compact = false,
    groupId,
    showLeftSidebarToggle = false,
    showRightSidebarToggle = false,
  } = props
  const group = useEditorStore((state) => state.getGroup(groupId))
  const openFileInGroup = useEditorStore((state) => state.openFileInGroup)
  const moveFileToGroup = useEditorStore((state) => state.moveFileToGroup)
  const htmlRef = useRef<HTMLDivElement>(null)
  const opened = group?.opened ?? []
  const activeId = group?.activeId
  const showTabNavigation = !compact && opened.length > 1
  const { t } = useTranslation()

  useEffect(() => {
    if (!htmlRef.current) return
    htmlRef.current.onwheel = (ev) => {
      ev.preventDefault()
      htmlRef.current!.scrollLeft += ev.deltaY
    }
  }, [])

  const onSelectItem = useCallback(
    (id: string) => {
      openFileInGroup(groupId, id)
    },
    [groupId, openFileInGroup],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLElement>) => {
    if (!hasEditorTabDragData(e.dataTransfer)) return

    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback(
    (e: DragEvent<HTMLElement>) => {
      const dragData = readEditorTabDragData(e.dataTransfer)
      if (!dragData) return

      e.preventDefault()
      e.stopPropagation()
      moveFileToGroup(dragData.sourceGroupId, groupId, dragData.fileId)
    },
    [groupId, moveFileToGroup],
  )

  const close = useCallback(
    (ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined, id: string) => {
      ev?.stopPropagation()
      useEditorStore.getState().closeFileInGroup(groupId, id)
    },
    [groupId],
  )

  const moveActiveTab = (dir: 'left' | 'right') => {
    const currentGroup = useEditorStore.getState().getGroup(groupId)
    if (!currentGroup) return

    const curIndex = currentGroup.opened.findIndex(
      (openedId) => openedId === currentGroup.activeId,
    )

    if (curIndex < 0) return

    if (dir === 'left') {
      if (currentGroup.opened.length > 0) {
        openFileInGroup(
          groupId,
          curIndex === 0
            ? currentGroup.opened[currentGroup.opened.length - 1]
            : currentGroup.opened[curIndex - 1],
        )
      }
    } else {
      if (currentGroup.opened.length > 0) {
        openFileInGroup(
          groupId,
          curIndex === currentGroup.opened.length - 1
            ? currentGroup.opened[0]
            : currentGroup.opened[curIndex + 1],
        )
      }
    }
  }

  return (
    <Container $compact={compact} className='editor-area-tabs' role='tablist'>
      {showLeftSidebarToggle || showTabNavigation ? (
        <div className='tab-control'>
          {showLeftSidebarToggle ? <SidebarToggleButton side='left' /> : null}
          {showLeftSidebarToggle && showTabNavigation ? <EditorAreaActionSeparator /> : null}
          {showTabNavigation ? (
            <div className='tab-navigation'>
              <EditorAreaActionButton
                icon='ri-arrow-left-line'
                label={t('contextmenu.editor_tab.previous')}
                onClick={() => moveActiveTab('left')}
              />
              <EditorAreaActionButton
                icon='ri-arrow-right-line'
                label={t('contextmenu.editor_tab.next')}
                onClick={() => moveActiveTab('right')}
              />
            </div>
          ) : null}
        </div>
      ) : null}
      <div className='tab-items' ref={htmlRef}>
        {opened.map((id) => (
          <EditorAreaTab
            active={activeId === id}
            close={close}
            compact={compact}
            groupId={groupId}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            id={id}
            key={id}
            onSelect={onSelectItem}
          />
        ))}
      </div>
      <div className='tab-filling' onDragOver={handleDragOver} onDrop={handleDrop} />
      <EditorAreaHeader groupId={groupId} showRightSidebarToggle={showRightSidebarToggle} />
    </Container>
  )
})

export default EditorAreaTabs
