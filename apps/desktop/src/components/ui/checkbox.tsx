import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { CheckIcon, MinusIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        'peer size-4 shrink-0 rounded-[var(--mf-radius-sm)] border border-input bg-background text-primary-foreground shadow-sm outline-none transition-[color,background-color,border-color,box-shadow] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary [&[data-state=indeterminate]_[data-slot=checkbox-check]]:hidden [&[data-state=indeterminate]_[data-slot=checkbox-minus]]:block',
        className,
      )}
      data-slot='checkbox'
      {...props}
    >
      <CheckboxPrimitive.Indicator
        className='flex items-center justify-center text-current'
        data-slot='checkbox-indicator'
      >
        <CheckIcon className='size-3' aria-hidden='true' data-slot='checkbox-check' />
        <MinusIcon className='hidden size-3' aria-hidden='true' data-slot='checkbox-minus' />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
