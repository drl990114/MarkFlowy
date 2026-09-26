import Logo from '@/assets/logo.svg?react'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EVENT } from '@/constants'
import { useTranslation } from '@/i18n'
import { currentWindow } from '@/services/windows'
import useAppInfoStore from '@/stores/useAppInfoStore'
import { writeText } from '@tauri-apps/plugin-clipboard-manager'
import { CopyIcon } from 'lucide-react'
import type { FC } from 'react'
import { memo, useCallback, useEffect, useState } from 'react'

const AboutDialog: FC = () => {
  const [open, setOpen] = useState(false)
  const { appInfo } = useAppInfoStore()
  const { t } = useTranslation()

  useEffect(() => {
    const unlisten = currentWindow.listen(EVENT.app_about, () => setOpen(true))
    return () => {
      unlisten.then((fn) => fn())
    }
  }, [])

  const getAppInfoDesc = useCallback(() => {
    return `
AppName: ${appInfo.name}
Version: ${appInfo.version}
TauriVersion: ${appInfo.tauriVersion}
`
  }, [appInfo])

  const handleCopyAppInfo = useCallback(() => {
    void writeText(getAppInfoDesc())
    setOpen(false)
  }, [getAppInfoDesc])

  const handleClose = useCallback(() => setOpen(false), [])

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) handleClose()
      }}
    >
      <Dialog.Content
        className='max-w-[22rem] justify-center gap-0 px-6 py-6'
        closeLabel={t('common.close')}
        size='sm'
      >
        <Dialog.Header className='items-center gap-3 pr-0 text-center'>
          <div className='rounded-xl'>
            <Logo className='size-14' aria-hidden='true' focusable='false' />
          </div>
          <Dialog.Title className='text-ui-title'>{appInfo.name}</Dialog.Title>
        </Dialog.Header>

        <Dialog.Body className='mt-4 mb-5 flex-none overflow-visible text-center'>
          <Dialog.Description asChild>
            <div className='flex flex-col items-center gap-3 text-ui-control text-foreground-secondary'>
              <div className='flex flex-col items-center gap-0.5'>
                <span className='font-medium text-foreground'>{t('about.description')}</span>
                <span>
                  {t('about.version')} {appInfo.version}
                </span>
              </div>
              <span>{t('about.powered_by_tauri', { version: appInfo.tauriVersion })}</span>
              <span className='text-ui-caption'>© 2023–present drl990114</span>
            </div>
          </Dialog.Description>
        </Dialog.Body>

        <Button
          aria-label={t('common.copy')}
          className='absolute right-3 bottom-3 text-foreground-secondary hover:text-foreground'
          onClick={handleCopyAppInfo}
          size='icon-sm'
          title={t('common.copy')}
          variant='ghost'
        >
          <CopyIcon className='size-3.5' aria-hidden='true' />
        </Button>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export default memo(AboutDialog)
