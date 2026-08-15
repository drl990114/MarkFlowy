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
      <Dialog.Content aria-describedby={undefined} closeLabel={t('common.close')}>
        <Dialog.Header>
          <Dialog.Title>{t('workspace.info')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body aria-busy={isLoading} aria-live='polite'>
          {isLoading ? (
            <div className='flex items-center gap-2 text-foreground-secondary'>
              <LoaderCircleIcon className='size-4 animate-spin' aria-hidden='true' />
              <span>{t('common.fetching')}</span>
            </div>
          ) : workspace?.rootPath ? (
            <div className='flex min-w-0 items-start gap-2'>
              <span className='shrink-0'>{t('file.path')}:</span>
              <span
                className='min-w-0 select-text text-foreground [overflow-wrap:anywhere]'
                dir='ltr'
              >
                {workspace.rootPath}
              </span>
            </div>
          ) : (
            <span>{t('workspace.none')}</span>
          )}
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  )
})
