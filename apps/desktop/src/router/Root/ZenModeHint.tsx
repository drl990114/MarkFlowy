import { keybindingRegistry } from '@/commands'
import { EVENT } from '@/constants'
import { useTranslation } from '@/i18n'
import { useEffect, useState } from 'react'
import { ZEN_MODE_HINT_DURATION_MS } from './zenMode'

interface ZenModeHintProps {
  active: boolean
}

export function ZenModeHint(props: ZenModeHintProps) {
  const { active } = props
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!active) {
      setVisible(false)
      return
    }

    setVisible(true)
    const timeoutId = window.setTimeout(() => setVisible(false), ZEN_MODE_HINT_DURATION_MS)

    return () => window.clearTimeout(timeoutId)
  }, [active])

  if (!active || !visible) return null

  const shortcut =
    keybindingRegistry.formatKeybinding(EVENT.app_toggleZenMode) ?? t('zenMode.shortcutFallback')

  return (
    <div
      aria-atomic='true'
      aria-live='polite'
      className='pointer-events-none fixed left-1/2 top-3 -translate-x-1/2 rounded-md border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground shadow-sm'
      data-mf-zen-mode-hint=''
      role='status'
    >
      {t('zenMode.exitHint', { shortcut })}
    </div>
  )
}
