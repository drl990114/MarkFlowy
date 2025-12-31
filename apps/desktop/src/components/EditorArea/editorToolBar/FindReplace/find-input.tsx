import { Input } from 'antd'
import type { FC } from 'react'

export const FindInput: FC<{
  query: string
  setQuery: (query: string) => void
  total: number
  activeIndex?: number | null
}> = ({ query, setQuery, total, activeIndex }) => {
  const counterLabel = `${total && activeIndex != null ? activeIndex + 1 : 0} of ${total}`

  return (
    <Input
      placeholder='Find'
      value={query}
      onChange={(event) => setQuery(event.target.value)}
      size='small'
      suffix={<div>{counterLabel}</div>}
    />
  )
}
