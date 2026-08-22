import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { cva, type VariantProps } from 'class-variance-authority'

const statusBarButtonVariants = cva(
  'h-[22px] min-w-[22px] cursor-pointer gap-1 rounded-sm px-1 text-ui-caption font-normal leading-[var(--mf-ui-line-height-caption)] tracking-[var(--mf-ui-tracking-caption)] text-content-secondary transition-[color,background-color,border-color,box-shadow,opacity] duration-[var(--mf-motion-duration-fast)] ease-[var(--mf-motion-ease-out)] hover:bg-control-ghost-hover hover:text-content-primary focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 active:scale-100 active:bg-control-ghost-pressed active:text-content-primary motion-reduce:transform-none [&_svg]:size-3.5',
  {
    variants: {
      format: {
        icon: 'w-[22px] px-0 text-sm',
        label: 'max-w-full whitespace-nowrap',
      },
    },
    defaultVariants: {
      format: 'label',
    },
  },
)

type StatusBarButtonProps = Omit<ButtonProps, 'size' | 'variant'> &
  VariantProps<typeof statusBarButtonVariants>

export function StatusBarButton({ className, format, ...props }: StatusBarButtonProps) {
  const resolvedFormat = format ?? 'label'

  return (
    <Button
      className={cn(statusBarButtonVariants({ format: resolvedFormat }), className)}
      data-mf-status-bar-button=''
      data-mf-status-bar-format={resolvedFormat}
      size='sm'
      variant='chrome'
      {...props}
    />
  )
}
