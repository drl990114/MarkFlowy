import { getFileObject } from "@/helper/files"
import type { IFile } from "@/helper/filesys"
import { useGlobalTheme } from "@/hooks"
import { useEditorStore, useEditorStateStore } from "@/stores"
import { memo } from "react"
import { TabItem, Dot } from "./styles"

const EditorAreaTabs = memo(() => {
  const { opened, activeId, setActiveId, delOpenedFile } = useEditorStore()
  const { idStateMap } = useEditorStateStore()
  const { themeColors } = useGlobalTheme()

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

  return opened.length > 1 ? (
    <div className='tab-items'>
      {opened.map((id) => {
        const file = getFileObject(id) as IFile
        const active = activeId === id
        const editorState = idStateMap.get(id)

        return (
          <TabItem
            active={active}
            onClick={() => onSelectItem(file.id)}
            className={'tab-item'}
            key={id}
          >
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
    </div>
  ) : null
})

export default EditorAreaTabs
