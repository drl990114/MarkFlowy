import { Empty, FileTree, ContextMenuItem } from '@markflowy/interface'
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
import { Tooltip } from 'zens'
import { Container } from './styles'
import { FillFlexParent } from '../fill-flex-parent'
import { showContextMenu } from '../ui-v2/ContextMenu'
import { MfIconButton } from '../ui-v2/Button'
import {
  getFileObject,
  getFileObjectByPath,
  setFileObject,
  setFileObjectByPath,
  deletePathEntry,
} from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'

const RecentListBottom = styled.button`
  width: 100%;
  margin-top: 4px;
  padding: 5px 6px;
  border-top: 1px solid ${(props) => props.theme.borderColor};
  border-right: 0;
  border-bottom: 0;
  border-left: 0;
  font-size: ${(props) => props.theme.fontXs};
  font-family: inherit;
  cursor: pointer;
  text-align: center;
  background: transparent;
  color: ${(props) => props.theme.labelFontColor};
  border-radius: 0 0 6px 6px;
  transition:
    background-color 0.2s ease,
    color 0.2s ease;

  &:hover {
    background-color: ${(props) => props.theme.hoverColor};
    color: ${(props) => props.theme.primaryFontColor};
  }

  &:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }
`

const RecentWorkspacesContent = styled.div`
  width: 220px;
  padding: 6px;

  .recent-workspaces__title {
    margin: 1px 4px 5px;
    color: ${(props) => props.theme.labelFontColor};
    font-size: ${(props) => props.theme.fontXs};
    font-weight: 600;
    line-height: 1.4;
  }

  .recent-workspaces__list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .recent-workspaces__item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border: 1px solid transparent;
    border-radius: 6px;
    background: transparent;
    color: ${(props) => props.theme.primaryFontColor};
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .recent-workspaces__item:hover {
    background-color: ${(props) => props.theme.hoverColor};
    border-color: ${(props) => props.theme.borderColor};
  }

  .recent-workspaces__item:focus-visible {
    outline: 2px solid ${(props) => props.theme.accentColor};
    outline-offset: 2px;
  }

  .recent-workspaces__icon {
    flex: 0 0 auto;
    width: 16px;
    color: ${(props) => props.theme.labelFontColor};
    font-size: 16px;
    line-height: 1;
  }

  .recent-workspaces__text {
    min-width: 0;
    flex: 1;
  }

  .recent-workspaces__name {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-weight: 500;
    line-height: 1.3;
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
  const { openFolderDialog } = useOpen()
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

  const handleOpenHistoryListItemClick = useCallback((path: string) => {
    createNewWindow({ path })
  }, [])

  const handleContextMenu: MouseEventHandler = useCallback((e) => e.preventDefault(), [])

  const handleShowConfirm = useCallback(
    async ({ title, onConfirm }: { title: string; onConfirm: () => void }) => {
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
    },
    [t],
  )

  const handleShowInputConfirm = useCallback(
    ({
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
      dialog
        .confirm({
          title,
          actions: [
            { id: 'cancel', label: cancelText ?? t('common.cancel') },
            { id: 'confirm', label: confirmText ?? t('common.confirm'), primary: true },
          ],
        })
        .then((action) => {
          if (action === 'confirm') {
            onConfirm()
            return
          }
          onClose()
        })
    },
    [t],
  )

  const handleShowContextMenu = useCallback(
    ({ x, y, items }: { x: number; y: number; items: ContextMenuItem[] }) => {
      showContextMenu({
        x,
        y,
        items: items.map((item) => ({
          label: item.label,
          value: item.value,
          handler: item.handler,
        })),
      })
    },
    [],
  )

  const recentWorkspaceItems = useMemo(
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
            fillFlexParentComponent={
              FillFlexParent as FC<{
                children: (dimens: { width: number; height: number }) => React.ReactNode
              }>
            }
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
          styles={{
            content: {
              padding: 0,
            },
          }}
          placement='bottomRight'
          content={
            <RecentWorkspacesContent>
              <h5 className='recent-workspaces__title'>{t('file.recentDir')}</h5>
              <div className='recent-workspaces__list'>
                {recentWorkspaceItems.map((item) => (
                  <Tooltip key={item.key} title={item.tooltip} skipTimeout={0} placement='right'>
                    <button
                      type='button'
                      className='recent-workspaces__item'
                      onClick={() => handleOpenHistoryListItemClick(item.key)}
                    >
                      <i className={`${item.iconCls} recent-workspaces__icon`} aria-hidden='true' />
                      <span className='recent-workspaces__text'>
                        <span className='recent-workspaces__name'>{item.title}</span>
                      </span>
                    </button>
                  </Tooltip>
                ))}
              </div>
              <RecentListBottom type='button' onClick={handleClearRecent}>
                {t('file.clearRecent')}
              </RecentListBottom>
            </RecentWorkspacesContent>
          }
        >
          {recentWorkspaceItems.length > 0 ? (
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
