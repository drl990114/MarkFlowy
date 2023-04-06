import { Editors, EventBus, Fs } from '@utils'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useEditorStore } from '@stores'
import { EVENT } from '@constants'
import type { FileEntry } from '@tauri-apps/api/fs'
import { readDir, readTextFile } from '@tauri-apps/api/fs'
import { open } from '@tauri-apps/api/dialog'
import { FileTree } from '@components'
import { appWindow } from '@tauri-apps/api/window'
import { ExplorerBottomBar, ExplorerContainer, ExplorerTopBar } from './styles'

const Explorer: FC<ExplorerProps> = (props) => {
  const { editors, folderData, setFolderData } = useEditorStore()
  const [selectedPath, setSelectedPath] = useState<string>()

  useEffect(() => {
    if (selectedPath)
      appWindow.setTitle(selectedPath)
  }, [selectedPath])

  const handleSelect = async (item: FileEntry) => {
    if (item.children)
      return

    setSelectedPath(item?.name)
    const text = await readTextFile(item.path)
    Editors.setMarkDown(text)
  }

  useEffect(() => {
    const handleOpenFile = ({ path, content }) => {}

    const eventId = EventBus.on(EVENT.open_file, handleOpenFile)

    return () => {
      EventBus.remove(EVENT.open_file, eventId)
    }
  }, [])

  const handleOpenFileClick = async () => {
    const res = await Fs.selectMdFileAndRead()
    if (res !== undefined) {
      Editors.setMarkDown(res.content)
      EventBus.emit(EVENT.open_file, res)
    }
  }

  const handleOpenDirClick = async () => {
    const dir = await open({ directory: true, recursive: true })

    if (!dir)
      return
    try {
      const res = await readDir(dir, { recursive: true })
      setFolderData(res)
    }
    catch (error) {
      console.log('error', error)
    }
  }

  return (
    <ExplorerContainer className="w-full flex flex-col">
      <ExplorerTopBar className="border-b-1 border-gray-500">top</ExplorerTopBar>
      <FileTree className="flex-1" data={folderData} selectedPath={selectedPath} onSelect={handleSelect}></FileTree>
      <ExplorerBottomBar className="border-t-1 border-gray-500" onClick={handleOpenDirClick}>
        open dir
      </ExplorerBottomBar>
    </ExplorerContainer>
  )
}

interface ExplorerProps {
  className?: string
}

export default Explorer
