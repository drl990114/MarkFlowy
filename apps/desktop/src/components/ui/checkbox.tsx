import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { CheckIcon, MinusIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { compactControlFocus } from './focus-styles'

export function Checkbox({ className, ...props }: ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        compactControlFocus,
        'peer size-4 shrink-0 cursor-default rounded-[var(--mf-radius-sm)] border border-input bg-background text-primary-foreground transition-colors duration-[var(--mf-motion-duration-fast)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary [&[data-state=indeterminate]_[data-slot=checkbox-check]]:hidden [&[data-state=indeterminate]_[data-slot=checkbox-minus]]:block',
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
