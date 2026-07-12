import { RadioGroup as RadioGroupPrimitive } from 'radix-ui'
import { CircleIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

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
        'aspect-square size-4 shrink-0 rounded-full border border-input bg-background text-primary shadow-sm outline-none transition-[color,box-shadow,border-color] focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
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
