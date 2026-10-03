import { Button } from '@/components/ui/button'
import { Command } from '@/components/ui/command'
import { Popover } from '@/components/ui/popover'
import { getFileNameFromPath } from '@/helper/filesys'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import useOpen from '@/hooks/useOpen'
import { useTranslation } from '@/i18n'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import useRecentFilesStore from '@/stores/useRecentFilesStore'
import { CheckIcon, FileIcon, FolderIcon, FolderOpenIcon } from 'lucide-react'
import { toast } from 'zens'
import { useMemo, useState } from 'react'
import { StatusBarButton } from './StatusBar/StatusBarButton'

const MAX_VISIBLE_RECENT_WORKSPACES = 8
const MAX_VISIBLE_RECENT_FILES = 8

type WorkspaceActionsLocation = 'statusbar' | 'titlebar'

type WorkspaceActionsProps = {
  location?: WorkspaceActionsLocation
}

export function WorkspaceActions({ location = 'titlebar' }: WorkspaceActionsProps) {
  const { t } = useTranslation()
  const { openFolder, openFolderDialog, closeFolder, openFile, openFilePath } = useOpen()
  const rootPath = useEditorStore((state) => state.folderData?.[0]?.path)
  const recentWorkspaces = useOpenedCacheStore((state) => state.recentWorkspaces)
  const clearRecentWorkspaces = useOpenedCacheStore((state) => state.clearRecentWorkspaces)
  const recentFiles = useRecentFilesStore((state) => state.entries)
  const replaceRecentFiles = useRecentFilesStore((state) => state.replaceEntries)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const pickerLabel = t('workspace.openFileOrFolder')
  const workspaceLabel = (rootPath && getFileNameFromPath(rootPath)) || t('file.openDir')
  const visibleRecentFiles = useMemo(
    () => recentFiles.flatMap(({ path }) => (path ? [path] : [])).slice(0, MAX_VISIBLE_RECENT_FILES),
    [recentFiles],
  )
  const visibleRecentWorkspaces = useMemo(() => {
    const rootKey = rootPath ? getPathIdentityKey(rootPath) : undefined
    const seenPaths = new Set<string>()

    return recentWorkspaces
      .filter(({ path }) => {
        const pathKey = getPathIdentityKey(path)
        if (!pathKey || pathKey === rootKey || seenPaths.has(pathKey)) return false
        seenPaths.add(pathKey)
        return true
      })
      .slice(0, MAX_VISIBLE_RECENT_WORKSPACES)
  }, [recentWorkspaces, rootPath])

  const handleOpenRecent = (path: string) => {
    setIsPickerOpen(false)
    void openFolder(path)
  }

  const handleOpenFolder = () => {
    setIsPickerOpen(false)
    void openFolderDialog().catch((error) => toast.error(String(error)))
  }

  const handleOpenFile = (path?: string) => {
    setIsPickerOpen(false)
    void (path ? openFilePath(path) : openFile()).catch((error) => toast.error(String(error)))
  }

  const handleClearRecent = () => {
    setIsPickerOpen(false)
    replaceRecentFiles([])
    void clearRecentWorkspaces().catch((error) => toast.error(String(error)))
  }

  const triggerContent = (
    <FolderOpenIcon aria-hidden='true' className='size-3.5' strokeWidth={1.75} />
  )

  return (
    <Popover.Root open={isPickerOpen} onOpenChange={setIsPickerOpen}>
      <Popover.Trigger asChild>
        {location === 'statusbar' ? (
          <StatusBarButton
            aria-expanded={isPickerOpen}
            aria-label={pickerLabel}
            data-slot='workspace-picker-trigger'
            format='icon'
            title={rootPath ? `${pickerLabel}\n${rootPath}` : pickerLabel}
          >
            {triggerContent}
          </StatusBarButton>
        ) : (
          <Button
            aria-expanded={isPickerOpen}
            aria-label={pickerLabel}
            data-slot='workspace-picker-trigger'
            size='icon-chrome'
            title={rootPath ? `${pickerLabel}\n${rootPath}` : pickerLabel}
            variant='chrome'
          >
            {triggerContent}
          </Button>
        )}
      </Popover.Trigger>
      <Popover.Content
        align='start'
        aria-label={pickerLabel}
        className='w-[min(360px,calc(100vw-16px))] overflow-hidden p-0'
        side='bottom'
      >
        <Command.Root label={pickerLabel}>
          <Command.Input autoFocus placeholder={t('workspace.searchPlaceholder')} />
          <Command.List className='max-h-72'>
            <Command.Empty>{t('search.search_empty')}</Command.Empty>
            {rootPath ? (
              <Command.Group heading={t('file.openFolderModal.currentWindow')}>
                <Command.Item
                  className='gap-2'
                  keywords={[workspaceLabel, rootPath]}
                  onSelect={() => setIsPickerOpen(false)}
                  title={rootPath}
                  value={`current:${rootPath}`}
                >
                  <FolderIcon aria-hidden='true' className='size-3.5 text-muted-foreground' />
                  <span className='min-w-0 flex-1 truncate font-medium'>{workspaceLabel}</span>
                  <CheckIcon
                    aria-hidden='true'
                    className='ml-auto size-3.5 shrink-0 text-primary'
                    strokeWidth={1.75}
                  />
                </Command.Item>
              </Command.Group>
            ) : null}
            {visibleRecentWorkspaces.length > 0 ? (
              <Command.Group heading={t('welcome.recentWorkspaces')}>
                {visibleRecentWorkspaces.map(({ path }) => (
                  <Command.Item
                    className='items-start gap-2'
                    key={path}
                    keywords={[getFileNameFromPath(path) || path, path]}
                    onSelect={() => handleOpenRecent(path)}
                    title={path}
                    value={`recent:${path}`}
                  >
                    <FolderIcon
                      aria-hidden='true'
                      className='mt-0.5 size-3.5 shrink-0 text-muted-foreground'
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-ui-control text-content-primary'>
                        {getFileNameFromPath(path) || path}
                      </span>
                      <span className='block truncate text-ui-caption text-content-muted' dir='ltr'>
                        {path}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
            {visibleRecentFiles.length > 0 ? (
              <Command.Group heading={t('workspace.recentFiles')}>
                {visibleRecentFiles.map((path) => (
                  <Command.Item
                    className='items-start gap-2'
                    key={path}
                    keywords={[getFileNameFromPath(path) || path, path]}
                    onSelect={() => handleOpenFile(path)}
                    title={path}
                    value={`file:${path}`}
                  >
                    <FileIcon
                      aria-hidden='true'
                      className='mt-0.5 size-3.5 shrink-0 text-muted-foreground'
                    />
                    <span className='min-w-0 flex-1'>
                      <span className='block truncate text-ui-control text-content-primary'>
                        {getFileNameFromPath(path) || path}
                      </span>
                      <span className='block truncate text-ui-caption text-content-muted' dir='ltr'>
                        {path}
                      </span>
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            ) : null}
          </Command.List>
        </Command.Root>
        <div className='border-t border-border p-1'>
          <Button
            className='h-7 w-full justify-start rounded-sm px-2 text-ui-control font-normal'
            onClick={() => handleOpenFile()}
            size='sm'
            variant='ghost'
          >
            <FileIcon aria-hidden='true' className='size-3.5 text-muted-foreground' />
            {t('file.openFile')}
          </Button>
          <Button
            className='h-7 w-full justify-start rounded-sm px-2 text-ui-control font-normal'
            onClick={handleOpenFolder}
            size='sm'
            variant='ghost'
          >
            <FolderOpenIcon aria-hidden='true' className='size-3.5 text-muted-foreground' />
            {t('file.openDir')}
          </Button>
          <Button
            className='h-7 w-full justify-start rounded-sm px-2 text-ui-control font-normal'
            size='sm'
            variant='ghost'
            onClick={() => {
              setIsPickerOpen(false)
              void openFolderDialog('new').catch((error) => toast.error(String(error)))
            }}
          >
            {t('file.openFolderInNewWindow')}
          </Button>
          {rootPath ? (
            <Button
              className='h-7 w-full justify-start rounded-sm px-2 text-ui-control font-normal'
              size='sm'
              variant='ghost'
              onClick={() => {
                setIsPickerOpen(false)
                void closeFolder().catch((error) => toast.error(String(error)))
              }}
            >
              {t('file.closeFolder')}
            </Button>
          ) : null}
          {visibleRecentWorkspaces.length > 0 || visibleRecentFiles.length > 0 ? (
            <Button
              className='h-7 w-full justify-start rounded-sm px-2 text-ui-control font-normal text-content-secondary'
              onClick={handleClearRecent}
              size='sm'
              variant='ghost'
            >
              {t('file.clearRecent')}
            </Button>
          ) : null}
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}
