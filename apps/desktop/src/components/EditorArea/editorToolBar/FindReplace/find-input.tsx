import { InputGroup } from '@/components/ui/input-group'
import type { FC } from 'react'
import { useTranslation } from '@/i18n'

export const FindInput: FC<{
  setComposing?: (value: boolean) => void
  query: string
  setQuery: (query: string) => void
  total: number
  activeIndex?: number | null
}> = ({ query, setQuery, total, activeIndex, setComposing }) => {
  const { t } = useTranslation()
  const counterLabel = t('find_replace.result_count', {
    current: total && activeIndex != null ? activeIndex + 1 : 0,
    total,
  })

  return (
    <InputGroup.Root className='h-7'>
      <InputGroup.Input
        aria-label={t('find_replace.find')}
        className='h-full'
        inputSize='sm'
        placeholder={t('find_replace.find')}
        value={query}
        onCompositionStart={() => setComposing?.(true)}
        onCompositionEnd={() => setComposing?.(false)}
        onChange={(event) => setQuery(event.target.value)}
      />
      <InputGroup.Addon align='inline-end' className='min-w-12 justify-center border-l-0 tabular-nums'>
        {counterLabel}
      </InputGroup.Addon>
    </InputGroup.Root>
  )
}
