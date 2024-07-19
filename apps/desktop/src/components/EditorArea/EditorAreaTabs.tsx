import { getFileObject } from '@/helper/files'
import type { IFile } from '@/helper/filesys'
import { useEditorStore, useEditorStateStore } from '@/stores'
import { memo, useEffect, useRef } from 'react'
import { TabItem, Dot } from './styles'
import styled, { css } from 'styled-components'
import useThemeStore from '@/stores/useThemeStore'
import { setTitleBarText } from '../TitleBar'
import { EditorAreaHeader } from './EditorAreaHeader'
import { darken } from '@markflowy/theme'
import { showContextMenu } from '../UI/ContextMenu'
import { useTranslation } from 'react-i18next'
import { Tooltip } from 'zens'

type ContainerProps = {
  visible: boolean
}

const Container = styled.div<ContainerProps>`
  display: flex;
  justify-content: ${(props) => (props.visible ? 'space-between' : 'flex-end')};
  background-color: ${(props) => props.theme.editorTabBgColor};

  .tab-items {
    display: flex;
    width: 100%;
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

    &__close {
      border-radius: ${(props) => props.theme.smallBorderRadius};

      &:hover {
        background-color: ${(props) => darken(props.theme.hoverColor, 0.2)};
      }
    }

    ${(props) =>
      !props.visible &&
      css({
        display: 'none',
      })}
  }
`
const EditorAreaTabs = memo(() => {
  const { opened, activeId, setActiveId, delOpenedFile, delOtherOpenedFile, delAllOpenedFile } =
    useEditorStore()
  const { idStateMap } = useEditorStateStore()
  const { curTheme } = useThemeStore()
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

  const close = (ev: React.MouseEvent<HTMLElement, MouseEvent>, id: string) => {
    ev.stopPropagation()
    const curIndex = opened.findIndex((openedId) => openedId === id)
    if (curIndex < 0) return

    if (activeId === id) {
      if (opened.length > 0) {
        if (opened.length === 1) {
          setTitleBarText('')
        }

        setActiveId(curIndex === 0 ? opened[curIndex + 1] : opened[curIndex - 1])
      }
    }

    delOpenedFile(id)
  }

  return (
    <Container visible>
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
                    close(e, id)
                  },
                },
                {
                  label: t('contextmenu.editor_tab.close_others'),
                  value: 'close_others',
                  handler: () => {
                    delOtherOpenedFile(id)
                  },
                },
                {
                  label: t('contextmenu.editor_tab.close_all'),
                  value: 'close_all',
                  handler: () => {
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
                <i className={'ri-file-3-line tab-items__icon'} />
                <span
                  style={{
                    color: active ? curTheme.styledConstants.accentColor : '',
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
                    <i
                      className='ri-close-line tab-items__icon tab-items__close'
                      onClick={(ev: React.MouseEvent<HTMLElement, MouseEvent>) => close(ev, id)}
                    />
                  )}
                </div>
              </TabItem>
            </Tooltip>
          )
        })}
      </div>
      <EditorAreaHeader />
    </Container>
  )
})

export default EditorAreaTabs
