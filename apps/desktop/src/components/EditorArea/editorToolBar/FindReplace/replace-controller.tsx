import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import type { FC } from 'react'

export const ReplaceController: FC<{
  replace: () => void
  replaceAll: () => void
}> = ({ replace, replaceAll }) => {
  return (
    <ButtonGroup.Root>
      <Button className='h-6' type='button' variant='outline' size='sm' onClick={replace}>
        Replace
      </Button>
      <Button className='h-6' type='button' variant='outline' size='sm' onClick={replaceAll}>
        All
      </Button>
    </ButtonGroup.Root>
  )
}
