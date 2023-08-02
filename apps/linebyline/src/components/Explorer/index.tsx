import { open } from '@tauri-apps/api/dialog'
import classNames from 'classnames'
import dayjs from 'dayjs'
import type { FC } from 'react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListDataItem } from '../List'
import { Container } from './styles'
import { useEditorStore } from '@/stores'
import { readDirectory } from '@/helper/filesys'
import type { IFile } from '@/helper/filesys'
import { useGlobalCacheData } from '@/hooks'
import { CacheManager } from '@/helper'
import { Empty, FileTree, List, Popper } from '@/components'
import styled from 'styled-components'

const RecentListBottom = styled.div`
  padding: 8px;
  font-size: 0.7rem;
  cursor: pointer;
  text-align: center;

  &:hover {
    background-color: ${props => props.theme.tipsBgColor};
  }
`

const Explorer: FC<ExplorerProps> = (props) => {
  const { t } = useTranslation()
  const { folderData, activeId, setFolderData, addOpenedFile, setActiveId } = useEditorStore()
  const [popperOpen, setPopperOpen] = useState(false)
  const [cache] = useGlobalCacheData()

  const handleSelect = (item: IFile) => {
    if (item.kind === 'dir') return

    addOpenedFile(item.id)
    setActiveId(item.id)
  }

  const openRir = useCallback(async (dir: string) => {
    try {
      const res = await readDirectory(dir)
      CacheManager.writeCache('openFolderHistory', { path: dir, time: dayjs() })
      setFolderData(res)
    } catch (error) {
      console.error('error', error)
    }
  }, [setFolderData])

  const handleClearRecent = () => {
    CacheManager.writeCache('openFolderHistory', [])
    setPopperOpen(false)
  }

  const handleOpenDirClick = async () => {
    const dir = await open({ directory: true, recursive: true })

    if (typeof dir !== 'string') return
    openRir(dir)
  }

  const handleOpenHistoryListItemClick = useCallback((item: ListDataItem) => {
    openRir(item.title)
    setPopperOpen(false)
  }, [openRir])

  const listData = useMemo(
    () =>
      cache.openFolderHistory.map((history: { time: string; path: string }) => ({
        key: history.time,
        title: history.path,
        iconCls: 'ri-folder-5-line',
      })),
    [cache],
  )

  const containerCLs = classNames(props.className)

  return (
    <Container className={containerCLs}>
      <div className="explorer-header">
        <small>EXPLORER</small>
        <div className="flex" />
      </div>
      <div className="h-full w-full overflow-auto">
        {folderData && folderData.length > 1 ? (
          <FileTree
            className="flex-1"
            data={folderData}
            activeId={activeId}
            onSelect={handleSelect}
          />
        ) : (
          <Empty />
        )}
      </div>
      <div className="explorer-bottom">
        <small className="flex-1 cursor-pointer" onClick={handleOpenDirClick}>
          {t('file.openDir')}
        </small>
        <Popper
          placement="top-end"
          onClickAway={() => setPopperOpen(false)}
          open={popperOpen}
          content={
            <>
              <List
                title={t('file.recentDir')}
                data={listData}
                onItemClick={handleOpenHistoryListItemClick}
              />
              <RecentListBottom onClick={handleClearRecent}>Clear Recent</RecentListBottom>
            </>
          }
        >
         {listData.length > 0 ? <i
            className="ri-more-2-fill icon-border cursor-pointer"
            onClick={() => setPopperOpen(true)}
          /> : null}
        </Popper>
      </div>
    </Container>
  )
}

interface ExplorerProps {
  className?: string
}

export default memo(Explorer)
