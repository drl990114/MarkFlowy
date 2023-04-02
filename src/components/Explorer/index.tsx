import { Editors, Fs } from '@utils'
import classnames from 'classnames'
import { FC, useEffect, useState } from 'react'
import { useEditorStore } from '@stores'
import { EventBus } from '@utils'
import { EVENT } from '@constants'
import { FileEntry, readDir, readTextFile } from '@tauri-apps/api/fs'
import { open } from '@tauri-apps/api/dialog'
import { FileTree } from '@components'

const Explorer: FC<ExplorerProps> = (props) => {
  const { editors, folderData, setFolderData } = useEditorStore()
  const [selectedPath, setSelectedPath] = useState<string>()

  const handleSelect = async (item: FileEntry) => {
    if (item.children) {
      return
    }
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
    if (!dir) return
    const res = await readDir(dir, { recursive: true })
    setFolderData(res)
  }
  const containerCls = classnames(props.className, '')

  return (
    <div className={containerCls}>
      <button className="btn" onClick={handleOpenFileClick}>
        open markdown file
      </button>
      <button className="btn" onClick={handleOpenDirClick}>
        open dir
      </button>
      <FileTree data={folderData} selectedPath={selectedPath} onSelect={handleSelect}></FileTree>
    </div>
  )
}

interface ExplorerProps {
  className?: string
}

export default Explorer
