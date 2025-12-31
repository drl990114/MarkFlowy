import { Input } from 'antd'
import type { FC } from 'react'

export const ReplaceInput: FC<{
  replacement: string
  setReplacement: (query: string) => void
}> = ({ replacement, setReplacement }) => (
  <Input
    placeholder='Replace'
    value={replacement}
    onChange={(event) => setReplacement(event.target.value)}
    size='small'
  />
)
