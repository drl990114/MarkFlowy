import { formatKeyMap } from '@/commands/keybindingKeys'
import { useTranslation } from '@/i18n'

/** Keep display tokens separate: a literal + key must not be split as a separator. */
export function ShortcutKeys({ keys }: { keys: readonly string[] }) {
  const { t } = useTranslation()

  if (!keys.length) {
    return (
      <span className='text-ui-caption text-muted-foreground'>
        {t('settings.keyboard.unbound')}
      </span>
    )
  }

  return (
    <span className='inline-flex flex-wrap items-center gap-1'>
      <span className='sr-only'>{formatKeyMap(keys)}</span>
      {keys.map((key) => (
        <kbd
          key={key}
          aria-hidden='true'
          className='inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-border bg-muted/50 px-1 font-sans text-ui-caption font-normal leading-none text-foreground'
        >
          {formatKeyMap([key])}
        </kbd>
      ))}
    </span>
  )
}
