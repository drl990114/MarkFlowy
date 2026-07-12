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
        className='min-h-[22rem] max-w-[24rem] justify-center gap-0 px-8 py-7'
        closeLabel={t('common.close')}
        size='sm'
      >
        <Dialog.Header className='items-center gap-4 pr-0 text-center'>
          <div className='rounded-[1.25rem] shadow-md ring-1 ring-border'>
            <Logo className='size-[4.5rem]' aria-hidden='true' focusable='false' />
          </div>
          <Dialog.Title className='text-xl'>{appInfo.name}</Dialog.Title>
        </Dialog.Header>

        <Dialog.Body className='mt-6 flex-none overflow-visible text-center'>
          <Dialog.Description asChild>
            <div className='flex flex-col items-center gap-4 text-sm text-foreground-secondary'>
              <div className='flex flex-col items-center gap-0.5'>
                <span className='font-medium text-foreground'>
                  AI-powered cross-platform Markdown editor.
                </span>
                <span>
                  {t('about.version')} {appInfo.version}
                </span>
              </div>
              <span>Powered by Tauri {appInfo.tauriVersion}</span>
              <span className='text-xs'>© 2023–present drl990114</span>
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
