import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { CircleIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'
import { compactControlFocus } from './focus-styles'

export function RadioGroupRoot({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      className={cn('grid gap-2', className)}
      data-slot='radio-group'
      {...props}
    />
  )
}

export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        compactControlFocus,
        'aspect-square size-4 shrink-0 cursor-default rounded-full border border-input bg-background text-primary transition-colors duration-[var(--mf-motion-duration-fast)] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none data-[state=checked]:border-primary',
        className,
      )}
      data-slot='radio-group-item'
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className='relative flex items-center justify-center'
        data-slot='radio-group-indicator'
      >
        <CircleIcon className='size-2 fill-current' aria-hidden='true' />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  )
}

export const RadioGroup = Object.assign(RadioGroupRoot, {
  Root: RadioGroupRoot,
  Item: RadioGroupItem,
})
