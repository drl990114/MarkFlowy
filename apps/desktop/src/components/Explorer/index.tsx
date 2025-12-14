import { Empty, FileTree, List } from '@/components'
import type { IFile } from '@/helper/filesys'
import { useOpen } from '@/hooks'
import { createNewWindow } from '@/services/windows'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { homeDir } from '@tauri-apps/api/path'
import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'
import { Popover } from 'zens'
import type { ListDataItem } from '../UI/List'
import { Container } from './styles'

const RecentListBottom = styled.div`
  padding: 8px;
  font-size: 0.7rem;
  cursor: pointer;
  text-align: center;
  color: ${(props) => props.theme.labelFontColor};

  &:hover {
    background-color: ${(props) => props.theme.tipsBgColor};
  }
`

const shortenPath = (path: string, homePath: string) => {
  if (!homePath) return path
  if (path === homePath) return '~'
  if (path.startsWith(homePath)) {
    const nextChar = path[homePath.length]
    if (nextChar === '/' || nextChar === '\\') {
      return `~${path.slice(homePath.length)}`
    }
  }
  return path
}

const getFolderName = (path: string) => {
  if (!path) return ''
  // Remove trailing separator if exists
  const normalized = path.replace(/[/\\]$/, '')
  const match = normalized.match(/[^/\\]+$/)
  return match ? match[0] : normalized
}

const Explorer: FC<ExplorerProps> = (props) => {
  const { t } = useTranslation()
  const { folderData, activeId, addOpenedFile, setActiveId } = useEditorStore()
  const [popperOpen, setPopperOpen] = useState(false)
  const { recentWorkspaces, clearRecentWorkspaces } = useOpenedCacheStore()
  const { openFolderDialog, openFolder } = useOpen()
  const [dndRootElement, setDndRootElement] = useState<HTMLDivElement | null>(null)
  const [homePath, setHomePath] = useState<string>('')

  useEffect(() => {
    homeDir().then(setHomePath)
  }, [])

  const handleSelect = (item: IFile) => {
    if (item?.kind !== 'file') return

    addOpenedFile(item.id)
    setActiveId(item.id)
  }

  const handleClearRecent = () => {
    clearRecentWorkspaces()
    setPopperOpen(false)
  }

  const handleOpenHistoryListItemClick = useCallback(
    (item: ListDataItem) => {
      createNewWindow({ path: item.key as string })
      // openFolder(item.key as string)
      setPopperOpen(false)
    },
    [openFolder],
  )

  const handleContextMenu: MouseEventHandler = useCallback((e) => e.preventDefault(), [])

  const listData = useMemo(
    () =>
      recentWorkspaces.map((history: { path: string }) => ({
        key: history.path,
        title: getFolderName(history.path),
        tooltip: shortenPath(history.path, homePath),
        iconCls: 'ri-folder-5-line',
      })),
    [recentWorkspaces, homePath],
  )

  const containerCLs = classNames(props.className)

  return (
    <Container className={containerCLs} onContextMenu={handleContextMenu}>
      <div className='h-full w-full overflow-hidden' ref={ref => setDndRootElement(ref)}>
        {folderData && folderData.length > 0 ? (
          <FileTree
            data={folderData}
            activeId={activeId}
            onSelect={handleSelect}
            dndRootElement={dndRootElement as unknown as Node}
          />
        ) : (
          <Empty />
        )}
      </div>
      <div className='explorer-bottom'>
        <span className='explorer-bottom__action cursor-pointer' onClick={openFolderDialog}>
          {t('file.openDir')}
        </span>
        <Popover
          arrow
          fixed
          style={{ zIndex: 9999 }}
          open={popperOpen}
          onClose={() => setPopperOpen(false)}
          placement='top-end'
          customContent={
            <>
              <List
                title={t('file.recentDir')}
                data={listData}
                onItemClick={handleOpenHistoryListItemClick}
              />
              <RecentListBottom onClick={handleClearRecent}>{t('file.clearRecent')}</RecentListBottom>
            </>
          }
        >
          {listData.length > 0 ? (
            <i
              className='ri-more-2-fill explorer-bottom__action__icon'
              onClick={() => setPopperOpen(true)}
            />
          ) : null}
        </Popover>
      </div>
    </Container>
  )
}

interface ExplorerProps {
  className?: string
}

export default memo(Explorer)
