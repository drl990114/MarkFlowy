import { FC, useCallback, useMemo } from 'react'
import { memo, useEffect, useState } from 'react'
import { useEditorStore } from '@stores'
import { APP_NAME, EVENT } from '@constants'
import { readTextFile, writeTextFile } from '@tauri-apps/api/fs'
import { open, save } from '@tauri-apps/api/dialog'
import { Empty, FileTree, Icon, List, Popper } from '@components'
import { appWindow } from '@tauri-apps/api/window'
import classNames from 'classnames'
import { emit } from '@tauri-apps/api/event'
import { CacheManager, DataCenter } from '@utils'
import { useTranslation } from 'react-i18next'
import { useGlobalCacheData } from '@hooks'
import dayjs from 'dayjs'
import { Container } from './styles'
import { ListDataItem } from '../List'
import { IFile, readDirectory } from '../../utils/filesys'

const Explorer: FC<ExplorerProps> = (props) => {
  const { t } = useTranslation()
  const { folderData, setFolderData } = useEditorStore()
  const [selectedPath, setSelectedPath] = useState<string>()
  const [popperOpen, setPopperOpen] = useState(false)
  const [cache] = useGlobalCacheData()

  useEffect(() => {
    const unListen = appWindow.listen('file_save', async () => {
      const content = DataCenter.getData('markdownContent')
      if (!selectedPath) {
        save({
          title: 'My wonderful save dialog',
          defaultPath: `${t('file.untitled')}.md`,
        }).then((path) => {
          if (path === null) return
          writeTextFile(path, content)
        })
      }
      try {
        writeTextFile(selectedPath!, content)
      } catch (error) {
        console.error(error)
      }
    })
    return () => {
      unListen.then((fn) => fn())
    }
  }, [selectedPath, t])

  useEffect(() => {
    emit(EVENT.selected_file, selectedPath)
  }, [selectedPath])

  const handleSelect = async (item: IFile) => {
    if (item.kind === 'dir') return

    setSelectedPath(item?.path)
    appWindow.setTitle(item?.name || APP_NAME)
    const text = await readTextFile(item.path)
    DataCenter.setRenderEditorContent(text)
  }

  const openRir = async (dir: string) => {
    try {
      // const res = await readDir(dir, { recursive: true})
      const res = await readDirectory(dir)
      CacheManager.writeCache('openFolderHistory', { path: dir, time: dayjs() })
      setFolderData(res)
    } catch (error) {
      console.error('error', error)
    }
  }

  const handleOpenDirClick = async () => {
    const dir = await open({ directory: true, recursive: true })

    if (typeof dir !== 'string') return
    openRir(dir)
  }

  const handleOpenHistoryListItemClick = useCallback((item: ListDataItem) => {
    openRir(item.title)
  }, [])

  const listData = useMemo(() => cache.openFolderHistory.map((history) => ({ key: history.time, title: history.path, iconName: 'folder' })), [cache])

  const containerCLs = classNames('w-full flex flex-col', props.className)

  return (
    <Container className={containerCLs}>
      <div className="border-b-1-solid flex justify-between items-center px-4 py-1">
        <small>EXPLORER</small>
        <div className="flex"></div>
      </div>
      <div className="h-full w-full">{folderData ? <FileTree className="flex-1" data={folderData} selectedPath={selectedPath} onSelect={handleSelect}></FileTree> : <Empty />}</div>
      <div className="border-t-1-solid flex justify-between items-center px-4 py-1">
        <small className="flex-1 cursor-pointer" onClick={handleOpenDirClick}>
          {t('file.openDir')}
        </small>
        <Popper placement="top-end" onClickAway={() => setPopperOpen(false)} open={popperOpen} content={<List title="最近打开的文件夹" data={listData} onItemClick={handleOpenHistoryListItemClick} />}>
          <Icon name="moreVertical" iconProps={{ className: 'w-20px h-20px icon-hover cursor-pointer', onClick: () => setPopperOpen(true) }} />
        </Popper>
      </div>
    </Container>
  )
}

interface ExplorerProps {
  className?: string
}

export default memo(Explorer)
