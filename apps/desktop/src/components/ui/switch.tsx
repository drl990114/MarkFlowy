import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-control-surface shadow-sm outline-none transition-colors duration-[var(--mf-motion-duration-base)] ease-[var(--mf-motion-ease-out)] focus-visible:border-control-focus focus-visible:ring-2 focus-visible:ring-control-focus/25 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none data-[state=checked]:bg-primary',
        className,
      )}
      data-slot='switch'
      {...props}
    >
      <SwitchPrimitive.Thumb
        className='pointer-events-none block size-4 rounded-full bg-surface-app shadow-sm transition-transform duration-[var(--mf-motion-duration-base)] ease-[var(--mf-motion-ease-out)] motion-reduce:transition-none data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0'
        data-slot='switch-thumb'
      />
    </SwitchPrimitive.Root>
  )
}
