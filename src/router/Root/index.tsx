import EditorArea from '@/components/EditorArea'
import { getFileObject } from '@/utils/files'
import { AppInfoDialog, SideBar } from '@components'
import { useEditorStore } from '@stores'
import { save } from '@tauri-apps/api/dialog'
import { listen } from '@tauri-apps/api/event'
import { writeTextFile } from '@tauri-apps/api/fs'
import { t } from 'i18next'
import { useEffect } from 'react'
import { Container } from './styles'

function Root() {
  const { activeId, getEditorContent } = useEditorStore()

  useEffect(() => {
    const unListenFileSave = listen('file_save', async () => {
      const content = activeId ? getEditorContent(activeId) : ''
      if (!activeId) {
        return
      }
      try {
        const file = getFileObject(activeId)
  
        if (!file.path) {
          save({
            title: 'Save File',
            defaultPath: file.name ?? `${t('file.untitled')}.md`,
          }).then((path) => {
            if (path === null) return
            writeTextFile(path, content)
          })
          return
        }
  
        writeTextFile(file.path!, content)
      } catch (error) {
        console.error(error)
      }
    })
    return () => {
      unListenFileSave.then(fn => fn())
    }
  }, [activeId])

  return (
    <Container>
      <SideBar />
      <EditorArea />
      <AppInfoDialog />
    </Container>
  )
}

export default Root
