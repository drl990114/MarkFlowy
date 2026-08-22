import { Button } from '@/components/ui/button'
import { Command } from '@/components/ui/command'
import { Popover } from '@/components/ui/popover'
import { getFileNameFromPath } from '@/helper/filesys'
import { getPathIdentityKey } from '@/helper/pathIdentity'
import useOpen from '@/hooks/useOpen'
import { useTranslation } from '@/i18n'
import { useEditorStore } from '@/stores'
import useOpenedCacheStore from '@/stores/useOpenedCacheStore'
import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { StatusBarButton } from './StatusBar/StatusBarButton'

const MAX_VISIBLE_RECENT_WORKSPACES = 8

type WorkspaceActionsLocation = 'statusbar' | 'titlebar'

type WorkspaceActionsProps = {
  location?: WorkspaceActionsLocation
}

export function WorkspaceActions({ location = 'titlebar' }: WorkspaceActionsProps) {
  const { t } = useTranslation()
  const { openFolder, openFolderDialog } = useOpen()
  const rootPath = useEditorStore((state) => state.folderData?.[0]?.path)
  const recentWorkspaces = useOpenedCacheStore((state) => state.recentWorkspaces)
  const clearRecentWorkspaces = useOpenedCacheStore((state) => state.clearRecentWorkspaces)
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const workspaceLabel = (rootPath && getFileNameFromPath(rootPath)) || t('file.openDir')
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
    void openFolderDialog()
  }

  const handleClearRecent = () => {
    setIsPickerOpen(false)
    void clearRecentWorkspaces()
  }

  const triggerContent = (
    <>
      <span className='truncate'>{workspaceLabel}</span>
      <ChevronDownIcon
        aria-hidden='true'
        className='size-3 shrink-0 opacity-60'
        strokeWidth={1.75}
      />
    </>
  )

  return (
    <Popover.Root open={isPickerOpen} onOpenChange={setIsPickerOpen}>
      <Popover.Trigger aria-haspopup='listbox' asChild>
        {location === 'statusbar' ? (
          <StatusBarButton
            aria-expanded={isPickerOpen}
            className='max-w-[180px] min-w-0'
            data-slot='workspace-picker-trigger'
            format='label'
            role='combobox'
            title={rootPath || t('file.openDir')}
          >
            {triggerContent}
          </StatusBarButton>
        ) : (
          <Button
            aria-expanded={isPickerOpen}
            className='h-[22px] max-w-[180px] min-w-0 gap-1 rounded-sm px-1.5 text-ui-caption font-normal text-content-secondary max-[719px]:max-w-[112px] [&_svg]:size-3'
            data-slot='workspace-picker-trigger'
            role='combobox'
            size='sm'
            title={rootPath || t('file.openDir')}
            variant='chrome'
          >
            {triggerContent}
          </Button>
        )}
      </Popover.Trigger>
      <Popover.Content
        align='start'
        aria-label={t('file.recentDir')}
        className='w-[min(360px,calc(100vw-16px))] overflow-hidden p-0'
        side='bottom'
      >
        <Command.Root label={t('file.recentDir')}>
          <Command.Input autoFocus placeholder={t('workspace.searchPlaceholder')} />
          <Command.List className='max-h-72'>
            <Command.Empty>{t('search.search_empty')}</Command.Empty>
            {rootPath ? (
              <Command.Group heading={t('file.openFolderModal.currentWindow')}>
                <Command.Item
                  className='gap-2'
                  keywords={[workspaceLabel, rootPath]}
                  onSelect={() => setIsPickerOpen(false)}
                  value={`current:${rootPath}`}
                >
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
                    value={`recent:${path}`}
                  >
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
          <div className='border-t border-border p-1'>
            <Button
              className='h-7 w-full justify-start rounded-sm px-2 text-ui-control font-normal'
              onClick={handleOpenFolder}
              size='sm'
              variant='ghost'
            >
              {t('file.openDir')}
            </Button>
            {visibleRecentWorkspaces.length > 0 ? (
              <Button
                className='h-7 w-full justify-start rounded-sm px-2 text-ui-caption font-normal text-content-secondary'
                onClick={handleClearRecent}
                size='sm'
                variant='ghost'
              >
                {t('file.clearRecent')}
              </Button>
            ) : null}
          </div>
        </Command.Root>
      </Popover.Content>
    </Popover.Root>
  )
}
