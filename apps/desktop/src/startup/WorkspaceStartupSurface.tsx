import { AsyncSurface } from '@/components/AsyncSurface'
import { Button } from '@/components/ui/button'
import { useDockViewportMode } from '@/hooks/useDockViewportMode'
import { t } from '@/i18n'
import useLayoutStore from '@/stores/useLayoutStore'
import { StartupProgress } from './StartupProgress'
import type { StartupPhaseState } from './startupCoordinator'
import type { ReactNode } from 'react'

interface WorkspaceStartupSurfaceProps {
  children: ReactNode
  chooseWorkspace?: () => void
  retry: () => void
  state: StartupPhaseState<void>
}

export const getStartupErrorDescription = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'An unexpected startup error occurred.'
}

export function WorkspaceStartupSurface({
  children,
  chooseWorkspace,
  retry,
  state,
}: WorkspaceStartupSurfaceProps) {
  const viewportMode = useDockViewportMode()
  const leftDock = useLayoutStore((layout) => layout.leftBar)
  const rightDock = useLayoutStore((layout) => layout.rightBar)

  if (state.status === 'ready') return children

  const errorState =
    state.status === 'error'
      ? {
          status: 'error' as const,
          title: 'Unable to open the workspace',
          description: getStartupErrorDescription(state.error),
          retry,
          action: chooseWorkspace ? (
            <Button onClick={chooseWorkspace} size='sm'>
              {t('file.openDir')}
            </Button>
          ) : undefined,
        }
      : undefined

  return (
    <div
      className='flex h-full min-h-0 w-full flex-col overflow-hidden bg-surface-app'
      data-mf-workspace-startup={state.status === 'error' ? 'error' : 'loading'}
    >
      <div className='flex min-h-0 flex-1'>
        {viewportMode !== 'compact' && leftDock.visible ? (
          <aside
            aria-hidden='true'
            className='shrink-0 border-r border-border bg-surface-panel-left'
            data-mf-workspace-shell='left-dock'
            style={{ width: leftDock.size }}
          />
        ) : null}
        <main className='flex min-w-0 flex-1 bg-surface-app' data-mf-workspace-shell='editor'>
          {errorState ? (
            <AsyncSurface retryLabel={t('common.retry')} state={errorState}>
              {() => null}
            </AsyncSurface>
          ) : (
            <StartupProgress label={t('common.fetching')} />
          )}
        </main>
        {viewportMode === 'wide' && rightDock.visible ? (
          <aside
            aria-hidden='true'
            className='shrink-0 border-l border-border bg-surface-panel-right'
            data-mf-workspace-shell='right-dock'
            style={{ width: rightDock.size }}
          />
        ) : null}
      </div>
      <div
        aria-hidden='true'
        className='h-[var(--mf-ui-status-bar-height)] shrink-0 border-t border-border bg-surface-titlebar'
        data-mf-workspace-shell='status-bar'
      />
    </div>
  )
}
