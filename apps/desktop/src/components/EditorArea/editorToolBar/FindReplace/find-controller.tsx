import { IconButton } from '@mui/material'
import type { FC } from 'react'

export const FindController: FC<{
  findPrev: () => void;
  findNext: () => void;
  stopFind: () => void;
  caseSensitive: boolean;
  toggleCaseSensitive: () => void;
  onDismiss?: () => void;
}> = ({ findPrev, findNext, stopFind, caseSensitive, toggleCaseSensitive, onDismiss }) => (
  <>
    <IconButton
      onClick={findPrev}
      size='small'
      title='Next Match (Enter)'
      aria-label='Next Match (Enter)'
    >
      <i className='ri-arrow-left-s-fill' />
    </IconButton>
    <IconButton
      onClick={findNext}
      size='small'
      title='Previous Match (Shift+Enter)'
      aria-label='Previous Match (Shift+Enter)'
    >
      <i className='ri-arrow-right-s-fill' />
    </IconButton>
    <IconButton
      onClick={toggleCaseSensitive}
      size='small'
      color={caseSensitive ? 'primary' : 'default'}
      title='Match Case'
      aria-label='Match Case'
    >
      <i className='ri-font-size' />
    </IconButton>
    <IconButton
      onClick={() => {
        stopFind()
        onDismiss?.()
      }}
      size='small'
    >
      <i className="ri-close-line" />
    </IconButton>
  </>
)
