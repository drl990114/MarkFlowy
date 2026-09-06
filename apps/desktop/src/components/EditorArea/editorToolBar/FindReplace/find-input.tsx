import { InputGroup } from '@/components/ui/input-group'
import type { FC } from 'react'
import { useTranslation } from '@/i18n'

export const FindInput: FC<{
  query: string
  setQuery: (query: string) => void
  total: number
  activeIndex?: number | null
}> = ({ query, setQuery, total, activeIndex }) => {
  const { t } = useTranslation()
  const counterLabel = t('find_replace.result_count', {
    current: total && activeIndex != null ? activeIndex + 1 : 0,
    total,
  })

  return (
    <InputGroup.Root>
      <InputGroup.Input
        aria-label={t('find_replace.find')}
        className='h-6'
        placeholder={t('find_replace.find')}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <InputGroup.Addon align='inline-end'>{counterLabel}</InputGroup.Addon>
    </InputGroup.Root>
  )
}
