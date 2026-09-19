import { ShortcutKeys as ShortcutKeycaps } from '@/components/ShortcutKeys'
import { useTranslation } from '@/i18n'

export function ShortcutKeys({ keys }: { keys: readonly string[] }) {
  const { t } = useTranslation()

  if (!keys.length) {
    return (
      <span className='text-ui-caption text-muted-foreground'>
        {t('settings.keyboard.unbound')}
      </span>
    )
  }

  return <ShortcutKeycaps keys={keys} />
}
