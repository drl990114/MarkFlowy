import { getFileObject } from '@/utils/files'
import { Empty, FileTree, Icon, List, Popper } from '@components'
import { APP_NAME } from '@constants'
import { useGlobalCacheData } from '@hooks'
import { useEditorStore } from '@stores'
import { open, save } from '@tauri-apps/api/dialog'
import { writeTextFile } from '@tauri-apps/api/fs'
import { appWindow } from '@tauri-apps/api/window'
import { CacheManager } from '@utils'
import classNames from 'classnames'
import dayjs from 'dayjs'
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { IFile, readDirectory } from '../../utils/filesys'
import { ListDataItem } from '../List'
import { Container } from './styles'

const Explorer: FC<ExplorerProps> = (props) => {
  const { t } = useTranslation()
  const { folderData, activeId, setFolderData, addOpenedFile, setActiveId, getEditorContent } = useEditorStore()
  const [popperOpen, setPopperOpen] = useState(false)
  const [cache] = useGlobalCacheData()

  useEffect(() => {
    const unListen = appWindow.listen('file_save', async () => {
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
      unListen.then((fn) => fn())
    }
  }, [activeId, t])

  const handleSelect = (item: IFile) => {
    if (item.kind === 'dir') return

    addOpenedFile(item.id)
    setActiveId(item.id)
    appWindow.setTitle(item?.name || APP_NAME)
  }

  const openRir = async (dir: string) => {
    try {
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

  const listData = useMemo(() => cache.openFolderHistory.map((history: { time: string; path: string }) => ({ key: history.time, title: history.path, iconName: 'folder' })), [cache])

  const containerCLs = classNames('w-full flex flex-col', props.className)

  return (
    <Container className={containerCLs}>
      <div className="border-b-1-solid flex justify-between items-center px-4 py-1">
        <small>EXPLORER</small>
        <div className="flex"></div>
      </div>
      <div className="h-full w-full">{folderData ? <FileTree className="flex-1" data={folderData} activeId={activeId} onSelect={handleSelect}></FileTree> : <Empty />}</div>
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
