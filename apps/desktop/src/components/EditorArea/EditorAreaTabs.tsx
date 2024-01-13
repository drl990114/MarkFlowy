import { getFileObject } from '@/helper/files'
import type { IFile } from '@/helper/filesys'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useEditorStore, useEditorStateStore } from '@/stores'
import { memo, useEffect, useRef } from 'react'
import { TabItem, Dot } from './styles'
import styled, { css } from 'styled-components'
import useThemeStore from '@/stores/useThemeStore'
import { setTitleBarText } from '../TitleBar'
import { EditorAreaHeader } from './EditorAreaHeader'
import { darken } from '@markflowy/theme'

type ContainerProps = {
  visible: boolean
}

const Container = styled.div<ContainerProps>`
  display: flex;
  justify-content: ${(props) => (props.visible ? 'space-between' : 'flex-end')};

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
  const { opened, activeId, setActiveId, delOpenedFile } = useEditorStore()
  const { idStateMap } = useEditorStateStore()
  const { curTheme } = useThemeStore()
  const [element] = useAutoAnimate<HTMLDivElement>()
  const htmlRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!htmlRef.current) return
    element(htmlRef.current)
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

          return (
            <TabItem active={active} onClick={() => onSelectItem(file.id)} key={id}>
              <i className={'ri-file-3-line tab-items__icon'} />
              <span style={{ color: active ? curTheme.styledContants.accentColor : '' }}>
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
          )
        })}
      </div>
      <EditorAreaHeader />
    </Container>
  )
})

export default EditorAreaTabs
