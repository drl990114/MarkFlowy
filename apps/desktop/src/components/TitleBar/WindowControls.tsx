import { Button } from '@/components/ui/button'
import { useTranslation } from '@/i18n'
import { currentWindow } from '@/services/windows'
import { CopyIcon, MinusIcon, SquareIcon, XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

export function WindowControls() {
  const { t } = useTranslation()
  const [maximized, setMaximized] = useState(false)

  useEffect(() => {
    let active = true
    const syncMaximizedState = async () => {
      try {
        const nextMaximized = await currentWindow.isMaximized()
        if (active) setMaximized(nextMaximized)
      } catch {
        // The native window state is unavailable in browser-only previews.
      }
    }

    void syncMaximizedState()
    const unlisten = currentWindow.onResized(() => {
      void syncMaximizedState()
    })

    return () => {
      active = false
      void unlisten.then((dispose) => dispose())
    }
  }, [])

  return (
    <div className='flex h-full shrink-0 items-stretch' data-mf-window-controls=''>
      <Button
        aria-label={t('titleBar.minimize')}
        className='h-full w-11 rounded-none focus-visible:z-10'
        size='icon'
        variant='chrome'
        onClick={() => void currentWindow.minimize()}
      >
        <MinusIcon aria-hidden='true' className='size-3.5' />
      </Button>
      <Button
        aria-label={maximized ? t('titleBar.restore') : t('titleBar.maximize')}
        className='h-full w-11 rounded-none focus-visible:z-10'
        size='icon'
        variant='chrome'
        onClick={() => void currentWindow.toggleMaximize()}
      >
        {maximized ? (
          <CopyIcon aria-hidden='true' className='size-3' />
        ) : (
          <SquareIcon aria-hidden='true' className='size-3' />
        )}
      </Button>
      <Button
        aria-label={t('common.close')}
        className='h-full w-11 rounded-none focus-visible:z-10 hover:bg-destructive hover:text-destructive-foreground'
        size='icon'
        variant='chrome'
        onClick={() => void currentWindow.close()}
      >
        <XIcon aria-hidden='true' className='size-3.5' />
      </Button>
    </div>
  )
}
