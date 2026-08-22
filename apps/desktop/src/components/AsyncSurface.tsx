import type { ReactNode } from 'react'
import { AlertCircleIcon, LoaderCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export type AsyncSurfaceState<T> =
  | { status: 'loading'; label?: ReactNode }
  | { status: 'empty'; description?: ReactNode; title: ReactNode }
  | {
      status: 'error'
      action?: ReactNode
      description?: ReactNode
      retry?: () => void
      title: ReactNode
    }
  | { status: 'blocked'; action?: ReactNode; description?: ReactNode; title: ReactNode }
  | { status: 'ready'; data: T }

export interface AsyncSurfaceProps<T> {
  children: (data: T) => ReactNode
  retryLabel?: ReactNode
  state: AsyncSurfaceState<T>
}

export function AsyncSurface<T>({ children, retryLabel = 'Retry', state }: AsyncSurfaceProps<T>) {
  if (state.status === 'ready') return children(state.data)

  if (state.status === 'loading') {
    return (
      <div
        aria-live='polite'
        className='flex min-h-24 flex-1 items-center justify-center gap-2 text-ui-caption text-muted-foreground'
        role='status'
      >
        <LoaderCircleIcon aria-hidden='true' className='animate-spin motion-reduce:animate-none' size={14} />
        {state.label ? <span>{state.label}</span> : null}
      </div>
    )
  }

  const isError = state.status === 'error'
  const retry = 'retry' in state ? state.retry : undefined
  const action = 'action' in state ? state.action : undefined

  return (
    <Empty aria-live={isError ? 'assertive' : 'polite'} role={isError ? 'alert' : 'status'}>
      <EmptyHeader>
        {isError ? (
          <EmptyMedia>
            <AlertCircleIcon aria-hidden='true' size={16} />
          </EmptyMedia>
        ) : null}
        <EmptyTitle>{state.title}</EmptyTitle>
        {state.description ? <EmptyDescription>{state.description}</EmptyDescription> : null}
      </EmptyHeader>
      {retry || action ? (
        <EmptyContent>
          {retry ? (
            <Button onClick={retry} size='sm' variant='outline'>
              {retryLabel}
            </Button>
          ) : null}
          {action}
        </EmptyContent>
      ) : null}
    </Empty>
  )
}
