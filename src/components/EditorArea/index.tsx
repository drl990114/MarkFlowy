import { useEditorStore } from '@/stores'
import { getFileObject } from '@/utils/files'
import { IFile } from '@/utils/filesys'
import { Icon } from '@/components'
import { Editor } from '@/editor'
import customColors from '@/colors'
import { Container, TabItem } from './styles'

export default function EditorArea() {
  const { opened, activeId, setActiveId, delOpenedFile } = useEditorStore()
  const onSelectItem = (id: string) => {
    setActiveId(id)
  }

  const close = (ev: React.MouseEvent<HTMLElement, MouseEvent>, id: string) => {
    ev.stopPropagation()
    const curIndex = opened.findIndex(openedId => openedId === id)
    if (curIndex < 0) return

    if (activeId === id) {
      if (opened.length > 0) {
        setActiveId(curIndex === 0 ? opened[curIndex + 1] : opened[curIndex - 1])
      }
    }

    delOpenedFile(id)
  }

  return (
    <Container className="w-full h-full overflow-y-scroll">
      <div className="tab-items flex">
        {opened.map((id) => {
          const file = getFileObject(id) as IFile
          const active = activeId === id

          return (
            <TabItem active={active} onClick={() => onSelectItem(file.id)} className={`tab-item`} key={id}>
              <Icon name="file" iconProps={{ className: 'w-20px' }} />
              <span style={{ color: active ? customColors.accentColor : '' }}>{file.name}</span>
              <Icon name="close" iconProps={{ className: 'w-20px close' , onClick: (ev: React.MouseEvent<HTMLElement, MouseEvent>) => close(ev, id) }} />
            </TabItem>
          )
        })}
      </div>
      <div className="code-contents">
        {opened.map((id) => {
          return <Editor key={id} id={id} active={id === activeId} />
        })}
      </div>
    </Container>
  )
}
