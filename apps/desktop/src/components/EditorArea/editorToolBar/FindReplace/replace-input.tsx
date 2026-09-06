import { Input } from '@/components/ui/input'
import type { FC } from 'react'
import { useTranslation } from '@/i18n'

export const ReplaceInput: FC<{
  replacement: string
  setReplacement: (query: string) => void
}> = ({ replacement, setReplacement }) => {
  const { t } = useTranslation()

  return (
    <Input
      aria-label={t('find_replace.replace_with')}
      className='h-6'
      placeholder={t('find_replace.replace')}
      value={replacement}
      onChange={(event) => setReplacement(event.target.value)}
    />
  )
}
