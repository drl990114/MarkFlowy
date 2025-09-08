import { getFileObject } from '@/helper/files'
import { createFile } from '@/helper/filesys'
import { useEditorStateStore, useEditorStore } from '@/stores'
import i18n from 'i18next'

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

export const addEmptyEditorTab = async () => {
  const empty = createFile({
    name: i18n.t('file.newTab'),
    content: '',
    path: undefined,
    kind: 'new_tab',
  })
  const { addOpenedFile, setActiveId } = useEditorStore.getState()
  const { setIdStateMap } = useEditorStateStore.getState()

  addOpenedFile(empty.id)
  setActiveId(empty.id)
  setIdStateMap(empty.id, {
    hasUnsavedChanges: false,
  })
}

export const isEmptyEditor = (id?: string): boolean => {
  if (!id) return false
  const file = getFileObject(id)
  if (!file) return false
  return file.kind === 'new_tab'
}
