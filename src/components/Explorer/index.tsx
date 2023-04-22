import type { FC } from 'react'
import { memo, useEffect, useState } from 'react'
import { useEditorStore } from '@stores'
import { APP_NAME, EVENT } from '@constants'
import type { FileEntry } from '@tauri-apps/api/fs'
import { readDir, readTextFile, writeTextFile } from '@tauri-apps/api/fs'
import { open, save } from '@tauri-apps/api/dialog'
import { Empty, FileTree, Icon } from '@components'
import { appWindow } from '@tauri-apps/api/window'
import classNames from 'classnames'
import { emit } from '@tauri-apps/api/event'
import { useGlobalRemirror } from '@hooks'
import { DataCenter } from '@utils'
import { useTranslation } from 'react-i18next'

const Explorer: FC<ExplorerProps> = (props) => {
  const { operater } = useGlobalRemirror()
  const { t } = useTranslation()
  const { folderData, setFolderData } = useEditorStore()
  const [selectedPath, setSelectedPath] = useState<string>()

  useEffect(() => {
    const unListen = appWindow.listen('file_save', async () => {
      const content = DataCenter.getData('markdownContent')
      if (!selectedPath) {
        save({
          title: 'My wonderful save dialog',
          defaultPath: `${t('file.untitled')}.md`,
        }).then((path) => {
          if (path === null)
            return
          writeTextFile(path, content)
        })
      }
      try {
        writeTextFile(selectedPath!, content)
      }
      catch (error) {
        console.error(error)
      }
    })
    return () => {
      unListen.then(fn => fn())
    }
  }, [selectedPath, t])

  useEffect(() => {
    emit(EVENT.selected_file, selectedPath)
  }, [selectedPath])

  const handleSelect = async (item: FileEntry) => {
    if (item.children)
      return

    setSelectedPath(item?.path)
    appWindow.setTitle(item?.name || APP_NAME)
    const text = await readTextFile(item.path)
    operater.setMarkdown(text)
  }

  const handleOpenDirClick = async () => {
    const dir = await open({ directory: true, recursive: true })

    if (typeof dir !== 'string')
      return
    try {
      const res = await readDir(dir, { recursive: true })
      setFolderData(res)
    }
    catch (error) {
      console.error('error', error)
    }
  }

  const containerCLs = classNames('w-full flex flex-col', props.className)

  return (
    <div className={containerCLs}>
      <div className="border-b-1 flex justify-between items-center px-4 py-1">
        <small>EXPLORER</small>
        <div className="flex"></div>
      </div>
      <div className="h-full w-full">{folderData ? <FileTree className="flex-1" data={folderData} selectedPath={selectedPath} onSelect={handleSelect}></FileTree> : <Empty />}</div>
      <div className="border-t-1 flex justify-between items-center px-4 py-1">
        <small className="flex-1 cursor-pointer" onClick={handleOpenDirClick}>
          {t('file.openDir')}
        </small>
        <Icon name="moreVertical" iconProps={{ className: 'w-20px h-20px icon-hover cursor-pointer' }} />
      </div>
    </div>
  )
}

interface ExplorerProps {
  className?: string
}

export default memo(Explorer)
