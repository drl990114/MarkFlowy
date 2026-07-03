import { EVENT } from '@/constants'
import { getFileObject, getSaveOpenedEditorEntries } from '@/helper/files'
import type { IFile } from '@/helper/filesys'
import { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { useEditorStateStore, useEditorStore } from '@/stores'
import { memo, type DragEvent, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import { Tooltip } from 'zens'
import { MfIconButton } from '../ui-v2/Button'
import { showContextMenu } from '../ui-v2/ContextMenu'
import { EditorAreaHeader } from './EditorAreaHeader'
import {
  hasEditorTabDragData,
  readEditorTabDragData,
  writeEditorTabDragData,
} from './editorDragData'
import { Dot, TabItem } from './styles'

const Container = styled.div<{ $compact: boolean }>`
  display: flex;
  flex: 0 0 auto;
  height: 32px;
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
    display: ${(props) => (props.$compact ? 'none' : 'flex')};
    align-items: center;
    height: 100%;
    padding: 0 ${(props) => props.theme.spaceXs};
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-right: 1px solid ${(props) => props.theme.borderColor};
  }

  .tab-filling {
    flex: 1 1 auto;
    height: 100%;
    min-width: ${(props) => (props.$compact ? '0' : '24px')};
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-left: 1px solid ${(props) => props.theme.borderColor};
  }
`
interface EditorAreaTabsProps {
  compact?: boolean
  groupId: string
}

function getTabLabel(fileName: string, compact: boolean) {
  if (!compact) return fileName

  const extensionIndex = fileName.lastIndexOf('.')
  if (extensionIndex <= 0) return fileName

  return fileName.slice(0, extensionIndex)
}

const EditorAreaTabs = memo((props: EditorAreaTabsProps) => {
  const { compact = false, groupId } = props
  const group = useEditorStore((state) => state.getGroup(groupId))
  const { openFileInGroup, closeOtherFilesInGroup, closeAllFilesInGroup, moveFileToGroup } =
    useEditorStore()
  const { idStateMap } = useEditorStateStore()
  const htmlRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()
  const opened = group?.opened ?? []
  const activeId = group?.activeId

  useEffect(() => {
    if (!htmlRef.current) return
    htmlRef.current.onwheel = (ev) => {
      ev.preventDefault()
      htmlRef.current!.scrollLeft += ev.deltaY
    }
  }, [])

  const onSelectItem = (id: string) => {
    openFileInGroup(groupId, id)
  }

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
    const group = useEditorStore.getState().getGroup(groupId)
    if (!group) return

    const curIndex = group.opened.findIndex((openedId) => openedId === group.activeId)

    if (curIndex < 0) return

    if (dir === 'left') {
      if (group.opened.length > 0) {
        openFileInGroup(
          groupId,
          curIndex === 0 ? group.opened[group.opened.length - 1] : group.opened[curIndex - 1],
        )
      }
    } else {
      if (group.opened.length > 0) {
        openFileInGroup(
          groupId,
          curIndex === group.opened.length - 1 ? group.opened[0] : group.opened[curIndex + 1],
        )
      }
    }
  }

  return (
    <Container $compact={compact} className='editor-area-tabs'>
      <div className='tab-control'>
        <MfIconButton
          icon='ri-arrow-left-line'
          size='small'
          rounded='smooth'
          onClick={() => moveActiveTab('left')}
        />
        <MfIconButton
          icon='ri-arrow-right-line'
          size='small'
          rounded='smooth'
          onClick={() => moveActiveTab('right')}
        />
      </div>
      <div className='tab-items' ref={htmlRef}>
        {opened.map((id) => {
          const file = getFileObject(id) as IFile
          if (!file) return null
          const active = activeId === id
          const editorState = idStateMap.get(id)
          const tabLabel = getTabLabel(file.name, compact)

          const handleMiddleClick = (e: React.MouseEvent<HTMLElement, MouseEvent>) => {
            // 鼠标中键点击关闭标签页
            if (e.button !== 1) return
            e.stopPropagation()
            e.preventDefault()
            if (
              checkUnsavedFiles({
                fileIds: [id],
                onSaveAndClose: async () => {
                  const saveHandler = getSaveOpenedEditorEntries(id)
                  await saveHandler?.()
                  close(e, id)
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
                          const saveHandler = getSaveOpenedEditorEntries(id)
                          await saveHandler?.()
                          close(e, id)
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
                    const otherIds = opened.filter((openedId) => openedId !== id)
                    if (
                      checkUnsavedFiles({
                        fileIds: otherIds,
                        onSaveAndClose: async (hasUnsavedFileIds) => {
                          const saves = hasUnsavedFileIds.map((otherId) =>
                            getSaveOpenedEditorEntries(otherId),
                          )
                          await Promise.all(saves.map((saveHandler) => saveHandler?.()))
                          closeOtherFilesInGroup(groupId, id)
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
                    if (
                      checkUnsavedFiles({
                        fileIds: opened,
                        onSaveAndClose: async (hasUnsavedFileIds) => {
                          const saves = hasUnsavedFileIds.map((otherId) =>
                            getSaveOpenedEditorEntries(otherId),
                          )
                          await Promise.all(saves.map((saveHandler) => saveHandler?.()))
                          closeAllFilesInGroup(groupId)
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
            e.dataTransfer.setData('text/plain', file.name)
          }

          return (
            <Tooltip title={file.name} key={id}>
              <TabItem
                active={active}
                draggable
                onClick={() => onSelectItem(file.id)}
                key={id}
                onContextMenu={handleContextMenu}
                onDragOver={handleDragOver}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onMouseDown={handleMiddleClick}
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
                  {editorState?.hasUnsavedChanges ? (
                    <Dot />
                  ) : (
                    <MfIconButton
                      icon='ri-close-line'
                      size='small'
                      rounded='rounded'
                      className='close'
                      onClick={(ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined) =>
                        close(ev, id)
                      }
                    />
                  )}
                </div>
              </TabItem>
            </Tooltip>
          )
        })}
      </div>
      <div className='tab-filling' onDragOver={handleDragOver} onDrop={handleDrop} />
      <EditorAreaHeader groupId={groupId} />
    </Container>
  )
})

export default EditorAreaTabs
