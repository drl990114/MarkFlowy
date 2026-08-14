import type { ButtonProps } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/cn'

export type EditorAreaActionButtonProps = Omit<ButtonProps, 'aria-label' | 'children'> & {
  icon: string
  label: string
}

export function EditorAreaActionButton({
  className,
  icon,
  label,
  ...props
}: EditorAreaActionButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className={cn('size-6 rounded-sm text-foreground-secondary', className)}
          size='icon-sm'
          variant='ghost'
          {...props}
        >
          <i aria-hidden='true' className={icon} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

export function EditorAreaActionSeparator() {
  return (
    <span
      aria-hidden='true'
      className='mx-1 h-4 w-px shrink-0 bg-[var(--mf-ui-border-subtle)]'
    />
  )
}
