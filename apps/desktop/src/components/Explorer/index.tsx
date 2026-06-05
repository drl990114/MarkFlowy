import { Empty, List, FileTree, ContextMenuItem } from '@markflowy/interface'
import type { IFile } from '@/helper/filesys'
import { useOpen } from '@/hooks'
import { dialog } from '@/services/dialog'
import { createNewWindow } from '@/services/windows'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { homeDir } from '@tauri-apps/api/path'
import { Popover } from 'antd'
import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from '@/i18n'
import styled from 'styled-components'
import type { ListDataItem } from '../ui-v2/List'
import { Container } from './styles'
import { FillFlexParent } from '../fill-flex-parent'
import { showContextMenu } from '../ui-v2/ContextMenu'
import { MfIconButton } from '../ui-v2/Button'
import { getFileObject, getFileObjectByPath, setFileObject, setFileObjectByPath, deletePathEntry } from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'

const RecentListBottom = styled.div`
  padding: 4px 8px;
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
  const { folderData, addOpenedFile, setActiveId } = useEditorStore()
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
  }

  const handleOpenHistoryListItemClick = useCallback(
    (item: ListDataItem) => {
      createNewWindow({ path: item.key as string })
      // openFolder(item.key as string)
    },
    [openFolder],
  )

  const handleContextMenu: MouseEventHandler = useCallback((e) => e.preventDefault(), [])

  const handleShowConfirm = useCallback(async ({ title, onConfirm }: { title: string; onConfirm: () => void }) => {
    const action = await dialog.confirm({
      title,
      actions: [
        { id: 'cancel', label: t('common.cancel') },
        { id: 'confirm', label: t('common.confirm'), primary: true },
      ],
    })

    if (action === 'confirm') {
      onConfirm()
    }
  }, [t])

  const handleShowInputConfirm = useCallback(({
    title,
    confirmText,
    cancelText,
    onConfirm,
    onClose,
  }: {
    title: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void
    onClose: () => void
  }) => {
    dialog.confirm({
      title,
      actions: [
        { id: 'cancel', label: cancelText ?? t('common.cancel') },
        { id: 'confirm', label: confirmText ?? t('common.confirm'), primary: true },
      ],
    }).then((action) => {
      if (action === 'confirm') {
        onConfirm()
        return
      }
      onClose()
    })
  }, [t])

  const handleShowContextMenu = useCallback(({ x, y, items }: { x: number; y: number; items: ContextMenuItem[] }) => {
    showContextMenu({
      x,
      y,
      items: items.map(item => ({
        label: item.label,
        value: item.value,
        handler: item.handler,
      })),
    })
  }, [])

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
      <div className='h-full w-full overflow-hidden' ref={(ref) => setDndRootElement(ref)}>
        {folderData && folderData.length > 0 ? (
          <FileTree
            data={folderData}
            onSelect={handleSelect}
            dndRootElement={dndRootElement as unknown as Node}
            fillFlexParentComponent={FillFlexParent as FC<{ children: (dimens: { width: number; height: number }) => React.ReactNode }>}
            onShowConfirm={handleShowConfirm}
            onShowInputConfirm={handleShowInputConfirm}
            onShowContextMenu={handleShowContextMenu}
            getFileObject={getFileObject}
            getFileObjectByPath={getFileObjectByPath}
            setFileObject={setFileObject}
            setFileObjectByPath={setFileObjectByPath}
            deletePathEntry={deletePathEntry}
            createFile={createFile}
            updateFile={updateFile}
            iconButtonComponent={MfIconButton}
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
          classNames={{
            container: 'popover',
          }}
          placement='bottomRight'
          content={
            <>
              <List
                title={t('file.recentDir')}
                data={listData}
                onItemClick={handleOpenHistoryListItemClick}
              />
              <RecentListBottom onClick={handleClearRecent}>
                {t('file.clearRecent')}
              </RecentListBottom>
            </>
          }
        >
          {listData.length > 0 ? (
            <i className='ri-more-2-fill explorer-bottom__action__icon' />
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
