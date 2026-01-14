import { useEffect } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { addExistingMarkdownFileEdit } from '@/services/editor-file'
import { getFileContent } from '@/services/file-info'
import { getFileNameFromPath } from '@/helper/filesys'
import { getFileObjectByPath } from '@/helper/files'
import { useEditorStore } from '@/stores'

const SUPPORTED_EXTENSIONS = ['.md', '.markdown', '.txt']

function isSupportedFile(path: string): boolean {
  const lowerPath = path.toLowerCase()
  return SUPPORTED_EXTENSIONS.some((ext) => lowerPath.endsWith(ext))
}

async function handleDroppedFile(filePath: string) {
  const { addOpenedFile, setActiveId } = useEditorStore.getState()

  // Check if the file is already opened
  const existingFile = getFileObjectByPath(filePath)
  if (existingFile) {
    setActiveId(existingFile.id)
    addOpenedFile(existingFile.id)
    return
  }

  // Read and open the file
  const fileContent = await getFileContent({ filePath })
  if (fileContent === null) return

  const fileName = getFileNameFromPath(filePath) || 'new-file.md'
  await addExistingMarkdownFileEdit({
    fileName,
    content: fileContent,
    path: filePath,
  })
}

export function useFileDrop() {
  useEffect(() => {
    let unlisten: (() => void) | undefined

    const setupDragDropListener = async () => {
      try {
        unlisten = await getCurrentWebview().onDragDropEvent((event) => {
          if (event.payload.type === 'drop') {
            const paths = event.payload.paths
            if (paths && paths.length > 0) {
              // Filter supported files and open them
              const supportedFiles = paths.filter(isSupportedFile)
              supportedFiles.forEach((filePath) => {
                handleDroppedFile(filePath)
              })
            }
          }
        })
      } catch (error) {
        console.error('Failed to setup drag drop listener:', error)
      }
    }

    setupDragDropListener()

    return () => {
      if (unlisten) {
        unlisten()
      }
    }
  }, [])
}

export default useFileDrop
