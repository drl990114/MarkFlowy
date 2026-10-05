import { commandRegistry } from '@/commands'
import { DeferredSurface } from '@/components/DeferredSurface'
import { scheduleActiveEditorFocus } from '@/components/EditorArea/focusActiveEditor'
import { Dialog } from '@/components/ui/dialog'
import { EVENT } from '@/constants'
import { resolveFileExcludePatterns } from '@/helper/file-exclude'
import { useTranslation } from '@/i18n'
import useAppSettingStore from '@/stores/useAppSettingStore'
import useEditorStore from '@/stores/useEditorStore'
import { useEffect, useRef, useState } from 'react'

const loadQuickOpen = () => import('./QuickOpenContent')

export function QuickOpenDialog() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const openedFileRef = useRef(false)
  const rootPath = useEditorStore((state) => state.folderData?.[0]?.path)
  const fileExcludePatterns = useAppSettingStore((state) =>
    resolveFileExcludePatterns(state.settingData),
  )

  useEffect(() => {
    const disposable = commandRegistry.registerCommand({
      id: EVENT.app_quickOpen,
      label: t('quick_open.title'),
      category: 'File',
      handler: () => {
        setOpen(true)
        inputRef.current?.focus()
        inputRef.current?.select()
      },
    })
    return () => disposable.dispose()
  }, [t])

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Content
        className='top-[min(18vh,8rem)] translate-y-0 gap-0 p-0'
        closeLabel={t('common.close')}
        data-mf-quick-open=''
        onCloseAutoFocus={(event) => {
          if (!openedFileRef.current) return
          openedFileRef.current = false
          event.preventDefault()
          scheduleActiveEditorFocus()
        }}
        onEscapeKeyDown={(event) => {
          if (event.isComposing || event.keyCode === 229) event.preventDefault()
        }}
      >
        <Dialog.Title className='sr-only'>{t('quick_open.title')}</Dialog.Title>
        <Dialog.Description className='sr-only'>{t('quick_open.placeholder')}</Dialog.Description>
        {open ? (
          <DeferredSurface
            load={loadQuickOpen}
            loadingLabel={t('common.fetching')}
            errorTitle={t('common.error')}
            retryLabel={t('common.retry')}
          >
            {({ QuickOpenContent, openQuickOpenFile }) => (
              <QuickOpenContent
                key={`${rootPath ?? ''}\n${fileExcludePatterns}`}
                rootPath={rootPath}
                fileExcludePatterns={fileExcludePatterns}
                inputRef={inputRef}
                onSelect={(entry) => {
                  if (!openQuickOpenFile(entry)) return
                  openedFileRef.current = true
                  setOpen(false)
                }}
              />
            )}
          </DeferredSurface>
        ) : null}
      </Dialog.Content>
    </Dialog.Root>
  )
}
