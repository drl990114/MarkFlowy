import classNames from 'classnames'
import type { FC } from 'react'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ListDataItem } from '../List'
import { Container } from './styles'
import { useEditorStore } from '@/stores'
import type { IFile } from '@/helper/filesys'
import { useGlobalCacheData, useOpen } from '@/hooks'
import { CacheManager } from '@/helper'
import { Empty, FileTree, List, Popper } from '@/components'
import styled from 'styled-components'

const RecentListBottom = styled.div`
  padding: 8px;
  font-size: 0.7rem;
  cursor: pointer;
  text-align: center;

  &:hover {
    background-color: ${(props) => props.theme.tipsBgColor};
  }
`

const Explorer: FC<ExplorerProps> = (props) => {
  const { t } = useTranslation()
  const { folderData, activeId, addOpenedFile, setActiveId } = useEditorStore()
  const [popperOpen, setPopperOpen] = useState(false)
  const [cache] = useGlobalCacheData()
  const { openFolderDialog, openFolder } = useOpen()

  const handleSelect = (item: IFile) => {
    if (item.kind === 'dir') return

    addOpenedFile(item.id)
    setActiveId(item.id)
  }

  const handleClearRecent = () => {
    CacheManager.writeCache('openFolderHistory', [])
    setPopperOpen(false)
  }

  const handleOpenHistoryListItemClick = useCallback(
    (item: ListDataItem) => {
      openFolder(item.title)
      setPopperOpen(false)
    },
    [openFolder],
  )

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
    <Container className={containerCLs} onContextMenu={e => e.preventDefault()}>
      {/* <SideBarHeader name='EXPLORER' /> */}
      <div className='h-full w-full overflow-auto'>
        {folderData && folderData.length > 0 ? (
          <FileTree
            className='flex-1'
            data={folderData}
            activeId={activeId}
            onSelect={handleSelect}
          />
        ) : (
          <Empty />
        )}
      </div>
      <div className='explorer-bottom'>
        <small className='flex-1 cursor-pointer' onClick={openFolderDialog}>
          {t('file.openDir')}
        </small>
        <Popper
          placement='top-end'
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
          {listData.length > 0 ? (
            <i
              className='ri-more-2-fill icon-border cursor-pointer'
              onClick={() => setPopperOpen(true)}
            />
          ) : null}
        </Popper>
      </div>
    </Container>
  )
}

interface ExplorerProps {
  className?: string
}

export default memo(Explorer)
