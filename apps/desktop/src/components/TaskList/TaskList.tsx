import useAppTasksStore from '@/stores/useTasksStore'
import { memo } from 'react'
import { PromiseStatus } from '@markflowy/interface'
import { CircleAlertIcon, CheckIcon, LoaderCircleIcon } from 'lucide-react'
import { useTranslation } from '@/i18n'

export const TaskList = memo(() => {
  const { t } = useTranslation()
  const { taskList } = useAppTasksStore()
  const recentTask = taskList[0]
  if (!recentTask) return null

  const status = recentTask.status as PromiseStatus
  const statusLabel =
    status === PromiseStatus.Rejected
      ? t('common.error')
      : status === PromiseStatus.Resolved
        ? t('common.success')
        : t('common.fetching')

  return (
    <div
      aria-label={`${recentTask.title}: ${statusLabel}`}
      aria-live={status === PromiseStatus.Rejected ? 'assertive' : 'polite'}
      className='flex min-w-[18px] max-w-48 items-center gap-1 overflow-hidden text-ui-caption text-content-secondary max-[719px]:max-w-24'
      role='status'
      title={recentTask.title}
    >
      {status === PromiseStatus.Rejected ? (
        <CircleAlertIcon aria-hidden='true' className='size-3.5 shrink-0 text-destructive' />
      ) : status === PromiseStatus.Resolved ? (
        <CheckIcon aria-hidden='true' className='size-3.5 shrink-0 text-success' />
      ) : (
        <LoaderCircleIcon
          aria-hidden='true'
          className='size-3.5 shrink-0 animate-spin motion-reduce:animate-none'
        />
      )}
      <span className='min-w-0 truncate'>{recentTask.title}</span>
    </div>
  )
})
