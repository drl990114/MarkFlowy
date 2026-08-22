import { EllipsisIcon } from 'lucide-react'
import { useTranslation } from '@/i18n'
import { Popover } from '@/components/ui/popover'
import { EditorCount } from './EditorCount'
import { StatusBarButton } from './StatusBarButton'

export function StatusOverflow() {
  const { t } = useTranslation()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <StatusBarButton aria-label={t('action.more')} format='icon'>
          <EllipsisIcon aria-hidden='true' size={14} strokeWidth={1.75} />
        </StatusBarButton>
      </Popover.Trigger>
      <Popover.Content align='start' className='min-w-44 p-1' side='top'>
        <div className='flex flex-col items-stretch gap-0.5 [&_[data-mf-status-bar-button]]:h-7 [&_[data-mf-status-bar-button]]:w-full [&_[data-mf-status-bar-button]]:justify-start [&_[data-mf-status-bar-button]]:px-2'>
          <EditorCount />
        </div>
      </Popover.Content>
    </Popover.Root>
  )
}
