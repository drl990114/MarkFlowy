import { FileTree } from '@markflowy/interface'
import type { ContextMenuItem } from '@markflowy/interface'
import type { IFile } from '@/helper/filesys'
import { dialog } from '@/services/dialog'
import { getUnsavedFileIds } from '@/services/checkUnsavedFiles'
import { useEditorStore } from '@/stores'
import { closeCompactLeftDockAfterSelection } from '@/stores/useLayoutStore'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import {
  ChevronsUpIcon,
  EllipsisIcon,
  FileIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  FolderOpenIcon,
  LoaderCircleIcon,
  LocateFixedIcon,
  RefreshCwIcon,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Empty, EmptyTitle } from '@/components/ui/empty'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import classNames from 'classnames'
import type { FC, MouseEventHandler } from 'react'
import { memo, useCallback, useState } from 'react'
import { useTranslation } from '@/i18n'
import {
  Container,
  EXPLORER_FILE_TREE_INDENT_SIZE,
  EXPLORER_FILE_TREE_ROW_HEIGHT,
} from './styles'
import { FillFlexParent } from '../fill-flex-parent'
import { showContextMenu } from '../ui-v2/ContextMenu'
import type { MfIconButtonProps } from '../ui-v2/Button'
import {
  getFileObject,
  getFileObjectByPath,
  setFileObject,
  setFileObjectByPath,
  deletePathEntry,
  deleteFileObjectsByIds,
  deleteFileObjectsByPathPrefix,
  getFileIdsByPathPrefix,
  getReplacementTargetIds,
  moveFileObjectsByPathPrefix,
} from '@/helper/files'
import { createFile, updateFile } from '@/helper/filesys'

const fileTreeActionIcons: Record<string, LucideIcon> = {
  'ri-collapse-vertical-fill': ChevronsUpIcon,
  'ri-focus-3-line': LocateFixedIcon,
  'ri-refresh-line': RefreshCwIcon,
}

function ExplorerFileTreeActionButton(props: MfIconButtonProps) {
  const Icon = fileTreeActionIcons[props.icon] ?? EllipsisIcon
  const accessibleName =
    props.ariaLabel ??
    (typeof props.tooltipProps?.title === 'string' ? props.tooltipProps.title : undefined)
  const button = (
    <Button
      aria-label={accessibleName}
      aria-pressed={typeof props.active === 'boolean' ? props.active : undefined}
      className={props.className}
      data-mf-chrome-icon-button=''
      disabled={props.disabled}
      onClick={(event) => props.onClick(event)}
      size='icon-chrome'
      variant='chrome'
    >
      <Icon aria-hidden='true' size={14} strokeWidth={1.75} />
    </Button>
  )

  if (!props.tooltipProps?.title) return button

  const { title, ...contentProps } = props.tooltipProps
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent {...contentProps}>{title}</TooltipContent>
    </Tooltip>
  )
}

function renderExplorerNodeIcon(file: IFile, state: { isLoading: boolean; isOpen: boolean }) {
  if (state.isLoading) {
    return (
      <LoaderCircleIcon
        aria-hidden='true'
        className='animate-spin motion-reduce:animate-none'
        size={16}
        strokeWidth={1.75}
      />
    )
  }

  if (file.kind === 'dir') {
    const DirectoryIcon = state.isOpen ? FolderOpenIcon : FolderIcon
    return <DirectoryIcon aria-hidden='true' size={16} strokeWidth={1.75} />
  }

  const ext = file.ext?.toLowerCase()
  const DocumentIcon =
    ext === 'json' ? FileJsonIcon : ext === 'md' || ext === 'markdown' ? FileTextIcon : FileIcon
  return <DocumentIcon aria-hidden='true' size={16} strokeWidth={1.75} />
}

type ExplorerFileTreePresentation = {
  renderNodeIcon: typeof renderExplorerNodeIcon
  stickyRoot: boolean
  indentSize: number
  rowHeight: number
}

const explorerFileTreePresentation = {
  renderNodeIcon: renderExplorerNodeIcon,
  stickyRoot: true,
  indentSize: EXPLORER_FILE_TREE_INDENT_SIZE,
  rowHeight: EXPLORER_FILE_TREE_ROW_HEIGHT,
} satisfies ExplorerFileTreePresentation

const Explorer: FC<ExplorerProps> = (props) => {
  const { t } = useTranslation()
  const { folderData, addOpenedFile, setActiveId } = useEditorStore()
  const [dndRootElement, setDndRootElement] = useState<HTMLDivElement | null>(null)

  const handleSelect = (item: IFile) => {
    if (item?.kind !== 'file') return

    addOpenedFile(item.id)
    setActiveId(item.id)
    if (closeCompactLeftDockAfterSelection()) scheduleActiveEditorFocus()
  }

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
        items,
      })
    },
    [],
  )

  const handleBeforeReplace = useCallback(
    async (path: string) => {
      const targetIds = await getReplacementTargetIds(path)
      const unsavedIds = getUnsavedFileIds(targetIds)
      if (unsavedIds.length === 0) return { allowed: true, targetIds }

      await dialog.info({
        title: t('confirm.close.title'),
        content: (
          <div>
            {t('confirm.close.description')}
            <div style={{ marginTop: '0.5em' }}>
              {unsavedIds.map((id) => (
                <div key={id}>{getFileObject(id)?.name}</div>
              ))}
            </div>
          </div>
        ),
      })
      return { allowed: false, targetIds }
    },
    [t],
  )

  const handleDeleteReplacedCache = useCallback((rootPath: string) => {
    const deletedIds = getFileIdsByPathPrefix(rootPath)
    const { delOpenedFile } = useEditorStore.getState()
    deletedIds.forEach((id) => delOpenedFile(id))
    deleteFileObjectsByPathPrefix(rootPath)
  }, [])

  const handleDeleteReplacedIds = useCallback((fileIds: string[]) => {
    const { delOpenedFile } = useEditorStore.getState()
    fileIds.forEach((id) => delOpenedFile(id))
    deleteFileObjectsByIds(fileIds)
  }, [])

  const containerCLs = classNames(props.className)
  const hasWorkspace = Boolean(folderData?.length)

  return (
    <Container className={containerCLs} onContextMenu={handleContextMenu}>
      <div className='min-h-0 w-full flex-1 overflow-hidden' ref={(ref) => setDndRootElement(ref)}>
        {hasWorkspace ? (
          <FileTree
            {...explorerFileTreePresentation}
            data={folderData ?? []}
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
            getFileIdsByPathPrefix={getFileIdsByPathPrefix}
            moveFileObjectsByPathPrefix={moveFileObjectsByPathPrefix}
            deleteFileObjectsByIds={handleDeleteReplacedIds}
            deleteFileObjectsByPathPrefix={handleDeleteReplacedCache}
            onBeforeReplace={handleBeforeReplace}
            createFile={createFile}
            updateFile={updateFile}
            iconButtonComponent={ExplorerFileTreeActionButton}
          />
        ) : (
          <Empty role='status'>
            <EmptyTitle>{t('workspace.none')}</EmptyTitle>
          </Empty>
        )}
      </div>
    </Container>
  )
}

interface ExplorerProps {
  className?: string
}

export default memo(Explorer)
