import { commandRegistry } from '@/commands'
import { Dialog } from '@/components/ui/dialog'
import { EVENT } from '@/constants'
import type { OpenSettingTarget } from '@/extensions/ai/aiProvidersService'
import { Setting } from '@/router'
import { memo, useCallback, useEffect, useState } from 'react'
import { useTranslation } from '@/i18n'

export const SettingDialog = memo(() => {
  const [open, setOpen] = useState(false)
  const [navigationRequest, setNavigationRequest] = useState<{
    id: number
    target?: OpenSettingTarget
  }>({ id: 0 })
  const { t } = useTranslation()

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: EVENT.app_openSetting,
      handler: (target?: OpenSettingTarget) => {
        setNavigationRequest((current) => ({
          id: current.id + 1,
          target: target?.category === 'ai' ? { ...target } : undefined,
        }))
        setOpen(true)
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
      <Dialog.Content
        aria-describedby={undefined}
        className='h-[90vh] w-[86vw] max-w-[80rem] gap-0 p-0'
        closeLabel={t('common.close')}
        size='full'
      >
        <Dialog.Header className='border-b border-border py-4 pr-14 pl-6'>
          <Dialog.Title>{t('settings.label')}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body className='overflow-hidden p-4 text-foreground'>
          <Setting key={navigationRequest.id} navigationRequest={navigationRequest} />
        </Dialog.Body>
      </Dialog.Content>
    </Dialog.Root>
  )
})
