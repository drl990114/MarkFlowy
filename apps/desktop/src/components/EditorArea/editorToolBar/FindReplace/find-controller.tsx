import { Button } from '@/components/ui/button'
import { Toggle } from '@/components/ui/toggle'
import type { FC } from 'react'

export const FindController: FC<{
  findPrev: () => void
  findNext: () => void
  stopFind: () => void
  caseSensitive: boolean
  toggleCaseSensitive: () => void
  onDismiss?: () => void
}> = ({ findPrev, findNext, stopFind, caseSensitive, toggleCaseSensitive, onDismiss }) => (
  <div className='flex items-center gap-2'>
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className='size-6 rounded-full'
      aria-label='Find previous match'
      onClick={findPrev}
    >
      <i className='ri-arrow-left-s-fill' aria-hidden='true' />
    </Button>
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className='size-6 rounded-full'
      aria-label='Find next match'
      onClick={findNext}
    >
      <i className='ri-arrow-right-s-fill' aria-hidden='true' />
    </Button>
    <Toggle
      pressed={caseSensitive}
      onPressedChange={toggleCaseSensitive}
      className='size-6 min-w-6 rounded-full p-0'
      aria-label='Match case'
    >
      <i className='ri-font-size' aria-hidden='true' />
    </Toggle>
    <Button
      type='button'
      variant='ghost'
      size='icon'
      className='size-6 rounded-full'
      aria-label='Close find and replace'
      onClick={() => {
        stopFind()
        onDismiss?.()
      }}
    >
      <i className='ri-close-line' aria-hidden='true' />
    </Button>
  </div>
)
