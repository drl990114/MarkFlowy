import { EVENT } from '@/constants'
import { getFileObject, getSaveOpenedEditorEntries } from '@/helper/files'
import type { IFile } from '@/helper/filesys'
import { checkUnsavedFiles } from '@/services/checkUnsavedFiles'
import { useCommandStore, useEditorStateStore, useEditorStore } from '@/stores'
import { memo, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { Tooltip } from 'zens'
import { MfIconButton } from '../ui-v2/Button'
import { showContextMenu } from '../ui-v2/ContextMenu'
import { EditorAreaHeader } from './EditorAreaHeader'
import { Dot, TabItem } from './styles'

const Container = styled.div`
  display: flex;
  flex: 0 0 auto;
  background-color: ${(props) => props.theme.editorTabBgColor};

  .tab-items {
    display: flex;
    flex: 0 1 auto;
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
    padding: 0 ${(props) => props.theme.spaceXs};
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-right: 1px solid ${(props) => props.theme.borderColor};
  }

  .tab-filling {
    flex: 1 1 auto;
    border-bottom: 1px solid ${(props) => props.theme.borderColor};
    border-left: 1px solid ${(props) => props.theme.borderColor};
  }
`
const EditorAreaTabs = memo(() => {
  const { opened, activeId, setActiveId, delOtherOpenedFile, delAllOpenedFile } =
    useEditorStore()
  const { idStateMap } = useEditorStateStore()
  const htmlRef = useRef<HTMLDivElement>(null)
  const { t } = useTranslation()

  useEffect(() => {
    if (!htmlRef.current) return
    htmlRef.current.onwheel = (ev) => {
      ev.preventDefault()
      htmlRef.current!.scrollLeft += ev.deltaY
    }
  }, [])

  const onSelectItem = (id: string) => {
    setActiveId(id)
  }

  const close = useCallback(
    (ev: React.MouseEvent<HTMLElement, MouseEvent> | undefined, id: string) => {
      ev?.stopPropagation()
      const { opened, activeId, delOpenedFile, setActiveId } = useEditorStore.getState()
      const curIndex = opened.findIndex((openedId) => openedId === id)

      if (curIndex < 0) return

      if (activeId === id) {
        if (opened.length > 0) {
          setActiveId(curIndex === 0 ? opened[curIndex + 1] : opened[curIndex - 1])
        }
      }

      delOpenedFile(id)
    },
    [],
  )

  useEffect(() => {
    useCommandStore.getState().addCommand({
      id: EVENT.app_closeCurrentEditorTab,
      handler: () => {
        const activeId = useEditorStore.getState().activeId
        if (activeId) {
          close(undefined, activeId)
        }
      },
    })
  }, [])

  const moveActiveTab = (dir: 'left' | 'right') => {
    const { opened, activeId, setActiveId } = useEditorStore.getState()
    const curIndex = opened.findIndex((openedId) => openedId === activeId)

    if (curIndex < 0) return

    if (dir === 'left') {
      if (opened.length > 0) {
        setActiveId(curIndex === 0 ? opened[opened.length - 1] : opened[curIndex - 1])
      }
    } else {
      if (opened.length > 0) {
        setActiveId(curIndex === opened.length - 1 ? opened[0] : opened[curIndex + 1])
      }
    }
  }

  return (
    <Container>
      <div className='tab-control'>
        <MfIconButton icon='ri-arrow-left-line' size='small' rounded='smooth' onClick={() => moveActiveTab('left')}/>
        <MfIconButton icon='ri-arrow-right-line' size='small' rounded='smooth' onClick={() => moveActiveTab('right')}/>
      </div>
      <div className='tab-items' ref={htmlRef}>
        {opened.map((id) => {
          const file = getFileObject(id) as IFile
          const active = activeId === id
          const editorState = idStateMap.get(id)

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
                          delOtherOpenedFile(id)
                        },
                        onUnsavedAndClose: () => {
                          delOtherOpenedFile(id)
                        },
                      }) > 0
                    ) {
                      return
                    }
                    delOtherOpenedFile(id)
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
                          delAllOpenedFile()
                        },
                        onUnsavedAndClose: () => {
                          delAllOpenedFile()
                        },
                      }) > 0
                    ) {
                      return
                    }
                    delAllOpenedFile()
                  },
                },
              ],
            })
          }

          return (
            <Tooltip title={file.name} key={id}>
              <TabItem
                active={active}
                onClick={() => onSelectItem(file.id)}
                key={id}
                onContextMenu={handleContextMenu}
              >
                <span
                  style={{
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {file.name}
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
      <div className='tab-filling' />
      <EditorAreaHeader />
    </Container>
  )
})

export default EditorAreaTabs
