import { createFile } from '@/helper/filesys'
import { useEditorStateStore, useEditorStore } from '@/stores'

interface AddNewMarkdownFileEditParams {
  fileName: string
  content: string
}

export const addNewMarkdownFileEdit = async (params: AddNewMarkdownFileEditParams) => {
  await addMarkdownFileEdit(params)
}

interface AddExistingMarkdownFileEditParams {
  fileName: string
  content: string
  path: string
}

export const addExistingMarkdownFileEdit = async (params: AddExistingMarkdownFileEditParams) => {
  await addNewMarkdownFileEdit(params)
}

interface AddMarkdownFileEditParams {
  fileName: string
  content: string
  path?: string
}

export const addMarkdownFileEdit = async (params: AddMarkdownFileEditParams) => {
  const { fileName } = params
  const newFile = createFile({
    name: fileName,
    ...params,
  })
  const { addOpenedFile, setActiveId } = useEditorStore.getState()
  const { setIdStateMap } = useEditorStateStore.getState()

  addOpenedFile(newFile.id)
  setActiveId(newFile.id)
  if (params.path) {
    const state = {
      hasUnsavedChanges: false,
      undoDepth: 0,
    }
    const { setIdStateMap } = useEditorStateStore.getState()

    setIdStateMap(newFile.id, state)
  } else {
    setIdStateMap(newFile.id, {
      hasUnsavedChanges: true,
    })
  }
}
