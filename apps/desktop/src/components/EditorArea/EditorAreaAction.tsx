import type { ButtonProps } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type { LucideIcon } from 'lucide-react'

export type EditorAreaActionButtonProps = Omit<
  ButtonProps,
  'aria-label' | 'children' | 'size' | 'variant'
> & {
  icon: LucideIcon
  label: string
}

export function EditorAreaActionButton({
  className,
  icon,
  label,
  ...props
}: EditorAreaActionButtonProps) {
  const Icon = icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label={label}
          className={className}
          data-mf-chrome-icon-button=''
          size='icon-chrome'
          variant='chrome'
          {...props}
        >
          <Icon aria-hidden='true' size={14} strokeWidth={1.75} />
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
