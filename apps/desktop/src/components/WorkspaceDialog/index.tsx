import { commandRegistry } from '@/commands'
import { Dialog } from '@/components/ui/dialog'
import { getWorkspace, type WorkSpace } from '@/services/workspace'
import { t } from '@/i18n'
import { LoaderCircleIcon } from 'lucide-react'
import { memo, useCallback, useEffect, useState } from 'react'

export const WorkspaceDialog = memo(() => {
  const [open, setOpen] = useState(false)
  const [workspace, setWorkspace] = useState<WorkSpace | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: 'open_workspace_dialog',
      handler: () => {
        setIsLoading(true)
        setOpen(true)
        void getWorkspace()
          .then((nextWorkspace) => {
            setWorkspace(nextWorkspace)
          })
          .finally(() => setIsLoading(false))
      },
    })

    return () => disposable.dispose()
  }, [])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <Dialog.Content aria-describedby={undefined} closeLabel={t('common.close')} size='lg'>
        <Dialog.Header>
          <Dialog.Title>{t('workspace.info')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body aria-busy={isLoading} aria-live='polite'>
          {isLoading ? (
            <div
              className='flex items-center gap-2 rounded-lg border border-border bg-muted p-4 text-foreground-secondary'
            >
              <LoaderCircleIcon className='size-4 animate-spin' aria-hidden='true' />
              <span>{t('common.fetching')}</span>
            </div>
          ) : workspace?.rootPath ? (
            <div className='flex items-start gap-3 rounded-lg border border-border bg-muted p-4'>
              <i
                aria-hidden='true'
                className='ri-folder-5-line mt-0.5 shrink-0 text-base text-primary'
              />
              <span className='min-w-0 break-all text-foreground'>{workspace.rootPath}</span>
            </div>
          ) : (
            <div className='rounded-lg border border-border bg-muted p-4 text-foreground-secondary'>
              {t('workspace.none')}
            </div>
          )}
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  )
})
