import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import { commandRegistry } from '@/commands'
import { EVENT } from '@/constants'
import { useWorkspaceOpenError, clearWorkspaceOpenError } from '@/services/workspace-open-error'
import { switchWorkspaceInCurrentWindow } from '@/services/workspace-switch'

export function WorkspaceOpenError() {
  const { path } = useWorkspaceOpenError()
  const { t } = useTranslation()
  const [retrying, setRetrying] = useState(false)
  if (!path) return null
  const retry = async () => {
    setRetrying(true)
    try {
      if (await switchWorkspaceInCurrentWindow(path)) clearWorkspaceOpenError()
    } catch (error) {
      useWorkspaceOpenError.setState({ path, error })
    } finally {
      setRetrying(false)
    }
  }
  return (
    <div
      className='flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border bg-background px-3 py-1 text-ui-control'
      role='alert'
    >
      <span className='min-w-0 flex-1 basis-48 truncate' title={path}>
        {t('startup.workspace_open_failed')} · {path}
      </span>
      <Button size='sm' variant='ghost' disabled={retrying} onClick={() => void retry()}>
        {t('common.retry')}
      </Button>
      <Button
        size='sm'
        variant='ghost'
        onClick={() => void commandRegistry.execute(EVENT.app_openFolder)}
      >
        {t('file.openDir')}
      </Button>
      <Button size='sm' variant='ghost' onClick={clearWorkspaceOpenError}>
        {t('common.close')}
      </Button>
    </div>
  )
}
