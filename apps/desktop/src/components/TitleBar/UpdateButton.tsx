import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { installUpdate } from '@/helper/updater'
import { useTranslation } from '@/i18n'
import useUpdaterStore from '@/stores/useUpdaterStore'
import { DownloadIcon, LoaderCircleIcon } from 'lucide-react'

export function UpdateButton() {
  const update = useUpdaterStore((state) => state.update)
  const isInstalling = useUpdaterStore((state) => state.isInstalling)
  const { t } = useTranslation()

  if (!update) return null

  const label = isInstalling
    ? t('updater.downloading')
    : `${t('updater.download_and_install')} · v${update.version}`

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-busy={isInstalling}
          aria-label={label}
          className='mx-1 bg-update-action text-update-action-foreground enabled:active:bg-update-action/80'
          data-slot='title-bar-update'
          disabled={isInstalling}
          size='icon-chrome'
          onClick={() => void installUpdate(update)}
        >
          {isInstalling ? (
            <LoaderCircleIcon aria-hidden='true' className='animate-spin motion-reduce:animate-none' />
          ) : (
            <DownloadIcon aria-hidden='true' />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
