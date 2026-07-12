import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type TooltipIconButtonProps = ComponentProps<typeof Button> & {
  tooltip: string
  side?: ComponentProps<typeof TooltipContent>['side']
}

export function TooltipIconButton({ tooltip, side = 'top', ...props }: TooltipIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={props['aria-label'] ?? tooltip}
          size='icon'
          type='button'
          variant='ghost'
          {...props}
        />
      </TooltipTrigger>
      <TooltipContent className='aui-tooltip-content' side={side}>
        {tooltip}
      </TooltipContent>
    </Tooltip>
  )
}
