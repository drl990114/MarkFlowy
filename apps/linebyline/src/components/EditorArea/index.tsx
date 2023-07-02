import Editor from './Editor'
import { Container, TabItem } from './styles'
import { getFileObject } from '@/helper/files'
import type { IFile } from '@/helper/filesys'
import { useGlobalTheme } from '@/hooks'
import { useEditorStore } from '@/stores'

export default function EditorArea() {
  const { opened, activeId, setActiveId, delOpenedFile } = useEditorStore()
  const { themeColors } = useGlobalTheme()
  const onSelectItem = (id: string) => {
    setActiveId(id)
  }

  const close = (ev: React.MouseEvent<HTMLElement, MouseEvent>, id: string) => {
    ev.stopPropagation()
    const curIndex = opened.findIndex(openedId => openedId === id)
    if (curIndex < 0)
      return

    if (activeId === id) {
      if (opened.length > 0) {
        setActiveId(
          curIndex === 0 ? opened[curIndex + 1] : opened[curIndex - 1],
        )
      }
    }

    delOpenedFile(id)
  }

  return (
    <Container className="w-full h-full">
      {opened.length > 1 ? <div className="tab-items">
        {opened.map((id) => {
          const file = getFileObject(id) as IFile
          const active = activeId === id

          return (
            <TabItem
              active={active}
              onClick={() => onSelectItem(file.id)}
              className={'tab-item'}
              key={id}
            >
              <i className={'ri-file-3-line tab-items__icon'} />
              <span style={{ color: active ? themeColors.accentColor : '' }}>
                {file.name}
              </span>
              <i
                className="ri-close-line tab-items__icon close"
                onClick={(ev: React.MouseEvent<HTMLElement, MouseEvent>) =>
                  close(ev, id)
                }
              />
            </TabItem>
          )
        })}
      </div> : null}
      <div className="code-contents">
        {opened.map((id) => {
          return <Editor key={id} id={id} active={id === activeId} />
        })}
      </div>
    </Container>
  )
}
