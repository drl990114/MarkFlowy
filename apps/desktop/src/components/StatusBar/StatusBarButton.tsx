import { Button, type ButtonProps } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { cva, type VariantProps } from 'class-variance-authority'

const statusBarButtonVariants = cva(
  'h-[22px] min-w-[22px] cursor-pointer rounded-sm px-1.5 text-ui-caption font-normal leading-[var(--mf-ui-line-height-caption)] tracking-[var(--mf-ui-tracking-caption)] text-foreground-secondary transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[var(--mf-ui-control-hover-bg)] hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-0 active:scale-[0.97] motion-reduce:transform-none',
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
  return (
    <Button
      className={cn(statusBarButtonVariants({ format }), className)}
      data-mf-status-bar-button=''
      size='sm'
      variant='ghost'
      {...props}
    />
  )
}
