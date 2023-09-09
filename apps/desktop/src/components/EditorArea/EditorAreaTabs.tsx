import { getFileObject } from '@/helper/files'
import type { IFile } from '@/helper/filesys'
import { useAutoAnimate, useGlobalTheme } from '@/hooks'
import { useEditorStore, useEditorStateStore } from '@/stores'
import { memo, useEffect } from 'react'
import { TabItem, Dot } from './styles'
import styled, { css } from 'styled-components'

type ContainerProps = {
  visible: boolean
}
const Container = styled.div<ContainerProps>`
  ${(props) =>
    !props.visible &&
    css({
      display: 'none',
    })}
`
const EditorAreaTabs = memo(() => {
  const { opened, activeId, setActiveId, delOpenedFile } = useEditorStore()
  const { idStateMap } = useEditorStateStore()
  const { themeColors } = useGlobalTheme()
  const { htmlRef } = useAutoAnimate<HTMLDivElement>()

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
        setActiveId(curIndex === 0 ? opened[curIndex + 1] : opened[curIndex - 1])
      }
    }

    delOpenedFile(id)
  }

  return (
    <Container className='tab-items' visible={opened.length > 1} ref={htmlRef}>
      {opened.map((id) => {
        const file = getFileObject(id) as IFile
        const active = activeId === id
        const editorState = idStateMap.get(id)

        return (
          <TabItem active={active} onClick={() => onSelectItem(file.id)} key={id}>
            <i className={'ri-file-3-line tab-items__icon'} />
            <span style={{ color: active ? themeColors.accentColor : '' }}>{file.name}</span>

            {editorState?.hasUnsavedChanges ? (
              <Dot />
            ) : (
              <i
                className='ri-close-line tab-items__icon close'
                onClick={(ev: React.MouseEvent<HTMLElement, MouseEvent>) => close(ev, id)}
              />
            )}
          </TabItem>
        )
      })}
    </Container>
  )
})

export default EditorAreaTabs
