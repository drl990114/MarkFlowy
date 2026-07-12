import { Input } from '@/components/ui/input'
import type { FC } from 'react'

export const ReplaceInput: FC<{
  replacement: string
  setReplacement: (query: string) => void
}> = ({ replacement, setReplacement }) => (
  <Input
    aria-label='Replace with'
    className='h-6'
    placeholder='Replace'
    value={replacement}
    onChange={(event) => setReplacement(event.target.value)}
  />
)
