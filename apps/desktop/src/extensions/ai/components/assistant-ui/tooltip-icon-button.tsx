import type { ComponentProps } from 'react'
import { Button } from '../ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip'

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
      <TooltipContent side={side}>{tooltip}</TooltipContent>
    </Tooltip>
  )
}
