import { InputGroup } from '@/components/ui/input-group'
import type { FC } from 'react'

export const FindInput: FC<{
  query: string
  setQuery: (query: string) => void
  total: number
  activeIndex?: number | null
}> = ({ query, setQuery, total, activeIndex }) => {
  const counterLabel = `${total && activeIndex != null ? activeIndex + 1 : 0} of ${total}`

  return (
    <InputGroup.Root>
      <InputGroup.Input
        aria-label='Find'
        className='h-6'
        placeholder='Find'
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <InputGroup.Addon align='inline-end'>{counterLabel}</InputGroup.Addon>
    </InputGroup.Root>
  )
}
