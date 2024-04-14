import { createFile } from '@/helper/filesys'
import { useEditorStateStore, useEditorStore } from '@/stores'

interface AddNewMarkdownFileEditParams {
  fileName: string
  content: string
}

export const addNewMarkdownFileEdit = async (params: AddNewMarkdownFileEditParams) => {
  const { fileName, content } = params
  const newFile = createFile({
    name: fileName,
    content: content,
  })
  const { addOpenedFile, setActiveId } = useEditorStore.getState()
  const { setIdStateMap } = useEditorStateStore.getState()

  addOpenedFile(newFile.id)
  setActiveId(newFile.id)
  setIdStateMap(newFile.id, {
    hasUnsavedChanges: true,
  })
}
