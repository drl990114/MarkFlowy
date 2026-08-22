import { keybindingRegistry } from '@/commands'
import { Button } from '@/components/ui/button'
import EVENT from '@/constants/event'
import { useOpen } from '@/hooks'
import { useTranslation } from '@/i18n'
import { addNewMarkdownFileEdit } from '@/services/editor-file'
import { useEditorStore } from '@/stores'
import { FileTextIcon, FolderOpenIcon, PlusIcon, type LucideIcon } from 'lucide-react'
import { memo, useMemo } from 'react'

export type EmptyStateMode = 'no-workspace' | 'empty-editor'

export function getEmptyStateMode(rootPath?: string): EmptyStateMode {
  return rootPath ? 'empty-editor' : 'no-workspace'
}

export const EmptyState = memo(() => {
  const rootPath = useEditorStore((state) => state.folderData?.[0]?.path)

  return <CompactEmptyState mode={getEmptyStateMode(rootPath)} />
})

function CompactEmptyState({ mode }: { mode: EmptyStateMode }) {
  const { t } = useTranslation()
  const { openFile, openFolderDialog } = useOpen()
  const openFolderShortcut = keybindingRegistry.formatKeybinding(EVENT.app_openFolder)
  const actions = useMemo<EmptyStateAction[]>(() => {
    const sharedActions: EmptyStateAction[] = [
      {
        id: 'new-file',
        label: t('action.create_file'),
        icon: PlusIcon,
        onSelect: createNewMarkdownFile,
      },
    ]

    if (mode === 'no-workspace') {
      sharedActions.push({
        id: 'open-folder',
        label: t('file.openDir'),
        icon: FolderOpenIcon,
        onSelect: openFolderDialog,
        shortcut: openFolderShortcut,
      })
    }

    sharedActions.push({
      id: 'open-file',
      label: t('file.openFile'),
      icon: FileTextIcon,
      onSelect: openFile,
    })

    return sharedActions
  }, [mode, openFile, openFolderDialog, openFolderShortcut, t])
  const statusLabel = mode === 'no-workspace' ? t('workspace.none') : t('file.emptyOpened')

  return (
    <section
      className='box-border flex h-full min-h-0 w-full items-center justify-center overflow-y-auto bg-surface-app px-5 py-8 text-content-primary'
      data-mf-empty-state={mode}
      data-slot={mode}
    >
      <div className='w-full max-w-60'>
        <p className='m-0 mb-1.5 px-2 text-ui-caption text-content-muted' role='status'>
          {statusLabel}
        </p>
        <div aria-label={t('welcome.getStarted')} className='flex flex-col' role='group'>
          {actions.map((action) => (
            <EmptyStateActionButton action={action} key={action.id} />
          ))}
        </div>
      </div>
    </section>
  )
}

interface EmptyStateAction {
  icon: LucideIcon
  id: string
  label: string
  onSelect: () => void | Promise<void>
  shortcut?: string
}

function EmptyStateActionButton({ action }: { action: EmptyStateAction }) {
  const Icon = action.icon

  return (
    <Button
      className='h-8 w-full justify-between rounded-sm px-2 text-ui-control font-normal text-content-primary'
      onClick={() => void action.onSelect()}
      variant='ghost'
    >
      <span className='flex min-w-0 items-center gap-2'>
        <Icon
          aria-hidden='true'
          className='size-3.5 shrink-0 text-content-secondary'
          strokeWidth={1.75}
        />
        <span className='truncate'>{action.label}</span>
      </span>
      {action.shortcut ? (
        <kbd
          aria-hidden='true'
          className='ml-4 shrink-0 font-mono text-ui-caption font-normal text-content-muted'
        >
          {action.shortcut}
        </kbd>
      ) : null}
    </Button>
  )
}

function createNewMarkdownFile() {
  return addNewMarkdownFileEdit({
    fileName: 'new-file.md',
    content: '',
  })
}
